/**
 * TEMPORARY: copies of plugin functions that more than one test file used before the split.
 * They still re-implement src/ instead of importing it. Each is replaced by the real function and
 * deleted here by a later task in spec/test-real-source, and this file is then removed.
 */

export function sanitizeTag(tag) {
	return tag
		.trim()
		.toLowerCase()
		.replace(/^#+/, '')
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-z0-9\-\/]/gi, '')
		.replace(/[-\/]+/g, (m) => (m.includes('/') ? '/' : '-'))
		.replace(/^[\-\/]+|[\-\/]+$/g, '');
}

export function mergeFrontmatter(rawYaml, data) {
	const lines = rawYaml.split(/\r?\n/);
	const updatedKeys = new Set();
	const newLines = [];

	const targetKeys = {
		title: `title: ${JSON.stringify(data.title)}`,
		channel_name: `channel_name: ${JSON.stringify(data.channel_name)}`,
		channel_username: `channel_username: ${JSON.stringify(data.channel_username || '')}`,
		channel_url: `channel_url: ${JSON.stringify(data.channel_url)}`,
		video_url: `video_url: ${JSON.stringify(data.video_url)}`,
		thumbnail: `thumbnail: ${JSON.stringify(data.thumbnail)}`,
		thumbnail_text: `thumbnail_text: ${JSON.stringify(data.thumbnail_text || '')}`,
	};

	let inTagsBlock = false;
	const existingTags = [];

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

	for (const [key, line] of Object.entries(targetKeys)) {
		if (!updatedKeys.has(key)) {
			newLines.push(line);
		}
	}

	const combinedTags = Array.from(
		new Set([...existingTags, ...(data.tags || [])])
	).map(sanitizeTag).filter(Boolean);

	if (combinedTags.length > 0) {
		newLines.push('tags:');
		for (const tag of combinedTags) {
			newLines.push(`  - ${tag}`);
		}
	}

	return newLines.join('\n').trim();
}

