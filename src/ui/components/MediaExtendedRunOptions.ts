import { Setting } from 'obsidian';
import { MediaExtendedRunOptions } from '../../types';

/**
 * Renders the per-run Media Extended toggles (create note, include description, include transcript)
 * into a modal. Toggles mutate the passed options object and never change permanent settings.
 * The description/transcript toggles are disabled while note creation is off.
 */
export function renderMediaExtendedRunOptions(containerEl: HTMLElement, options: MediaExtendedRunOptions): void {
	const dependentSettings: Setting[] = [];
	const syncDisabled = () => {
		dependentSettings.forEach((setting) => setting.setDisabled(!options.createNote));
	};

	new Setting(containerEl)
		.setName('Create Media Extended note')
		.setDesc('Create a separate companion note for Media Extended (does not change permanent setting)')
		.addToggle((toggle) =>
			toggle
				.setValue(options.createNote)
				.onChange((value) => {
					options.createNote = value;
					syncDisabled();
				})
		);

	dependentSettings.push(
		new Setting(containerEl)
			.setName('Include description in Media Extended note')
			.setDesc('Add the video description with timestamp links to the Media Extended note for this run (does not change permanent setting)')
			.addToggle((toggle) =>
				toggle
					.setValue(options.includeDescription)
					.onChange((value) => {
						options.includeDescription = value;
					})
			),
		new Setting(containerEl)
			.setName('Include transcript in Media Extended note')
			.setDesc('Add the timestamped transcript to the Media Extended note for this run (does not change permanent setting)')
			.addToggle((toggle) =>
				toggle
					.setValue(options.includeTranscript)
					.onChange((value) => {
						options.includeTranscript = value;
					})
			)
	);

	syncDisabled();
}
