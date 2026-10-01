import assert from 'node:assert';

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
function sanitizeTag(tag) {
	return tag
		.trim()
		.toLowerCase()
		.replace(/^#+/, '')
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-z0-9\-\/]/gi, '')
		.replace(/[-\/]+/g, (m) => (m.includes('/') ? '/' : '-'))
		.replace(/^[\-\/]+|[\-\/]+$/g, '');
}

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
function mergeFrontmatter(rawYaml, data) {
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

// Test 5: decodeHTML with preserveNewlines
function decodeHTML(text, preserveNewlines = false) {
	const decoded = text
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));

	if (preserveNewlines) {
		return decoded
			.replace(/\\n/g, '\n')
			.replace(/\r\n/g, '\n')
			.replace(/\r/g, '\n')
			.trim();
	}

	return decoded
		.replace(/\\n/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

console.log('Testing decodeHTML...');
const descWithNewlines = 'Line 1 &amp; info\\nLine 2 with links: https://example.com\\n\\nLine 3 &#39;end&#39;';
const decodedPreserved = decodeHTML(descWithNewlines, true);
assert.strictEqual(
	decodedPreserved,
	"Line 1 & info\nLine 2 with links: https://example.com\n\nLine 3 'end'"
);
const decodedCollapsed = decodeHTML(descWithNewlines, false);
assert.strictEqual(
	decodedCollapsed,
	"Line 1 & info Line 2 with links: https://example.com Line 3 'end'"
);
console.log('✓ decodeHTML passed');

// Test 6: Topics parsing from LLM response
function parseTopics(text) {
	return Array.from(new Set(
		text
			.split(/[,\n]/)
			.map(t => t.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-').replace(/[^a-z0-9_\-\/]/gi, ''))
			.filter(t => t.length > 0 && !/^\d+$/.test(t))
	));
}

console.log('Testing parseTopics...');
const llmResponse = 'artificial-intelligence, #Machine Learning, deep learning\nNeural Networks, 123, , AI Ethics';
const parsedTopics = parseTopics(llmResponse);
assert.deepStrictEqual(parsedTopics, [
	'artificial-intelligence',
	'machine-learning',
	'deep-learning',
	'neural-networks',
	'ai-ethics'
]);
console.log('✓ parseTopics passed');

// Test 7: extractTagsFromText
function extractTagsFromText(text) {
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

// Test 9: isNoteMissingFrontmatter
function isNoteMissingFrontmatter(content) {
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

console.log('Testing isNoteMissingFrontmatter...');
const legacyNote = `# Video Note
👤 [Author](...)  🔗 [Watch video](...)`;
assert.strictEqual(isNoteMissingFrontmatter(legacyNote), true);

const partialFmNote = `---
title: "Some Title"
video_url: "https://..."
---
# Video Note`;
assert.strictEqual(isNoteMissingFrontmatter(partialFmNote), true);

const completeFmNote = `---
title: "Full"
channel_name: "Author"
channel_username: "@author"
channel_url: "https://..."
video_url: "https://..."
thumbnail: "https://..."
thumbnail_text: "TEXT"
---
# Video Note`;
assert.strictEqual(isNoteMissingFrontmatter(completeFmNote), false);
console.log('✓ isNoteMissingFrontmatter passed');

// Test 10: mergeFrontmatter with excludeTags (for upgrades)
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

// Test 11: folder filtering and sorting
console.log('Testing folder filtering and sorting...');
function filterFilesByFolder(files, folder) {
	if (folder.isRoot) {
		return files;
	}
	return files.filter((f) => f.path.startsWith(folder.path + '/'));
}

function sortFolders(folders) {
	return [...folders].sort((a, b) => {
		if (a.isRoot) return -1;
		if (b.isRoot) return 1;
		return a.path.localeCompare(b.path);
	});
}

const mockFiles = [
	{ path: 'RootNote.md' },
	{ path: 'YouTube/Video1.md' },
	{ path: 'YouTube/2026/Video2.md' },
	{ path: 'Other/Note.md' },
	{ path: 'YouTube-Archived/Old.md' }, // Note prefix boundary test
];

const rootFolder = { path: '/', isRoot: true };
const ytFolder = { path: 'YouTube', isRoot: false };
const ytSubFolder = { path: 'YouTube/2026', isRoot: false };

assert.strictEqual(filterFilesByFolder(mockFiles, rootFolder).length, 5);

const ytFiltered = filterFilesByFolder(mockFiles, ytFolder);
assert.strictEqual(ytFiltered.length, 2);
assert.deepStrictEqual(ytFiltered.map((f) => f.path), [
	'YouTube/Video1.md',
	'YouTube/2026/Video2.md'
]);
// Ensures 'YouTube-Archived' was NOT incorrectly matched
assert(!ytFiltered.some((f) => f.path.startsWith('YouTube-Archived')));

const ytSubFiltered = filterFilesByFolder(mockFiles, ytSubFolder);
assert.strictEqual(ytSubFiltered.length, 1);
assert.strictEqual(ytSubFiltered[0].path, 'YouTube/2026/Video2.md');

const unsortedFolders = [
	{ path: 'Resources', isRoot: false },
	{ path: 'Archive', isRoot: false },
	{ path: '/', isRoot: true },
	{ path: 'YouTube', isRoot: false },
];
const sorted = sortFolders(unsortedFolders);
assert.strictEqual(sorted[0].path, '/');
assert.strictEqual(sorted[1].path, 'Archive');
assert.strictEqual(sorted[2].path, 'Resources');
assert.strictEqual(sorted[3].path, 'YouTube');
console.log('✓ folder filtering and sorting passed');

// Test 12: Gemini model retirement and migration
console.log('Testing Gemini model retirement and migration...');
const retiredModels = [
	'gemini-2.0-flash',
	'gemini-2.0-flash-lite',
	'gemini-2.0-flash-exp',
	'gemini-2.0-flash-thinking-exp',
	'gemini-1.5-pro',
	'gemini-1.5-pro-latest',
	'gemini-1.5-flash',
	'gemini-1.5-flash-latest',
	'gemini-1.5-flash-8b',
	'gemini-1.0-pro',
	'gemini-pro',
	'gemini-pro-vision'
];

const mockGeminiProvider = {
	name: 'Gemini',
	type: 'gemini',
	isBuiltIn: true,
	models: [
		{ name: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash Deprecated' },
		{ name: 'gemini-2.0-flash-lite', displayName: 'Gemini 2.0 Flash-Lite Deprecated' },
		{ name: 'gemini-3.8-flash', displayName: 'Gemini 3.8 Flash (Recommended)' },
		{ name: 'gemini-3.5-flash', displayName: 'Gemini 3.5 Flash' },
	]
};

// Simulate pruning
const prunedModels = mockGeminiProvider.models.filter(
	(m) => !retiredModels.includes(m.name)
);
assert.strictEqual(prunedModels.length, 2);
assert.deepStrictEqual(prunedModels.map((m) => m.name), ['gemini-3.8-flash', 'gemini-3.5-flash']);

// Simulate migration of selectedModelId
function migrateSelectedModelId(selectedModelId, providers, defaultModel) {
	if (!selectedModelId) return defaultModel;
	const [provider, model] = selectedModelId.split(':');
	if (provider.toLowerCase() === 'gemini' && retiredModels.includes(model)) {
		return defaultModel;
	}
	const valid = providers.some((p) => p.name === provider && p.models.some((m) => m.name === model));
	return valid ? selectedModelId : defaultModel;
}

const defaultModel = 'Gemini:gemini-3.8-flash';
assert.strictEqual(
	migrateSelectedModelId('Gemini:gemini-2.0-flash', [{ name: 'Gemini', models: prunedModels }], defaultModel),
	'Gemini:gemini-3.8-flash'
);
assert.strictEqual(
	migrateSelectedModelId('Gemini:gemini-3.8-flash', [{ name: 'Gemini', models: prunedModels }], defaultModel),
	'Gemini:gemini-3.8-flash'
);
assert.strictEqual(
	migrateSelectedModelId('Gemini:non-existent', [{ name: 'Gemini', models: prunedModels }], defaultModel),
	'Gemini:gemini-3.8-flash'
);
console.log('✓ Gemini model retirement and migration passed');

// Test 13: Anthropic and OpenAI model retirement and migration
console.log('Testing Anthropic and OpenAI model retirement and migration...');
const retiredAnthropic = [
	'claude-sonnet-4-20250514',
	'claude-opus-4-20250514',
	'claude-3-5-sonnet-20241022',
	'claude-3-5-sonnet-20240620',
	'claude-3-5-haiku-20241022',
	'claude-3-opus-20240229',
	'claude-3-sonnet-20240229',
	'claude-3-haiku-20240307',
	'claude-2.1',
	'claude-2.0',
	'claude-instant-1.2'
];

const retiredOpenAI = [
	'gpt-4-vision-preview',
	'gpt-4-0314',
	'gpt-4-0613',
	'gpt-4-32k-0314',
	'gpt-4-32k-0613',
	'gpt-3.5-turbo-0301',
	'gpt-3.5-turbo-0613',
	'gpt-3.5-turbo-16k-0613',
	'o1-preview'
];

const mockAnthropicProvider = {
	name: 'Anthropic',
	type: 'anthropic',
	models: [
		{ name: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4 Deprecated' },
		{ name: 'claude-sonnet-5-5', displayName: 'Claude Sonnet 5.5 (Recommended)' },
		{ name: 'claude-opus-5-5', displayName: 'Claude Opus 5.5' },
	]
};

const prunedAnthropic = mockAnthropicProvider.models.filter(
	(m) => !retiredAnthropic.includes(m.name)
);
assert.strictEqual(prunedAnthropic.length, 2);
assert.deepStrictEqual(prunedAnthropic.map((m) => m.name), ['claude-sonnet-5-5', 'claude-opus-5-5']);

const mockOpenAIProvider = {
	name: 'OpenAI',
	type: 'openai',
	models: [
		{ name: 'gpt-4-0613', displayName: 'GPT-4 0613' },
		{ name: 'gpt-6', displayName: 'GPT-6 (Astra)' },
		{ name: 'gpt-4o', displayName: 'GPT-4o' },
	]
};

const prunedOpenAI = mockOpenAIProvider.models.filter(
	(m) => !retiredOpenAI.includes(m.name)
);
assert.strictEqual(prunedOpenAI.length, 2);
assert.deepStrictEqual(prunedOpenAI.map((m) => m.name), ['gpt-6', 'gpt-4o']);

// Test migration of retired models
function multiProviderMigrate(selectedModelId, providers, defaultModel) {
	if (!selectedModelId) return defaultModel;
	const [provider, model] = selectedModelId.split(':');
	const lower = provider.toLowerCase();
	if (lower === 'anthropic' && retiredAnthropic.includes(model)) return defaultModel;
	if (lower === 'openai' && retiredOpenAI.includes(model)) return defaultModel;
	if (lower === 'gemini' && retiredModels.includes(model)) return defaultModel;
	const valid = providers.some((p) => p.name === provider && p.models.some((m) => m.name === model));
	return valid ? selectedModelId : defaultModel;
}

const allProviders = [
	{ name: 'Gemini', models: prunedModels },
	{ name: 'Anthropic', models: prunedAnthropic },
	{ name: 'OpenAI', models: prunedOpenAI }
];

assert.strictEqual(
	multiProviderMigrate('Anthropic:claude-sonnet-4-20250514', allProviders, defaultModel),
	'Gemini:gemini-3.8-flash'
);
assert.strictEqual(
	multiProviderMigrate('Anthropic:claude-sonnet-5-5', allProviders, defaultModel),
	'Anthropic:claude-sonnet-5-5'
);
assert.strictEqual(
	multiProviderMigrate('OpenAI:gpt-4-0613', allProviders, defaultModel),
	'Gemini:gemini-3.8-flash'
);
assert.strictEqual(
	multiProviderMigrate('OpenAI:gpt-6', allProviders, defaultModel),
	'OpenAI:gpt-6'
);
console.log('✓ Anthropic and OpenAI model retirement and migration passed');

// Test 14: OpenAI parameter construction (max_completion_tokens & reasoning temperature)
console.log('Testing OpenAI parameter construction...');
function buildOpenAIParams(model, prompt, maxTokens, temperature) {
	const isReasoningModel = /^(o[134])/i.test(model);
	const params = {
		model,
		messages: [{ role: 'user', content: prompt }],
		max_completion_tokens: maxTokens,
	};
	if (!isReasoningModel) {
		params.temperature = temperature;
	}
	return params;
}

// For standard models (gpt-4o, gpt-5.x, etc.)
const standardParams = buildOpenAIParams('gpt-4o', 'Summarize this', 4000, 0.7);
assert.strictEqual(standardParams.max_completion_tokens, 4000);
assert.strictEqual(standardParams.max_tokens, undefined);
assert.strictEqual(standardParams.temperature, 0.7);

// For reasoning models (o1, o3-mini, o4-mini)
const reasoningParams = buildOpenAIParams('o3-mini', 'Summarize this', 4000, 0.7);
assert.strictEqual(reasoningParams.max_completion_tokens, 4000);
assert.strictEqual(reasoningParams.max_tokens, undefined);
assert.strictEqual(reasoningParams.temperature, undefined); // Must be omitted for reasoning models

// Fallback logic simulation
function simulateFallback(params, error) {
	if (
		params.max_completion_tokens !== undefined &&
		error?.message &&
		(error.message.includes('max_completion_tokens') || error.message.includes('extra fields'))
	) {
		const fallbackParams = { ...params };
		fallbackParams.max_tokens = fallbackParams.max_completion_tokens;
		delete fallbackParams.max_completion_tokens;
		return fallbackParams;
	}
	throw error;
}

const fallbackResult = simulateFallback(
	{ model: 'legacy-model', max_completion_tokens: 1000 },
	{ message: 'unrecognized parameter: max_completion_tokens' }
);
assert.strictEqual(fallbackResult.max_tokens, 1000);
assert.strictEqual(fallbackResult.max_completion_tokens, undefined);
console.log('✓ OpenAI parameter construction passed');

// Test 15: Optional note body title
console.log('Testing optional note body title...');
function generateSummaryHelper(transcript, thumbnailUrl, url, summaryText, inlineTags, includeDescription, includeTitle) {
	const metaLines = [
		`👤 [${transcript.author}](${transcript.channelUrl})  🔗 [Watch video](${url})`
	];

	if (inlineTags && inlineTags.length > 0) {
		metaLines.push(`**Tags:** ${inlineTags.map((t) => `#${t}`).join(' ')}`);
	}

	const summaryParts = [];
	if (includeTitle && transcript.title) {
		summaryParts.push(`# ${transcript.title}`);
	}

	summaryParts.push(
		`![Thumbnail](${thumbnailUrl})`,
		metaLines.join('\n\n'),
		summaryText
	);

	if (includeDescription && transcript.description && transcript.description.trim()) {
		summaryParts.push(`## Description\n\n${transcript.description.trim()}`);
	}

	return summaryParts.join('\n\n');
}

const mockTranscript = {
	title: 'Sample Video Title',
	author: 'Sample Author',
	channelUrl: 'https://youtube.com/@sample',
	description: 'Sample description text',
};

// Default behavior: includeTitle = false
const bodyWithoutTitle = generateSummaryHelper(
	mockTranscript,
	'https://img.youtube.com/vi/123/default.jpg',
	'https://youtube.com/watch?v=123',
	'Summary content goes here',
	undefined,
	true,
	false
);
assert.strictEqual(bodyWithoutTitle.startsWith('# Sample Video Title'), false);
assert.strictEqual(bodyWithoutTitle.includes('# Sample Video Title'), false);
assert.strictEqual(bodyWithoutTitle.startsWith('![Thumbnail](https://img.youtube.com/vi/123/default.jpg)'), true);

// Enabled behavior: includeTitle = true
const bodyWithTitle = generateSummaryHelper(
	mockTranscript,
	'https://img.youtube.com/vi/123/default.jpg',
	'https://youtube.com/watch?v=123',
	'Summary content goes here',
	undefined,
	true,
	true
);
assert.strictEqual(bodyWithTitle.startsWith('# Sample Video Title'), true);
console.log('✓ Optional note body title passed');

// Test 16: Optional wikilinks in technical terms
console.log('Testing optional wikilinks in technical terms...');
function stripWikilinksFromTechnicalTerms(content) {
	const sectionRegex = /(^|\r?\n)(#{1,4}\s+[^\r\n]*technical\s+term[^\r\n]*\r?\n)([\s\S]*?)(?=(?:\r?\n#{1,4}\s+|\r?\n---\s*|$))/gi;
	return content.replace(sectionRegex, (match, prefix, heading, body) => {
		const strippedBody = body.replace(
			/\[\[([^\]\|]+)(?:\|([^\]]+))?\]\]/g,
			(_, target, display) => display || target
		);
		return `${prefix}${heading}${strippedBody}`;
	});
}

// Case 1: Standard wikilinks in technical terms with wikilinks in summary
const sampleSummary = [
	'## Summary',
	'This discusses [[AI]] and [[Neural Networks]].',
	'',
	'## Key points',
	'- Key point 1',
	'',
	'## Technical terms',
	'- **[[Machine Learning]]**: A subset of AI.',
	'- **[[Transformer|Transformer Architecture]]**: Attention-based model.',
	'- [[Backpropagation]]: Optimization algorithm.',
	'',
	'## Conclusion',
	'In conclusion, [[AI]] continues to evolve.'
].join('\n');

const stripped = stripWikilinksFromTechnicalTerms(sampleSummary);

// Terms should be preserved without [[ ]]
assert.strictEqual(stripped.includes('- **Machine Learning**: A subset of AI.'), true);
assert.strictEqual(stripped.includes('- **Transformer Architecture**: Attention-based model.'), true);
assert.strictEqual(stripped.includes('- Backpropagation: Optimization algorithm.'), true);

// Outside sections should maintain their wikilinks
assert.strictEqual(stripped.includes('This discusses [[AI]] and [[Neural Networks]].'), true);
assert.strictEqual(stripped.includes('In conclusion, [[AI]] continues to evolve.'), true);

// Case 2: Technical terms at the end of the text (no trailing section)
const sampleEndingTerms = [
	'## Summary',
	'Summary text.',
	'',
	'## Technical terms',
	'- **[[Kubernetes]]**: Container platform.',
	'- **[[Docker]]**: Container engine.'
].join('\n');

const strippedEnding = stripWikilinksFromTechnicalTerms(sampleEndingTerms);
assert.strictEqual(strippedEnding.includes('- **Kubernetes**: Container platform.'), true);
assert.strictEqual(strippedEnding.includes('- **Docker**: Container engine.'), true);
assert.strictEqual(strippedEnding.includes('[['), false);

// Case 3: Prompt adaptation logic
function adaptPromptForWikilinks(basePrompt, linkTerms) {
	if (!linkTerms) {
		let prompt = basePrompt
			.replace(/\*\*\[\[Term 1\]\]\*\*/g, '**Term 1**')
			.replace(/\*\*\[\[Term 2\]\]\*\*/g, '**Term 2**')
			.replace(/\[\[Term (\d+)\]\]/g, 'Term $1');
		prompt += '\n\nImportant formatting rule: In the "Technical terms" section, do NOT use wikilinks (do NOT enclose terms in [[ ]]). Format terms as bold text only (e.g. - **Term**: explanation).';
		return prompt;
	}
	return basePrompt;
}

const mockDefaultPrompt = '## Technical terms\n- **[[Term 1]]**: [Explanation 1]\n- **[[Term 2]]**: [Explanation 2]';
const adaptedEnabled = adaptPromptForWikilinks(mockDefaultPrompt, true);
assert.strictEqual(adaptedEnabled.includes('**[[Term 1]]**'), true);

const adaptedDisabled = adaptPromptForWikilinks(mockDefaultPrompt, false);
assert.strictEqual(adaptedDisabled.includes('**[[Term 1]]**'), false);
assert.strictEqual(adaptedDisabled.includes('**Term 1**'), true);
assert.strictEqual(adaptedDisabled.includes('do NOT use wikilinks'), true);
console.log('✓ Optional wikilinks in technical terms passed');

console.log('\nAll tests passed successfully!');




