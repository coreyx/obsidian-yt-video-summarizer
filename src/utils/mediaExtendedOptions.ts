import { MediaExtendedRunOptions, PluginSettings } from '../types';

/** The settings that decide whether and how a Media Extended companion note is created */
type MediaExtendedSettings = Pick<
	PluginSettings,
	'getCreateMediaExtendedNotes' | 'getMediaExtendedIncludeDescription' | 'getMediaExtendedIncludeTranscript'
>;

/**
 * The Media Extended options a summarize or transcript prompt starts with: the permanent settings.
 * The prompt's checkboxes can change them for one run without touching the settings.
 */
export function defaultMediaExtendedRunOptions(settings: MediaExtendedSettings): MediaExtendedRunOptions {
	return {
		createNote: settings.getCreateMediaExtendedNotes(),
		includeDescription: settings.getMediaExtendedIncludeDescription(),
		includeTranscript: settings.getMediaExtendedIncludeTranscript(),
	};
}

/**
 * Decides what a companion note includes: each choice made for this run, or else the permanent setting.
 */
export function resolveCompanionNoteOptions(
	runOptions: Partial<Pick<MediaExtendedRunOptions, 'includeDescription' | 'includeTranscript'>> | undefined,
	settings: MediaExtendedSettings
): { includeDescription: boolean; includeTranscript: boolean } {
	return {
		includeDescription: runOptions?.includeDescription ?? settings.getMediaExtendedIncludeDescription(),
		includeTranscript: runOptions?.includeTranscript ?? settings.getMediaExtendedIncludeTranscript(),
	};
}
