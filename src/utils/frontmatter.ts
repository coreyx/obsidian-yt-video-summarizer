import { Editor } from 'obsidian';

export interface FrontmatterData {
	title: string;
	channel_name: string;
	channel_username: string;
	channel_url: string;
	video_url: string;
	thumbnail: string;
	thumbnail_text: string;
	tags?: string[];
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

	if (data.tags && data.tags.length > 0) {
		lines.push('tags:');
		for (const tag of data.tags) {
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

	let inTagsBlock = false;
	const existingTags: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const keyMatch = line.match(/^([a-zA-Z0-9_-]+):(.*)$/);

		if (keyMatch) {
			const key = keyMatch[1];

			if (key === 'tags') {
				inTagsBlock = true;
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

			if (key in targetKeys) {
				newLines.push(targetKeys[key]);
				updatedKeys.add(key);
				continue;
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

		newLines.push(line);
	}

	// Add any target keys that were not present in the original frontmatter
	for (const [key, line] of Object.entries(targetKeys)) {
		if (!updatedKeys.has(key)) {
			newLines.push(line);
		}
	}

	// Handle tags
	if (options?.excludeTags) {
		// When excluding tags during upgrades, preserve any existing tags
		if (existingTags.length > 0) {
			newLines.push('tags:');
			for (const tag of existingTags.map(sanitizeTag).filter(Boolean)) {
				newLines.push(`  - ${tag}`);
			}
		}
	} else {
		// Normal mode: merge existing tags with new tags
		const combinedTags = Array.from(
			new Set([...existingTags, ...(data.tags || [])])
		).map(sanitizeTag).filter(Boolean);

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
