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

// Test 17: Transcript formatting and timestamp links
console.log('Testing transcript formatting and timestamp links...');

function formatTimestampPartsHelper(offsetMs) {
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

function formatTranscriptHelper(lines, videoId, options = {}) {
	const linkTimestamps = options.linkTimestamps ?? true;
	const mediaExtended = options.mediaExtended ?? true;

	return lines
		.map((line) => {
			const { timeStr, roundedSeconds, meTimeStr } = formatTimestampPartsHelper(line.offset);

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

// Check unit breakdown
const p1 = formatTimestampPartsHelper(65610);
assert.strictEqual(p1.timeStr, '01:05');
assert.strictEqual(p1.roundedSeconds, 66);
assert.strictEqual(p1.meTimeStr, '01:05.61');

const p2 = formatTimestampPartsHelper(122650);
assert.strictEqual(p2.timeStr, '02:02');
assert.strictEqual(p2.roundedSeconds, 123);
assert.strictEqual(p2.meTimeStr, '02:02.65');

const testLines = [
	{ text: 'First segment', offset: 65610, duration: 3000 },
	{ text: 'Second segment with\nnewline', offset: 122650, duration: 4000 },
	{ text: 'Hour segment', offset: 3665610, duration: 2000 }
];

// Both enabled (default): Media Extended format matching user's exact specification
const bothEnabled = formatTranscriptHelper(testLines, 'dQw4w9WgXcQ');
assert.strictEqual(bothEnabled.includes('- [01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=66#t=01:05.61) First segment'), true);
assert.strictEqual(bothEnabled.includes('- [02:02](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123#t=02:02.65) Second segment with newline'), true);
assert.strictEqual(bothEnabled.includes('- [01:01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3666#t=01:01:05.61) Hour segment'), true);
assert.strictEqual(bothEnabled.includes('[[#t='), false);

// Only YouTube links (Media Extended disabled)
const ytOnly = formatTranscriptHelper(testLines, 'dQw4w9WgXcQ', { mediaExtended: false });
assert.strictEqual(ytOnly.includes('- [01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=66) First segment'), true);
assert.strictEqual(ytOnly.includes('- [02:02](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123) Second segment with newline'), true);
assert.strictEqual(ytOnly.includes('#t='), false);
assert.strictEqual(ytOnly.includes('[[#t='), false);

// Links disabled: plain text timestamps
const noLinks = formatTranscriptHelper(testLines, 'dQw4w9WgXcQ', { linkTimestamps: false });
assert.strictEqual(noLinks.includes('- 01:05 First segment'), true);
assert.strictEqual(noLinks.includes('- 02:02 Second segment with newline'), true);
assert.strictEqual(noLinks.includes('https://www.youtube.com'), false);
assert.strictEqual(noLinks.includes('[['), false);

// Both disabled
const neither = formatTranscriptHelper(testLines, 'dQw4w9WgXcQ', { linkTimestamps: false, mediaExtended: false });
assert.strictEqual(neither.includes('- 01:05 First segment'), true);
assert.strictEqual(neither.includes('[['), false);
assert.strictEqual(neither.includes('https://'), false);

// Test summary generation with transcript dump
function generateSummaryDumpHelper(transcript, thumbnailUrl, url, summaryText, dumpTranscript) {
	const summaryParts = [
		`![Thumbnail](${thumbnailUrl})`,
		summaryText
	];
	if (dumpTranscript && transcript.lines && transcript.lines.length > 0) {
		const formatted = formatTranscriptHelper(transcript.lines, transcript.videoId);
		summaryParts.push(`## Transcript\n\n${formatted}`);
	}
	return summaryParts.join('\n\n');
}

const mockTranscriptWithLines = {
	videoId: 'abc123xyz',
	lines: testLines
};

const summaryNoDump = generateSummaryDumpHelper(mockTranscriptWithLines, 'thumb.jpg', 'url', '## Summary\nText', false);
assert.strictEqual(summaryNoDump.includes('## Transcript'), false);

const summaryWithDump = generateSummaryDumpHelper(mockTranscriptWithLines, 'thumb.jpg', 'url', '## Summary\nText', true);
assert.strictEqual(summaryWithDump.includes('## Transcript'), true);
assert.strictEqual(summaryWithDump.includes('- [01:05]('), true);
console.log('✓ Transcript formatting and timestamp links passed');

// Test 18: YouTube Data API and metadata tags extraction
console.log('Testing YouTube Data API and metadata tags extraction...');

function extractTagsFromDataApiResponse(jsonText) {
	try {
		const data = JSON.parse(jsonText);
		const tags = data.items?.[0]?.snippet?.tags;
		if (Array.isArray(tags)) {
			return tags.filter((t) => typeof t === 'string' && t.trim().length > 0);
		}
	} catch {
		// ignore
	}
	return [];
}

function extractTagsFromPlayerDataKeywords(playerData) {
	if (Array.isArray(playerData?.videoDetails?.keywords)) {
		return playerData.videoDetails.keywords.filter(
			(k) => typeof k === 'string' && k.trim().length > 0
		);
	}
	return [];
}

function extractTagsFromHtmlFallback(html) {
	const jsonMatch = html.match(/"keywords":\s*(\[[^\]]+\])/);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[1]);
			if (Array.isArray(parsed)) {
				return parsed.filter((k) => typeof k === 'string' && k.trim().length > 0);
			}
		} catch {
			// ignore
		}
	}
	const metaMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]+)"/i);
	if (metaMatch) {
		return metaMatch[1].split(',').map((t) => t.trim()).filter(Boolean);
	}
	return [];
}

