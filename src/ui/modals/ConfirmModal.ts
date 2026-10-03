import { App, ButtonComponent, Modal, Setting } from 'obsidian';

/**
 * A yes/no confirmation dialog. Use {@link ConfirmModal.confirm} to await the user's choice;
 * closing the dialog without choosing counts as "no".
 */
export class ConfirmModal extends Modal {
	private confirmed = false;

	constructor(
		app: App,
		private title: string,
		private message: string,
		private confirmText: string,
		private onDone: (confirmed: boolean) => void
	) {
		super(app);
	}

	static confirm(app: App, title: string, message: string, confirmText = 'Continue'): Promise<boolean> {
		return new Promise((resolve) => {
			new ConfirmModal(app, title, message, confirmText, resolve).open();
		});
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: this.title });
		contentEl.createEl('p', { text: this.message });

		new Setting(contentEl)
			.addButton((btn: ButtonComponent) =>
				btn
					.setButtonText(this.confirmText)
					.setCta()
					.onClick(() => {
						this.confirmed = true;
						this.close();
					})
			)
			.addButton((btn: ButtonComponent) =>
				btn.setButtonText('Cancel').onClick(() => {
					this.close();
				})
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		this.onDone(this.confirmed);
	}
}
