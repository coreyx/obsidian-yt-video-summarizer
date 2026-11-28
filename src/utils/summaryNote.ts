import { App, Editor, EditorPosition, MarkdownView, TFile } from 'obsidian';
import { PlaylistInfo, TranscriptResponse } from '../types';
import {
	buildFrontmatter,
	convertTimestampsToLinks,
	formatTranscript,
	FrontmatterData,
	isBlankNoteForSummary,
	updateNoteContentWithFrontmatter,
} from './frontmatter';

/**
 * Rendering and placement decisions for video summary notes, kept apart from the plugin class so they can be
 * tested without Obsidian. The plugin gathers the inputs (settings, vault state, the editor) and does the
 * writing; these functions decide what is written and where.
 */

/**
 * Builds the line under a summary's thumbnail: the channel, a link to the video, and (when the video is part
 * of a creator playlist) a link to the playlist with the video's position in it.
 */
export function buildVideoMetaLine(
	author: string,
	channelUrl: string,
	videoUrl: string,
	playlist?: Pick<PlaylistInfo, 'title' | 'url' | 'index' | 'count'> | null
): string {
	let line = `👤 [${author}](${channelUrl})  🔗 [Watch video](${videoUrl})`;
	if (playlist) {
		let label = playlist.title ?? 'Playlist';
		if (typeof playlist.index === 'number' && typeof playlist.count === 'number') {
			label += ` (${playlist.index}/${playlist.count})`;
		} else if (typeof playlist.index === 'number') {
			label += ` (#${playlist.index})`;
		}
		line += `  📋 [Playlist: ${label}](${playlist.url})`;
	}
	return line;
}

/** Inputs to {@link buildSummaryBody}. */
export interface SummaryBodyOptions {
	transcript: Pick<TranscriptResponse, 'title' | 'author' | 'channelUrl' | 'videoId' | 'lines' | 'playlist'>;
	thumbnailUrl: string;
	/** The video link shown in the note (the URL the user gave, which may carry playlist parameters) */
	videoUrl: string;
	/** The AI summary; left out for a transcript-only note */
	summary?: string;
	inlineTags?: string[];
	/** The *Include title in note body* setting */
	includeTitle?: boolean;
	/** The *Dump transcript in summary* setting; a transcript-only note always includes it */
	includeTranscript?: boolean;
	/** The *Discover playlist from creator* setting */
	showPlaylist?: boolean;
}

/**
 * Builds the body of a video summary note: optional title heading, thumbnail, the meta line (and inline tags),
 * then the AI summary with its timestamps linked to the video and/or the timestamped transcript.
 * The description stays in frontmatter; "Add description to video summary note" adds it to the body.
 */