function mergeAllVideoTags(transcriptTitle, transcriptDesc, transcriptTags, topicTags, extractYtTags, detectHashtags) {
	const detectedTags = detectHashtags
		? Array.from(new Set([
				...extractTagsFromText(transcriptTitle),
				...extractTagsFromText(transcriptDesc || ''),
		  ]))
		: [];

	const ytDataApiTags = (extractYtTags && transcriptTags)
		? transcriptTags
		: [];

	return Array.from(
		new Set(
			[...detectedTags, ...ytDataApiTags, ...(topicTags || [])]
				.map(sanitizeTag)
				.filter(Boolean)
		)
	);
}

// Case 1: Parsing Data API v3 JSON response
const mockDataApiResponse = JSON.stringify({
	items: [{
		id: 'dQw4w9WgXcQ',
		snippet: {
			title: 'Never Gonna Give You Up',
			tags: ['Rick Astley', 'Never Gonna Give You Up', '80s Music', 'Rickroll']
		}
	}]
});
const parsedApiTags = extractTagsFromDataApiResponse(mockDataApiResponse);
assert.deepStrictEqual(parsedApiTags, ['Rick Astley', 'Never Gonna Give You Up', '80s Music', 'Rickroll']);

// Case 2: Parsing InnerTube player data keywords
const mockPlayerData = {
	videoDetails: {
		keywords: ['Obsidian', 'Note Taking', 'PKM', 'Productivity Tools']
	}
};
const parsedKeywords = extractTagsFromPlayerDataKeywords(mockPlayerData);
assert.deepStrictEqual(parsedKeywords, ['Obsidian', 'Note Taking', 'PKM', 'Productivity Tools']);

// Case 3: Parsing HTML fallback (JSON or meta tag)
const mockHtmlWithJson = '<html><head><script>var ytInitialPlayerResponse = {"videoDetails":{"keywords":["Markdown","Knowledge Base"]}};</script></head></html>';
assert.deepStrictEqual(extractTagsFromHtmlFallback(mockHtmlWithJson), ['Markdown', 'Knowledge Base']);

const mockHtmlWithMeta = '<html><head><meta name="keywords" content="Zettelkasten, Second Brain, Workflow"></head></html>';
assert.deepStrictEqual(extractTagsFromHtmlFallback(mockHtmlWithMeta), ['Zettelkasten', 'Second Brain', 'Workflow']);

// Case 4: Merging with title/description hashtags and topic tags (on by default)
const sampleTitle = 'Mastering Obsidian in 2026 #Obsidian #Productivity';
const sampleDesc = 'Here are my top tips! Check out #SecondBrain and #PKM.\nSubscribe!';
const sampleYtTags = ['Obsidian App', 'Note Taking', 'Second Brain', 'PKM', 'Knowledge Management'];
const sampleTopics = ['digital-notes', 'productivity'];

