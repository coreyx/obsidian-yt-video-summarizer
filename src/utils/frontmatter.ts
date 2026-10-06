import { Editor } from 'obsidian';
import { TranscriptLine } from '../types';

export interface FrontmatterData {
	title: string;
	channel_name: string;
	channel_username: string;
	channel_url: string;
	video_url: string;
	thumbnail: string;
	thumbnail_text: string;
	description?: string;
	tags?: string[];
	duration?: number;
	published_at?: string;
	view_count?: number;
	like_count?: number;
	aspect_ratio?: string;
	playlist_title?: string;
	playlist_url?: string;
	playlist_id?: string;
	playlist_index?: number;
	playlist_count?: number;
}

export interface FrontmatterOptions {
	excludeTags?: boolean;
}

/**
 * Checkbox properties every video summary note starts with, for the user to tick.
 * They are written as `false` and never overwritten once a note has them.
 */
export const USER_FLAG_KEYS = ['watch_later', 'favorite'];

/**
 * Adds the checkbox properties a note's frontmatter doesn't have yet, as `false`, and changes nothing
 * else. They go where new notes have them (before `description` / `tags`), or at the end of the
 * frontmatter. Returns the content as-is when there is no frontmatter or nothing is missing.
 */
export function addMissingUserFlags(content: string): string {
	const match = content.match(/^---\r?\n([\s\S]*?\r?\n)---(?:\r?\n|$)/);
	if (!match) {
		return content;
	}

	const yaml = match[1];
	const missing = USER_FLAG_KEYS.filter((key) => !new RegExp(`^${key}:`, 'm').test(yaml));
	if (missing.length === 0) {
		return content;
	}

	const eol = yaml.endsWith('\r\n') ? '\r\n' : '\n';
	const yamlStart = match[0].indexOf('\n') + 1;
	const anchor = yaml.search(/^(?:description|tags):/m);
	const insertAt = yamlStart + (anchor === -1 ? yaml.length : anchor);
	const added = missing.map((key) => `${key}: false${eol}`).join('');
	return content.slice(0, insertAt) + added + content.slice(insertAt);
}

/**
 * Maps fetched video metadata to the video stats frontmatter properties.
 */
export function videoStatsFrontmatter(metadata: {
	duration?: number;
	publishedAt?: string;
	viewCount?: number;
	likeCount?: number;
	aspectRatio?: string;
}): Pick<FrontmatterData, 'duration' | 'published_at' | 'view_count' | 'like_count' | 'aspect_ratio'> {
	return {
		duration: metadata.duration,
		published_at: metadata.publishedAt,
		view_count: metadata.viewCount,
		like_count: metadata.likeCount,
		aspect_ratio: metadata.aspectRatio,
	};
}

/**
 * Builds the video stats frontmatter lines (duration, published_at, view_count, like_count, aspect_ratio)
 * for the values that are available, keyed by property name. Uses the same formats as Media Extended notes
 * (duration in seconds, unquoted YYYY-MM-DD date, aspect ratio like "16 / 9").
 */
function buildVideoStatsLines(data: FrontmatterData): Record<string, string> {
	const lines: Record<string, string> = {};
	if (typeof data.duration === 'number' && data.duration > 0) {
		lines['duration'] = `duration: ${Math.round(data.duration)}`;
	}
	if (data.published_at && /^\d{4}-\d{2}-\d{2}$/.test(data.published_at)) {
		lines['published_at'] = `published_at: ${data.published_at}`;
	}
	if (typeof data.view_count === 'number' && !isNaN(data.view_count)) {
		lines['view_count'] = `view_count: ${data.view_count}`;
	}
	if (typeof data.like_count === 'number' && !isNaN(data.like_count)) {
		lines['like_count'] = `like_count: ${data.like_count}`;
	}
	if (data.aspect_ratio && /^\d+ \/ \d+$/.test(data.aspect_ratio)) {
		lines['aspect_ratio'] = `aspect_ratio: ${data.aspect_ratio}`;
	}
	return lines;
}

/**
 * Builds a YAML frontmatter string from structured metadata.
 */
export function buildFrontmatter(data: FrontmatterData): string {
	const lines: string[] = ['---'];
	lines.push(`title: ${JSON.stringify(data.title)}`);
	lines.push(`channel_name: ${JSON.stringify(data.channel_name)}`);
	lines.push(`channel_username: ${JSON.stringify(data.channel_username || '')}`);
	lines.push(`channel_url: ${JSON.stringify(data.channel_url)}`);
	lines.push(`video_url: ${JSON.stringify(data.video_url)}`);
	lines.push(`thumbnail: ${JSON.stringify(data.thumbnail)}`);
	lines.push(`thumbnail_text: ${JSON.stringify(data.thumbnail_text || '')}`);
	lines.push(...Object.values(buildVideoStatsLines(data)));

	if (data.playlist_title) {
		lines.push(`playlist_title: ${JSON.stringify(data.playlist_title)}`);
	}
	if (data.playlist_url) {
		lines.push(`playlist_url: ${JSON.stringify(data.playlist_url)}`);
	}
	if (data.playlist_id) {
		lines.push(`playlist_id: ${JSON.stringify(data.playlist_id)}`);
	}
	if (typeof data.playlist_index === 'number') {
		lines.push(`playlist_index: ${data.playlist_index}`);
	}
	if (typeof data.playlist_count === 'number') {
		lines.push(`playlist_count: ${data.playlist_count}`);
	}

	for (const key of USER_FLAG_KEYS) {
		lines.push(`${key}: false`);
	}

	if (data.description !== undefined && data.description !== null) {
		if (data.description.trim()) {
			lines.push('description: |-');
			const descLines = data.description.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
			for (const dLine of descLines) {
				lines.push(dLine.trim().length > 0 ? `  ${dLine}` : '');
			}
		} else {
			lines.push('description: ""');
		}
	}

	if (data.tags && data.tags.length > 0) {
		lines.push('tags:');
		for (const tag of deduplicateTags(data.tags)) {
			lines.push(`  - ${tag}`);
		}
	}

	lines.push('---');
	return lines.join('\n');
}

/**
 * Merges new frontmatter metadata into an existing raw YAML string.
 * Preserves other frontmatter properties and merges tags (unless excludeTags is true).
 */
