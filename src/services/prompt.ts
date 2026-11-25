/**
 * Service for handling AI prompts.
 * This class provides methods for building prompts for AI models.
 */
export class PromptService {
	/**
	 * Creates an instance of PromptService.
	 * @param settings - The plugin settings.
	 */
	constructor(private customPrompt: string) {}

	/**
	 * Builds the prompt for AI based on the video transcript
	 * @param transcriptText - Video transcript text
	 * @returns Prompt string for AI
	 * @example
	 * const prompt = promptService.buildPrompt('This is a sample transcript.');
	 * console.log(prompt); // 'Custom prompt\n\nTranscript:\nThis is a sample transcript.'
	 */
	buildPrompt(transcriptText: string): string {
		return `${this.customPrompt}\n\nTranscript:\n${transcriptText}`;
	}
}

/**
 * Adjusts the summary prompt for the *Link technical terms* setting. The default prompt asks for technical
 * terms as `[[wikilinks]]`; with the setting off, the examples become bold text and an explicit rule tells the
 * model not to use wikilinks.
 */
export function adaptPromptForWikilinks(prompt: string, linkTerms: boolean): string {
	if (linkTerms) {
		return prompt;
	}
	return prompt
		.replace(/\*\*\[\[Term 1\]\]\*\*/g, '**Term 1**')
		.replace(/\*\*\[\[Term 2\]\]\*\*/g, '**Term 2**')
		.replace(/\[\[Term (\d+)\]\]/g, 'Term $1')
		+ '\n\nImportant formatting rule: In the "Technical terms" section, do NOT use wikilinks (do NOT enclose terms in [[ ]]). Format terms as bold text only (e.g. - **Term**: explanation).';
}