const mergedEnabled = mergeAllVideoTags(sampleTitle, sampleDesc, sampleYtTags, sampleTopics, true, true);
// Should contain hashtags from title/desc
assert.strictEqual(mergedEnabled.includes('obsidian'), true);
assert.strictEqual(mergedEnabled.includes('productivity'), true);
assert.strictEqual(mergedEnabled.includes('secondbrain'), true);
assert.strictEqual(mergedEnabled.includes('pkm'), true);
// Should contain YouTube Data API tags sanitized
assert.strictEqual(mergedEnabled.includes('obsidian-app'), true);
assert.strictEqual(mergedEnabled.includes('note-taking'), true);
assert.strictEqual(mergedEnabled.includes('second-brain'), true);
assert.strictEqual(mergedEnabled.includes('knowledge-management'), true);
// Should contain topic tags
assert.strictEqual(mergedEnabled.includes('digital-notes'), true);

// Case 5: When YouTube Data API tags toggle is disabled
const mergedDisabled = mergeAllVideoTags(sampleTitle, sampleDesc, sampleYtTags, sampleTopics, false, true);
// Title/desc and topic tags should be present
assert.strictEqual(mergedDisabled.includes('obsidian'), true);
assert.strictEqual(mergedDisabled.includes('secondbrain'), true);
assert.strictEqual(mergedDisabled.includes('digital-notes'), true);
// YouTube Data API tags should NOT be present
assert.strictEqual(mergedDisabled.includes('obsidian-app'), false);
assert.strictEqual(mergedDisabled.includes('note-taking'), false);
assert.strictEqual(mergedDisabled.includes('knowledge-management'), false);

// Case 6: De-duplication test
const tagsWithDuplicates = mergeAllVideoTags('Video #AI', 'More #machine-learning', ['AI', 'Machine Learning', 'ai'], ['AI'], true, true);
assert.deepStrictEqual(tagsWithDuplicates, ['ai', 'machine-learning']);

console.log('✓ YouTube Data API and metadata tags extraction passed');

// Test 19: Media Extended companion notes, frontmatter, and bidirectional linking
console.log('Testing Media Extended companion notes and bidirectional linking...');

