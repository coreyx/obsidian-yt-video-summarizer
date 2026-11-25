// Building and merging frontmatter, frontmatter tags, sanitizing, video stats, YAML block merging, blank-note detection, and the topic property.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { loadSource } from './helpers/loadSource.mjs';
import {
	sanitizeTag,
	mergeFrontmatter,
	extractTagsFromText,
	buildMediaExtendedFrontmatterHelper,
	deduplicateTagsHelper,
	getVideoNoteKindHelper,
	splitYamlBlocksHelper,
	mergeYamlBlocksHelper,
} from './helpers/legacy-copies.mjs';

// Test 1: sanitizeFileName
function sanitizeFileName(name) {
	let sanitized = name
		.replace(/[\\/:*?"<>|#^[\]]/g, '')
		.replace(/[\x00-\x1f\x7f]/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	sanitized = sanitized.replace(/^[.\-\s]+|[.\-\s]+$/g, '');

	const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
	if (reserved.test(sanitized)) {
		sanitized = `${sanitized}-video`;
	}

	if (sanitized.length > 100) {
		sanitized = sanitized.substring(0, 100).trim();
		sanitized = sanitized.replace(/^[.\-\s]+|[.\-\s]+$/g, '');
	}

	return sanitized || 'YouTube Summary';
}

console.log('Testing sanitizeFileName...');
assert.strictEqual(
	sanitizeFileName('How to Build AI Agents? (2026 Tutorial) #1 [Full] / <Live>'),
	'How to Build AI Agents (2026 Tutorial) 1 Full Live'
);
assert.strictEqual(sanitizeFileName('con'), 'con-video');
assert.strictEqual(sanitizeFileName('aux.md'), 'aux.md-video');
assert.strictEqual(sanitizeFileName('   ...---   '), 'YouTube Summary');
assert.strictEqual(sanitizeFileName(''), 'YouTube Summary');
const longName = 'A'.repeat(150);
assert.strictEqual(sanitizeFileName(longName).length, 100);
console.log('✓ sanitizeFileName passed');

// Test 2: sanitizeTag

console.log('Testing sanitizeTag...');
assert.strictEqual(sanitizeTag('#Artificial Intelligence!'), 'artificial-intelligence');
assert.strictEqual(sanitizeTag(' machine learning '), 'machine-learning');
assert.strictEqual(sanitizeTag('C++ / Python'), 'c/python');
assert.strictEqual(sanitizeTag('---tag---'), 'tag');
assert.strictEqual(sanitizeTag('foo--bar'), 'foo-bar');
console.log('✓ sanitizeTag passed');

// Test 3: buildFrontmatter
function buildFrontmatter(data) {
	const lines = ['---'];
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

console.log('Testing buildFrontmatter...');
const testData = {
	title: 'Never Gonna Give You Up: 4K Remaster "Special"',
	channel_name: 'Rick Astley',
	channel_username: '@RickAstleyYT',
	channel_url: 'https://www.youtube.com/@RickAstleyYT',
	video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
	thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
	thumbnail_text: 'RICK ASTLEY OFFICIAL MUSIC VIDEO',
	tags: ['music', 'pop-culture', '80s-music']
};

const built = buildFrontmatter(testData);
assert(built.startsWith('---\n'));
assert(built.endsWith('\n---'));
assert(built.includes('title: "Never Gonna Give You Up: 4K Remaster \\"Special\\""'));
assert(built.includes('channel_name: "Rick Astley"'));
assert(built.includes('channel_username: "@RickAstleyYT"'));
assert(built.includes('channel_url: "https://www.youtube.com/@RickAstleyYT"'));
assert(built.includes('video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"'));
assert(built.includes('thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"'));
assert(built.includes('thumbnail_text: "RICK ASTLEY OFFICIAL MUSIC VIDEO"'));
assert(built.includes('tags:\n  - music\n  - pop-culture\n  - 80s-music'));
console.log('✓ buildFrontmatter passed');

// Test 4: mergeFrontmatter

console.log('Testing mergeFrontmatter...');
const existingYaml = `aliases:
  - Rick Roll
date_created: 2026-01-01
tags:
  - existing-tag
  - music
custom_prop: "preserved"`;

const merged = mergeFrontmatter(existingYaml, testData);
assert(merged.includes('aliases:\n  - Rick Roll'));
assert(merged.includes('date_created: 2026-01-01'));
assert(merged.includes('custom_prop: "preserved"'));
assert(merged.includes('title: "Never Gonna Give You Up: 4K Remaster \\"Special\\""'));
assert(merged.includes('channel_username: "@RickAstleyYT"'));
assert(merged.includes('tags:\n  - existing-tag\n  - music\n  - pop-culture\n  - 80s-music'));
console.log('✓ mergeFrontmatter passed');

// Test 7: extractTagsFromText

console.log('Testing extractTagsFromText...');
const titleWithTags = 'Next.js 15 Full Course #NextJS #React #web_dev #123';
const titleTags = extractTagsFromText(titleWithTags);
assert.deepStrictEqual(titleTags, ['nextjs', 'react', 'web-dev']);

const descWithTags = `In this video we cover:
- React Server Components #ServerComponents
- AI SDKs #ArtificialIntelligence #AI
Don't forget to like and subscribe! ## NotATag #123`;
const descTags = extractTagsFromText(descWithTags);
assert.deepStrictEqual(descTags, ['servercomponents', 'artificialintelligence', 'ai']);
console.log('✓ extractTagsFromText passed');

// Test 8: extractYouTubeUrlFromNote
function extractYouTubeUrlFromNote(content) {
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (fmMatch) {
		const videoUrlMatch = fmMatch[1].match(/^video_url:\s*["']?([^"'\r\n]+)["']?/m);
		if (videoUrlMatch && videoUrlMatch[1].trim()) {
			return videoUrlMatch[1].trim();
		}
	}

	const mdLinkMatch = content.match(
		/\[[^\]]*\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s\)]*v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}[^\s\)]*)\)/i
	);
	if (mdLinkMatch) {
		return mdLinkMatch[1];
	}

	const urlMatch = content.match(
		/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s"'\)<>]*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11}[^\s"'\)<>]*)/i
	);
	if (urlMatch) {
		return urlMatch[0];
	}

	return null;
}

