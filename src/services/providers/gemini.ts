import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIModelProvider } from 'src/types';

export class GeminiProvider implements AIModelProvider {
    private client: GoogleGenerativeAI;
    private model: string;
    private maxTokens: number;
    private temperature: number;

    constructor(
        apiKey: string,
        model: string,
        maxTokens: number,
        temperature: number
    ) {
        this.client = new GoogleGenerativeAI(apiKey);
        this.model = model;
        this.maxTokens = maxTokens;
        this.temperature = temperature;
    }

    async testConnection(): Promise<boolean> {
        try {
            const model = this.client.getGenerativeModel({ model: this.model });
            await model.generateContent('test');
            return true;
        } catch (error) {
            console.error('Gemini connection test failed:', error);
            return false;
        }
    }

    async summarizeVideo(videoId: string, prompt: string): Promise<string> {
        const model = this.client.getGenerativeModel({
            model: this.model,
            generationConfig: {
                maxOutputTokens: this.maxTokens,
                temperature: this.temperature
            }
        });

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text();
            
            if (response.candidates && response.candidates[0] && response.candidates[0].finishReason === 'MAX_TOKENS') {
                text += '\n\n[Summary truncated due to max token limit. Please increase "Max Tokens" in settings.]';
            }
            
            return text;
        } catch (error) {
            console.error('Error generating summary with Gemini:', error);
            throw error;
        }
    }

    async extractThumbnailText(imageBase64: string, mimeType = 'image/jpeg'): Promise<string> {
        try {
            const model = this.client.getGenerativeModel({ model: this.model });
            const result = await model.generateContent([
                {
                    inlineData: {
                        data: imageBase64,
                        mimeType: mimeType
                    }
                },
                "Extract and transcribe all text visible in this YouTube video thumbnail image. Return ONLY the transcribed text without quotes, markdown headers, or introductory text. If no text is visible, reply with nothing."
            ]);
            const response = await result.response;
            return response.text().trim();
        } catch (error) {
            console.warn('Gemini thumbnail vision extraction failed or not supported by current model:', error);
            return '';
        }
    }

    async generateTopics(summaryText: string): Promise<string[]> {
        try {
            const model = this.client.getGenerativeModel({
                model: this.model,
                generationConfig: {
                    maxOutputTokens: 100,
                    temperature: 0.2
                }
            });
            const prompt = `Based on the following video summary, generate 3 to 7 concise topic tags representing the key subjects. Return ONLY a comma-separated list of tags in lowercase (e.g. artificial-intelligence, physics, productivity). Do not include hashtags (#) or explanation.\n\nSummary:\n${summaryText.slice(0, 4000)}`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return this.parseTopics(response.text());
        } catch (error) {
            console.warn('Gemini topic tag generation failed:', error);
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