function generateMxUidHelper() {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let id = '';
	for (let i = 0; i < 24; i++) {
		id += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return id;
}

function buildMediaExtendedFrontmatterHelper(data) {
	const mxUid = data.mxUid || generateMxUidHelper();
	const videoUrl = `https://www.youtube.com/watch?v=${data.videoId}`;
	const cover = data.cover || `"[[mx-cover-youtube_${data.videoId}.jpg]]"`;
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

function addRelatedLinkHelper(content, linkTarget) {
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
		
		const updatedBody = body.trimEnd() ? `${body.trimEnd()}\n${linkLine}` : `\n${linkLine}`;
		const replacement = `${match[1]}${header}${updatedBody}`;
		return trimmed.replace(fullMatch, () => replacement);
	}

	return `${trimmed}\n\n# Related\n${linkLine}\n`;
}

function buildMediaExtendedNoteHelper(data, transcriptText, relatedNoteLink) {
	const fm = buildMediaExtendedFrontmatterHelper(data);
	let body = transcriptText ? transcriptText.trim() : '';
	if (relatedNoteLink) {
		body = addRelatedLinkHelper(body, relatedNoteLink);
	}
	return `${fm}\n\n${body.trim()}\n`;
}

// Case 1: generateMxUid test
const uid1 = generateMxUidHelper();
const uid2 = generateMxUidHelper();
assert.strictEqual(uid1.length, 24);
assert.match(uid1, /^[a-z0-9]{24}$/);
assert.notStrictEqual(uid1, uid2);

// Case 2: Matching sample frontmatter format
const sampleRickAstleyData = {
	mxUid: 'vcxchy79gecb4s69v25oxq9s',
	videoId: 'dQw4w9WgXcQ',
	title: 'Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)',
	description: 'The official video for “Never Gonna Give You Up” by Rick Astley.\n\nNever: The Autobiography 📚 OUT NOW!',
	duration: 214,
	creator: 'Rick Astley',
	publishedAt: '2009-10-25',
	viewCount: 1818745023,
	likeCount: 19404514,
	cover: '[[mx-cover-youtube_dQw4w9WgXcQ.jpg]]',
	aspectRatio: '427 / 240',
};

const sampleFm = buildMediaExtendedFrontmatterHelper(sampleRickAstleyData);
assert(sampleFm.includes('mx-uid: vcxchy79gecb4s69v25oxq9s'));
assert(sampleFm.includes('video: https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
assert(sampleFm.includes('title: Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)'));
assert(sampleFm.includes('description: |-\n  The official video for “Never Gonna Give You Up” by Rick Astley.\n\n  Never: The Autobiography 📚 OUT NOW!'));
assert(sampleFm.includes('duration: 214'));
assert(sampleFm.includes('creator: Rick Astley'));
assert(sampleFm.includes('published_at: 2009-10-25'));
assert(sampleFm.includes('view_count: 1818745023'));
assert(sampleFm.includes('like_count: 19404514'));
assert(sampleFm.includes('cover: "[[mx-cover-youtube_dQw4w9WgXcQ.jpg]]"'));
assert(sampleFm.includes('aspect_ratio: 427 / 240'));

// Case 3: Title with special characters is properly quoted
const specialTitleData = {
	videoId: 'xyz789',
	title: 'Guide: How to use Obsidian with AI',
	creator: 'Tech Channel',
};
const specialFm = buildMediaExtendedFrontmatterHelper(specialTitleData);
assert(specialFm.includes('title: "Guide: How to use Obsidian with AI"'));

// Case 4: addRelatedLink helper when no # Related section exists
const noteWithoutRelated = '# Summary\n\nThis is a summary of the video.';
const linkedNote = addRelatedLinkHelper(noteWithoutRelated, 'Media Library/Rick Astley - Never Gonna Give You Up');
assert(linkedNote.includes('# Related\n- [[Media Library/Rick Astley - Never Gonna Give You Up]]'));

// Case 5: addRelatedLink helper when # Related already exists
const noteWithRelated = '# Summary\n\nNotes.\n\n# Related\n- [[Existing Link]]';
const linkedNote2 = addRelatedLinkHelper(noteWithRelated, 'Media Library/Rick Astley - Never Gonna Give You Up');
assert(linkedNote2.includes('# Related\n- [[Existing Link]]\n- [[Media Library/Rick Astley - Never Gonna Give You Up]]'));

// Case 6: addRelatedLink helper does not duplicate links
const linkedNote3 = addRelatedLinkHelper(linkedNote2, 'Media Library/Rick Astley - Never Gonna Give You Up');
assert.strictEqual(linkedNote2, linkedNote3);

// Case 7: addRelatedLink helper handles note names with dollar signs ($100, $$)
const dollarLinked = addRelatedLinkHelper('# Summary', 'Media Library/$100 AI Budget');
assert(dollarLinked.includes('- [[Media Library/$100 AI Budget]]'));

// Case 8: buildMediaExtendedNote helper complete note creation
const sampleLines = [
	{ text: 'First line', duration: 2, offset: 65610 },
	{ text: 'Second line', duration: 3, offset: 122650 }
];
const formattedSampleLines = formatTranscriptHelper(sampleLines, 'dQw4w9WgXcQ', { linkTimestamps: true, mediaExtended: true });
const fullMediaExtendedNote = buildMediaExtendedNoteHelper(
	sampleRickAstleyData,
	formattedSampleLines,
	'Rick Astley - Never Gonna Give You Up'
);
assert(fullMediaExtendedNote.startsWith('---\nmx-uid: vcxchy79gecb4s69v25oxq9s'));
assert(fullMediaExtendedNote.includes('- [01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=66#t=01:05.61) First line'));
assert(fullMediaExtendedNote.includes('- [02:02](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123#t=02:02.65) Second line'));
assert(fullMediaExtendedNote.includes('# Related\n- [[Rick Astley - Never Gonna Give You Up]]'));

// Case 9: Bidirectional link simulation
// Summary note links to Media Library/Title
const summaryBody = '# Summary\n\nKey takeaways from the video.';
const summaryWithRelated = addRelatedLinkHelper(summaryBody, 'Media Library/Rick Astley - Never Gonna Give You Up');
assert(summaryWithRelated.includes('- [[Media Library/Rick Astley - Never Gonna Give You Up]]'));

// Media Extended companion note links back to original summary note
assert(fullMediaExtendedNote.includes('- [[Rick Astley - Never Gonna Give You Up]]'));

console.log('✓ Media Extended companion notes and bidirectional linking passed');

// Test 20: YouTube description in frontmatter, Data API tags injection, and tag deduplication
console.log('Testing YouTube description in frontmatter and tag deduplication...');

function deduplicateTagsHelper(tags) {
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

// Test 21: Creator playlist discovery, frontmatter serialization, and body formatting
console.log('Testing creator playlist discovery, frontmatter, and body formatting...');

// Helper functions mirroring YouTubeService and frontmatter methods
function extractPlaylistIdHelper(url) {
	if (!url) return null;
	try {
		const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
		if (match) {
			const id = match[1];
			if (id.startsWith('RD') || id === 'WL' || id === 'LL') {
				return null;
			}
			return id;
		}
	} catch {}
	return null;
}

function extractPlaylistIndexHelper(url) {
	if (!url) return undefined;
	const match = url.match(/[?&]index=(\d+)/);
	if (match) {
		const idx = parseInt(match[1], 10);
		if (!isNaN(idx) && idx > 0) return idx;
	}
	return undefined;
}

function extractPlaylistFromDescHelper(desc) {
	if (!desc) return null;
	const match = desc.match(/https?:\/\/(?:www\.)?youtube\.com\/(?:playlist\?list=|watch\?[^\s"'\)<>]*list=)([a-zA-Z0-9_-]+)/i);
	if (match) {
		const id = match[1];
		if (!id.startsWith('RD') && id !== 'WL' && id !== 'LL') {
			return id;
		}
	}
	return null;
}

function buildFrontmatterWithPlaylist(data) {
	const lines = ['---'];
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
		for (const tag of deduplicateTagsHelper(data.tags)) {
			lines.push(`  - ${tag}`);
		}
	}

	lines.push('---');
	return lines.join('\n');
}

function mergeFrontmatterWithPlaylist(rawYaml, data) {
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

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const keyMatch = line.match(/^([a-zA-Z0-9_-]+):(.*)$/);
		if (keyMatch) {
			const key = keyMatch[1];
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

	return newLines.join('\n').trim();
}

function formatMetaLine(author, channelUrl, videoUrl, playlist, discoverPlaylist = true) {
	let line = `👤 [${author}](${channelUrl})  🔗 [Watch video](${videoUrl})`;
	if (discoverPlaylist && playlist) {
		let pLabel = playlist.title || 'Playlist';
		if (typeof playlist.index === 'number' && typeof playlist.count === 'number') {
			pLabel += ` (${playlist.index}/${playlist.count})`;
		} else if (typeof playlist.index === 'number') {
			pLabel += ` (#${playlist.index})`;
		}
		line += `  📋 [Playlist: ${pLabel}](${playlist.url})`;
	}
	return line;
}

// Case 1: Extract playlist ID & index from video URL
const urlWithPlaylist = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLlaN88a7xkmq7R8d1b1R5U0x9O_tC9_1s&index=4';
assert.strictEqual(extractPlaylistIdHelper(urlWithPlaylist), 'PLlaN88a7xkmq7R8d1b1R5U0x9O_tC9_1s');
assert.strictEqual(extractPlaylistIndexHelper(urlWithPlaylist), 4);

// Case 2: Ignore YouTube Mixes and system playlists
assert.strictEqual(extractPlaylistIdHelper('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ'), null);
assert.strictEqual(extractPlaylistIdHelper('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=WL'), null);
assert.strictEqual(extractPlaylistIdHelper('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=LL'), null);

// Case 3: Extract playlist link from description
const descWithPlaylist = 'Check out the complete series here:\nhttps://www.youtube.com/playlist?list=PLabc1234567890xyz\nSubscribe!';
assert.strictEqual(extractPlaylistFromDescHelper(descWithPlaylist), 'PLabc1234567890xyz');

// Case 4: buildFrontmatter with playlist fields
const dataWithPlaylist = {
	title: 'Building Modern Obsidian Plugins',
	channel_name: 'DevChannel',
	channel_username: '@devchannel',
	channel_url: 'https://youtube.com/@devchannel',
	video_url: 'https://youtube.com/watch?v=123',
	thumbnail: 'https://img.youtube.com/vi/123/maxresdefault.jpg',
	thumbnail_text: 'EPISODE 3',
	playlist_title: 'Obsidian Plugin Tutorial Series',
	playlist_url: 'https://www.youtube.com/playlist?list=PLabc1234567890xyz',
	playlist_id: 'PLabc1234567890xyz',
	playlist_index: 3,
	playlist_count: 12,
	tags: ['obsidian', 'plugins']
};

const builtPlaylistYaml = buildFrontmatterWithPlaylist(dataWithPlaylist);
assert(builtPlaylistYaml.includes('playlist_title: "Obsidian Plugin Tutorial Series"'));
assert(builtPlaylistYaml.includes('playlist_url: "https://www.youtube.com/playlist?list=PLabc1234567890xyz"'));
assert(builtPlaylistYaml.includes('playlist_id: "PLabc1234567890xyz"'));
assert(builtPlaylistYaml.includes('playlist_index: 3'));
assert(builtPlaylistYaml.includes('playlist_count: 12'));

// Case 5: mergeFrontmatter adds playlist fields to existing note
const existingNoteNoPlaylist = `title: "Building Modern Obsidian Plugins"
channel_name: "DevChannel"
video_url: "https://youtube.com/watch?v=123"`;

const mergedPlaylistYaml = mergeFrontmatterWithPlaylist(existingNoteNoPlaylist, dataWithPlaylist);
assert(mergedPlaylistYaml.includes('playlist_title: "Obsidian Plugin Tutorial Series"'));
assert(mergedPlaylistYaml.includes('playlist_url: "https://www.youtube.com/playlist?list=PLabc1234567890xyz"'));
assert(mergedPlaylistYaml.includes('playlist_id: "PLabc1234567890xyz"'));
assert(mergedPlaylistYaml.includes('playlist_index: 3'));
assert(mergedPlaylistYaml.includes('playlist_count: 12'));

// Case 6: Note body metadata line formatting with playlist
const playlistObj = {
	title: 'Obsidian Plugin Tutorial Series',
	url: 'https://www.youtube.com/playlist?list=PLabc1234567890xyz',
	index: 3,
	count: 12,
};
const formattedLineWithCount = formatMetaLine('DevChannel', 'https://youtube.com/@devchannel', 'https://youtube.com/watch?v=123', playlistObj, true);
assert.strictEqual(
	formattedLineWithCount,
	'👤 [DevChannel](https://youtube.com/@devchannel)  🔗 [Watch video](https://youtube.com/watch?v=123)  📋 [Playlist: Obsidian Plugin Tutorial Series (3/12)](https://www.youtube.com/playlist?list=PLabc1234567890xyz)'
);

// Without count:
const formattedLineWithoutCount = formatMetaLine('DevChannel', 'https://youtube.com/@devchannel', 'https://youtube.com/watch?v=123', { ...playlistObj, count: undefined }, true);
assert.strictEqual(
	formattedLineWithoutCount,
	'👤 [DevChannel](https://youtube.com/@devchannel)  🔗 [Watch video](https://youtube.com/watch?v=123)  📋 [Playlist: Obsidian Plugin Tutorial Series (#3)](https://www.youtube.com/playlist?list=PLabc1234567890xyz)'
);

// When feature is disabled:
const formattedLineDisabled = formatMetaLine('DevChannel', 'https://youtube.com/@devchannel', 'https://youtube.com/watch?v=123', playlistObj, false);
assert.strictEqual(
	formattedLineDisabled,
	'👤 [DevChannel](https://youtube.com/@devchannel)  🔗 [Watch video](https://youtube.com/watch?v=123)'
);

console.log('✓ Creator playlist discovery, frontmatter, and body formatting passed');

console.log('\nAll tests passed successfully!');







