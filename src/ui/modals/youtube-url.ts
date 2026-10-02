import { App, Modal, Notice, Setting } from 'obsidian';

/**
 * A modal dialog for entering a YouTube URL and run options.
 */
export class YouTubeURLModal extends Modal {
	private onSubmit: (url: string, createMediaExtended: boolean) => void;
	private createMediaExtended: boolean;
	private showMediaExtendedOption: boolean;

	/**
	 * Constructs a new YouTubeURLModal.
	 * @param app - The Obsidian app instance.
	 * @param onSubmit - Callback function to handle the submitted URL and options.
	 * @param initialCreateMediaExtended - Inherited state from permanent setting.
	 * @param showMediaExtendedOption - Whether to display the Media Extended checkbox.
	 */
	constructor(
		app: App,
		onSubmit: (url: string, createMediaExtended: boolean) => void,
		initialCreateMediaExtended = true,
		showMediaExtendedOption = true
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.createMediaExtended = initialCreateMediaExtended;
		this.showMediaExtendedOption = showMediaExtendedOption;
	}

	/**
	 * Called when the modal is opened.
	 * Sets up the modal content.
	 */
	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Create modal content
		contentEl.createDiv({ cls: 'yt-summarizer-modal' }, (modalEl) => {
			modalEl.createEl('h2', {
				text: 'Enter YouTube URL',
				cls: 'yt-summarizer-modal__title',
			});

			// Input field for YouTube URL
			const inputEl = modalEl.createEl('input', {
				type: 'text',
				placeholder: 'https://www.youtube.com/watch?v=...',
				cls: 'yt-summarizer__input',
			});

			// Media Extended option
			if (this.showMediaExtendedOption) {
				new Setting(modalEl)
					.setName('Create Media Extended note')
					.setDesc('Create a separate companion note for Media Extended (does not change permanent setting)')
					.addToggle((toggle) =>
						toggle
							.setValue(this.createMediaExtended)
							.onChange((value) => {
								this.createMediaExtended = value;
							})
					);
			}

			// Action buttons
			const actions = modalEl.createDiv({
				cls: 'yt-summarizer__actions',
			});

			const submitBtn = actions.createEl('button', {
				text: 'Submit',
				cls: 'yt-summarizer__button yt-summarizer__button--primary',
			});

			const cancelBtn = actions.createEl('button', {
				text: 'Cancel',
				cls: 'yt-summarizer__button yt-summarizer__button--danger',
			});

			// Handle submit button click
			submitBtn.addEventListener('click', () => {
				const url = inputEl.value.trim();
				if (url) {
					this.onSubmit(url, this.createMediaExtended);
					this.close();
				} else {
					new Notice('Please enter a valid URL');
				}
			});

			// Handle enter key in input field
			inputEl.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					submitBtn.click();
				}
			});

			// Handle cancel button click
			cancelBtn.addEventListener('click', () => this.close());
		});
	}


	/**
	 * Called when the modal is closed.
	 * Cleans up the modal content.
	 */
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
