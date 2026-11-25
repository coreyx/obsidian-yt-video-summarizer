import OpenAI from 'openai';
import { AIModelProvider, GenerateTopicsOptions } from 'src/types';
import { buildTopicGenerationPrompt, parseTopicTags } from '../../utils/vaultTags';
import { buildVideoTopicsPrompt, parseVideoTopics } from '../../utils/videoTopics';

import { normalizeOpenAIBaseUrl } from '../lmStudio';
import { obsidianFetch } from '../../utils/obsidianFetch';

/**
 * Builds the Chat Completions request for a text prompt. Uses `max_completion_tokens` (the current
 * parameter), and leaves out `temperature` for OpenAI reasoning models (o1, o3, o4), which reject it.
 */
export function buildChatCompletionParams(model: string, prompt: string, maxTokens: number, temperature: number): any {
    const params: any = {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: maxTokens,
    };
    if (!/^(o[134])/i.test(model)) {
        params.temperature = temperature;
    }
    return params;
}

/**
 * Returns a copy of `params` that sends the token limit as the older `max_tokens` when `error` shows the
 * server rejected `max_completion_tokens` (common for legacy or OpenAI-compatible servers), or `null` when
 * the error is about something else and retrying wouldn't help.
 */
export function toLegacyMaxTokensParams(params: any, error: unknown): any | null {
    const errMsg = String((error as any)?.message || error || '').toLowerCase();
    const rejectedParameter =
        errMsg.includes('max_completion_tokens') ||
        errMsg.includes('extra fields') ||
        errMsg.includes('unrecognized') ||
        errMsg.includes('unknown parameter') ||
        errMsg.includes('unsupported parameter');
    if (params.max_completion_tokens === undefined || !rejectedParameter) {
        return null;
    }
    const fallbackParams = { ...params, max_tokens: params.max_completion_tokens };
    delete fallbackParams.max_completion_tokens;
    return fallbackParams;
}

export class OpenAIProvider implements AIModelProvider {
    private client: OpenAI;
    private model: string;
    private maxTokens: number;
    private temperature: number;

    constructor(
        apiKey: string,
        model: string,
        maxTokens: number,
        temperature: number,
        baseUrl?: string
    ) {
        this.client = new OpenAI({
            apiKey: (apiKey && apiKey.trim()) ? apiKey.trim() : 'not-needed',
            baseURL: baseUrl ? normalizeOpenAIBaseUrl(baseUrl) : undefined,
            dangerouslyAllowBrowser: true, // required to run inside the browser-like Obsidian
            fetch: obsidianFetch // local servers (LM Studio, Ollama) don't allow app://obsidian.md via CORS
        });
        this.model = model;
        this.maxTokens = maxTokens;
        this.temperature = temperature;
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.client.models.retrieve(this.model);
            return true;
        } catch (error) {
            // Fallback for OpenAI-compatible servers (e.g. LM Studio, Ollama) that only support models.list()
            try {
                const list = await this.client.models.list();
                if (list) return true;
            } catch (listErr) {
                console.error('OpenAI connection test failed:', error, listErr);
            }
            return false;
        }
    }

    private async createChatCompletion(params: any): Promise<any> {
        try {
            return await this.client.chat.completions.create(params);
        } catch (error: any) {
            const fallbackParams = toLegacyMaxTokensParams(params, error);
            if (fallbackParams) {
                return await this.client.chat.completions.create(fallbackParams);
            }
            throw error;
        }
    }

    async summarizeVideo(videoId: string, prompt: string): Promise<string> {
        try {
            const completion = await this.createChatCompletion(
                buildChatCompletionParams(this.model, prompt, this.maxTokens, this.temperature)
            );

            let text = completion.choices[0]?.message?.content || '';
            
            if (completion.choices[0]?.finish_reason === 'length') {
                text += '\n\n[Summary truncated due to max token limit. Please increase "Max Tokens" in settings.]';
            }

            return text;
        } catch (error) {
            console.error('Error generating summary with OpenAI:', error);
            throw error;
        }
    }

    async extractThumbnailText(imageBase64: string, mimeType = 'image/jpeg'): Promise<string> {
        try {
            const completion = await this.createChatCompletion({
                model: this.model,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: "Extract and transcribe all text visible in this YouTube video thumbnail image. Return ONLY the transcribed text without quotes, markdown headers, or introductory text. If no text is visible, reply with nothing."
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType};base64,${imageBase64}`
                                }
                            }
                        ]
                    }
                ],
                max_completion_tokens: 200,
            });
            return completion.choices[0]?.message?.content?.trim() || '';
        } catch (error) {
            console.warn('OpenAI thumbnail vision extraction failed or not supported by current model:', error);
            return '';
        }
    }

    async generateTopics(summaryText: string, options?: GenerateTopicsOptions): Promise<string[]> {
        try {
            const prompt = buildTopicGenerationPrompt(summaryText, options);
            const completion = await this.createChatCompletion(buildChatCompletionParams(this.model, prompt, 200, 0.2));
            return parseTopicTags(completion.choices[0]?.message?.content || '');
        } catch (error) {
            console.warn('OpenAI topic tag generation failed:', error);
            return [];
        }
    }

    async inferVideoTopics(transcriptText: string, title?: string): Promise<string[]> {
        try {
            const prompt = buildVideoTopicsPrompt(transcriptText, title);
            const completion = await this.createChatCompletion(buildChatCompletionParams(this.model, prompt, 200, 0.2));
            return parseVideoTopics(completion.choices[0]?.message?.content || '');
        } catch (error) {
            console.warn('OpenAI video topic inference failed:', error);
            return [];
        }
    }
}
