import Anthropic from '@anthropic-ai/sdk';
import { AIModelProvider, GenerateTopicsOptions } from 'src/types';
import { buildTopicGenerationPrompt } from '../../utils/vaultTags';

export class AnthropicProvider implements AIModelProvider {
    private client: Anthropic;

    constructor(
        apiKey: string,
        private model: string,
        private maxTokens: number,
        private temperature: number,
        baseUrl: string | undefined
    ) {
        this.client = new Anthropic({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true,
            baseURL: baseUrl
        });
        this.model = model;
        this.maxTokens = maxTokens;
        this.temperature = temperature;
    }

    async testConnection(): Promise<boolean> {
        try {
            // Anthropic doesn't have a dedicated test endpoint, so we'll make a minimal request
            await this.client.messages.create({
                model: this.model,
                max_tokens: 1,
                messages: [{ role: 'user', content: 'test' }]
            });
            return true;
        } catch (error) {
            console.error('Anthropic connection test failed:', error);
            return false;
        }
    }

    async summarizeVideo(videoId: string, prompt: string): Promise<string> {
        try {
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: this.maxTokens,
                temperature: this.temperature,
                messages: [{ role: 'user', content: prompt }]
            });

            if (response.content[0].type === 'text') {
                let text = response.content[0].text;
                if (response.stop_reason === 'max_tokens') {
                    text += '\n\n[Summary truncated due to max token limit. Please increase "Max Tokens" in settings.]';
                }
                return text;
            }
            throw new Error('Unexpected response type from Anthropic API');
        } catch (error) {
            console.error('Error generating summary with Anthropic:', error);
            throw error;
        }
    }

    async extractThumbnailText(imageBase64: string, mimeType = 'image/jpeg'): Promise<string> {
        try {
            const mediaType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)
                ? mimeType
                : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 200,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mediaType,
                                    data: imageBase64
                                }
                            },
                            {
                                type: 'text',
                                text: "Extract and transcribe all text visible in this YouTube video thumbnail image. Return ONLY the transcribed text without quotes, markdown headers, or introductory text. If no text is visible, reply with nothing."
                            }
                        ]
                    }
                ]
            });
            if (response.content[0]?.type === 'text') {
                return response.content[0].text.trim();
            }
            return '';
        } catch (error) {
            console.warn('Anthropic thumbnail vision extraction failed or not supported by current model:', error);
            return '';
        }
    }

    async generateTopics(summaryText: string, options?: GenerateTopicsOptions): Promise<string[]> {
        try {
            const prompt = buildTopicGenerationPrompt(summaryText, options);
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 200,
                temperature: 0.2,
                messages: [{ role: 'user', content: prompt }]
            });
            if (response.content[0]?.type === 'text') {
                return this.parseTopics(response.content[0].text);
            }
            return [];
        } catch (error) {
            console.warn('Anthropic topic tag generation failed:', error);
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
