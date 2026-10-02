import OpenAI from 'openai';
import { AIModelProvider } from 'src/types';

import { normalizeOpenAIBaseUrl } from '../lmStudio';

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
            dangerouslyAllowBrowser: true // required to run inside the browser-like Obsidian
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
            // If a legacy or custom OpenAI-compatible server rejects max_completion_tokens, fall back to max_tokens
            const errMsg = String(error?.message || error || '').toLowerCase();
            if (
                params.max_completion_tokens !== undefined &&
                (errMsg.includes('max_completion_tokens') ||
                 errMsg.includes('extra fields') ||
                 errMsg.includes('unrecognized') ||
                 errMsg.includes('unknown parameter') ||
                 errMsg.includes('unsupported parameter'))
            ) {
                const fallbackParams = { ...params };
                fallbackParams.max_tokens = fallbackParams.max_completion_tokens;
                delete fallbackParams.max_completion_tokens;
                return await this.client.chat.completions.create(fallbackParams);
            }
            throw error;
        }
    }

    async summarizeVideo(videoId: string, prompt: string): Promise<string> {
        try {
            const isReasoningModel = /^(o[134])/i.test(this.model);
            const params: any = {
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                max_completion_tokens: this.maxTokens,
            };
            if (!isReasoningModel) {
                params.temperature = this.temperature;
            }

            const completion = await this.createChatCompletion(params);

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

    async generateTopics(summaryText: string): Promise<string[]> {
        try {
            const isReasoningModel = /^(o[134])/i.test(this.model);
            const prompt = `Based on the following video summary, generate 3 to 7 concise topic tags representing the key subjects. Return ONLY a comma-separated list of tags in lowercase (e.g. artificial-intelligence, physics, productivity). Do not include hashtags (#) or explanation.\n\nSummary:\n${summaryText.slice(0, 4000)}`;
            const params: any = {
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                max_completion_tokens: 100,
            };
            if (!isReasoningModel) {
                params.temperature = 0.2;
            }

            const completion = await this.createChatCompletion(params);
            return this.parseTopics(completion.choices[0]?.message?.content || '');
        } catch (error) {
            console.warn('OpenAI topic tag generation failed:', error);
            return [];
        }
    }

    private parseTopics(text: string): string[] {
        return Array.from(new Set(
            text
                .split(/[,\n]/)
                .map(t => t.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-').replace(/[^a-z0-9_\-\/]/gi, ''))
                .filter(t => t.length > 0 && !/^\d+$/.test(t))
        ));
    }
}
