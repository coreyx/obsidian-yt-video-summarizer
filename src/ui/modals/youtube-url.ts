import { App, Modal, Notice } from 'obsidian';
import { MediaExtendedRunOptions } from '../../types';
import { renderMediaExtendedRunOptions } from '../components/MediaExtendedRunOptions';

/**
 * A modal dialog for entering a YouTube URL and run options.
 */
export class YouTubeURLModal extends Modal {
	private onSubmit: (url: string, mediaExtendedOptions: MediaExtendedRunOptions) => void;
	private mediaExtendedOptions: MediaExtendedRunOptions;
	private showMediaExtendedOption: boolean;

	/**
	 * Constructs a new YouTubeURLModal.
	 * @param app - The Obsidian app instance.
	 * @param onSubmit - Callback function to handle the submitted URL and per-run options.
	 * @param initialMediaExtendedOptions - Initial per-run Media Extended options (inherited from permanent settings).
	 * @param showMediaExtendedOption - Whether to display the Media Extended toggles.
	 */
	constructor(
		app: App,
		onSubmit: (url: string, mediaExtendedOptions: MediaExtendedRunOptions) => void,
		initialMediaExtendedOptions: MediaExtendedRunOptions,
		showMediaExtendedOption = true
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.mediaExtendedOptions = { ...initialMediaExtendedOptions };
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

			// Media Extended options
			if (this.showMediaExtendedOption) {
				renderMediaExtendedRunOptions(modalEl, this.mediaExtendedOptions);
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
					this.onSubmit(url, { ...this.mediaExtendedOptions });
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
