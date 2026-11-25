import { PlaylistInfo, TranscriptResponse } from '../types';
import { convertTimestampsToLinks, formatTranscript } from './frontmatter';

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
