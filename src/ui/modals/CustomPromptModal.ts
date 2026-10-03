import { App, Modal, Notice, Setting } from 'obsidian';
import { MediaExtendedRunOptions } from '../../types';
import { renderMediaExtendedRunOptions } from '../components/MediaExtendedRunOptions';

export class CustomPromptModal extends Modal {
	private prompt = '';
	private mediaExtendedOptions: MediaExtendedRunOptions;

	constructor(
		app: App,
		private onSubmit: (prompt: string, mediaExtendedOptions: MediaExtendedRunOptions) => void,
		initialMediaExtendedOptions: MediaExtendedRunOptions
	) {
		super(app);
		this.mediaExtendedOptions = { ...initialMediaExtendedOptions };
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Add custom prompt instructions' });

		new Setting(contentEl)
			.setName('Instructions')
			.setDesc('These instructions are appended only for this run')
			.addTextArea((text) =>
				text
					.setPlaceholder('Focus on action items, architecture, and technical terms...')
					.setValue(this.prompt)
					.onChange((value) => (this.prompt = value))
			);

		renderMediaExtendedRunOptions(contentEl, this.mediaExtendedOptions);

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText('Summarize')
					.setCta()
					.onClick(() => {
						const trimmed = this.prompt.trim();
						if (!trimmed) {
							new Notice('Please enter prompt instructions');
							return;
						}
						this.onSubmit(trimmed, { ...this.mediaExtendedOptions });
						this.close();
					})
			)
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => {
					this.close();
				})
			);
	}


	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