export function buildSummaryBody(options: SummaryBodyOptions): string {
	const { transcript } = options;
	const metaLines = [
		buildVideoMetaLine(transcript.author, transcript.channelUrl, options.videoUrl, options.showPlaylist ? transcript.playlist : undefined),
	];
	if (options.inlineTags && options.inlineTags.length > 0) {
		metaLines.push(`**Tags:** ${options.inlineTags.map((tag) => `#${tag}`).join(' ')}`);
	}

	const parts: string[] = [];
	if (options.includeTitle && transcript.title) {
		parts.push(`# ${transcript.title}`);
	}
	parts.push(`![Thumbnail](${options.thumbnailUrl})`, metaLines.join('\n\n'));

	const transcriptOnly = options.summary === undefined;
	if (!transcriptOnly) {
		// Link any timestamps the AI included to the video in standard YouTube format
		parts.push(convertTimestampsToLinks(options.summary as string, transcript.videoId, 'youtube'));
	}

	// A transcript-only note always has its Transcript section; a summary adds it only when it has lines
	if (transcriptOnly || (options.includeTranscript && transcript.lines && transcript.lines.length > 0)) {
		const formatted = formatTranscript(transcript.lines, transcript.videoId, { format: 'youtube' });
		parts.push(`## Transcript\n\n${formatted}`);
	}

	return parts.join('\n\n');
}

/**
 * Normalizes a folder setting into a vault folder path (forward slashes, no leading or trailing slash),
 * using `fallback` when the setting is empty.
 */
export function normalizeFolderSetting(value: string | undefined | null, fallback: string): string {
	return (value ?? '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || fallback;
}

/**
 * Decides where a new summary goes: into the note it was started from when that note is blank (see
 * `isBlankNoteForSummary`), otherwise into a new note in the video summaries folder, linked from the cursor.
 * @param sourceBasename - The basename of the note the command ran in, or `null` when there is none.
 */
export function chooseSummaryTarget(editorText: string, sourceBasename: string | null): 'current-note' | 'new-note' {
	return sourceBasename !== null && isBlankNoteForSummary(editorText, sourceBasename) ? 'current-note' : 'new-note';
}

/**
 * Returns a vault path for `baseName` in `folderPath` that doesn't collide with an existing file, appending
 * " (1)", " (2)", ... as needed. `currentPath` counts as free, so renaming a note onto its own path is a no-op.
 * @param exists - Whether a file already exists at a vault path.
 */
export function findAvailableNotePath(
	folderPath: string,
	baseName: string,
	exists: (path: string) => boolean,
	currentPath?: string,
	extension = 'md'
): string {
	const parentDir = folderPath && folderPath !== '/' ? `${folderPath}/` : '';
	let targetPath = `${parentDir}${baseName}.${extension}`;
	let counter = 1;
	while (exists(targetPath) && targetPath !== currentPath) {
		targetPath = `${parentDir}${baseName} (${counter}).${extension}`;
		counter++;
	}
	return targetPath;
}

/**
 * The content a summary note ends up with. A new note, or a blank one, gets the frontmatter and body. A blank
 * note that has tags-only frontmatter, or that the user typed into while the summary ran, keeps what it has:
 * the body is appended and the frontmatter merged in, so existing tags are kept alongside the new ones.
 * @param current - The note's content just before writing.
 * @param isNewNote - Whether the note was created for this summary (its placeholder text is replaced).
 */
export function composeSummaryNoteContent(current: string, isNewNote: boolean, fmData: FrontmatterData, body: string): string {
	return isNewNote || current.trim() === ''
		? `${buildFrontmatter(fmData)}\n\n${body}`
		: updateNoteContentWithFrontmatter(`${current.trimEnd()}\n\n${body}`, fmData);
}

/** The editor methods the insertion helpers use (a subset of Obsidian's `Editor`). */
type InsertionEditor = Pick<Editor, 'replaceRange' | 'setCursor' | 'offsetToPos' | 'posToOffset'>;

/** Inserts `text` at `position` and puts the cursor right after it. */
export function insertTextAt(editor: InsertionEditor, position: EditorPosition, text: string): void {
	editor.replaceRange(text, position);
	editor.setCursor(editor.offsetToPos(editor.posToOffset(position) + text.length));
}

/**
 * Inserts a link to a new summary note at the cursor. When text is selected (typically the video URL the
 * command ran on), the selection is kept and the link goes after it, separated by a space.
 * @returns The text put in front of the link (`' '` or `''`), so the exact insertion can be removed later.
 */
export function insertLinkAtCursor(editor: InsertionEditor & Pick<Editor, 'somethingSelected' | 'getCursor'>, link: string): string {
	const linkPrefix = editor.somethingSelected() ? ' ' : '';
	insertTextAt(editor, editor.getCursor('to'), `${linkPrefix}${link}`);
	return linkPrefix;
}

/**
 * Returns a note's video description from its frontmatter: `video_description`, or `description` for notes
 * summarized before the property was renamed (and for Media Extended notes, which use `description`).
 * Returns `undefined` when neither is a string.
 * @param frontmatter - The note's parsed frontmatter, as Obsidian's metadata cache gives it.
 */
export function frontmatterVideoDescription(frontmatter: Record<string, unknown> | undefined | null): string | undefined {
	if (typeof frontmatter?.video_description === 'string') {
		return frontmatter.video_description;
	}
	return typeof frontmatter?.description === 'string' ? frontmatter.description : undefined;
}

/**
 * Returns the frontmatter description to copy into a note body, or `null` when the description should be
 * fetched from YouTube instead: the setting is off, or the frontmatter has no non-empty description.
 * @param useFrontmatter - The *Use frontmatter description when adding description to body* setting.
 */
export function frontmatterDescriptionToUse(useFrontmatter: boolean, frontmatterDescription: unknown): string | null {
	return useFrontmatter && typeof frontmatterDescription === 'string' && frontmatterDescription.trim()
		? frontmatterDescription
		: null;
}

/**
 * Replaces the first occurrence of `search` in a note and returns whether it was found.
 * A note that is open in an editor is changed through that editor: its latest edits may not be saved
 * yet, and vault.process() only sees what is on disk.
 */
export async function replaceInNote(
	app: Pick<App, 'workspace' | 'vault'>,
	file: TFile,
	search: string,
	replacement: string
): Promise<boolean> {
	for (const leaf of app.workspace.getLeavesOfType('markdown')) {
		const view = leaf.view;
		if (!(view instanceof MarkdownView) || view.file?.path !== file.path) {
			continue;
		}
		const editor = view.editor;
		const index = editor.getValue().indexOf(search);
		if (index !== -1) {
			editor.replaceRange(replacement, editor.offsetToPos(index), editor.offsetToPos(index + search.length));
			return true;
		}
	}

	let found = false;
	await app.vault.process(file, (content) => {
		found = content.includes(search);
		return content.replace(search, () => replacement);
	});
	return found;
}