console.log('Testing extractYouTubeUrlFromNote...');
const noteWithFm = `---
title: "Old Video"
video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
---
# Content`;
assert.strictEqual(
	extractYouTubeUrlFromNote(noteWithFm),
	'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
);

const noteWithMdLink = `# My Video
👤 [Author](https://youtube.com/@channel)  🔗 [Watch video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
Summary text...`;
assert.strictEqual(
	extractYouTubeUrlFromNote(noteWithMdLink),
	'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
);

const noteWithShorts = `Check this out: https://youtu.be/dQw4w9WgXcQ nice!`;
assert.strictEqual(
	extractYouTubeUrlFromNote(noteWithShorts),
	'https://youtu.be/dQw4w9WgXcQ'
);

const noteWithNoUrl = `# Just a regular note with no links`;
assert.strictEqual(extractYouTubeUrlFromNote(noteWithNoUrl), null);
console.log('✓ extractYouTubeUrlFromNote passed');

// Test 10: mergeFrontmatter with excludeTags (for metadata refresh)
function mergeFrontmatterWithExclude(rawYaml, data, options) {
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

	if (options?.excludeTags) {
		if (existingTags.length > 0) {
			newLines.push('tags:');
			for (const tag of existingTags.map(sanitizeTag).filter(Boolean)) {
				newLines.push(`  - ${tag}`);
			}
		}
	} else {
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

console.log('Testing mergeFrontmatter with excludeTags...');
const oldYamlWithTags = `tags:
  - my-custom-tag
title: "Old Title"`;

const upgraded = mergeFrontmatterWithExclude(oldYamlWithTags, testData, { excludeTags: true });
// Should preserve existing tag
assert(upgraded.includes('tags:\n  - my-custom-tag'));
// Should NOT include new testData tags (pop-culture, 80s-music)
assert(!upgraded.includes('80s-music'));
// Should add new fields
assert(upgraded.includes('channel_username: "@RickAstleyYT"'));
assert(upgraded.includes('thumbnail_text: "RICK ASTLEY OFFICIAL MUSIC VIDEO"'));
console.log('✓ mergeFrontmatter with excludeTags passed');

// Test 20: YouTube description in frontmatter, Data API tags injection, and tag deduplication
console.log('Testing YouTube description in frontmatter and tag deduplication...');


function buildFrontmatterWithDesc(data) {
	const lines = ['---'];
	lines.push(`title: ${JSON.stringify(data.title)}`);
	lines.push(`channel_name: ${JSON.stringify(data.channel_name)}`);
	lines.push(`channel_username: ${JSON.stringify(data.channel_username || '')}`);
	lines.push(`channel_url: ${JSON.stringify(data.channel_url)}`);
	lines.push(`video_url: ${JSON.stringify(data.video_url)}`);
	lines.push(`thumbnail: ${JSON.stringify(data.thumbnail)}`);
	lines.push(`thumbnail_text: ${JSON.stringify(data.thumbnail_text || '')}`);

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
		for (const tag of deduplicateTagsHelper(data.tags)) {
			lines.push(`  - ${tag}`);
		}
	}

	lines.push('---');
	return lines.join('\n');
}

function mergeFrontmatterWithDesc(rawYaml, data, options) {
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
	let inDescBlock = false;
	const existingTags = [];

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

	for (const [key, line] of Object.entries(targetKeys)) {
		if (!updatedKeys.has(key)) {
			newLines.push(line);
		}
	}

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

	if (options?.excludeTags) {
		if (existingTags.length > 0) {
			newLines.push('tags:');
			for (const tag of deduplicateTagsHelper(existingTags)) {
				newLines.push(`  - ${tag}`);
			}
		}
	} else {
		const combinedTags = deduplicateTagsHelper([...existingTags, ...(data.tags || [])]);
		if (combinedTags.length > 0) {
			newLines.push('tags:');
			for (const tag of combinedTags) {
				newLines.push(`  - ${tag}`);
			}
		}
	}

	return newLines.join('\n').trim();
}

// Case 1: Deduplication of tags between title, description, and Data API
const test20TitleTags = extractTagsFromText('Deep Dive: #Obsidian & #Productivity for Developers #AI');
const test20DescTags = extractTagsFromText('Check out #productivity, #Obsidian, and #machine-learning in 2026!');
const test20DataApiTags = ['Obsidian', 'AI', 'Machine Learning', 'Productivity', 'Note Taking', 'obsidian'];

const test20CombinedRawTags = [...test20TitleTags, ...test20DescTags, ...test20DataApiTags];
const test20Deduplicated = deduplicateTagsHelper(test20CombinedRawTags);

// Ensure no duplicate 'obsidian', 'productivity', 'ai', 'machine-learning'
assert.strictEqual(test20Deduplicated.filter(t => t === 'obsidian').length, 1);
assert.strictEqual(test20Deduplicated.filter(t => t === 'productivity').length, 1);
assert.strictEqual(test20Deduplicated.filter(t => t === 'ai').length, 1);
assert.strictEqual(test20Deduplicated.filter(t => t === 'machine-learning').length, 1);
assert.strictEqual(test20Deduplicated.includes('note-taking'), true);

// Case 2: Deduplication collapsing run-together hashtag vs hyphenated Data API tag
// e.g. #RickAstley in title/desc vs "Rick Astley" in Data API
const hashtagAndApi = deduplicateTagsHelper(['#RickAstley', 'Rick Astley', '#NeverGonnaGiveYouUp', 'Never Gonna Give You Up']);
assert.strictEqual(hashtagAndApi.includes('rick-astley'), true);
assert.strictEqual(hashtagAndApi.includes('rickastley'), false);
assert.strictEqual(hashtagAndApi.includes('never-gonna-give-you-up'), true);
assert.strictEqual(hashtagAndApi.includes('nevergonnagiveyouup'), false);

// Case 3: buildFrontmatter with description (multi-line)
const dataWithDesc = {
	title: 'Test Title',
	channel_name: 'Test Channel',
	channel_username: '@test',
	channel_url: 'https://youtube.com/@test',
	video_url: 'https://youtube.com/watch?v=123',
	thumbnail: 'https://img.youtube.com/thumb.jpg',
	thumbnail_text: 'OCR text',
	description: 'Line 1 of description\nLine 2 of description with https://link.com\n\nEnjoy the video!',
	tags: ['#AI', 'ai', 'Obsidian', '#Obsidian']
};

const builtWithDesc = buildFrontmatterWithDesc(dataWithDesc);
assert(builtWithDesc.includes('description: |-\n  Line 1 of description\n  Line 2 of description with https://link.com\n\n  Enjoy the video!'));
// Tags should be deduplicated inside frontmatter
assert(builtWithDesc.includes('tags:\n  - ai\n  - obsidian'));
assert(!builtWithDesc.includes('- ai\n  - ai'));

// Case 4: buildFrontmatter without description (undefined)
const dataWithoutDesc = { ...dataWithDesc, description: undefined };
const builtWithoutDesc = buildFrontmatterWithDesc(dataWithoutDesc);
assert(!builtWithoutDesc.includes('description:'));

// Case 5: mergeFrontmatter adding description and Data API tags to note without them
const oldNoteYaml = `aliases:
  - My Note
tags:
  - personal-notes
title: "Old Title"`;

const mergedWithDescAndTags = mergeFrontmatterWithDesc(oldNoteYaml, dataWithDesc);
assert(mergedWithDescAndTags.includes('description: |-\n  Line 1 of description'));
assert(mergedWithDescAndTags.includes('tags:\n  - personal-notes\n  - ai\n  - obsidian'));

// Case 6: mergeFrontmatter replacing existing multi-line description
const noteWithOldDesc = `title: "Old"
description: |-
  Old line 1
  Old line 2
tags:
  - old-tag`;

const mergedReplacedDesc = mergeFrontmatterWithDesc(noteWithOldDesc, dataWithDesc);
assert(mergedReplacedDesc.includes('Line 1 of description'));
assert(!mergedReplacedDesc.includes('Old line 1'));
assert(!mergedReplacedDesc.includes('Old line 2'));
assert(mergedReplacedDesc.includes('tags:\n  - old-tag\n  - ai\n  - obsidian'));

console.log('✓ YouTube description in frontmatter and tag deduplication passed');

// Test 33: Video stats frontmatter (duration, published_at, view_count, like_count, aspect_ratio)
console.log('Testing video stats frontmatter and aspect ratio detection...');

function formatAspectRatioHelper(width, height) {
	const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
	const divisor = gcd(Math.round(width), Math.round(height)) || 1;
	return `${Math.round(width) / divisor} / ${Math.round(height) / divisor}`;
}

function getAspectRatioFromPlayerDataHelper(playerData) {
	const formats = [...(playerData?.streamingData?.formats ?? []), ...(playerData?.streamingData?.adaptiveFormats ?? [])];
	let best;
	for (const format of formats) {
		const width = Number(format?.width);
		const height = Number(format?.height);
		if (width > 0 && height > 0 && (!best || width * height > best.width * best.height)) {
			best = { width, height };
		}
	}
	return best ? formatAspectRatioHelper(best.width, best.height) : undefined;
}

function videoStatsFrontmatterHelper(metadata) {
	return {
		duration: metadata.duration,
		published_at: metadata.publishedAt,
		view_count: metadata.viewCount,
		like_count: metadata.likeCount,
		aspect_ratio: metadata.aspectRatio,
	};
}

function buildVideoStatsLinesHelper(data) {
	const lines = {};
	if (typeof data.duration === 'number' && data.duration > 0) lines.duration = `duration: ${Math.round(data.duration)}`;
	if (data.published_at && /^\d{4}-\d{2}-\d{2}$/.test(data.published_at)) lines.published_at = `published_at: ${data.published_at}`;
	if (typeof data.view_count === 'number' && !isNaN(data.view_count)) lines.view_count = `view_count: ${data.view_count}`;
	if (typeof data.like_count === 'number' && !isNaN(data.like_count)) lines.like_count = `like_count: ${data.like_count}`;
	if (data.aspect_ratio && /^\d+ \/ \d+$/.test(data.aspect_ratio)) lines.aspect_ratio = `aspect_ratio: ${data.aspect_ratio}`;
	return lines;
}

// 33.1: Aspect ratio reduction and detection (largest format wins; dimensions from real player responses)
assert.strictEqual(formatAspectRatioHelper(3840, 2160), '16 / 9');
assert.strictEqual(formatAspectRatioHelper(320, 240), '4 / 3');
assert.strictEqual(formatAspectRatioHelper(1080, 1920), '9 / 16');
assert.strictEqual(formatAspectRatioHelper(1280, 534), '640 / 267');
assert.strictEqual(
	getAspectRatioFromPlayerDataHelper({
		streamingData: {
			formats: [{ width: 640, height: 360 }],
			adaptiveFormats: [{ width: 3840, height: 2160 }, { mimeType: 'audio/mp4' }, { width: 1280, height: 720 }],
		},
	}),
	'16 / 9'
);
assert.strictEqual(getAspectRatioFromPlayerDataHelper({ streamingData: { adaptiveFormats: [{ width: 1080, height: 1920 }] } }), '9 / 16');
assert.strictEqual(getAspectRatioFromPlayerDataHelper({}), undefined);
assert.strictEqual(getAspectRatioFromPlayerDataHelper({ streamingData: { formats: [{ mimeType: 'audio/webm' }] } }), undefined);

// 33.2: Metadata mapping and frontmatter lines in Media Extended-compatible formats
const statsData = videoStatsFrontmatterHelper({ duration: 213.4, publishedAt: '2009-10-25', viewCount: 1822608029, likeCount: 19404514, aspectRatio: '16 / 9' });
assert.deepStrictEqual(Object.values(buildVideoStatsLinesHelper(statsData)), [
	'duration: 213',
	'published_at: 2009-10-25',
	'view_count: 1822608029',
	'like_count: 19404514',
	'aspect_ratio: 16 / 9',
]);
// Zero counts are kept (a real value); missing or malformed values are omitted
assert.deepStrictEqual(buildVideoStatsLinesHelper({ view_count: 0, like_count: 0 }), { view_count: 'view_count: 0', like_count: 'like_count: 0' });
assert.deepStrictEqual(buildVideoStatsLinesHelper(videoStatsFrontmatterHelper({})), {});
assert.deepStrictEqual(buildVideoStatsLinesHelper({ duration: 0, published_at: 'Oct 25, 2009', aspect_ratio: '16:9', view_count: NaN }), {});

// 33.3: Merging into existing frontmatter replaces stale stats in place and appends missing ones
function mergeStatsHelper(rawYaml, data) {
	const targets = buildVideoStatsLinesHelper(data);
	const updated = new Set();
	const out = rawYaml.split('\n').map((line) => {
		const key = line.match(/^([a-zA-Z0-9_-]+):/)?.[1];
		if (key && key in targets) {
			updated.add(key);
			return targets[key];
		}
		return line;
	});
	for (const [key, line] of Object.entries(targets)) {
		if (!updated.has(key)) out.push(line);
	}
	return out.join('\n');
}
const mergedStats = mergeStatsHelper('title: "T"\nview_count: 5\ncustom: keep', statsData);
assert.strictEqual(mergedStats, 'title: "T"\nview_count: 1822608029\ncustom: keep\nduration: 213\npublished_at: 2009-10-25\nlike_count: 19404514\naspect_ratio: 16 / 9');

console.log('✓ Video stats frontmatter and aspect ratio detection passed');

// Test 34: Refresh video metadata (note classification, YAML block merge, Media Extended frontmatter refresh)
console.log('Testing refresh video metadata classification and frontmatter merging...');




function refreshMediaExtendedNoteContentHelper(content, metadata) {
	const normalized = content.replace(/\r\n/g, '\n');
	const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
	const refreshExistingYaml = fmMatch?.[1] ?? '';
	const existingUid = refreshExistingYaml.match(/^mx-uid:\s*([A-Za-z0-9_-]+)/m)?.[1];
	const fresh = buildMediaExtendedFrontmatterHelper({ ...metadata, mxUid: existingUid ?? metadata.mxUid });
	let freshYaml = fresh.replace(/^---\n/, '').replace(/\n---$/, '');
	if (/^media:/m.test(refreshExistingYaml) && !/^video:/m.test(refreshExistingYaml)) {
		freshYaml = freshYaml.split('\n').filter((line) => !line.startsWith('video:')).join('\n');
	}
	if (!fmMatch) {
		const body = normalized.replace(/^\s+/, '');
		return body ? `${fresh}\n\n${body}` : `${fresh}\n`;
	}
	const body = normalized.slice(fmMatch[0].length);
	return `---\n${mergeYamlBlocksHelper(refreshExistingYaml, freshYaml)}\n---\n${body}`;
}

// 34.1: Classification
assert.strictEqual(getVideoNoteKindHelper('---\nmx-uid: abc\n---\n', 'Notes/x.md', 'Media Library'), 'mediaExtended');
assert.strictEqual(getVideoNoteKindHelper('---\ntitle: x\n---\n', 'Media Library/x.md', 'Media Library'), 'mediaExtended');
assert.strictEqual(getVideoNoteKindHelper('---\nvideo_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"\n---\n', 'Video Summaries/x.md', 'Media Library'), 'summary');
assert.strictEqual(getVideoNoteKindHelper('Just a link https://youtu.be/dQw4w9WgXcQ in a note', 'Notes/x.md', 'Media Library'), null);
assert.strictEqual(getVideoNoteKindHelper('---\ntitle: x\n---\n', 'Notes/x.md', 'Media Library'), null);

// 34.2: YAML block merge — replaces in place (incl. multi-line blocks), appends new keys, keeps others and comments
const refreshExistingYaml = 'mx-uid: keepme\ntitle: Old\n# my comment\ndescription: |-\n  Old line 1\n\n  Old line 2\ncustom: value\ncover: "[[mx-cover-youtube_dQw4w9WgXcQ.jpg]]"';
const refreshUpdatesYaml = 'title: New\ndescription: |-\n  New desc\ncover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"\naspect_ratio: 16 / 9';
assert.strictEqual(
	mergeYamlBlocksHelper(refreshExistingYaml, refreshUpdatesYaml),
	'mx-uid: keepme\ntitle: New\n# my comment\ndescription: |-\n  New desc\ncustom: value\ncover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"\naspect_ratio: 16 / 9'
);

// 34.3: Media Extended refresh — fixes the old wikilink cover, keeps mx-uid, custom keys, and the body
const oldMeNote = '---\nmx-uid: vcxchy79gecb4s69v25oxq9s\nvideo: https://www.youtube.com/watch?v=dQw4w9WgXcQ\ntitle: Old Title\ndescription: ""\nduration: 200\ncreator: Rick Astley\nmy_rating: 5\ncover: "[[mx-cover-youtube_dQw4w9WgXcQ.jpg]]"\naspect_ratio: 427 / 240\n---\n\n# Description\n\nBody text\n\n# Related\n\n- [[Summary]]\n';
const refreshedMe = refreshMediaExtendedNoteContentHelper(oldMeNote, {
	videoId: 'dQw4w9WgXcQ',
	title: 'Rick Astley - Never Gonna Give You Up',
	description: 'Fresh description',
	duration: 213,
	creator: 'Rick Astley',
	publishedAt: '2009-10-25',
	viewCount: 1822608029,
	likeCount: 19404514,
	cover: 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp',
	aspectRatio: '16 / 9',
});
assert(refreshedMe.startsWith('---\nmx-uid: vcxchy79gecb4s69v25oxq9s\n'));
assert(refreshedMe.includes('title: Rick Astley - Never Gonna Give You Up'));
assert(refreshedMe.includes('description: |-\n  Fresh description'));
assert(refreshedMe.includes('duration: 213'));
assert(refreshedMe.includes('my_rating: 5'));
assert(refreshedMe.includes('cover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"'));
assert(!refreshedMe.includes('mx-cover-youtube'));
assert(refreshedMe.includes('aspect_ratio: 16 / 9'));
assert(refreshedMe.includes('published_at: 2009-10-25'));
assert(refreshedMe.endsWith('---\n\n# Description\n\nBody text\n\n# Related\n\n- [[Summary]]\n'));
assert.strictEqual((refreshedMe.match(/^mx-uid:/gm) || []).length, 1);
assert.strictEqual((refreshedMe.match(/^cover:/gm) || []).length, 1);

// Refreshing twice is stable (idempotent)
const refreshMeta = { videoId: 'dQw4w9WgXcQ', title: 'T', creator: 'C', cover: 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/hqdefault.webp' };
const refreshedOnce = refreshMediaExtendedNoteContentHelper(oldMeNote, refreshMeta);
assert.strictEqual(refreshMediaExtendedNoteContentHelper(refreshedOnce, refreshMeta), refreshedOnce);

// 34.4: Notes that use `media:` don't get a duplicate `video:` key
const mediaKeyNote = '---\nmx-uid: abc\nmedia: https://www.youtube.com/watch?v=dQw4w9WgXcQ\n---\nBody\n';
const refreshedMediaKey = refreshMediaExtendedNoteContentHelper(mediaKeyNote, refreshMeta);
assert(!/^video:/m.test(refreshedMediaKey));
assert(refreshedMediaKey.includes('media: https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
assert(refreshedMediaKey.endsWith('---\nBody\n'));

console.log('✓ Refresh video metadata classification and frontmatter merging passed');

// Test 36: Blank-note detection for the summarizer ("Untitled" notes with tags-only frontmatter)
console.log('Testing blank-note detection for Untitled notes with tags-only frontmatter...');

function isBlankNoteForSummaryHelper(content, noteName) {
	if (content.trim() === '') return true;
	if (!/^untitled/i.test(noteName.trim())) return false;
	const fmMatch = content.match(/^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/);
	if (!fmMatch) return false;
	if (content.slice(fmMatch[0].length).trim() !== '') return false;
	const keys = splitYamlBlocksHelper((fmMatch[1] ?? '').replace(/\r\n/g, '\n'))
		.filter((block) => block.lines.some((line) => line.trim() !== ''))
		.map((block) => block.key);
	return keys.every((key) => key === 'tags');
}

const tagsOnlyList = '---\ntags:\n  - inbox\n  - video\n---\n';
const tagsOnlyInline = '---\ntags: [inbox, video]\n---';

// 36.1: Empty notes are blank regardless of name
assert.strictEqual(isBlankNoteForSummaryHelper('', 'My Note'), true);
assert.strictEqual(isBlankNoteForSummaryHelper('  \n\n', 'Anything'), true);

// 36.2: Untitled + tags-only frontmatter + no body → blank (list, inline, CRLF, trailing whitespace, numbered Untitled)
assert.strictEqual(isBlankNoteForSummaryHelper(tagsOnlyList, 'Untitled'), true);
assert.strictEqual(isBlankNoteForSummaryHelper(tagsOnlyInline, 'Untitled 3'), true);
assert.strictEqual(isBlankNoteForSummaryHelper('---\r\ntags:\r\n  - inbox\r\n---\r\n\r\n', 'Untitled'), true);
assert.strictEqual(isBlankNoteForSummaryHelper(`${tagsOnlyList}\n   \n`, 'untitled 2'), true);
assert.strictEqual(isBlankNoteForSummaryHelper('---\n---\n', 'Untitled'), true);

// 36.3: Any condition failing → not blank
assert.strictEqual(isBlankNoteForSummaryHelper(tagsOnlyList, 'Meeting notes'), false); // name
assert.strictEqual(isBlankNoteForSummaryHelper(`${tagsOnlyList}\nSome text`, 'Untitled'), false); // body
assert.strictEqual(isBlankNoteForSummaryHelper('---\ntags:\n  - a\ncreated: 2026-10-02\n---\n', 'Untitled'), false); // other key
assert.strictEqual(isBlankNoteForSummaryHelper('---\naliases: [x]\n---\n', 'Untitled'), false); // non-tags key only
assert.strictEqual(isBlankNoteForSummaryHelper('Just text', 'Untitled'), false); // body, no frontmatter

// 36.4: Writing the summary into a tags-only note keeps the user's tags and adds the summary frontmatter + body
const blankFmData = {
	title: 'Video', channel_name: 'C', channel_username: '@c', channel_url: 'https://www.youtube.com/@c',
	video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 't.jpg', thumbnail_text: '', tags: ['music'],
};
const tagsOnlyCurrent = `${tagsOnlyList.trimEnd()}\n\n## Summary\n\nText`;
const tagsOnlyFm = tagsOnlyCurrent.match(/^---\r?\n([\s\S]*?\r?\n)---(\r?\n)?/);
const mergedTagsOnly = `---\n${mergeFrontmatter(tagsOnlyFm[1], blankFmData)}\n---\n${tagsOnlyCurrent.slice(tagsOnlyFm[0].length)}`;
assert(mergedTagsOnly.includes('  - inbox'));
assert(mergedTagsOnly.includes('  - video'));
assert(mergedTagsOnly.includes('  - music'));
assert(mergedTagsOnly.includes('title: "Video"'));
assert(mergedTagsOnly.trimEnd().endsWith('## Summary\n\nText'));
assert.strictEqual((mergedTagsOnly.match(/^tags:/gm) || []).length, 1);

console.log('✓ Blank-note detection for Untitled notes with tags-only frontmatter passed');

// Test 42: watch_later / favorite checkbox properties in video summary frontmatter
console.log('Testing watch_later and favorite frontmatter properties...');

// Runs against the real src/utils/frontmatter.ts
const realFrontmatter = await loadSource('src/utils/frontmatter.ts');

const flagData = {
	title: 'Flag Test',
	channel_name: 'Channel',
	channel_username: '@channel',
	channel_url: 'https://www.youtube.com/@channel',
	video_url: 'https://www.youtube.com/watch?v=MdxaU0l3FzI',
	thumbnail: 'https://img.youtube.com/vi/MdxaU0l3FzI/maxresdefault.jpg',
	thumbnail_text: '',
	description: 'Line one\nwatch_later: true',
	tags: ['topic'],
};

// 42.1: New notes get both properties as unquoted YAML booleans, before description and tags
const flagLines = realFrontmatter.buildFrontmatter(flagData).split('\n');
assert(flagLines.includes('watch_later: false'));
assert(flagLines.includes('favorite: false'));
assert.strictEqual(flagLines.indexOf('favorite: false'), flagLines.indexOf('watch_later: false') + 1);
assert(flagLines.indexOf('favorite: false') < flagLines.indexOf('description: |-'));
assert(flagLines.indexOf('favorite: false') < flagLines.indexOf('tags:'));
assert.strictEqual(flagLines[0], '---');
assert.strictEqual(flagLines[flagLines.length - 1], '---');

// 42.2: Merging into a note without them adds both once
const mergedMissing = realFrontmatter.mergeFrontmatter('title: "Old"\nrating: 5\ntags:\n  - mine\n', flagData).split('\n');
assert.strictEqual(mergedMissing.filter((l) => l === 'watch_later: false').length, 1);
assert.strictEqual(mergedMissing.filter((l) => l === 'favorite: false').length, 1);
assert(mergedMissing.includes('rating: 5'));
assert(!mergedMissing.includes(''), 'appended properties should not be preceded by a blank line');
assert(mergedMissing.indexOf('favorite: false') < mergedMissing.indexOf('tags:'));

// 42.3: Values the user set are never overwritten or duplicated (refresh, regenerate)
const mergedSet = realFrontmatter.mergeFrontmatter('title: "Old"\nwatch_later: true\nfavorite: true\n', flagData);
assert(mergedSet.includes('watch_later: true'));
assert(mergedSet.includes('favorite: true'));
assert(!mergedSet.includes('watch_later: false'));
assert(!mergedSet.includes('favorite: false'));
const mergedPartial = realFrontmatter.mergeFrontmatter('favorite: true\n', flagData, { excludeTags: true });
assert(mergedPartial.includes('favorite: true'));
assert(mergedPartial.includes('watch_later: false'));
assert(!mergedPartial.includes('favorite: false'));

// 42.4: A second merge is stable, and text inside the description doesn't count as the property
const mergedOnce = realFrontmatter.mergeFrontmatter('title: "Old"\n', flagData);
assert.strictEqual(mergedOnce.split('\n').filter((l) => l === 'watch_later: false').length, 1);
assert(mergedOnce.includes('  watch_later: true')); // the indented description line
assert.strictEqual(realFrontmatter.mergeFrontmatter(`${mergedOnce}\n`, flagData), mergedOnce);

// 42.5: Whole-note update keeps a ticked box and the body
const flaggedNote = '---\ntitle: "Old"\nwatch_later: true\n---\n\nBody text\n';
const updatedFlaggedNote = realFrontmatter.updateNoteContentWithFrontmatter(flaggedNote, flagData);
assert(updatedFlaggedNote.includes('\nwatch_later: true\n'));
assert(updatedFlaggedNote.includes('\nfavorite: false\n'));
assert(updatedFlaggedNote.endsWith('\nBody text\n'));

console.log('✓ watch_later and favorite frontmatter properties passed');

// Test 46: video_url follows title, and the AI-inferred `topic` list property (real frontmatter.ts / videoTopics.ts)
console.log('Testing video_url order and the topic frontmatter property...');

const videoTopics = await loadSource('src/utils/videoTopics.ts');

const topicData = {
	title: 'Topic Test',
	channel_name: 'Channel',
	channel_username: '@channel',
	channel_url: 'https://www.youtube.com/@channel',
	video_url: 'https://www.youtube.com/watch?v=MdxaU0l3FzI',
	thumbnail: 'https://img.youtube.com/vi/MdxaU0l3FzI/maxresdefault.jpg',
	thumbnail_text: '',
	description: 'A description',
	topic: ['Machine Learning', 'Personal Finance', 'machine learning'],
	tags: ['ai'],
};
const keysOf = (yaml) => yaml.split('\n').map((line) => line.match(/^([A-Za-z0-9_-]+):/)?.[1]).filter(Boolean);

// 46.1: New notes: video_url sits between title and channel_name; topic is a list just before tags
const topicBuilt = realFrontmatter.buildFrontmatter(topicData);
const builtKeys = keysOf(topicBuilt);
assert.deepStrictEqual(builtKeys.slice(0, 3), ['title', 'video_url', 'channel_name']);
assert.strictEqual(builtKeys.indexOf('topic'), builtKeys.indexOf('tags') - 1);
assert(topicBuilt.includes('topic:\n  - Machine Learning\n  - Personal Finance\ntags:'), 'topic list is deduplicated, case-insensitively');

// 46.2: No topics, no topic property
assert(!realFrontmatter.buildFrontmatter({ ...topicData, topic: undefined }).includes('topic:'));
assert(!realFrontmatter.buildFrontmatter({ ...topicData, topic: [] }).includes('topic:'));

// 46.3: Topics YAML would misread are quoted
const quotedBuilt = realFrontmatter.buildFrontmatter({ ...topicData, topic: ['C++: Basics', 'True', '2024'] });
assert(quotedBuilt.includes('  - "C++: Basics"\n  - "True"\n  - "2024"'));

// 46.4: Merging: new topics replace the existing list in place; other keys are kept
const existingTopicYaml = 'title: "Old"\ntopic:\n  - Old Topic\n  - Another\nmy_key: kept\ntags:\n  - old-tag\n';
const mergedTopics = realFrontmatter.mergeFrontmatter(existingTopicYaml, topicData);
assert(mergedTopics.includes('topic:\n  - Machine Learning\n  - Personal Finance\nmy_key: kept'));
assert(!mergedTopics.includes('Old Topic'));
assert.strictEqual(keysOf(mergedTopics).filter((k) => k === 'topic').length, 1);

// 46.5: Merging without topics (inference off or failed, or a metadata refresh) keeps the existing list
const keptTopics = realFrontmatter.mergeFrontmatter(existingTopicYaml, { ...topicData, topic: undefined }, { excludeTags: true });
assert(keptTopics.includes('topic:\n  - Old Topic\n  - Another\n'));

// 46.6: Merging into a note without topic adds it before tags
const addedTopics = realFrontmatter.mergeFrontmatter('title: "Old"\ntags:\n  - old-tag\n', topicData);
const addedKeys = keysOf(addedTopics);
assert.strictEqual(addedKeys.indexOf('topic'), addedKeys.indexOf('tags') - 1);

// 46.7: Merging replaces an inline topic value and a list with unindented items
assert(realFrontmatter.mergeFrontmatter('topic: Old\n', topicData).startsWith('topic:\n  - Machine Learning'));
const unindented = realFrontmatter.mergeFrontmatter('topic:\n- Old\n- Older\nfavorite: true\n', topicData);
assert(!unindented.includes('Old'));
assert(unindented.includes('favorite: true'));

// 46.8: Parsing the model's reply: at most 3, Title Case, cleaned of list markers / quotes / wikilinks, deduplicated
assert.deepStrictEqual(
	videoTopics.parseVideoTopics('1. machine learning\n- "Personal Finance"\n* [[home automation]]\nCooking'),
	['Machine Learning', 'Personal Finance', 'Home Automation']
);
assert.deepStrictEqual(videoTopics.parseVideoTopics('AI Safety, ai safety, history of science'), ['AI Safety', 'History of Science']);
assert.deepStrictEqual(videoTopics.parseVideoTopics('Topics:\n#iOS Development.'), ['iOS Development']);
assert.deepStrictEqual(videoTopics.parseVideoTopics(''), []);
assert.deepStrictEqual(videoTopics.parseVideoTopics(`${'word '.repeat(20)}\n42`), []);

// 46.9: The prompt carries the title and transcript; long transcripts are sampled from start, middle, and end
const topicPrompt = videoTopics.buildVideoTopicsPrompt('short transcript text', 'My Video');
assert(topicPrompt.includes('Video title: My Video') && topicPrompt.includes('short transcript text'));
assert(topicPrompt.includes('between 1 and 3 topics'));
const longTranscript = `START ${'a '.repeat(20000)}MIDDLE ${'b '.repeat(20000)}END`;
const sampled = videoTopics.sampleTranscriptForTopics(longTranscript, 3000);
assert(sampled.length <= 3000 + 20);
assert(sampled.startsWith('START') && sampled.endsWith('END') && sampled.includes('MIDDLE'));

// 46.10: Every provider implements inference, and the summary pipeline writes it behind the setting
for (const name of ['anthropic', 'gemini', 'openai']) {
	const source = readFileSync(new URL(`../src/services/providers/${name}.ts`, import.meta.url), 'utf8');
	assert(source.includes('async inferVideoTopics('), `${name} provider infers topics`);
}
const mainSourceForTopics = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
assert(mainSourceForTopics.includes('this.settings.getInferTopics() && this.provider?.inferVideoTopics'));
assert(mainSourceForTopics.includes('topic: topics.length > 0 ? topics : undefined'));

console.log('✓ video_url order and topic frontmatter property passed');

console.log('\nAll tests passed successfully!');
