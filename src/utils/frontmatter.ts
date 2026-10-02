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
	const lines = rawYaml.split(/\r?\n/);
	const updatedKeys = new Set<string>();
	const newLines: string[] = [];

	const targetKeys: Record<string, string> = {
		title: `title: ${JSON.stringify(data.title)}`,
		channel_name: `channel_name: ${JSON.stringify(data.channel_name)}`,
		channel_username: `channel_username: ${JSON.stringify(data.channel_username || '')}`,
		channel_url: `channel_url: ${JSON.stringify(data.channel_url)}`,
		video_url: `video_url: ${JSON.stringify(data.video_url)}`,
		thumbnail: `thumbnail: ${JSON.stringify(data.thumbnail)}`,
		thumbnail_text: `thumbnail_text: ${JSON.stringify(data.thumbnail_text || '')}`,
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
	// 1. Check YAML frontmatter video_url
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (fmMatch) {
		const videoUrlMatch = fmMatch[1].match(/^video_url:\s*["']?([^"'\r\n]+)["']?/m);
		if (videoUrlMatch && videoUrlMatch[1].trim()) {
			return videoUrlMatch[1].trim();
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
 * Checks if a note is missing any of the standard frontmatter fields.
 */
export function isNoteMissingFrontmatter(content: string): boolean {
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fmMatch) return true;

	const yaml = fmMatch[1];
	const requiredFields = [
		'title:',
		'channel_name:',
		'channel_username:',
		'channel_url:',
		'video_url:',
		'thumbnail:',
		'thumbnail_text:',
	];

	return requiredFields.some(field => !yaml.includes(field));
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
 * Checks if a note is missing the description property in its frontmatter.
 */
export function isNoteMissingDescriptionFrontmatter(content: string): boolean {
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fmMatch) {
		return true;
	}
	const yaml = fmMatch[1];
	return !/^description:\s*/m.test(yaml);
}

/**
 * Checks if a note is missing playlist properties (playlist_title, playlist_url, etc.) in its frontmatter.
 */
export function isNoteMissingPlaylistFrontmatter(content: string): boolean {
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fmMatch) {
		return true;
	}
	const yaml = fmMatch[1];
	return !/^playlist(_[a-zA-Z0-9_-]*)?:\s*/m.test(yaml);
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
	// We prefer hierarchical tags with '/' (e.g. "ai/music-videos" over "ai-music-videos"),
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

export interface FormatTranscriptOptions {
	linkTimestamps?: boolean;
	mediaExtended?: boolean;
}

/**
 * Formats an array of TranscriptLine objects into markdown transcript text
 * with optional YouTube timestamp links and Media Extended playback links.
 */
export function formatTranscript(
	lines: TranscriptLine[],
	videoId: string,
	options: FormatTranscriptOptions = {}
): string {
	const linkTimestamps = options.linkTimestamps ?? true;
	const mediaExtended = options.mediaExtended ?? true;

	return lines
		.map((line) => {
			const { timeStr, roundedSeconds, meTimeStr } = formatTimestampParts(line.offset);

			let timestampPart = timeStr;
			if (linkTimestamps) {
				const url = mediaExtended
					? `https://www.youtube.com/watch?v=${videoId}&t=${roundedSeconds}#t=${meTimeStr}`
					: `https://www.youtube.com/watch?v=${videoId}&t=${roundedSeconds}`;
				timestampPart = `[${timeStr}](${url})`;
			}

			const text = line.text.replace(/\r?\n+/g, ' ').trim();
			return `- ${timestampPart} ${text}`;
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
 * Builds YAML frontmatter specifically formatted for the Media Extended Obsidian plugin.
 */
export function buildMediaExtendedFrontmatter(data: MediaExtendedMetadata): string {
	const mxUid = data.mxUid || generateMxUid();
	const videoUrl = `https://www.youtube.com/watch?v=${data.videoId}`;
	const cover = data.cover || `"[[mx-cover-youtube_${data.videoId}.jpg]]"`;
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
 * Converts a timestamp string (e.g. "0:00", "01:23", "1:23:45") into a Media Extended playback URL.
 */
export function parseTimestampToMediaExtendedUrl(timeStr: string, videoId: string): string | null {
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

	const totalSeconds = hours * 3600 + minutes * 60 + seconds;
	const { meTimeStr } = formatTimestampParts(totalSeconds * 1000);
	return `https://www.youtube.com/watch?v=${videoId}&t=${totalSeconds}#t=${meTimeStr}`;
}

/**
 * Scans a video description for timestamps (e.g. "0:00", "01:23", "[01:23]", "(01:23)", "1:05:30")
 * and converts them into Media Extended markdown links ([MM:SS](https://...&t=SECONDS#t=MM:SS.00))
 * while preserving existing non-timestamp markdown links and URLs.
 */
export function convertDescriptionTimestampsToMediaExtended(
	description: string,
	videoId: string
): string {
	if (!description || !description.trim()) {
		return description;
	}

	// Placeholders to protect already processed or existing links/URLs
	const protectedTokens: string[] = [];
	const createPlaceholder = (content: string): string => {
		const placeholder = `@@@ME_PROTECTED_TOKEN_${protectedTokens.length}@@@`;
		protectedTokens.push(content);
		return placeholder;
	};

	let processed = description;

	// Pattern for matching timestamp digits: H:MM:SS, HH:MM:SS, M:SS, or MM:SS
	// Seconds must be 00-59. Minutes in 3-part must be 00-59.
	const TS_PATTERN = '(?:\\d{1,2}:[0-5]\\d:[0-5]\\d|\\d{1,2}:[0-5]\\d)';

	// Step 1: Convert existing markdown links where the link text is a timestamp
	// e.g. [01:23](https://youtube.com/...)
	const existingMdLinkRegex = new RegExp(`\\[(${TS_PATTERN})\\]\\(([^)]+)\\)`, 'g');
	processed = processed.replace(existingMdLinkRegex, (_match, ts) => {
		const url = parseTimestampToMediaExtendedUrl(ts, videoId);
		return url ? createPlaceholder(`[${ts}](${url})`) : createPlaceholder(_match);
	});

	// Step 2: Protect any other existing markdown links [text](url)
	const otherMdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
	processed = processed.replace(otherMdLinkRegex, (match) => createPlaceholder(match));

	// Step 3: Protect existing URLs (http:// or https://)
	const rawUrlRegex = /https?:\/\/[^\s)]+/g;
	processed = processed.replace(rawUrlRegex, (match) => createPlaceholder(match));

	// Step 4: Convert bracketed timestamps e.g. [01:23] or [1:23:45]
	const bracketedRegex = new RegExp(`\\[(${TS_PATTERN})\\]`, 'g');
	processed = processed.replace(bracketedRegex, (_match, ts) => {
		const url = parseTimestampToMediaExtendedUrl(ts, videoId);
		return url ? createPlaceholder(`[${ts}](${url})`) : _match;
	});

	// Step 5: Convert standalone timestamps
	// Preceded by start of string, whitespace, '(', '>', '•', or '-'
	// Followed by end of string, whitespace, ')', ':', '.', ',', '!', '?', or '-'
	// Not followed by AM or PM (e.g. 10:00 AM)
	const standaloneRegex = new RegExp(
		`(?<=^|[\\s(>•-])(${TS_PATTERN})(?=$|[\\s):.,!?-])(?!\\s*(?:am|pm)\\b)`,
		'gi'
	);
	processed = processed.replace(standaloneRegex, (ts) => {
		const url = parseTimestampToMediaExtendedUrl(ts, videoId);
		return url ? `[${ts}](${url})` : ts;
	});

	// Step 6: Restore all protected placeholders
	for (let i = 0; i < protectedTokens.length; i++) {
		const placeholder = `@@@ME_PROTECTED_TOKEN_${i}@@@`;
		processed = processed.replace(placeholder, () => protectedTokens[i]);
	}

	return processed;
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
 * Parses a comma- or newline-separated string of folder paths into normalized folder paths.
 * Normalizes backslashes to forward slashes and strips leading/trailing slashes.
 */
export function parseFolderList(foldersStr: string): string[] {
	if (!foldersStr || !foldersStr.trim()) return [];
	return foldersStr
		.split(/[\n,]/)
		.map((f) => f.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
		.filter((f) => f.length > 0);
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