export function extractTagsFromText(text) {
	if (!text) return [];
	const tagRegex = /(?:^|\s)#([\p{L}\p{N}_\-]+)/gu;
	const tags = [];
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

export function formatTimestampPartsHelper(offsetMs) {
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

export function buildTimestampUrlHelper(videoId, offsetMs, format) {
	const { roundedSeconds, meTimeStr } = formatTimestampPartsHelper(offsetMs);
	if (format === 'mediaExtended') {
		return `https://www.youtube.com/watch?v=${videoId}&t=${roundedSeconds}#t=${meTimeStr}`;
	}
	const seconds = Math.floor(Math.max(0, offsetMs) / 1000);
	return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
}

export function formatTranscriptHelper(lines, videoId, options = {}) {
	const format = options.format ?? 'youtube';

	return lines
		.map((line) => {
			const { timeStr } = formatTimestampPartsHelper(line.offset);
			const url = buildTimestampUrlHelper(videoId, line.offset, format);
			const text = line.text.replace(/\r?\n+/g, ' ').trim();
			return `- [${timeStr}](${url}) ${text}`;
		})
		.join('\n');
}

export function generateMxUidHelper() {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let id = '';
	for (let i = 0; i < 24; i++) {
		id += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return id;
}

export function buildMediaExtendedFrontmatterHelper(data) {
	const mxUid = data.mxUid || generateMxUidHelper();
	const videoUrl = `https://www.youtube.com/watch?v=${data.videoId}`;
	const cover = getMediaExtendedCoverUrlHelper(data);
	const aspectRatio = data.aspectRatio || '427 / 240';

	const lines = ['---'];
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

export function parseTimestampToSecondsHelper(timeStr) {
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

export function parseTimestampToUrlHelper(timeStr, videoId, format) {
	const totalSeconds = parseTimestampToSecondsHelper(timeStr);
	return totalSeconds === null ? null : buildTimestampUrlHelper(videoId, totalSeconds * 1000, format);
}

export function convertTimestampsToLinksHelper(text, videoId, format) {
	if (!text || !text.trim()) {
		return text;
	}

	const protectedTokens = [];
	const createPlaceholder = (content) => {
		const placeholder = `@@@TS_PROTECTED_TOKEN_${protectedTokens.length}@@@`;
		protectedTokens.push(content);
		return placeholder;
	};

	let processed = text;
	const TS_PATTERN = '(?:\\d{1,2}:[0-5]\\d:[0-5]\\d|\\d{1,2}:[0-5]\\d)';

	processed = processed.replace(/```[\s\S]*?```|`[^`\n]+`|\[\[[^\]\n]+\]\]/g, (match) => createPlaceholder(match));

	const existingMdLinkRegex = new RegExp(`\\[(${TS_PATTERN})\\]\\(([^)]+)\\)`, 'g');
	processed = processed.replace(existingMdLinkRegex, (_match, ts) => {
		const url = parseTimestampToUrlHelper(ts, videoId, format);
		return url ? createPlaceholder(`[${ts}](${url})`) : createPlaceholder(_match);
	});

	const otherMdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
	processed = processed.replace(otherMdLinkRegex, (match) => createPlaceholder(match));

	const rawUrlRegex = /https?:\/\/[^\s)]+/g;
	processed = processed.replace(rawUrlRegex, (match) => createPlaceholder(match));

	const bracketedRegex = new RegExp(`\\[(${TS_PATTERN})\\]`, 'g');
	processed = processed.replace(bracketedRegex, (_match, ts) => {
		const url = parseTimestampToUrlHelper(ts, videoId, format);
		return url ? createPlaceholder(`[${ts}](${url})`) : _match;
	});

	const standaloneRegex = new RegExp(
		`(?<=^|[\\s(>•*-])(${TS_PATTERN})(?=$|[\\s):.,!?*-])(?!\\s*(?:am|pm)\\b)`,
		'gi'
	);
	processed = processed.replace(standaloneRegex, (ts) => {
		const url = parseTimestampToUrlHelper(ts, videoId, format);
		return url ? `[${ts}](${url})` : ts;
	});

	for (let i = protectedTokens.length - 1; i >= 0; i--) {
		const placeholder = `@@@TS_PROTECTED_TOKEN_${i}@@@`;
		processed = processed.replace(placeholder, () => protectedTokens[i]);
	}

	return processed;
}

export function getMediaExtendedCoverUrlHelper(data) {
	return data.cover?.replace(/^"|"$/g, '') || `https://i.ytimg.com/vi_webp/${data.videoId}/maxresdefault.webp`;
}

export function deduplicateTagsHelper(tags) {
	if (!tags || tags.length === 0) return [];

	const sanitizedList = [];
	for (const raw of tags) {
		if (typeof raw !== 'string') continue;
		const sanitized = sanitizeTag(raw);
		if (sanitized && sanitized.length > 0) {
			sanitizedList.push(sanitized);
		}
	}

	const seen = new Set();
	const uniqueTags = [];
	for (const tag of sanitizedList) {
		if (!seen.has(tag)) {
			seen.add(tag);
			uniqueTags.push(tag);
		}
	}

	const normalizedMap = new Map();
	for (const tag of uniqueTags) {
		const key = tag.replace(/[\-\/]/g, '');
		const existing = normalizedMap.get(key);
		if (!existing) {
			normalizedMap.set(key, tag);
		} else {
			const existingHyphenCount = (existing.match(/[\-\/]/g) || []).length;
			const currentHyphenCount = (tag.match(/[\-\/]/g) || []).length;
			if (currentHyphenCount > existingHyphenCount) {
				normalizedMap.set(key, tag);
			}
		}
	}

	return Array.from(normalizedMap.values());
}

export function isMediaExtendedCompanionNoteHelper(content, filePath, mediaFolder = 'Media Library') {
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

export function testFilterFilesByFolderPaths(files, targetFolders) {
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

export function findMarkdownSectionHelper(content, heading, level = 1) {
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
			if (lineLevel <= level) return { start, end: i };
			continue;
		}
		if (lineLevel === level && match[2].toLowerCase() === target) start = i;
	}
	return start >= 0 ? { start, end: lines.length } : null;
}

export function upsertMarkdownSectionHelper(content, heading, body, insertBefore = [], level = 1) {
	const lines = content.replace(/\r\n/g, '\n').split('\n');
	const normalized = lines.join('\n');
	const sectionText = `${'#'.repeat(level)} ${heading}\n\n${body.trim()}`;
	const join = (before, after) => {
		const head = before.join('\n').replace(/\s+$/, '');
		const tail = after.join('\n').replace(/^\s+/, '').replace(/\s+$/, '');
		return `${[head, sectionText, tail].filter(Boolean).join('\n\n')}\n`;
	};
	const existing = findMarkdownSectionHelper(normalized, heading, level);
	if (existing) return join(lines.slice(0, existing.start), lines.slice(existing.end));
	const anchors = insertBefore
		.map((h) => findMarkdownSectionHelper(normalized, h))
		.filter((s) => s !== null)
		.sort((a, b) => a.start - b.start);
	if (anchors.length > 0) return join(lines.slice(0, anchors[0].start), lines.slice(anchors[0].start));
	return join(lines, []);
}

export function getVideoNoteKindHelper(content, filePath, mediaFolder) {
	if (isMediaExtendedCompanionNoteHelper(content, filePath, mediaFolder)) return 'mediaExtended';
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (fmMatch && /^video_url:\s*["']?https?:\/\//m.test(fmMatch[1])) return 'summary';
	return null;
}

export function splitYamlBlocksHelper(yaml) {
	const blocks = [];
	for (const line of yaml.split('\n')) {
		const keyMatch = line.match(/^([A-Za-z0-9_-]+):/);
		if (keyMatch) blocks.push({ key: keyMatch[1], lines: [line] });
		else if (/^\S/.test(line) || blocks.length === 0) blocks.push({ key: null, lines: [line] });
		else blocks[blocks.length - 1].lines.push(line);
	}
	return blocks;
}

export function mergeYamlBlocksHelper(refreshExistingYaml, refreshUpdatesYaml) {
	const updates = splitYamlBlocksHelper(refreshUpdatesYaml).filter((b) => b.key !== null);
	const updateMap = new Map(updates.map((b) => [b.key, b.lines]));
	const used = new Set();
	const merged = [];
	for (const block of splitYamlBlocksHelper(refreshExistingYaml)) {
		if (block.key !== null && updateMap.has(block.key)) {
			if (!used.has(block.key)) {
				merged.push(...updateMap.get(block.key));
				used.add(block.key);
			}
		} else {
			merged.push(...block.lines);
		}
	}
	for (const block of updates) if (!used.has(block.key)) merged.push(...block.lines);
	return merged.join('\n');
}