export function mergeFrontmatter(
	rawYaml: string,
	data: FrontmatterData,
	options?: FrontmatterOptions
): string {
	// Trailing blank lines would otherwise end up in front of any properties appended below
	const lines = rawYaml.replace(/\s+$/, '').split(/\r?\n/);
	const updatedKeys = new Set<string>();
	const existingKeys = new Set<string>();
	const newLines: string[] = [];

	const targetKeys: Record<string, string> = {
		title: `title: ${JSON.stringify(data.title)}`,
		channel_name: `channel_name: ${JSON.stringify(data.channel_name)}`,
		channel_username: `channel_username: ${JSON.stringify(data.channel_username || '')}`,
		channel_url: `channel_url: ${JSON.stringify(data.channel_url)}`,
		video_url: `video_url: ${JSON.stringify(data.video_url)}`,
		thumbnail: `thumbnail: ${JSON.stringify(data.thumbnail)}`,
		thumbnail_text: `thumbnail_text: ${JSON.stringify(data.thumbnail_text || '')}`,
		...buildVideoStatsLines(data),
	};

	if (data.playlist_title) {
		targetKeys['playlist_title'] = `playlist_title: ${JSON.stringify(data.playlist_title)}`;
	}
	if (data.playlist_url) {
		targetKeys['playlist_url'] = `playlist_url: ${JSON.stringify(data.playlist_url)}`;
	}
	if (data.playlist_id) {
		targetKeys['playlist_id'] = `playlist_id: ${JSON.stringify(data.playlist_id)}`;
	}
	if (typeof data.playlist_index === 'number') {
		targetKeys['playlist_index'] = `playlist_index: ${data.playlist_index}`;
	}
	if (typeof data.playlist_count === 'number') {
		targetKeys['playlist_count'] = `playlist_count: ${data.playlist_count}`;
	}

	let inTagsBlock = false;
	let inDescBlock = false;
	const existingTags: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (inDescBlock) {
			if (/^\s+/.test(line) || line.trim() === '') {
				if (data.description !== undefined) {
					continue;
				}
			} else {
				inDescBlock = false;
			}
		}

		if (inTagsBlock) {
			const itemMatch = line.match(/^\s*-\s+(.*)$/);
			if (itemMatch) {
				existingTags.push(itemMatch[1].trim().replace(/^['"]|['"]$/g, ''));
				continue;
			} else if (line.trim().length > 0) {
				inTagsBlock = false;
			}
		}

		const keyMatch = line.match(/^([a-zA-Z0-9_-]+):(.*)$/);

		if (keyMatch) {
			const key = keyMatch[1];
			existingKeys.add(key);

			if (key === 'tags') {
				inTagsBlock = true;
				inDescBlock = false;
				updatedKeys.add('tags');
				const inlineVal = keyMatch[2].trim();
				if (inlineVal.startsWith('[') && inlineVal.endsWith(']')) {
					const parsed = inlineVal
						.slice(1, -1)
						.split(',')
						.map(s => s.trim().replace(/^['"]|['"]$/g, ''))
						.filter(Boolean);
					existingTags.push(...parsed);
				} else if (inlineVal) {
					existingTags.push(inlineVal.replace(/^['"]|['"]$/g, '').trim());
				}
				continue;
			} else {
				inTagsBlock = false;
			}

			if (key === 'description') {
				updatedKeys.add('description');
				if (data.description !== undefined) {
					inDescBlock = true;
					if (data.description.trim()) {
						newLines.push('description: |-');
						const descLines = data.description.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
						for (const dLine of descLines) {
							newLines.push(dLine.trim().length > 0 ? `  ${dLine}` : '');
						}
					} else {
						newLines.push('description: ""');
					}
					continue;
				} else {
					newLines.push(line);
					continue;
				}
			}

			if (key in targetKeys) {
				newLines.push(targetKeys[key]);
				updatedKeys.add(key);
				continue;
			}
		}

		newLines.push(line);
	}

	// Add any target keys that were not present in the original frontmatter
	for (const [key, line] of Object.entries(targetKeys)) {
		if (!updatedKeys.has(key)) {
			newLines.push(line);
		}
	}

	// Add the user's checkbox properties if the note doesn't have them yet; existing values are kept
	for (const key of USER_FLAG_KEYS) {
		if (!existingKeys.has(key)) {
			newLines.push(`${key}: false`);
		}
	}

	// Add description if it was provided and not in original frontmatter
	if (data.description !== undefined && !updatedKeys.has('description')) {
		if (data.description.trim()) {
			newLines.push('description: |-');
			const descLines = data.description.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
			for (const dLine of descLines) {
				newLines.push(dLine.trim().length > 0 ? `  ${dLine}` : '');
			}
		} else {
			newLines.push('description: ""');
		}
	}

	// Handle tags
	if (options?.excludeTags) {
		// When excluding tags during upgrades, preserve any existing tags
		if (existingTags.length > 0) {
			newLines.push('tags:');
			for (const tag of deduplicateTags(existingTags)) {
				newLines.push(`  - ${tag}`);
			}
		}
	} else {
		// Normal mode: merge existing tags with new tags and deduplicate
		const combinedTags = deduplicateTags([...existingTags, ...(data.tags || [])]);

		if (combinedTags.length > 0) {
			newLines.push('tags:');
			for (const tag of combinedTags) {
				newLines.push(`  - ${tag}`);
			}
		}
	}

	return newLines.join('\n').trim();
}

/**
 * Applies frontmatter to an Obsidian editor document.
 * If frontmatter already exists, merges properties into it.
 * Otherwise, prepends a new frontmatter block at the top of the file.
 */
export function applyFrontmatter(
	editor: Editor,
	data: FrontmatterData,
	options?: FrontmatterOptions
): void {
	const fullText = editor.getValue();
	const match = fullText.match(/^---\r?\n([\s\S]*?\r?\n)---(\r?\n)?/);

	if (match) {
		const rawYaml = match[1];
		const merged = mergeFrontmatter(rawYaml, data, options);
		const newBlock = `---\n${merged}\n---\n`;
		const endOffset = match[0].length;
		const endPos = editor.offsetToPos(endOffset);
		editor.replaceRange(newBlock, { line: 0, ch: 0 }, endPos);
	} else {
		const fmData = options?.excludeTags ? { ...data, tags: undefined } : data;
		const newBlock = `${buildFrontmatter(fmData)}\n\n`;
		editor.replaceRange(newBlock, { line: 0, ch: 0 });
	}
}

/**
 * Updates a full note text string with new or merged frontmatter.
 * Useful for batch upgrading files in the vault.
 */
export function updateNoteContentWithFrontmatter(
	fullText: string,
	data: FrontmatterData,
	options?: FrontmatterOptions
): string {
	const match = fullText.match(/^---\r?\n([\s\S]*?\r?\n)---(\r?\n)?/);

	if (match) {
		const rawYaml = match[1];
		const merged = mergeFrontmatter(rawYaml, data, options);
		const afterFrontmatter = fullText.slice(match[0].length);
		return `---\n${merged}\n---\n${afterFrontmatter.startsWith('\n') ? afterFrontmatter.slice(1) : afterFrontmatter}`;
	} else {
		const fmData = options?.excludeTags ? { ...data, tags: undefined } : data;
		return `${buildFrontmatter(fmData)}\n\n${fullText}`;
	}
}

/**
 * Extracts a YouTube URL from note content or frontmatter.
 */
export function extractYouTubeUrlFromNote(content: string): string | null {
	// 1. Check YAML frontmatter video_url (summary notes), then video / media (Media Extended notes)
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (fmMatch) {
		for (const key of ['video_url', 'video', 'media']) {
			const videoUrlMatch = fmMatch[1].match(new RegExp(`^${key}:\\s*["']?([^"'\\r\\n]+)["']?`, 'm'));
			const value = videoUrlMatch?.[1].trim();
			if (value && (key === 'video_url' || /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(value))) {
				return value;
			}
		}
	}

	// 2. Check for markdown link: [Watch video](URL) or [any](URL)
	const mdLinkMatch = content.match(
		/\[[^\]]*\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s\)]*v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}[^\s\)]*)\)/i
	);
	if (mdLinkMatch) {
		return mdLinkMatch[1];
	}

	// 3. Check for any YouTube URL in text
	const urlMatch = content.match(
		/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s"'\)<>]*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11}[^\s"'\)<>]*)/i
	);
	if (urlMatch) {
		return urlMatch[0];
	}

	return null;
}

/**
 * Checks if a note is a Media Extended companion note (has mx-uid in frontmatter or is in mediaFolder).
 */
export function isMediaExtendedCompanionNote(
	content: string,
	filePath?: string,
	mediaFolder = 'Media Library'
): boolean {
	if (filePath) {
		const normalizedFolder = mediaFolder.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
		const normalizedPath = filePath.replace(/\\/g, '/');
		if (normalizedFolder && (normalizedPath.startsWith(normalizedFolder + '/') || normalizedPath === normalizedFolder)) {
			return true;
		}
	}
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (fmMatch && /^mx-uid:\s*[a-zA-Z0-9_-]+/m.test(fmMatch[1])) {
		return true;
	}
	return false;
}

/**
 * Detects whether a note contains a # Related section with a wikilink to a Media Extended companion note.
 */
export function hasRelatedMediaExtendedLink(
	content: string,
	mediaFolder = 'Media Library',
	expectedBasename?: string
): boolean {
	const relatedMatch = content.match(/(?:^|\r?\n)#{1,6}\s+Related[^\r\n]*([\s\S]*?)(?=(?:\r?\n#{1,6}\s+|$))/i);
	if (!relatedMatch) {
		return false;
	}
	const relatedBody = relatedMatch[1];

	if (expectedBasename) {
		const cleanBase = expectedBasename.trim();
		const escapedBase = cleanBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const specificRegex = new RegExp(`\\[\\[(?:.*\\/)?${escapedBase}(?:\\|[^\\]]+)?\\]\\]`, 'i');
		if (specificRegex.test(relatedBody)) {
			return true;
		}
	}

	const cleanFolder = mediaFolder.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
	if (cleanFolder) {
		const escapedFolder = cleanFolder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const folderRegex = new RegExp(`\\[\\[${escapedFolder}\\/[^\\]]+\\]\\]`, 'i');
		if (folderRegex.test(relatedBody)) {
			return true;
		}
	}

	return false;
}

/**
 * Extracts hashtags from text (such as YouTube video titles and descriptions).
 * Matches patterns like #ai, #web-development, #coding_tutorial, #React
 * Ignores pure numbers like #123, markdown headings like ## Title, and empty hashes.
 */
export function extractTagsFromText(text: string): string[] {
	if (!text) return [];
	const tagRegex = /(?:^|\s)#([\p{L}\p{N}_\-]+)/gu;
	const tags: string[] = [];
	let match;
	while ((match = tagRegex.exec(text)) !== null) {
		const rawTag = match[1];
		if (/[a-zA-Z\p{L}]/.test(rawTag)) {
			const sanitized = sanitizeTag(rawTag);
			if (sanitized && sanitized.length > 1) {
				tags.push(sanitized);
			}
		}
	}
	return Array.from(new Set(tags));
}

/**
 * Sanitizes a video title so it can be safely used as a filename
 * across Windows, macOS, Linux, and Obsidian wikilinks.
 */
export function sanitizeFileName(name: string): string {
	let sanitized = name
		// Strip characters not allowed in file systems or Obsidian wikilinks: / \ : * ? " < > | # ^ [ ]
		.replace(/[\\/:*?"<>|#^[\]]/g, '')
		// Strip ASCII control characters 0x00-0x1F and 0x7F
		.replace(/[\x00-\x1f\x7f]/g, '')
		// Collapse whitespace
		.replace(/\s+/g, ' ')
		.trim();

	// Remove leading and trailing dots, hyphens, and spaces
	sanitized = sanitized.replace(/^[.\-\s]+|[.\-\s]+$/g, '');

	// Prevent reserved Windows names: CON, PRN, AUX, NUL, COM1-9, LPT1-9
	const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
	if (reserved.test(sanitized)) {
		sanitized = `${sanitized}-video`;
	}

	// Limit length to 100 characters to prevent path length issues
	if (sanitized.length > 100) {
		sanitized = sanitized.substring(0, 100).trim();
		sanitized = sanitized.replace(/^[.\-\s]+|[.\-\s]+$/g, '');
	}

	return sanitized || 'YouTube Summary';
}

/**
 * Sanitizes a tag string for Obsidian.
 */
export function sanitizeTag(tag: string): string {
	return tag
		.trim()
		.toLowerCase()
		.replace(/^#+/, '')
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-z0-9\-\/]/gi, '')
		.replace(/[-\/]+/g, (m) => (m.includes('/') ? '/' : '-'))
		.replace(/^[\-\/]+|[\-\/]+$/g, '');
}

/**
 * Sanitizes and deduplicates a list of tag candidates.
 * Strips '#' and special characters, converts to lowercase kebab-case,
 * and collapses duplicates (including case variations and hyphenated vs non-hyphenated variants).
 */
export function deduplicateTags(tags: string[]): string[] {
	if (!tags || tags.length === 0) return [];

	const sanitizedList: string[] = [];
	for (const raw of tags) {
		if (typeof raw !== 'string') continue;
		const sanitized = sanitizeTag(raw);
		if (sanitized && sanitized.length > 0) {
			sanitizedList.push(sanitized);
		}
	}

	// First pass: exact matches after sanitization
	const seen = new Set<string>();
	const uniqueTags: string[] = [];
	for (const tag of sanitizedList) {
		if (!seen.has(tag)) {
			seen.add(tag);
			uniqueTags.push(tag);
		}
	}

	// Second pass: collapse tags that only differ by hyphens/slashes, e.g. "rick-astley" vs "rickastley"
	// We prefer hierarchical tags with '/' (e.g. "ai/machine-learning" over "ai-machine-learning"),
	// followed by versions with hyphens/separators (e.g. "rick-astley") over run-together words ("rickastley")
	const normalizedMap = new Map<string, string>();
	for (const tag of uniqueTags) {
		const key = tag.replace(/[\-\/]/g, '');
		const existing = normalizedMap.get(key);
		if (!existing) {
			normalizedMap.set(key, tag);
		} else {
			const existingHasSlash = existing.includes('/');
			const currentHasSlash = tag.includes('/');
			if (currentHasSlash && !existingHasSlash) {
				normalizedMap.set(key, tag);
			} else if (!currentHasSlash && existingHasSlash) {
				// Keep existing hierarchical tag
			} else {
				const existingDelimCount = (existing.match(/[\-\/]/g) || []).length;
				const currentDelimCount = (tag.match(/[\-\/]/g) || []).length;
				if (currentDelimCount > existingDelimCount) {
					normalizedMap.set(key, tag);
				}
			}
		}
	}

	return Array.from(normalizedMap.values());
}

/**
 * Strips Obsidian [[wikilinks]] from terms in the "Technical terms" section,
 * keeping the terms themselves (e.g. - **[[Term]]**: ... becomes - **Term**: ...).
 */
export function stripWikilinksFromTechnicalTerms(content: string): string {
	const sectionRegex = /(^|\r?\n)(#{1,4}\s+[^\r\n]*technical\s+term[^\r\n]*\r?\n)([\s\S]*?)(?=(?:\r?\n#{1,4}\s+|\r?\n---\s*|$))/gi;
	return content.replace(sectionRegex, (match, prefix, heading, body) => {
		const strippedBody = body.replace(
			/\[\[([^\]\|]+)(?:\|([^\]]+))?\]\]/g,
			(_: string, target: string, display?: string) => display || target
		);
		return `${prefix}${heading}${strippedBody}`;
	});
}

/**
 * Formats a duration in seconds into a mm:ss or hh:mm:ss timestamp string.
 */
export function formatTimestamp(seconds: number): string {
	const totalSeconds = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const secs = totalSeconds % 60;

	if (hours > 0) {
		return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	}
	return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Formats duration / offset information into display timestamp, rounded seconds,
 * and Media Extended millisecond timestamp string.
 */
export function formatTimestampParts(offsetMs: number): {
	timeStr: string;
	roundedSeconds: number;
	meTimeStr: string;
} {
	const safeMs = Math.max(0, Math.round(offsetMs));
	const totalSeconds = Math.floor(safeMs / 1000);
	const roundedSeconds = Math.round(safeMs / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const hundredths = Math.floor((safeMs % 1000) / 10);

	const timeStr = hours > 0
		? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
		: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

	const meTimeStr = `${timeStr}.${String(hundredths).padStart(2, '0')}`;

	return { timeStr, roundedSeconds, meTimeStr };
}

/**
 * Timestamp link styles:
 * - `youtube`: standard YouTube link (`https://www.youtube.com/watch?v=ID&t=66s`), used in video summary notes.
 * - `mediaExtended`: Media Extended playback link (`https://www.youtube.com/watch?v=ID&t=66#t=01:05.61`),
 *   used in Media Extended companion notes.
 */
export type TimestampLinkFormat = 'youtube' | 'mediaExtended';

/**
 * Builds a timestamp URL for a video at the given offset in the requested link format.
 */
export function buildTimestampUrl(videoId: string, offsetMs: number, format: TimestampLinkFormat): string {
	const { roundedSeconds, meTimeStr } = formatTimestampParts(offsetMs);
	if (format === 'mediaExtended') {
		return `https://www.youtube.com/watch?v=${videoId}&t=${roundedSeconds}#t=${meTimeStr}`;
	}
	// Floor so the link never starts after the displayed timestamp
	const seconds = Math.floor(Math.max(0, offsetMs) / 1000);
	return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
}

export interface FormatTranscriptOptions {
	format?: TimestampLinkFormat;
}

/**
 * Formats an array of TranscriptLine objects into markdown transcript text
 * with every timestamp linked to the video (standard YouTube or Media Extended format).
 */
export function formatTranscript(
	lines: TranscriptLine[],
	videoId: string,
	options: FormatTranscriptOptions = {}
): string {
	const format = options.format ?? 'youtube';

	return lines
		.map((line) => {
			const { timeStr } = formatTimestampParts(line.offset);
			const url = buildTimestampUrl(videoId, line.offset, format);
			const text = line.text.replace(/\r?\n+/g, ' ').trim();
			return `- [${timeStr}](${url}) ${text}`;
		})
		.join('\n');
}

export interface MediaExtendedMetadata {
	mxUid?: string;
	videoId: string;
	title: string;
	description?: string;
	duration?: number;
	creator: string;
	publishedAt?: string;
	viewCount?: number;
	likeCount?: number;
	cover?: string;
	aspectRatio?: string;
}

/**
 * Generates a 24-character random lowercase alphanumeric UID matching Media Extended's format.
 */
export function generateMxUid(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let id = '';
	for (let i = 0; i < 24; i++) {
		id += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return id;
}

/**
 * Returns the cover image URL for a Media Extended note: the given cover, or the max-resolution WebP thumbnail.
 */
export function getMediaExtendedCoverUrl(data: Pick<MediaExtendedMetadata, 'cover' | 'videoId'>): string {
	return data.cover?.replace(/^"|"$/g, '') || `https://i.ytimg.com/vi_webp/${data.videoId}/maxresdefault.webp`;
}

/**
 * Builds an inline markdown image embed for a video cover.
 */
export function buildCoverEmbed(coverUrl: string): string {
	return `![Cover](${coverUrl})`;
}

/**
 * Builds YAML frontmatter specifically formatted for the Media Extended Obsidian plugin.
 */
export function buildMediaExtendedFrontmatter(data: MediaExtendedMetadata): string {
	const mxUid = data.mxUid || generateMxUid();
	const videoUrl = `https://www.youtube.com/watch?v=${data.videoId}`;
	const cover = getMediaExtendedCoverUrl(data);
	const aspectRatio = data.aspectRatio || '427 / 240';

	const lines: string[] = ['---'];
	lines.push(`mx-uid: ${mxUid}`);
	lines.push(`video: ${videoUrl}`);
	if (data.title.includes(':') || data.title.includes('"') || data.title.includes("'") || data.title.includes('#')) {
		lines.push(`title: ${JSON.stringify(data.title)}`);
	} else {
		lines.push(`title: ${data.title}`);
	}

	if (data.description && data.description.trim()) {
		lines.push('description: |-');
		const descLines = data.description.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
		for (const dLine of descLines) {
			lines.push(dLine.trim().length > 0 ? `  ${dLine}` : '');
		}
	} else {
		lines.push('description: ""');
	}

	if (typeof data.duration === 'number') {
		lines.push(`duration: ${Math.round(data.duration)}`);
	}
	lines.push(`creator: ${data.creator}`);
	if (data.publishedAt) {
		lines.push(`published_at: ${data.publishedAt}`);
	}
	if (typeof data.viewCount === 'number') {
		lines.push(`view_count: ${data.viewCount}`);
	}
	if (typeof data.likeCount === 'number') {
		lines.push(`like_count: ${data.likeCount}`);
	}
	lines.push(`cover: ${cover.startsWith('"') ? cover : `"${cover}"`}`);
	lines.push(`aspect_ratio: ${aspectRatio}`);
	lines.push('---');

	return lines.join('\n');
}

/**
 * Parses a timestamp string (e.g. "0:00", "01:23", "1:23:45") into total seconds.
 */
export function parseTimestampToSeconds(timeStr: string): number | null {
	const parts = timeStr.split(':').map((p) => parseInt(p, 10));
	if (parts.some((n) => isNaN(n))) return null;

	let hours = 0;
	let minutes = 0;
	let seconds = 0;

	if (parts.length === 3) {
		[hours, minutes, seconds] = parts;
	} else if (parts.length === 2) {
		[minutes, seconds] = parts;
	} else {
		return null;
	}

	return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Converts a timestamp string (e.g. "0:00", "01:23", "1:23:45") into a timestamp URL in the given format.
 */
export function parseTimestampToUrl(timeStr: string, videoId: string, format: TimestampLinkFormat): string | null {
	const totalSeconds = parseTimestampToSeconds(timeStr);
	return totalSeconds === null ? null : buildTimestampUrl(videoId, totalSeconds * 1000, format);
}

/**
 * Converts a timestamp string (e.g. "0:00", "01:23", "1:23:45") into a Media Extended playback URL.
 */
export function parseTimestampToMediaExtendedUrl(timeStr: string, videoId: string): string | null {
	return parseTimestampToUrl(timeStr, videoId, 'mediaExtended');
}

/**
 * Scans markdown text (a video description, AI summary, etc.) for timestamps
 * (e.g. "0:00", "01:23", "[01:23]", "(01:23)", "1:05:30") and converts them into markdown links
 * to the video in the given format, re-pointing existing timestamp links at the video.
 * Preserves existing non-timestamp markdown links, wikilinks, raw URLs, and code.
 */
export function convertTimestampsToLinks(
	text: string,
	videoId: string,
	format: TimestampLinkFormat
): string {
	if (!text || !text.trim()) {
		return text;
	}

	// Placeholders to protect already processed or existing links/URLs
	const protectedTokens: string[] = [];
	const createPlaceholder = (content: string): string => {
		const placeholder = `@@@TS_PROTECTED_TOKEN_${protectedTokens.length}@@@`;
		protectedTokens.push(content);
		return placeholder;
	};

	let processed = text;

	// Pattern for matching timestamp digits: H:MM:SS, HH:MM:SS, M:SS, or MM:SS
	// Seconds must be 00-59. Minutes in 3-part must be 00-59.
	const TS_PATTERN = '(?:\\d{1,2}:[0-5]\\d:[0-5]\\d|\\d{1,2}:[0-5]\\d)';

	// Step 1: Protect fenced code blocks, inline code, and wikilinks
	processed = processed.replace(/```[\s\S]*?```|`[^`\n]+`|\[\[[^\]\n]+\]\]/g, (match) => createPlaceholder(match));

	// Step 2: Re-point existing markdown links where the link text is a timestamp
	// e.g. [01:23](https://youtube.com/...)
	const existingMdLinkRegex = new RegExp(`\\[(${TS_PATTERN})\\]\\(([^)]+)\\)`, 'g');
	processed = processed.replace(existingMdLinkRegex, (_match, ts) => {
		const url = parseTimestampToUrl(ts, videoId, format);
		return url ? createPlaceholder(`[${ts}](${url})`) : createPlaceholder(_match);
	});

	// Step 3: Protect any other existing markdown links [text](url)
	const otherMdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
	processed = processed.replace(otherMdLinkRegex, (match) => createPlaceholder(match));

	// Step 4: Protect existing URLs (http:// or https://)
	const rawUrlRegex = /https?:\/\/[^\s)]+/g;
	processed = processed.replace(rawUrlRegex, (match) => createPlaceholder(match));

	// Step 5: Convert bracketed timestamps e.g. [01:23] or [1:23:45]
	const bracketedRegex = new RegExp(`\\[(${TS_PATTERN})\\]`, 'g');
	processed = processed.replace(bracketedRegex, (_match, ts) => {
		const url = parseTimestampToUrl(ts, videoId, format);
		return url ? createPlaceholder(`[${ts}](${url})`) : _match;
	});

	// Step 6: Convert standalone timestamps
	// Preceded by start of string, whitespace, '(', '>', '•', '-', or '*'
	// Followed by end of string, whitespace, ')', ':', '.', ',', '!', '?', '-', or '*'
	// Not followed by AM or PM (e.g. 10:00 AM)
	const standaloneRegex = new RegExp(
		`(?<=^|[\\s(>•*-])(${TS_PATTERN})(?=$|[\\s):.,!?*-])(?!\\s*(?:am|pm)\\b)`,
		'gi'
	);
	processed = processed.replace(standaloneRegex, (ts) => {
		const url = parseTimestampToUrl(ts, videoId, format);
		return url ? `[${ts}](${url})` : ts;
	});

	// Step 7: Restore protected placeholders, newest first, so tokens nested inside
	// later tokens (e.g. inline code inside link text) are restored too
	for (let i = protectedTokens.length - 1; i >= 0; i--) {
		const placeholder = `@@@TS_PROTECTED_TOKEN_${i}@@@`;
		processed = processed.replace(placeholder, () => protectedTokens[i]);
	}

	return processed;
}

/**
 * Converts description timestamps into standard YouTube timestamp links ([MM:SS](https://...&t=SECONDSs)).
 */
export function convertDescriptionTimestampsToYouTube(description: string, videoId: string): string {
	return convertTimestampsToLinks(description, videoId, 'youtube');
}

/**
 * Converts description timestamps into Media Extended markdown links ([MM:SS](https://...&t=SECONDS#t=MM:SS.00)).
 */
export function convertDescriptionTimestampsToMediaExtended(description: string, videoId: string): string {
	return convertTimestampsToLinks(description, videoId, 'mediaExtended');
}

/**
 * Appends or merges a wikilink into the "# Related" section of a markdown document.
 * If the section does not exist, it appends it to the end of the document.
 * Always ensures an empty line after the "# Related" heading before link items begin.
 */
export function addRelatedLink(content: string, linkTarget: string): string {
	const trimmed = content.trimEnd();
	const wikilink = `[[${linkTarget}]]`;
	const linkLine = `- ${wikilink}`;

	if (trimmed.includes(wikilink)) {
		return content;
	}

	const relatedHeaderRegex = /(^|\r?\n)(#{1,6}\s+Related[^\r\n]*)(\r?\n[\s\S]*?)?(?=(?:\r?\n#{1,6}\s+|$))/i;
	const match = trimmed.match(relatedHeaderRegex);

	if (match) {
		const fullMatch = match[0];
		const header = match[2];
		const body = match[3] || '';
		
		const cleanBody = body.trim();
		const updatedBody = cleanBody ? `\n\n${cleanBody}\n${linkLine}` : `\n\n${linkLine}`;
		const replacement = `${match[1]}${header}${updatedBody}`;
		return trimmed.replace(fullMatch, () => replacement);
	}

	return trimmed ? `${trimmed}\n\n# Related\n\n${linkLine}\n` : `# Related\n\n${linkLine}\n`;
}

export interface BuildMediaExtendedNoteOptions {
	includeDescription?: boolean;
	/** Adds the cover as an inline image at the top of the body (off unless requested) */
	embedCover?: boolean;
}

/**
 * Builds the complete text for a Media Extended note, combining frontmatter,
 * optional timestamped description, optional timestamped transcript,
 * and the # Related link back to the original summary note.
 * Places clean headings (# Description, # Transcript, # Related) with empty lines
 * before section content begins.
 */
export function buildMediaExtendedNote(
	data: MediaExtendedMetadata,
	transcriptText?: string,
	relatedNoteLink?: string,
	options?: BuildMediaExtendedNoteOptions
): string {
	const fm = buildMediaExtendedFrontmatter(data);
	const sections: string[] = [];

	if (options?.embedCover) {
		sections.push(buildCoverEmbed(getMediaExtendedCoverUrl(data)));
	}

	const includeDescription = options?.includeDescription ?? true;
	if (includeDescription && data.description && data.description.trim()) {
		const formattedDescription = convertDescriptionTimestampsToMediaExtended(
			data.description.trim(),
			data.videoId
		);
		sections.push(`# Description\n\n${formattedDescription}`);
	}

	if (transcriptText && transcriptText.trim()) {
		sections.push(`# Transcript\n\n${transcriptText.trim()}`);
	}

	let body = sections.join('\n\n');
	if (relatedNoteLink) {
		body = addRelatedLink(body, relatedNoteLink);
	}

	return body.trim() ? `${fm}\n\n${body.trim()}\n` : `${fm}\n`;
}

/**
 * Finds a markdown section (`# Heading` at the given level, case-insensitive) outside frontmatter and
 * code fences. Returns the line index of the heading and the line index where the section ends
 * (the next heading of the same or a higher level, or the number of lines).
 */
export function findMarkdownSection(content: string, heading: string, level = 1): { start: number; end: number } | null {
	const lines = content.split('\n');
	let i = 0;
	if (lines[0]?.trim() === '---') {
		const close = lines.findIndex((line, idx) => idx > 0 && line.trim() === '---');
		i = close >= 0 ? close + 1 : 0;
	}

	const target = heading.trim().toLowerCase();
	let inFence = false;
	let start = -1;
	for (; i < lines.length; i++) {
		if (/^\s*(```|~~~)/.test(lines[i])) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;
		const match = lines[i].match(/^(#{1,6}) +(.+?)\s*$/);
		if (!match) continue;
		const lineLevel = match[1].length;
		if (start >= 0) {
			if (lineLevel <= level) {
				return { start, end: i };
			}
			continue;
		}
		if (lineLevel === level && match[2].toLowerCase() === target) {
			start = i;
		}
	}
	return start >= 0 ? { start, end: lines.length } : null;
}

/**
 * Checks whether a note has a `# Heading` section at the given level (default level 1).
 */
export function hasMarkdownSection(content: string, heading: string, level = 1): boolean {
	return findMarkdownSection(content, heading, level) !== null;
}

/**
 * Writes a heading (at `level`, default `#`) + body into a note. Replaces the section if it exists;
 * otherwise inserts it before the earliest of the level-1 `insertBefore` headings that exists, or
 * appends it at the end. Sections are separated by a single empty line, with an empty line after each heading.
 */
export function upsertMarkdownSection(
	content: string,
	heading: string,
	body: string,
	insertBefore: string[] = [],
	level = 1
): string {
	const lines = content.replace(/\r\n/g, '\n').split('\n');
	const normalized = lines.join('\n');
	const sectionText = `${'#'.repeat(level)} ${heading}\n\n${body.trim()}`;

	const join = (before: string[], after: string[]): string => {
		const head = before.join('\n').replace(/\s+$/, '');
		const tail = after.join('\n').replace(/^\s+/, '').replace(/\s+$/, '');
		return `${[head, sectionText, tail].filter(Boolean).join('\n\n')}\n`;
	};

	const existing = findMarkdownSection(normalized, heading, level);
	if (existing) {
		return join(lines.slice(0, existing.start), lines.slice(existing.end));
	}

	const anchors = insertBefore
		.map((h) => findMarkdownSection(normalized, h))
		.filter((s): s is { start: number; end: number } => s !== null)
		.sort((a, b) => a.start - b.start);
	if (anchors.length > 0) {
		return join(lines.slice(0, anchors[0].start), lines.slice(anchors[0].start));
	}

	return join(lines, []);
}

/**
 * Classifies a note for metadata refresh: a Media Extended companion note, a video summary note
 * (frontmatter has a `video_url`), or neither.
 */
export function getVideoNoteKind(content: string, filePath: string, mediaFolder: string): 'mediaExtended' | 'summary' | null {
	if (isMediaExtendedCompanionNote(content, filePath, mediaFolder)) {
		return 'mediaExtended';
	}
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (fmMatch && /^video_url:\s*["']?https?:\/\//m.test(fmMatch[1])) {
		return 'summary';
	}
	return null;
}

/**
 * Decides whether the summarizer should treat a note as blank and write the summary into it.
 * A note is blank when it's empty, or when all of these hold: its frontmatter has no keys other than
 * `tags`, it has no body, and its name starts with "Untitled" (e.g. a new note that got default tags
 * from a template).
 */
export function isBlankNoteForSummary(content: string, noteName: string): boolean {
	if (content.trim() === '') {
		return true;
	}
	if (!/^untitled/i.test(noteName.trim())) {
		return false;
	}

	const fmMatch = content.match(/^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/);
	if (!fmMatch) {
		return false;
	}
	const body = content.slice(fmMatch[0].length);
	if (body.trim() !== '') {
		return false;
	}

	const keys = splitYamlBlocks((fmMatch[1] ?? '').replace(/\r\n/g, '\n'))
		.filter((block) => block.lines.some((line) => line.trim() !== ''))
		.map((block) => block.key);
	return keys.every((key) => key === 'tags');
}

/**
 * Extracts a note's frontmatter tags, whether written as a list, inline (`[a, b]`), or a single
 * value (`tags: a, b`). Strips quotes and leading `#`.
 */
export function extractFrontmatterTags(content: string): string[] {
	const fmMatch = content.replace(/\r\n/g, '\n').match(/^---\n(?:([\s\S]*?)\n)?---(?:\n|$)/);
	const tagsBlock = splitYamlBlocks(fmMatch?.[1] ?? '').find((block) => block.key === 'tags');
	if (!tagsBlock) {
		return [];
	}

	const raw: string[] = [];
	const inline = tagsBlock.lines[0].replace(/^tags:/, '').trim();
	if (inline.startsWith('[') && inline.endsWith(']')) {
		raw.push(...inline.slice(1, -1).split(','));
	} else if (inline) {
		raw.push(...inline.split(/[,\s]+/));
	}
	for (const line of tagsBlock.lines.slice(1)) {
		const item = line.match(/^\s*-\s+(.*)$/);
		if (item) {
			raw.push(item[1]);
		}
	}
	return raw.map((tag) => tag.trim().replace(/^['"]|['"]$/g, '').replace(/^#/, '')).filter(Boolean);
}

/**
 * Adds tags to a note's frontmatter `tags`, combining them with the existing tags through the same
 * `deduplicateTags()` used when summarizing. Leaves the rest of the frontmatter and the body unchanged,
 * and returns the note untouched when nothing new would be added. Creates frontmatter if there is none.
 */
export function addTagsToNoteContent(content: string, newTags: string[]): { content: string; added: string[] } {
	const existing = extractFrontmatterTags(content);
	const existingDeduplicated = new Set(deduplicateTags(existing));
	const combined = deduplicateTags([...existing, ...newTags]);
	const added = combined.filter((tag) => !existingDeduplicated.has(tag));
	if (added.length === 0) {
		return { content, added };
	}

	const tagsBlock = ['tags:', ...combined.map((tag) => `  - ${tag}`)].join('\n');
	const normalized = content.replace(/\r\n/g, '\n');
	const fmMatch = normalized.match(/^---\n(?:([\s\S]*?)\n)?---(?:\n|$)/);
	if (!fmMatch) {
		const body = normalized.replace(/^\s+/, '');
		return { content: body ? `---\n${tagsBlock}\n---\n\n${body}` : `---\n${tagsBlock}\n---\n`, added };
	}
	const merged = fmMatch[1] ? mergeYamlBlocks(fmMatch[1], tagsBlock) : tagsBlock;
	return { content: `---\n${merged}\n---\n${normalized.slice(fmMatch[0].length)}`, added };
}

/**
 * Splits YAML into top-level blocks: a `key:` line plus its indented/blank continuation lines.
 * Other unindented lines (e.g. comments) become their own key-less blocks.
 */
function splitYamlBlocks(yaml: string): { key: string | null; lines: string[] }[] {
	const blocks: { key: string | null; lines: string[] }[] = [];
	for (const line of yaml.split('\n')) {
		const keyMatch = line.match(/^([A-Za-z0-9_-]+):/);
		if (keyMatch) {
			blocks.push({ key: keyMatch[1], lines: [line] });
		} else if (/^\S/.test(line) || blocks.length === 0) {
			blocks.push({ key: null, lines: [line] });
		} else {
			blocks[blocks.length - 1].lines.push(line);
		}
	}
	return blocks;
}

/**
 * Merges top-level YAML blocks: keys present in `updatesYaml` replace the existing block in place
 * (including multi-line values like `description: |-`), keys not yet present are appended,
 * and every other existing key and comment is kept as-is.
 */
export function mergeYamlBlocks(existingYaml: string, updatesYaml: string): string {
	const updates = splitYamlBlocks(updatesYaml).filter((block) => block.key !== null);
	const updateMap = new Map(updates.map((block) => [block.key as string, block.lines]));
	const used = new Set<string>();

	const merged: string[] = [];
	for (const block of splitYamlBlocks(existingYaml)) {
		if (block.key !== null && updateMap.has(block.key)) {
			if (!used.has(block.key)) {
				merged.push(...(updateMap.get(block.key) as string[]));
				used.add(block.key);
			}
		} else {
			merged.push(...block.lines);
		}
	}
	for (const block of updates) {
		if (!used.has(block.key as string)) {
			merged.push(...block.lines);
		}
	}
	return merged.join('\n');
}

/**
 * Extracts the 11-character YouTube video ID from a watch, youtu.be, shorts, or embed URL.
 */
export function extractVideoIdFromUrl(url: string): string | null {
	return url.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
}

/**
 * Checks whether any of the given frontmatter keys holds a YouTube URL for `videoId`
 * (e.g. `video_url` for summary notes, `video` / `media` for Media Extended notes).
 */
export function frontmatterMatchesVideo(
	frontmatter: Record<string, unknown> | undefined | null,
	keys: string[],
	videoId: string
): boolean {
	if (!frontmatter) return false;
	return keys.some((key) => {
		const value = frontmatter[key];
		return typeof value === 'string' && extractVideoIdFromUrl(value) === videoId;
	});
}

/**
 * Returns `freshContent` (a regenerated note), but with any frontmatter properties from `existingContent`
 * that the fresh note doesn't set carried over (e.g. user-added keys and tags). Used when rebuilding a note.
 */
export function keepExtraFrontmatter(existingContent: string, freshContent: string): string {
	const pattern = /^---\n(?:([\s\S]*?)\n)?---(?:\n|$)/;
	const existingMatch = existingContent.replace(/\r\n/g, '\n').match(pattern);
	const fresh = freshContent.replace(/\r\n/g, '\n');
	const freshMatch = fresh.match(pattern);
	if (!existingMatch?.[1] || !freshMatch) {
		return freshContent;
	}
	const merged = mergeYamlBlocks(existingMatch[1], freshMatch[1] ?? '');
	return `---\n${merged}\n---\n${fresh.slice(freshMatch[0].length)}`;
}

/**
 * Refreshes the frontmatter of a Media Extended note from fresh video metadata, keeping the existing
 * `mx-uid`, any other keys, and the note body. Notes that reference the video via `media:` don't get
 * a duplicate `video:` key.
 */
export function refreshMediaExtendedNoteContent(content: string, metadata: MediaExtendedMetadata): string {
	const normalized = content.replace(/\r\n/g, '\n');
	const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
	const existingYaml = fmMatch?.[1] ?? '';
	const existingUid = existingYaml.match(/^mx-uid:\s*([A-Za-z0-9_-]+)/m)?.[1];

	const fresh = buildMediaExtendedFrontmatter({ ...metadata, mxUid: existingUid ?? metadata.mxUid });
	let freshYaml = fresh.replace(/^---\n/, '').replace(/\n---$/, '');
	if (/^media:/m.test(existingYaml) && !/^video:/m.test(existingYaml)) {
		freshYaml = freshYaml.split('\n').filter((line) => !line.startsWith('video:')).join('\n');
	}

	if (!fmMatch) {
		const body = normalized.replace(/^\s+/, '');
		return body ? `${fresh}\n\n${body}` : `${fresh}\n`;
	}
	const body = normalized.slice(fmMatch[0].length);
	return `---\n${mergeYamlBlocks(existingYaml, freshYaml)}\n---\n${body}`;
}

/**
 * Ensures the `# first` section comes before the `# second` section (e.g. Description before Transcript).
 * If both exist and are out of order, moves the first section to directly above the second.
 */
export function ensureSectionOrder(content: string, first: string, second: string): string {
	const normalized = content.replace(/\r\n/g, '\n');
	const firstSection = findMarkdownSection(normalized, first);
	const secondSection = findMarkdownSection(normalized, second);
	if (!firstSection || !secondSection || firstSection.start < secondSection.start) {
		return content;
	}

	const lines = normalized.split('\n');
	const moved = lines.slice(firstSection.start, firstSection.end).join('\n').trim();
	const remaining = [...lines.slice(0, firstSection.start), ...lines.slice(firstSection.end)];
	const head = remaining.slice(0, secondSection.start).join('\n').replace(/\s+$/, '');
	const tail = remaining.slice(secondSection.start).join('\n').replace(/^\s+/, '').replace(/\s+$/, '');
	return `${[head, moved, tail].filter(Boolean).join('\n\n')}\n`;
}

/**
 * Filters a list of files by target folder paths (prefix match).
 * If targetFolders is empty, returns all files.
 */
export function filterFilesByFolderPaths<T extends { path: string }>(
	files: T[],
	targetFolders: string[]
): T[] {
	if (!targetFolders || targetFolders.length === 0) {
		return files;
	}
	const normalizedTargets = targetFolders
		.map((f) => f.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
		.filter((f) => f.length > 0);

	if (normalizedTargets.length === 0) {
		return files;
	}

	return files.filter((file) => {
		const filePath = file.path.replace(/\\/g, '/');
		return normalizedTargets.some(
			(folder) => filePath.startsWith(folder + '/') || filePath === folder
		);
	});
}

/**
 * Filters a list of files by a specific folder (or vault root).
 * If folder is root, returns all files.
 */
export function filterFilesByFolder<T extends { path: string }>(
	files: T[],
	folder: { path: string; isRoot(): boolean }
): T[] {
	if (folder.isRoot()) {
		return files;
	}
	const folderPath = folder.path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
	return files.filter((file) => {
		const filePath = file.path.replace(/\\/g, '/');
		return filePath.startsWith(folderPath + '/') || filePath === folderPath;
	});
}


