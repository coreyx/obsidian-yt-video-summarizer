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

function buildTimestampUrlHelper(videoId, offsetMs, format) {
	const { roundedSeconds, meTimeStr } = formatTimestampPartsHelper(offsetMs);
	if (format === 'mediaExtended') {
		return `https://www.youtube.com/watch?v=${videoId}&t=${roundedSeconds}#t=${meTimeStr}`;
	}
	const seconds = Math.floor(Math.max(0, offsetMs) / 1000);
	return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
}

function formatTranscriptHelper(lines, videoId, options = {}) {
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

// Media Extended format (companion notes) matching user's exact specification
const meFormatted = formatTranscriptHelper(testLines, 'dQw4w9WgXcQ', { format: 'mediaExtended' });
assert.strictEqual(meFormatted.includes('- [01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=66#t=01:05.61) First segment'), true);
assert.strictEqual(meFormatted.includes('- [02:02](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123#t=02:02.65) Second segment with newline'), true);
assert.strictEqual(meFormatted.includes('- [01:01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3666#t=01:01:05.61) Hour segment'), true);
assert.strictEqual(meFormatted.includes('[[#t='), false);

// Standard YouTube format (default, video summary notes): &t=SECONDSs, floored to the displayed second
const ytFormatted = formatTranscriptHelper(testLines, 'dQw4w9WgXcQ');
assert.strictEqual(ytFormatted.includes('- [01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=65s) First segment'), true);
assert.strictEqual(ytFormatted.includes('- [02:02](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=122s) Second segment with newline'), true);
assert.strictEqual(ytFormatted.includes('- [01:01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3665s) Hour segment'), true);
assert.strictEqual(ytFormatted.includes('#t='), false);
assert.strictEqual(ytFormatted.includes('[[#t='), false);

// Every transcript line is linked in both formats
for (const formatted of [meFormatted, ytFormatted]) {
	for (const line of formatted.split('\n')) {
		assert.match(line, /^- \[\d{2}:\d{2}(?::\d{2})?\]\(https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ&t=\d+/);
	}
}

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
		
		const cleanBody = body.trim();
		const updatedBody = cleanBody ? `\n\n${cleanBody}\n${linkLine}` : `\n\n${linkLine}`;
		const replacement = `${match[1]}${header}${updatedBody}`;
		return trimmed.replace(fullMatch, () => replacement);
	}

	return trimmed ? `${trimmed}\n\n# Related\n\n${linkLine}\n` : `# Related\n\n${linkLine}\n`;
}

function parseTimestampToSecondsHelper(timeStr) {
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

function parseTimestampToUrlHelper(timeStr, videoId, format) {
	const totalSeconds = parseTimestampToSecondsHelper(timeStr);
	return totalSeconds === null ? null : buildTimestampUrlHelper(videoId, totalSeconds * 1000, format);
}

function parseTimestampToMediaExtendedUrlHelper(timeStr, videoId) {
	return parseTimestampToUrlHelper(timeStr, videoId, 'mediaExtended');
}

function convertTimestampsToLinksHelper(text, videoId, format) {
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

function convertDescriptionTimestampsToMediaExtendedHelper(description, videoId) {
	return convertTimestampsToLinksHelper(description, videoId, 'mediaExtended');
}

function convertDescriptionTimestampsToYouTubeHelper(description, videoId) {
	return convertTimestampsToLinksHelper(description, videoId, 'youtube');
}

function getMediaExtendedCoverUrlHelper(data) {
	return data.cover?.replace(/^"|"$/g, '') || `https://i.ytimg.com/vi_webp/${data.videoId}/maxresdefault.webp`;
}

function buildCoverEmbedHelper(coverUrl) {
	return `![Cover](${coverUrl})`;
}

function buildMediaExtendedNoteHelper(data, transcriptText, relatedNoteLink, options) {
	const fm = buildMediaExtendedFrontmatterHelper(data);
	const sections = [];

	if (options?.embedCover) {
		sections.push(buildCoverEmbedHelper(getMediaExtendedCoverUrlHelper(data)));
	}

	const includeDescription = options?.includeDescription ?? true;
	if (includeDescription && data.description && data.description.trim()) {
		const formattedDescription = convertDescriptionTimestampsToMediaExtendedHelper(
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
		body = addRelatedLinkHelper(body, relatedNoteLink);
	}
	return body.trim() ? `${fm}\n\n${body.trim()}\n` : `${fm}\n`;
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
	cover: 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp',
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
assert(sampleFm.includes('cover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"'));

// Default cover (no explicit cover) is the full max-resolution WebP thumbnail URL, never a local wikilink
const defaultCoverFm = buildMediaExtendedFrontmatterHelper({ videoId: 'z02Y-1OvWSM', title: 'T', creator: 'C' });
assert(defaultCoverFm.includes('cover: "https://i.ytimg.com/vi_webp/z02Y-1OvWSM/maxresdefault.webp"'));
assert(!defaultCoverFm.includes('[['));

// getCoverUrl: falls back to hqdefault when maxres is missing (404); keeps maxres on success or network error
async function getCoverUrlHelper(videoId, headStatus) {
	const maxres = `https://i.ytimg.com/vi_webp/${videoId}/maxresdefault.webp`;
	try {
		const status = await headStatus(maxres);
		if (status === 404) return `https://i.ytimg.com/vi_webp/${videoId}/hqdefault.webp`;
	} catch {
		// keep maxres
	}
	return maxres;
}
assert.strictEqual(await getCoverUrlHelper('dQw4w9WgXcQ', async () => 200), 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp');
assert.strictEqual(await getCoverUrlHelper('jNQXAC9IVRw', async () => 404), 'https://i.ytimg.com/vi_webp/jNQXAC9IVRw/hqdefault.webp');
assert.strictEqual(await getCoverUrlHelper('dQw4w9WgXcQ', async () => { throw new Error('offline'); }), 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp');

// getAvailableThumbnailUrl (video summary notes): same fallback on the img.youtube.com JPEG thumbnails
async function getAvailableThumbnailUrlHelper(videoId, headStatus) {
	const maxres = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
	try {
		if ((await headStatus(maxres)) === 404) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
	} catch {
		// keep maxres
	}
	return maxres;
}
assert.strictEqual(await getAvailableThumbnailUrlHelper('dQw4w9WgXcQ', async () => 200), 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
assert.strictEqual(await getAvailableThumbnailUrlHelper('jNQXAC9IVRw', async () => 404), 'https://img.youtube.com/vi/jNQXAC9IVRw/hqdefault.jpg');
assert.strictEqual(await getAvailableThumbnailUrlHelper('dQw4w9WgXcQ', async () => { throw new Error('offline'); }), 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
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
assert(linkedNote.includes('# Related\n\n- [[Media Library/Rick Astley - Never Gonna Give You Up]]'));

// Case 5: addRelatedLink helper when # Related already exists
const noteWithRelated = '# Summary\n\nNotes.\n\n# Related\n- [[Existing Link]]';
const linkedNote2 = addRelatedLinkHelper(noteWithRelated, 'Media Library/Rick Astley - Never Gonna Give You Up');
assert(linkedNote2.includes('# Related\n\n- [[Existing Link]]\n- [[Media Library/Rick Astley - Never Gonna Give You Up]]'));

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
const formattedSampleLines = formatTranscriptHelper(sampleLines, 'dQw4w9WgXcQ', { format: 'mediaExtended' });
const fullMediaExtendedNote = buildMediaExtendedNoteHelper(
	sampleRickAstleyData,
	formattedSampleLines,
	'Rick Astley - Never Gonna Give You Up'
);
assert(fullMediaExtendedNote.startsWith('---\nmx-uid: vcxchy79gecb4s69v25oxq9s'));
assert(fullMediaExtendedNote.includes('# Description\n\n'));
assert(fullMediaExtendedNote.includes('# Transcript\n\n'));
assert(fullMediaExtendedNote.includes('- [01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=66#t=01:05.61) First line'));
assert(fullMediaExtendedNote.includes('- [02:02](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123#t=02:02.65) Second line'));
assert(fullMediaExtendedNote.includes('# Related\n\n- [[Rick Astley - Never Gonna Give You Up]]'));

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

// Test 22: Detection of missing companion notes
console.log('Testing missing companion note detection...');

function isMediaExtendedCompanionNoteHelper(content, filePath, mediaFolder = 'Media Library') {
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

function hasRelatedMediaExtendedLinkHelper(content, mediaFolder = 'Media Library', expectedBasename) {
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

// Case 1: isMediaExtendedCompanionNote identification
const companionNoteContent = `---
mx-uid: vcxchy79gecb4s69v25oxq9s
video: https://www.youtube.com/watch?v=dQw4w9WgXcQ
title: Rick Astley - Never Gonna Give You Up
---

- [01:05](https://youtube.com/watch?v=dQw4w9WgXcQ&t=66#t=01:05.61) Intro`;

const regularSummaryContent = `---
title: "Rick Astley - Never Gonna Give You Up"
channel_name: "Rick Astley"
video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
---

## Summary
Great music video.`;

assert.strictEqual(isMediaExtendedCompanionNoteHelper(companionNoteContent, 'Media Library/Rick Astley.md'), true);
assert.strictEqual(isMediaExtendedCompanionNoteHelper(companionNoteContent, 'Custom Folder/Rick Astley.md'), true); // Has mx-uid
assert.strictEqual(isMediaExtendedCompanionNoteHelper(regularSummaryContent, 'Media Library/Rick Astley.md'), true); // In media folder
assert.strictEqual(isMediaExtendedCompanionNoteHelper(regularSummaryContent, 'YouTube/Rick Astley.md'), false); // Regular summary

// Case 2: hasRelatedMediaExtendedLink detection
const summaryWithCompanionLink = `---
title: "Rick Astley"
video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
---

## Summary
Some text.

# Related
- [[Media Library/Rick Astley - Never Gonna Give You Up]]`;

const summaryWithDifferentRelatedLink = `---
title: "Rick Astley"
video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
---

## Summary
Some text.

# Related
- [[80s Music History]]`;

const summaryWithNoRelated = `---
title: "Rick Astley"
video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
---

## Summary
Some text.`;

assert.strictEqual(hasRelatedMediaExtendedLinkHelper(summaryWithCompanionLink, 'Media Library', 'Rick Astley - Never Gonna Give You Up'), true);
assert.strictEqual(hasRelatedMediaExtendedLinkHelper(summaryWithDifferentRelatedLink, 'Media Library', 'Rick Astley - Never Gonna Give You Up'), false);
assert.strictEqual(hasRelatedMediaExtendedLinkHelper(summaryWithNoRelated, 'Media Library', 'Rick Astley - Never Gonna Give You Up'), false);

console.log('✓ Missing companion note detection passed');

// Test 23: Folder filtering and folder-scoped discovery
console.log('Testing folder filtering and folder-scoped discovery...');

function testFilterFilesByFolderPaths(files, targetFolders) {
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

function testFilterFilesByFolder(files, folder) {
	if (folder.isRoot()) {
		return files;
	}
	const folderPath = folder.path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
	return files.filter((file) => {
		const filePath = file.path.replace(/\\/g, '/');
		return filePath.startsWith(folderPath + '/') || filePath === folderPath;
	});
}

// Case 1: filterFilesByFolderPaths
const mockVaultFiles = [
	{ path: 'YouTube/Rick Astley.md' },
	{ path: 'YouTube/Tutorials/Agent.md' },
	{ path: 'Notes/Videos/Conference.md' },
	{ path: 'Articles/Blog.md' },
	{ path: 'RootNote.md' }
];

const filteredByPaths = testFilterFilesByFolderPaths(mockVaultFiles, ['YouTube', 'Notes/Videos']);
assert.strictEqual(filteredByPaths.length, 3);
assert.deepStrictEqual(
	filteredByPaths.map((f) => f.path),
	['YouTube/Rick Astley.md', 'YouTube/Tutorials/Agent.md', 'Notes/Videos/Conference.md']
);

// Empty folder list returns all files
assert.strictEqual(testFilterFilesByFolderPaths(mockVaultFiles, []).length, 5);

// Case 2: filterFilesByFolder (single folder or root)
const mockSubFolder = { path: 'YouTube', isRoot: () => false };
const vaultRootFolder = { path: '/', isRoot: () => true };

const filteredByFolder = testFilterFilesByFolder(mockVaultFiles, mockSubFolder);
assert.strictEqual(filteredByFolder.length, 2);
assert.deepStrictEqual(
	filteredByFolder.map((f) => f.path),
	['YouTube/Rick Astley.md', 'YouTube/Tutorials/Agent.md']
);

const filteredByRoot = testFilterFilesByFolder(mockVaultFiles, vaultRootFolder);
assert.strictEqual(filteredByRoot.length, 5);


console.log('✓ Folder filtering and folder-scoped discovery passed');

// Test 24: Summary prompt Media Extended checkbox and per-run override resolution
console.log('Testing summary prompt Media Extended checkbox override resolution...');

function resolveMediaExtendedOption(settingValue, overrideValue) {
	return overrideValue !== undefined ? overrideValue : settingValue;
}

// Case 1: Inherits true when permanent setting is true and override is undefined
let permanentSetting = true;
assert.strictEqual(resolveMediaExtendedOption(permanentSetting, undefined), true);
assert.strictEqual(permanentSetting, true); // permanent setting unchanged

// Case 2: Inherits false when permanent setting is false and override is undefined
permanentSetting = false;
assert.strictEqual(resolveMediaExtendedOption(permanentSetting, undefined), false);
assert.strictEqual(permanentSetting, false); // permanent setting unchanged

// Case 3: Overridden to false at prompt when permanent setting is true
permanentSetting = true;
const promptChoiceOff = false;
assert.strictEqual(resolveMediaExtendedOption(permanentSetting, promptChoiceOff), false);
assert.strictEqual(permanentSetting, true); // permanent setting untouched!

// Case 4: Overridden to true at prompt when permanent setting is false
permanentSetting = false;
const promptChoiceOn = true;
assert.strictEqual(resolveMediaExtendedOption(permanentSetting, promptChoiceOn), true);
assert.strictEqual(permanentSetting, false); // permanent setting untouched!

console.log('✓ Summary prompt Media Extended checkbox override resolution passed');

// Test 25: OpenAI-compatible URL normalization, LM Studio model parsing & provider sync
console.log('Testing OpenAI-compatible URL normalization and LM Studio model parsing...');

function testNormalizeOpenAIBaseUrl(rawUrl) {
	let clean = (rawUrl || '').trim();
	if (!clean) {
		return 'http://localhost:1234/v1';
	}
	if (!/^https?:\/\//i.test(clean)) {
		clean = `http://${clean}`;
	}
	clean = clean.replace(/\/+$/, '');
	if (!/\/v\d+([a-z0-9_-]+)?$/i.test(clean)) {
		clean = `${clean}/v1`;
	}
	return clean;
}

function testGetLMStudioNativeModelsUrl(baseUrl) {
	return `${baseUrl.replace(/\/v\d+([a-z0-9_-]+)?$/i, '')}/api/v0/models`;
}

function testParseLMStudioModels(responseData) {
	if (!responseData) return [];
	const rawList = Array.isArray(responseData)
		? responseData
		: Array.isArray(responseData.data)
			? responseData.data
			: [];
	const models = [];
	for (const item of rawList) {
		if (!item) continue;
		const id = typeof item === 'string' ? item : item.id || item.name;
		if (!id || typeof id !== 'string') continue;
		if (item.type === 'embeddings' || item.type === 'embedding') continue;
		const isLoaded = item.state === 'loaded' || item.loaded === true;
		const displayName = item.displayName || item.name || id;
		models.push({
			id: id.trim(),
			displayName: String(displayName).trim(),
			isLoaded
		});
	}
	models.sort((a, b) => {
		if (a.isLoaded && !b.isLoaded) return -1;
		if (!a.isLoaded && b.isLoaded) return 1;
		return a.displayName.localeCompare(b.displayName);
	});
	return models;
}

function testSyncLMStudioProvider(settings, url, models) {
	const normalizedUrl = testNormalizeOpenAIBaseUrl(url);
	let provider = settings.providers.find((p) => p.name.toLowerCase() === 'lm studio');
	const storedModels = models.map((m) => ({
		name: m.id,
		displayName: m.displayName || m.id,
		pricing: 'Local LLM (LM Studio)'
	}));

	if (!provider) {
		provider = {
			name: 'LM Studio',
			type: 'openai',
			isBuiltIn: false,
			apiKey: 'not-needed',
			url: normalizedUrl,
			models: storedModels
		};
		settings.providers.push(provider);
	} else {
		provider.url = normalizedUrl;
		if (!provider.apiKey) {
			provider.apiKey = 'not-needed';
		}
		provider.type = 'openai';
		if (storedModels.length > 0) {
			provider.models = storedModels;
		}
	}

	let newActiveModelId = null;
	if (models.length > 0) {
		const isCurrent = (m) => `${provider.name}:${m.id}` === settings.selectedModelId;
		const loadedModels = models.filter((m) => m.isLoaded);
		const preferredModel = loadedModels.find(isCurrent) || loadedModels[0] || models.find(isCurrent) || models[0];
		newActiveModelId = `${provider.name}:${preferredModel.id}`;
		settings.selectedModelId = newActiveModelId;
	}

	return { provider, modelCount: storedModels.length, activeModelId: newActiveModelId };
}

// 25.1: URL normalization tests
assert.strictEqual(testNormalizeOpenAIBaseUrl(''), 'http://localhost:1234/v1');
assert.strictEqual(testNormalizeOpenAIBaseUrl('localhost:1234'), 'http://localhost:1234/v1');
assert.strictEqual(testNormalizeOpenAIBaseUrl('http://localhost:1234'), 'http://localhost:1234/v1');
assert.strictEqual(testNormalizeOpenAIBaseUrl('http://localhost:1234/'), 'http://localhost:1234/v1');
assert.strictEqual(testNormalizeOpenAIBaseUrl('http://localhost:1234/v1'), 'http://localhost:1234/v1');
assert.strictEqual(testNormalizeOpenAIBaseUrl('http://localhost:1234/v1/'), 'http://localhost:1234/v1');
assert.strictEqual(testNormalizeOpenAIBaseUrl('http://127.0.0.1:11434'), 'http://127.0.0.1:11434/v1');
assert.strictEqual(testNormalizeOpenAIBaseUrl('https://openrouter.ai/api/v1'), 'https://openrouter.ai/api/v1');
assert.strictEqual(testNormalizeOpenAIBaseUrl('https://api.groq.com/openai/v1/'), 'https://api.groq.com/openai/v1');

// Native LM Studio endpoint derived from the OpenAI-compatible base URL
assert.strictEqual(testGetLMStudioNativeModelsUrl('http://localhost:1234/v1'), 'http://localhost:1234/api/v0/models');
assert.strictEqual(testGetLMStudioNativeModelsUrl('http://127.0.0.1:1234/v1'), 'http://127.0.0.1:1234/api/v0/models');

// 25.2: Model parsing tests
const mockLMStudioResp = {
	object: 'list',
	data: [
		{ id: 'mistral-7b-instruct', state: 'unloaded' },
		{ id: 'qwen2.5-coder-7b-instruct', state: 'loaded', type: 'llm' },
		{ id: 'llama-3.2-3b-instruct', state: 'unloaded' }
	]
};
const parsedModels = testParseLMStudioModels(mockLMStudioResp);
assert.strictEqual(parsedModels.length, 3);
// Loaded model must be sorted first
assert.strictEqual(parsedModels[0].id, 'qwen2.5-coder-7b-instruct');
assert.strictEqual(parsedModels[0].isLoaded, true);
assert.strictEqual(parsedModels[1].id, 'llama-3.2-3b-instruct');
assert.strictEqual(parsedModels[2].id, 'mistral-7b-instruct');

// Standard OpenAI format without state
const mockOpenAIList = {
	data: [{ id: 'model-b' }, { id: 'model-a' }]
};
const parsedOpenAI = testParseLMStudioModels(mockOpenAIList);
assert.strictEqual(parsedOpenAI.length, 2);
assert.strictEqual(parsedOpenAI[0].id, 'model-a'); // sorted alphabetically when neither loaded
assert.strictEqual(parsedOpenAI[1].id, 'model-b');

// LM Studio native /api/v0/models format: loaded model wins over alphabetical order, embeddings dropped
const mockNativeResp = {
	object: 'list',
	data: [
		{ id: 'gemma-4-e4b-it', type: 'vlm', state: 'not-loaded' },
		{ id: 'qwen3-coder-30b-a3b-instruct', type: 'llm', state: 'loaded' },
		{ id: 'text-embedding-nomic-embed-text-v1.5', type: 'embeddings', state: 'not-loaded' }
	]
};
const parsedNative = testParseLMStudioModels(mockNativeResp);
assert.strictEqual(parsedNative.length, 2);
assert.strictEqual(parsedNative[0].id, 'qwen3-coder-30b-a3b-instruct');
assert.strictEqual(parsedNative[0].isLoaded, true);
assert.strictEqual(parsedNative[1].id, 'gemma-4-e4b-it');
assert.strictEqual(parsedNative[1].isLoaded, false);

// Empty and invalid handling
assert.deepStrictEqual(testParseLMStudioModels(null), []);
assert.deepStrictEqual(testParseLMStudioModels({ data: [] }), []);
assert.deepStrictEqual(testParseLMStudioModels({ data: [{ id: '' }, null, 123] }), []);

// 25.3: Sync LM Studio provider into settings
const testSettings = {
	providers: [
		{ name: 'Gemini', type: 'gemini', models: [{ name: 'gemini-3.8-flash' }] }
	],
	selectedModelId: 'Gemini:gemini-3.8-flash'
};

// Initial sync adds "LM Studio" and sets active model to loaded model
const syncResult = testSyncLMStudioProvider(testSettings, 'http://localhost:1234', parsedModels);
assert.strictEqual(syncResult.modelCount, 3);
assert.strictEqual(syncResult.activeModelId, 'LM Studio:qwen2.5-coder-7b-instruct');
assert.strictEqual(testSettings.selectedModelId, 'LM Studio:qwen2.5-coder-7b-instruct');
assert.strictEqual(testSettings.providers.length, 2);
assert.strictEqual(testSettings.providers[1].name, 'LM Studio');
assert.strictEqual(testSettings.providers[1].url, 'http://localhost:1234/v1');
assert.strictEqual(testSettings.providers[1].apiKey, 'not-needed');

// Re-syncing updates models without duplicating provider
const updatedResp = {
	data: [{ id: 'deepseek-r1-distill-qwen-7b', state: 'loaded' }]
};
const updatedModels = testParseLMStudioModels(updatedResp);
const resyncResult = testSyncLMStudioProvider(testSettings, 'http://127.0.0.1:1234/v1', updatedModels);
assert.strictEqual(testSettings.providers.length, 2); // still 2 providers
assert.strictEqual(resyncResult.modelCount, 1);
assert.strictEqual(testSettings.providers[1].url, 'http://127.0.0.1:1234/v1');
assert.strictEqual(testSettings.selectedModelId, 'LM Studio:deepseek-r1-distill-qwen-7b');

// Nothing loaded: the current LM Studio selection is kept instead of jumping to the first model
const noneLoaded = testParseLMStudioModels({
	data: [
		{ id: 'aaa-model', state: 'not-loaded' },
		{ id: 'deepseek-r1-distill-qwen-7b', state: 'not-loaded' }
	]
});
testSyncLMStudioProvider(testSettings, 'http://127.0.0.1:1234/v1', noneLoaded);
assert.strictEqual(testSettings.selectedModelId, 'LM Studio:deepseek-r1-distill-qwen-7b');

// Several loaded: the current selection is kept when it is one of them
const twoLoaded = testParseLMStudioModels({
	data: [
		{ id: 'aaa-model', state: 'loaded' },
		{ id: 'deepseek-r1-distill-qwen-7b', state: 'loaded' }
	]
});
testSyncLMStudioProvider(testSettings, 'http://127.0.0.1:1234/v1', twoLoaded);
assert.strictEqual(testSettings.selectedModelId, 'LM Studio:deepseek-r1-distill-qwen-7b');

// Current selection not loaded: switch to the loaded model
const otherLoaded = testParseLMStudioModels({
	data: [
		{ id: 'aaa-model', state: 'loaded' },
		{ id: 'deepseek-r1-distill-qwen-7b', state: 'not-loaded' }
	]
});
testSyncLMStudioProvider(testSettings, 'http://127.0.0.1:1234/v1', otherLoaded);
assert.strictEqual(testSettings.selectedModelId, 'LM Studio:aaa-model');

console.log('✓ OpenAI-compatible URL normalization and LM Studio model parsing passed');

// Test 26: Description in Media Extended note, timestamp conversion, section headings, and empty lines
console.log('Testing Media Extended note description, timestamp conversion, and section headings...');

// 26.1: parseTimestampToMediaExtendedUrlHelper unit tests
const testVideoId = 'abc123XYZ';
assert.strictEqual(
	parseTimestampToMediaExtendedUrlHelper('0:00', testVideoId),
	'https://www.youtube.com/watch?v=abc123XYZ&t=0#t=00:00.00'
);
assert.strictEqual(
	parseTimestampToMediaExtendedUrlHelper('01:23', testVideoId),
	'https://www.youtube.com/watch?v=abc123XYZ&t=83#t=01:23.00'
);
assert.strictEqual(
	parseTimestampToMediaExtendedUrlHelper('1:23:45', testVideoId),
	'https://www.youtube.com/watch?v=abc123XYZ&t=5025#t=01:23:45.00'
);
assert.strictEqual(parseTimestampToMediaExtendedUrlHelper('invalid', testVideoId), null);

// 26.2: convertDescriptionTimestampsToMediaExtendedHelper tests
const sampleRawDescription = `Welcome to this tutorial!
Chapters:
0:00 - Introduction
- 01:23 Getting Started
• 02:45 Basic Workflow
03:50: Best Practices
[04:20] Advanced Tips
(05:15) Q&A Session
1:05:30 Final Thoughts

Resources:
See [our blog](https://example.com/guide:1) for written steps.
Visit https://example.com/repo/12:34 for the source code.
Already formatted: [06:00](https://youtube.com/watch?v=old&t=360)
Note: Meeting is at 10:00 AM (not a video timestamp)
Aspect ratio is 16:9 widescreen`;

const convertedDesc = convertDescriptionTimestampsToMediaExtendedHelper(sampleRawDescription, testVideoId);

// 0:00 converted
assert(convertedDesc.includes('[0:00](https://www.youtube.com/watch?v=abc123XYZ&t=0#t=00:00.00) - Introduction'));
// - 01:23 converted
assert(convertedDesc.includes('- [01:23](https://www.youtube.com/watch?v=abc123XYZ&t=83#t=01:23.00) Getting Started'));
// • 02:45 converted
assert(convertedDesc.includes('• [02:45](https://www.youtube.com/watch?v=abc123XYZ&t=165#t=02:45.00) Basic Workflow'));
// 03:50: converted with colon preserved
assert(convertedDesc.includes('[03:50](https://www.youtube.com/watch?v=abc123XYZ&t=230#t=03:50.00): Best Practices'));
// [04:20] bracketed converted without double brackets
assert(convertedDesc.includes('[04:20](https://www.youtube.com/watch?v=abc123XYZ&t=260#t=04:20.00) Advanced Tips'));
assert(!convertedDesc.includes('[[04:20]('));
// (05:15) parenthesized preserved
assert(convertedDesc.includes('([05:15](https://www.youtube.com/watch?v=abc123XYZ&t=315#t=05:15.00)) Q&A Session'));
// 1:05:30 3-part timestamp converted
assert(convertedDesc.includes('[1:05:30](https://www.youtube.com/watch?v=abc123XYZ&t=3930#t=01:05:30.00) Final Thoughts'));
// Existing link converted to Media Extended URL
assert(convertedDesc.includes('[06:00](https://www.youtube.com/watch?v=abc123XYZ&t=360#t=06:00.00)'));
// Regular markdown link preserved
assert(convertedDesc.includes('[our blog](https://example.com/guide:1)'));
// Raw URL preserved
assert(convertedDesc.includes('https://example.com/repo/12:34'));
// 10:00 AM not matched as timestamp
assert(convertedDesc.includes('10:00 AM'));
// 16:9 aspect ratio not matched
assert(convertedDesc.includes('16:9 widescreen'));

// 26.3: Empty description handling
assert.strictEqual(convertDescriptionTimestampsToMediaExtendedHelper('', testVideoId), '');
assert.strictEqual(convertDescriptionTimestampsToMediaExtendedHelper(undefined, testVideoId), undefined);

// 26.4: buildMediaExtendedNoteHelper with sections and empty lines
const testMetadata = {
	mxUid: 'test12345678901234567890',
	videoId: testVideoId,
	title: 'Complete TypeScript Guide',
	description: 'A great tutorial.\n0:00 Intro\n01:23 Code walkthrough',
	duration: 300,
	creator: 'Code Master'
};
const testTranscript = '- [00:00](https://www.youtube.com/watch?v=abc123XYZ&t=0#t=00:00.00) Hello world\n- [01:23](https://www.youtube.com/watch?v=abc123XYZ&t=83#t=01:23.00) Let us begin';
const testRelatedNote = 'TypeScript Summary Note';

// Default includes description (on by default)
const fullNoteWithDesc = buildMediaExtendedNoteHelper(testMetadata, testTranscript, testRelatedNote);
assert(fullNoteWithDesc.startsWith('---\nmx-uid: test12345678901234567890'));
// Section headings must exist
assert(fullNoteWithDesc.includes('\n\n# Description\n\n'));
assert(fullNoteWithDesc.includes('\n\n# Transcript\n\n'));
assert(fullNoteWithDesc.includes('\n\n# Related\n\n'));
// Empty lines must follow each heading before content
assert(fullNoteWithDesc.includes('# Description\n\nA great tutorial.'));
assert(fullNoteWithDesc.includes('# Transcript\n\n- [00:00]'));
assert(fullNoteWithDesc.includes('# Related\n\n- [[TypeScript Summary Note]]'));
// Timestamps in description must be converted to Media Extended links
assert(fullNoteWithDesc.includes('[01:23](https://www.youtube.com/watch?v=abc123XYZ&t=83#t=01:23.00) Code walkthrough'));

// 26.5: Turning off includeDescription setting
const meNoteWithoutDesc = buildMediaExtendedNoteHelper(testMetadata, testTranscript, testRelatedNote, {
	includeDescription: false
});
assert(!meNoteWithoutDesc.includes('# Description'));
assert(meNoteWithoutDesc.includes('# Transcript\n\n- [00:00]'));
assert(meNoteWithoutDesc.includes('# Related\n\n- [[TypeScript Summary Note]]'));

// 26.6: Empty line after # Related in Video Summary note
const summaryBodyNote = '# Video Summary\n\nHere are the key takeaways.';
const summaryLinked = addRelatedLinkHelper(summaryBodyNote, 'Media Library/Complete TypeScript Guide');
assert(summaryLinked.includes('\n\n# Related\n\n- [[Media Library/Complete TypeScript Guide]]\n'));

console.log('✓ Media Extended note description, timestamp conversion, and section headings passed');

// Test 26b: Summary note YouTube timestamp links, per-run Media Extended options, and body defaults
console.log('Testing summary note YouTube timestamp links, per-run Media Extended options, and defaults...');

// 26b.1: Description timestamps become standard YouTube links in the summary note
const ytDesc = convertDescriptionTimestampsToYouTubeHelper(sampleRawDescription, testVideoId);
assert(ytDesc.includes('[0:00](https://www.youtube.com/watch?v=abc123XYZ&t=0s) - Introduction'));
assert(ytDesc.includes('- [01:23](https://www.youtube.com/watch?v=abc123XYZ&t=83s) Getting Started'));
assert(ytDesc.includes('• [02:45](https://www.youtube.com/watch?v=abc123XYZ&t=165s) Basic Workflow'));
assert(ytDesc.includes('[03:50](https://www.youtube.com/watch?v=abc123XYZ&t=230s): Best Practices'));
assert(ytDesc.includes('[04:20](https://www.youtube.com/watch?v=abc123XYZ&t=260s) Advanced Tips'));
assert(ytDesc.includes('([05:15](https://www.youtube.com/watch?v=abc123XYZ&t=315s)) Q&A Session'));
assert(ytDesc.includes('[1:05:30](https://www.youtube.com/watch?v=abc123XYZ&t=3930s) Final Thoughts'));
// Existing timestamp link re-pointed at this video in YouTube format
assert(ytDesc.includes('[06:00](https://www.youtube.com/watch?v=abc123XYZ&t=360s)'));
assert(!ytDesc.includes('#t='));
assert(ytDesc.includes('[our blog](https://example.com/guide:1)'));
assert(ytDesc.includes('https://example.com/repo/12:34'));
assert(ytDesc.includes('10:00 AM'));
assert(ytDesc.includes('16:9 widescreen'));

// 26b.2: AI summary text — bold timestamps linked; code, inline code, and wikilinks untouched
const aiSummary = [
	'## Key Points',
	'- **05:23** The [[TypeScript]] compiler is introduced',
	'- Config uses `timeout: 12:30` inline',
	'- See [[Notes 10:15]] for more',
	'```',
	'cron: 10:30',
	'```',
	'- Covered at [07:45] in detail',
].join('\n');
const linkedSummary = convertTimestampsToLinksHelper(aiSummary, testVideoId, 'youtube');
assert(linkedSummary.includes('**[05:23](https://www.youtube.com/watch?v=abc123XYZ&t=323s)**'));
assert(linkedSummary.includes('[[TypeScript]]'));
assert(linkedSummary.includes('`timeout: 12:30`'));
assert(linkedSummary.includes('[[Notes 10:15]]'));
assert(linkedSummary.includes('```\ncron: 10:30\n```'));
assert(linkedSummary.includes('[07:45](https://www.youtube.com/watch?v=abc123XYZ&t=465s)'));
assert(!linkedSummary.includes('TS_PROTECTED_TOKEN'));

// 26b.3: Nested protected tokens (inline code inside link text) restore fully
const nested = convertTimestampsToLinksHelper('See [the `cfg` file](https://example.com) at 01:00', testVideoId, 'youtube');
assert.strictEqual(nested, 'See [the `cfg` file](https://example.com) at [01:00](https://www.youtube.com/watch?v=abc123XYZ&t=60s)');

// 26b.4: Per-run Media Extended options override permanent settings without changing them
function resolveCompanionOptionsHelper(settings, runOptions) {
	return {
		includeDescription: runOptions?.includeDescription ?? settings.mediaExtendedIncludeDescription,
		includeTranscript: runOptions?.includeTranscript ?? settings.mediaExtendedIncludeTranscript,
	};
}
const permanentSettings = { mediaExtendedIncludeDescription: true, mediaExtendedIncludeTranscript: true };
assert.deepStrictEqual(resolveCompanionOptionsHelper(permanentSettings), { includeDescription: true, includeTranscript: true });
assert.deepStrictEqual(
	resolveCompanionOptionsHelper(permanentSettings, { createNote: true, includeDescription: false, includeTranscript: false }),
	{ includeDescription: false, includeTranscript: false }
);
assert.deepStrictEqual(permanentSettings, { mediaExtendedIncludeDescription: true, mediaExtendedIncludeTranscript: true });

// Transcript excluded for the run: companion note has no # Transcript section
const meNoTranscript = buildMediaExtendedNoteHelper(testMetadata, '', testRelatedNote, { includeDescription: true });
assert(meNoTranscript.includes('# Description\n\n'));
assert(!meNoTranscript.includes('# Transcript'));
assert(meNoTranscript.includes('# Related\n\n- [[TypeScript Summary Note]]'));

// Both excluded: frontmatter + related link only
const meBare = buildMediaExtendedNoteHelper(testMetadata, '', testRelatedNote, { includeDescription: false });
assert(!meBare.includes('# Description'));
assert(!meBare.includes('# Transcript'));
assert(meBare.includes('# Related\n\n- [[TypeScript Summary Note]]'));

// 26b.5: Body defaults — summary note off, Media Extended note on
const { readFileSync } = await import('node:fs');
const defaultsSource = readFileSync(new URL('../src/defaults.ts', import.meta.url), 'utf8');
// The "include description in summary note body" option was removed (use "Add description to video summary note")
assert.doesNotMatch(defaultsSource, /DEFAULT_INCLUDE_VIDEO_DESCRIPTION/);
assert.match(defaultsSource, /DEFAULT_DUMP_TRANSCRIPT_IN_SUMMARY = false;/);
assert.match(defaultsSource, /DEFAULT_MEDIA_EXTENDED_INCLUDE_DESCRIPTION = true;/);
assert.match(defaultsSource, /DEFAULT_MEDIA_EXTENDED_INCLUDE_TRANSCRIPT = true;/);

console.log('✓ Summary note YouTube timestamp links, per-run Media Extended options, and defaults passed');

// Test 28: Vault tag cache extraction, compression, group prefix detection, prompt building, and grouped tag deduplication
console.log('Testing vault tag caching, AI topic tagging prompt, and grouped tag deduplication...');

function extractGroupPrefixesHelper(tags) {
	if (!tags || tags.length === 0) return [];
	const prefixSet = new Set();
	for (const tag of tags) {
		if (typeof tag !== 'string') continue;
		const clean = tag.trim().toLowerCase();
		if (clean.includes('/')) {
			const parts = clean.split('/').filter(Boolean);
			if (parts.length > 1) {
				prefixSet.add(`${parts[0]}/`);
			}
			if (parts.length > 2) {
				prefixSet.add(`${parts.slice(0, -1).join('/')}/`);
			}
		}
	}
	return Array.from(prefixSet).sort();
}

function compressVaultTagsHelper(tags, groupPrefixes, maxTags = 1000) {
	if (!tags || tags.length === 0) {
		return '(none yet - feel free to create initial tags)';
	}
	const limitedTags = tags.slice(0, maxTags);
	return limitedTags.join(', ');
}

function buildVaultTagDataHelper(tagInput, maxTags = 1000) {
	const countMap = new Map();

	if (Array.isArray(tagInput)) {
		for (const raw of tagInput) {
			if (typeof raw !== 'string') continue;
			const sanitized = sanitizeTag(raw);
			if (sanitized && sanitized.length > 1 && !/^\d+$/.test(sanitized)) {
				countMap.set(sanitized, (countMap.get(sanitized) || 0) + 1);
			}
		}
	} else if (tagInput && typeof tagInput === 'object') {
		for (const [rawTag, count] of Object.entries(tagInput)) {
			const sanitized = sanitizeTag(rawTag);
			if (sanitized && sanitized.length > 1 && !/^\d+$/.test(sanitized)) {
				const n = typeof count === 'number' && !isNaN(count) ? count : 1;
				countMap.set(sanitized, (countMap.get(sanitized) || 0) + n);
			}
		}
	}

	const sortedTags = Array.from(countMap.entries())
		.sort((a, b) => {
			if (b[1] !== a[1]) return b[1] - a[1];
			return a[0].localeCompare(b[0]);
		})
		.map(entry => entry[0]);

	const groupPrefixes = extractGroupPrefixesHelper(sortedTags);
	const compressedContext = compressVaultTagsHelper(sortedTags, groupPrefixes, maxTags);

	return {
		tags: sortedTags,
		groupPrefixes,
		compressedContext,
		totalCount: sortedTags.length,
	};
}

function buildTopicGenerationPromptHelper(summaryText, options) {
	const existingTags = (options?.existingTags || []).filter(t => t && typeof t === 'string' && t.trim().length > 0);
	const existingTagsStr = existingTags.length > 0
		? deduplicateTagsUpdatedHelper(existingTags).join(', ')
		: '(none)';

	const vaultContext = options?.compressedContext || (options?.vaultTags && options.vaultTags.length > 0
		? options.vaultTags.join(', ')
		: '(none yet - feel free to create initial tags)');

	const groupPrefixesStr = options?.groupPrefixes && options.groupPrefixes.length > 0
		? `\nEstablished group prefixes in vault:\n${options.groupPrefixes.join(', ')}\n`
		: '';

	const titleStr = options?.title ? `Video Title: ${options.title}\n\n` : '';

	return `You are an expert content categorization assistant for Obsidian notes.

Analyze the video summary and existing metadata to generate 3 to 7 relevant tags.

Questions to answer:
1. What topic(s) does this video belong to?
2. Is there any obvious tag that is missing in the existing set of tags?

Existing tags already identified for this video:
${existingTagsStr}

Existing vault tags (cached tag list from whole vault):
${vaultContext}
${groupPrefixesStr}
Important rules:
- Always prefer to reuse a tag that already exists instead of creating a new one. Only create new tags when necessary if semantic meaning of the desired tag does not already exist in the cached tag list.
- Use kebab case for any new tags you create (lowercase words separated by hyphens).
- Group tags where it makes sense: If you find a large group prefix like ai/ then group the more specific part of the tag under that instead of creating an entirely new tag at the top level (e.g. "ai/machine-learning" instead of "ai-machine-learning").
- Return ONLY a comma-separated list of tags in lowercase (e.g. ai/machine-learning, typescript, productivity). Do not include hashtags (#) or explanation.

${titleStr}Summary:
${summaryText.slice(0, 4000)}`;
}

function deduplicateTagsUpdatedHelper(tags) {
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

// 28.1: extractGroupPrefixesHelper tests
const mockTagsWithPrefixes = [
	'ai/machine-learning',
	'ai/llm',
	'ai/audio',
	'dev/frontend/react',
	'productivity',
	'obsidian',
	'data-science'
];
const extractedPrefixes = extractGroupPrefixesHelper(mockTagsWithPrefixes);
assert.deepStrictEqual(extractedPrefixes, ['ai/', 'dev/', 'dev/frontend/']);
assert.deepStrictEqual(extractGroupPrefixesHelper(['flat', 'no-slash', 'simple']), []);
assert.deepStrictEqual(extractGroupPrefixesHelper([]), []);

// 28.2: buildVaultTagDataHelper tests with frequency sorting and sanitization
const rawVaultTagRecord = {
	'#productivity': 25,
	'#ai/machine-learning': 12,
	'#ai/llm': 18,
	'#ai': 30,
	'#dev/frontend/react': 5,
	'#123': 8, // Pure number, should be excluded
	'#a': 4,   // Single char, excluded
	'#Dev/Backend': 10,
	'': 2
};

const vaultTagData = buildVaultTagDataHelper(rawVaultTagRecord);
assert.strictEqual(vaultTagData.totalCount, 6);
// Highest frequency first
assert.strictEqual(vaultTagData.tags[0], 'ai');
assert.strictEqual(vaultTagData.tags[1], 'productivity');
assert.strictEqual(vaultTagData.tags[2], 'ai/llm');
assert.strictEqual(vaultTagData.tags[3], 'ai/machine-learning');
assert.strictEqual(vaultTagData.tags[4], 'dev/backend');
assert.strictEqual(vaultTagData.tags[5], 'dev/frontend/react');

// Check prefixes
assert(vaultTagData.groupPrefixes.includes('ai/'));
assert(vaultTagData.groupPrefixes.includes('dev/'));

// Check compressed context string
assert(vaultTagData.compressedContext.includes('ai, productivity, ai/llm, ai/machine-learning'));

// Empty vault tags check
const emptyVaultData = buildVaultTagDataHelper({});
assert.strictEqual(emptyVaultData.totalCount, 0);
assert.strictEqual(emptyVaultData.compressedContext, '(none yet - feel free to create initial tags)');

// 28.3: buildTopicGenerationPromptHelper tests
const test28SampleSummary = 'This tutorial demonstrates how to train machine learning models using PyTorch and open source tools.';
const test28PromptOutput = buildTopicGenerationPromptHelper(test28SampleSummary, {
	title: 'Training Machine Learning Models with PyTorch',
	existingTags: ['youtube-video', 'pytorch'],
	vaultTags: vaultTagData.tags,
	groupPrefixes: vaultTagData.groupPrefixes,
	compressedContext: vaultTagData.compressedContext,
});

// Prompt must ask the two key questions
assert(test28PromptOutput.includes('1. What topic(s) does this video belong to?'));
assert(test28PromptOutput.includes('2. Is there any obvious tag that is missing in the existing set of tags?'));

// Prompt must include the existing tags identified for the video
assert(test28PromptOutput.includes('Existing tags already identified for this video:\nyoutube-video, pytorch'));

// Prompt must include cached vault tags
assert(test28PromptOutput.includes('Existing vault tags (cached tag list from whole vault):\nai, productivity, ai/llm, ai/machine-learning'));

// Prompt must include established group prefixes
assert(test28PromptOutput.includes('Established group prefixes in vault:\nai/, dev/, dev/frontend/'));

// Prompt must include important rules
assert(test28PromptOutput.includes('Always prefer to reuse a tag that already exists instead of creating a new one.'));
assert(test28PromptOutput.includes('Use kebab case for any new tags you create'));
assert(test28PromptOutput.includes('Group tags where it makes sense: If you find a large group prefix like ai/ then group the more specific part of the tag under that instead of creating an entirely new tag at the top level'));
assert(test28PromptOutput.includes('ai/machine-learning" instead of "ai-machine-learning'));

// Prompt must include title and summary
assert(test28PromptOutput.includes('Video Title: Training Machine Learning Models with PyTorch'));
assert(test28PromptOutput.includes(test28SampleSummary));

// 28.4: Deduplication preference for grouped tags over flat tags
// ai/machine-learning should be preferred over ai-machine-learning regardless of order
const testTagsOrder1 = deduplicateTagsUpdatedHelper(['ai-machine-learning', 'ai/machine-learning']);
assert.deepStrictEqual(testTagsOrder1, ['ai/machine-learning']);

const testTagsOrder2 = deduplicateTagsUpdatedHelper(['ai/machine-learning', 'ai-machine-learning']);
assert.deepStrictEqual(testTagsOrder2, ['ai/machine-learning']);

// Other hyphenated tags should still collapse run-together words
const testHyphenCollapse = deduplicateTagsUpdatedHelper(['rickastley', 'rick-astley']);
assert.deepStrictEqual(testHyphenCollapse, ['rick-astley']);

// 28.5: Activation condition simulation (only active when addTopicsAsTags is true)
class MockSettingsManager {
	constructor(addTopicsAsTags) {
		this.addTopicsAsTags = addTopicsAsTags;
	}
	getAddTopicsAsTags() {
		return this.addTopicsAsTags;
	}
}

function simulateRebuildCache(settings, mockVaultTags) {
	if (!settings.getAddTopicsAsTags()) {
		return { tags: [], groupPrefixes: [], compressedContext: '', totalCount: 0 };
	}
	return buildVaultTagDataHelper(mockVaultTags);
}

// When disabled, cache is NOT rebuilt and returns empty
const disabledSettings = new MockSettingsManager(false);
const disabledResult = simulateRebuildCache(disabledSettings, rawVaultTagRecord);
assert.strictEqual(disabledResult.totalCount, 0);
assert.strictEqual(disabledResult.compressedContext, '');

// When enabled, cache is rebuilt
const enabledSettings = new MockSettingsManager(true);
const enabledResult = simulateRebuildCache(enabledSettings, rawVaultTagRecord);
assert.strictEqual(enabledResult.totalCount, 6);
assert(enabledResult.compressedContext.length > 0);

console.log('✓ Vault tag caching, AI topic tagging prompt, and grouped tag deduplication passed');

// Test 29: Batch operation progress tracking, item logging, and markdown reporting
console.log('Testing batch operation progress tracking, item logging, and markdown reporting...');

function formatBatchReportAsMarkdownHelper(report) {
	const startTimeStr = new Date(report.startTime).toLocaleString();
	const durationSec = report.endTime
		? ((report.endTime - report.startTime) / 1000).toFixed(1)
		: '0.0';

	const lines = [
		`# Batch Operation Report: ${report.operationName}`,
		`- **Scope:** ${report.scope}`,
		`- **Started:** ${startTimeStr}`,
		`- **Duration:** ${durationSec}s`,
		`- **Total Notes:** ${report.total}`,
		`- **Succeeded:** ${report.succeeded}`,
		`- **Skipped:** ${report.skipped}`,
		`- **Failed:** ${report.failed}`,
		'',
		'## Processed Notes',
		'| Status | File | Message | URL |',
		'| :--- | :--- | :--- | :--- |'
	];

	if (report.items.length === 0) {
		lines.push('| - | None | No notes were processed. | - |');
	} else {
		for (const item of report.items) {
			const statusLabel =
				item.status === 'success'
					? '✓ Success'
					: item.status === 'skipped'
					? '⊘ Skipped'
					: '✕ Error';
			const sanitizedMsg = (item.message || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
			const urlCol = item.url ? item.url : '-';
			lines.push(`| ${statusLabel} | [[${item.fileName}]] | ${sanitizedMsg} | ${urlCol} |`);
		}
	}

	return lines.join('\n');
}

class MockBatchProgressTracker {
	constructor(host, operationName, scope, total) {
		this.host = host;
		this.report = {
			operationName,
			scope,
			startTime: Date.now(),
			total,
			succeeded: 0,
			skipped: 0,
			failed: 0,
			items: []
		};
		this.updates = [];
	}

	update(current, fileName, detail) {
		const pct = this.report.total > 0 ? Math.round((current / this.report.total) * 100) : 100;
		this.updates.push({ current, fileName, detail, pct });
	}

	recordItem(item) {
		item.timestamp = item.timestamp || Date.now();
		this.report.items.push(item);
		if (item.status === 'success') this.report.succeeded++;
		else if (item.status === 'skipped') this.report.skipped++;
		else if (item.status === 'error') this.report.failed++;
		this.update(this.report.items.length, item.fileName, item.status.toUpperCase());
	}

	finish() {
		this.report.endTime = Date.now();
		this.host.setLastBatchReport(this.report);
		return this.report;
	}

	static finishEmpty(host, operationName, scope, message) {
		const report = {
			operationName,
			scope,
			startTime: Date.now(),
			endTime: Date.now(),
			total: 0,
			succeeded: 0,
			skipped: 0,
			failed: 0,
			items: []
		};
		host.setLastBatchReport(report);
		return report;
	}
}

class MockHost {
	constructor() {
		this.lastReport = null;
	}
	setLastBatchReport(report) {
		this.lastReport = report;
	}
}

// 29.1: Basic recording and tallies
const host1 = new MockHost();
const tracker1 = new MockBatchProgressTracker(host1, 'Refresh video metadata', 'vault', 3);

tracker1.recordItem({
	filePath: 'Notes/Video 1.md',
	fileName: 'Video 1',
	url: 'https://www.youtube.com/watch?v=vid1',
	status: 'success',
	message: 'Added playlist: "AI Tutorials" (Index 1/10)'
});

tracker1.recordItem({
	filePath: 'Notes/Video 2.md',
	fileName: 'Video 2',
	url: 'https://www.youtube.com/watch?v=vid2',
	status: 'skipped',
	message: 'Video is not part of a playlist on YouTube'
});

tracker1.recordItem({
	filePath: 'Notes/Video 3.md',
	fileName: 'Video 3',
	url: 'https://www.youtube.com/watch?v=vid3',
	status: 'error',
	message: 'HTTP 403: Quota exceeded'
});

const report1 = tracker1.finish();
assert.strictEqual(report1.total, 3);
assert.strictEqual(report1.succeeded, 1);
assert.strictEqual(report1.skipped, 1);
assert.strictEqual(report1.failed, 1);
assert.strictEqual(report1.items.length, 3);
assert.strictEqual(host1.lastReport, report1);
assert(report1.endTime >= report1.startTime);

// 29.2: Progress update percentages
assert.deepStrictEqual(tracker1.updates, [
	{ current: 1, fileName: 'Video 1', detail: 'SUCCESS', pct: 33 },
	{ current: 2, fileName: 'Video 2', detail: 'SKIPPED', pct: 67 },
	{ current: 3, fileName: 'Video 3', detail: 'ERROR', pct: 100 }
]);

// 29.3: finishEmpty handling
const host2 = new MockHost();
const emptyReport = MockBatchProgressTracker.finishEmpty(
	host2,
	'Refresh video metadata',
	'folder "Podcasts"',
	'All notes already up-to-date!'
);
assert.strictEqual(emptyReport.total, 0);
assert.strictEqual(emptyReport.succeeded, 0);
assert.strictEqual(emptyReport.skipped, 0);
assert.strictEqual(emptyReport.failed, 0);
assert.strictEqual(emptyReport.items.length, 0);
assert.strictEqual(host2.lastReport, emptyReport);

const emptyMarkdown = formatBatchReportAsMarkdownHelper(emptyReport);
assert(emptyMarkdown.includes('# Batch Operation Report: Refresh video metadata'));
assert(emptyMarkdown.includes('- **Total Notes:** 0'));
assert(emptyMarkdown.includes('No notes were processed.'));

// 29.4: formatBatchReportAsMarkdown output verification
const markdownOutput = formatBatchReportAsMarkdownHelper(report1);
assert(markdownOutput.includes('# Batch Operation Report: Refresh video metadata'));
assert(markdownOutput.includes('- **Scope:** vault'));
assert(markdownOutput.includes('- **Total Notes:** 3'));
assert(markdownOutput.includes('- **Succeeded:** 1'));
assert(markdownOutput.includes('- **Skipped:** 1'));
assert(markdownOutput.includes('- **Failed:** 1'));
assert(markdownOutput.includes('| ✓ Success | [[Video 1]] | Added playlist: "AI Tutorials" (Index 1/10) | https://www.youtube.com/watch?v=vid1 |'));
assert(markdownOutput.includes('| ⊘ Skipped | [[Video 2]] | Video is not part of a playlist on YouTube | https://www.youtube.com/watch?v=vid2 |'));
assert(markdownOutput.includes('| ✕ Error | [[Video 3]] | HTTP 403: Quota exceeded | https://www.youtube.com/watch?v=vid3 |'));

// Verify pipe escaping in messages
const pipeItemReport = {
	operationName: 'Test',
	scope: 'vault',
	startTime: Date.now(),
	endTime: Date.now(),
	total: 1,
	succeeded: 1,
	skipped: 0,
	failed: 0,
	items: [
		{
			filePath: 'test.md',
			fileName: 'test',
			status: 'success',
			message: 'Param A | Param B | Param C'
		}
	]
};
const pipeMarkdown = formatBatchReportAsMarkdownHelper(pipeItemReport);
assert(pipeMarkdown.includes('Param A \\| Param B \\| Param C'));

console.log('✓ Batch operation progress tracking, item logging, and markdown reporting passed');

// Test 31: Video summary note placement (blank note vs. new note in fallback folder)
console.log('Testing video summary note placement, fallback folder paths, and source note link handling...');

function normalizeVideoSummaryFolderHelper(value) {
	return (value ?? 'Video Summaries').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Video Summaries';
}

// Mirrors summarizeVideo Step 0: blank note → write into it; body and/or frontmatter (or no file) → new note
function resolveSummaryTargetHelper(editorText, hasSourceFile) {
	return hasSourceFile && editorText.trim() === '' ? 'current-note' : 'new-note';
}

function getAvailableNotePathHelper(existingPaths, folderPath, baseName, currentPath, extension = 'md') {
	const parentDir = folderPath && folderPath !== '/' ? `${folderPath}/` : '';
	let targetPath = `${parentDir}${baseName}.${extension}`;
	let counter = 1;
	while (existingPaths.has(targetPath) && targetPath !== currentPath) {
		targetPath = `${parentDir}${baseName} (${counter}).${extension}`;
		counter++;
	}
	return targetPath;
}

// 31.1: Fallback folder default and normalization
assert.strictEqual(normalizeVideoSummaryFolderHelper(undefined), 'Video Summaries');
assert.strictEqual(normalizeVideoSummaryFolderHelper('   '), 'Video Summaries');
assert.strictEqual(normalizeVideoSummaryFolderHelper('/Notes\\Videos/'), 'Notes/Videos');
assert.match(defaultsSource, /DEFAULT_VIDEO_SUMMARY_FOLDER = 'Video Summaries';/);

// 31.2: Target resolution
assert.strictEqual(resolveSummaryTargetHelper('', true), 'current-note');
assert.strictEqual(resolveSummaryTargetHelper('  \n\n ', true), 'current-note');
assert.strictEqual(resolveSummaryTargetHelper('Some notes', true), 'new-note');
assert.strictEqual(resolveSummaryTargetHelper('---\ntags: [a]\n---\n', true), 'new-note');
assert.strictEqual(resolveSummaryTargetHelper('---\ntags: [a]\n---\n\nBody', true), 'new-note');
assert.strictEqual(resolveSummaryTargetHelper('', false), 'new-note');

// 31.3: Collision-free paths in the fallback folder (renaming a note onto its own path is a no-op)
const existing = new Set(['Video Summaries/My Video.md', 'Video Summaries/My Video (1).md']);
assert.strictEqual(getAvailableNotePathHelper(existing, 'Video Summaries', 'Other Video'), 'Video Summaries/Other Video.md');
assert.strictEqual(getAvailableNotePathHelper(existing, 'Video Summaries', 'My Video'), 'Video Summaries/My Video (2).md');
assert.strictEqual(getAvailableNotePathHelper(existing, 'Video Summaries', 'My Video', 'Video Summaries/My Video.md'), 'Video Summaries/My Video.md');
assert.strictEqual(getAvailableNotePathHelper(new Set(), '', 'Root Note'), 'Root Note.md');

// 31.4: Link inserted at the cursor, updated after rename, removed on failure
function insertAtHelper(content, offset, text) {
	return content.slice(0, offset) + text + content.slice(offset);
}
const sourceBefore = 'Watch this: https://youtu.be/dQw4w9WgXcQ\nMore notes below.';
const urlEnd = sourceBefore.indexOf('\n');
const placeholderLink = '[[YouTube Summary dQw4w9WgXcQ]]';
const withLink = insertAtHelper(sourceBefore, urlEnd, ` ${placeholderLink}`);
assert.strictEqual(withLink, 'Watch this: https://youtu.be/dQw4w9WgXcQ [[YouTube Summary dQw4w9WgXcQ]]\nMore notes below.');

// User keeps typing elsewhere in the note while the summary runs
const editedMeanwhile = `${withLink}\nA new line typed during summarization.`;
const renamedLink = '[[Never Gonna Give You Up]]';
const afterRename = editedMeanwhile.replace(placeholderLink, () => renamedLink);
assert(afterRename.includes('https://youtu.be/dQw4w9WgXcQ [[Never Gonna Give You Up]]\n'));
assert(afterRename.endsWith('A new line typed during summarization.'));
// Idempotent if Obsidian already updated the link itself
assert.strictEqual(afterRename.replace(placeholderLink, () => renamedLink), afterRename);

// Failure cleanup removes exactly the inserted text
const afterCleanup = afterRename.replace(` ${renamedLink}`, '');
assert.strictEqual(afterCleanup, `${sourceBefore}\nA new line typed during summarization.`);

// 31.5: Writing into a blank note that the user typed into during summarization appends instead of overwriting
function writeSummaryHelper(current, isNewNote, fm, body) {
	return isNewNote || current.trim() === '' ? `${fm}\n\n${body}` : `${current.trimEnd()}\n\n${body}`;
}
assert.strictEqual(writeSummaryHelper('Summarizing https://youtu.be/x…\n', true, '---\ntitle: T\n---', 'Body'), '---\ntitle: T\n---\n\nBody');
assert.strictEqual(writeSummaryHelper('', false, '---\ntitle: T\n---', 'Body'), '---\ntitle: T\n---\n\nBody');
assert.strictEqual(writeSummaryHelper('Typed meanwhile\n', false, '---\ntitle: T\n---', 'Body'), 'Typed meanwhile\n\nBody');

console.log('✓ Video summary note placement, fallback folder paths, and source note link handling passed');

// Test 32: Add description / transcript to Media Extended notes (section detection, upsert, video detection)
console.log('Testing Media Extended note section detection, insertion/replacement, and video detection...');

function findMarkdownSectionHelper(content, heading, level = 1) {
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

function upsertMarkdownSectionHelper(content, heading, body, insertBefore = [], level = 1) {
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

function extractYouTubeUrlFromFrontmatterHelper(content) {
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fmMatch) return null;
	for (const key of ['video_url', 'video', 'media']) {
		const m = fmMatch[1].match(new RegExp(`^${key}:\\s*["']?([^"'\\r\\n]+)["']?`, 'm'));
		const value = m?.[1].trim();
		if (value && (key === 'video_url' || /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(value))) {
			return value;
		}
	}
	return null;
}

const meFrontmatter = '---\nmx-uid: abcdefghijklmnopqrstuvwx\nvideo: https://www.youtube.com/watch?v=dQw4w9WgXcQ\ntitle: Test\ndescription: ""\n---';
const meNoteBare = `${meFrontmatter}\n\n# Related\n\n- [[Summary Note]]\n`;
const meNoteFull = `${meFrontmatter}\n\n# Description\n\nOld description\n\n# Transcript\n\n- [00:00](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0#t=00:00.00) Hi\n\n# Related\n\n- [[Summary Note]]\n`;

// 32.1: Video detection from Media Extended frontmatter (video / media keys), ignoring non-YouTube values
assert.strictEqual(extractYouTubeUrlFromFrontmatterHelper(meNoteBare), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
assert.strictEqual(extractYouTubeUrlFromFrontmatterHelper('---\nmedia: https://youtu.be/dQw4w9WgXcQ\n---\n'), 'https://youtu.be/dQw4w9WgXcQ');
assert.strictEqual(extractYouTubeUrlFromFrontmatterHelper('---\nvideo: "[[local.mp4]]"\n---\n'), null);
assert.strictEqual(extractYouTubeUrlFromFrontmatterHelper('---\nvideo_url: https://www.youtube.com/watch?v=abc123XYZ00\nvideo: https://youtu.be/other\n---\n'), 'https://www.youtube.com/watch?v=abc123XYZ00');

// 32.2: Section detection — level-1 only, case-insensitive, ignores frontmatter and code fences
assert.strictEqual(findMarkdownSectionHelper(meNoteBare, 'Description'), null);
assert.strictEqual(findMarkdownSectionHelper(meNoteBare, 'Transcript'), null);
assert.notStrictEqual(findMarkdownSectionHelper(meNoteFull, 'Description'), null);
assert.notStrictEqual(findMarkdownSectionHelper(meNoteFull, 'transcript'), null);
assert.strictEqual(findMarkdownSectionHelper('## Description\n\nText', 'Description'), null);
assert.strictEqual(findMarkdownSectionHelper('```\n# Description\n```\n', 'Description'), null);
assert.strictEqual(findMarkdownSectionHelper('---\ntitle: "# Description"\n---\nBody', 'Description'), null);

// 32.3: Insert description before # Transcript / # Related when missing
const descBody = '[0:00](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0#t=00:00.00) Intro';
const withDesc = upsertMarkdownSectionHelper(meNoteBare, 'Description', descBody, ['Transcript', 'Related']);
assert.strictEqual(withDesc, `${meFrontmatter}\n\n# Description\n\n${descBody}\n\n# Related\n\n- [[Summary Note]]\n`);

// 32.4: Insert transcript after description, before # Related
const transcriptBody = '- [00:01](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1#t=00:01.00) Hello';
const withBoth = upsertMarkdownSectionHelper(withDesc, 'Transcript', transcriptBody, ['Related']);
assert.strictEqual(withBoth, `${meFrontmatter}\n\n# Description\n\n${descBody}\n\n# Transcript\n\n${transcriptBody}\n\n# Related\n\n- [[Summary Note]]\n`);

// 32.5: Replace an existing section in place, keeping other sections
const replacedDesc = upsertMarkdownSectionHelper(meNoteFull, 'Description', 'New description', ['Transcript', 'Related']);
assert(replacedDesc.includes('# Description\n\nNew description\n\n# Transcript\n\n'));
assert(!replacedDesc.includes('Old description'));
assert(replacedDesc.includes('# Related\n\n- [[Summary Note]]\n'));
const replacedTranscript = upsertMarkdownSectionHelper(meNoteFull, 'Transcript', transcriptBody, ['Related']);
assert(replacedTranscript.includes(`# Transcript\n\n${transcriptBody}\n\n# Related`));
assert(!replacedTranscript.includes(') Hi\n'));
assert.strictEqual((replacedTranscript.match(/^# Transcript$/gm) || []).length, 1);

// 32.6: Appends at the end when no anchors exist; works with frontmatter-only notes and CRLF
assert.strictEqual(upsertMarkdownSectionHelper(meFrontmatter, 'Transcript', transcriptBody, ['Related']), `${meFrontmatter}\n\n# Transcript\n\n${transcriptBody}\n`);
assert.strictEqual(upsertMarkdownSectionHelper('---\na: 1\n---\r\n\r\nNotes\r\n', 'Description', 'D'), '---\na: 1\n---\n\nNotes\n\n# Description\n\nD\n');

// 32.7: Subheadings inside a section belong to it; replacing removes them
const withSubheading = `${meFrontmatter}\n\n# Description\n\nOld\n\n## Links\n\n- a\n\n# Related\n\n- [[X]]\n`;
const replacedSub = upsertMarkdownSectionHelper(withSubheading, 'Description', 'New', ['Transcript', 'Related']);
assert(!replacedSub.includes('## Links'));
assert(replacedSub.includes('# Description\n\nNew\n\n# Related\n\n- [[X]]\n'));

// 32.8a: Description always comes before Transcript
function ensureSectionOrderHelper(content, first, second) {
	const normalized = content.replace(/\r\n/g, '\n');
	const firstSection = findMarkdownSectionHelper(normalized, first);
	const secondSection = findMarkdownSectionHelper(normalized, second);
	if (!firstSection || !secondSection || firstSection.start < secondSection.start) return content;
	const lines = normalized.split('\n');
	const moved = lines.slice(firstSection.start, firstSection.end).join('\n').trim();
	const remaining = [...lines.slice(0, firstSection.start), ...lines.slice(firstSection.end)];
	const head = remaining.slice(0, secondSection.start).join('\n').replace(/\s+$/, '');
	const tail = remaining.slice(secondSection.start).join('\n').replace(/^\s+/, '').replace(/\s+$/, '');
	return `${[head, moved, tail].filter(Boolean).join('\n\n')}\n`;
}
const addSection = (content, heading, body, insertBefore) =>
	ensureSectionOrderHelper(upsertMarkdownSectionHelper(content, heading, body, insertBefore), 'Description', 'Transcript');
const expectedOrder = `${meFrontmatter}\n\n# Description\n\n${descBody}\n\n# Transcript\n\n${transcriptBody}\n\n# Related\n\n- [[Summary Note]]\n`;

// Either command order produces Description → Transcript → Related
const transcriptFirst = addSection(meNoteBare, 'Transcript', transcriptBody, ['Related']);
assert.strictEqual(addSection(transcriptFirst, 'Description', descBody, ['Transcript', 'Related']), expectedOrder);
const descriptionFirst = addSection(meNoteBare, 'Description', descBody, ['Transcript', 'Related']);
assert.strictEqual(addSection(descriptionFirst, 'Transcript', transcriptBody, ['Related']), expectedOrder);

// Out-of-order note (Transcript above Description): replacing either section fixes the order
const outOfOrder = `${meFrontmatter}\n\n# Transcript\n\nOld transcript\n\n# Description\n\nOld description\n\n# Related\n\n- [[Summary Note]]\n`;
const fixedByDesc = addSection(outOfOrder, 'Description', descBody, ['Transcript', 'Related']);
assert.strictEqual(fixedByDesc, `${meFrontmatter}\n\n# Description\n\n${descBody}\n\n# Transcript\n\nOld transcript\n\n# Related\n\n- [[Summary Note]]\n`);
const fixedByTranscript = addSection(outOfOrder, 'Transcript', transcriptBody, ['Related']);
assert.strictEqual(fixedByTranscript, `${meFrontmatter}\n\n# Description\n\nOld description\n\n# Transcript\n\n${transcriptBody}\n\n# Related\n\n- [[Summary Note]]\n`);

// # Related above an existing # Description: adding the transcript still lands it after Description
const relatedFirst = `${meFrontmatter}\n\n# Related\n\n- [[Summary Note]]\n\n# Description\n\n${descBody}\n`;
const withTranscriptAfterDesc = addSection(relatedFirst, 'Transcript', transcriptBody, ['Related']);
assert(withTranscriptAfterDesc.indexOf('# Description') < withTranscriptAfterDesc.indexOf('# Transcript'));

// Already ordered or single-section notes are unchanged
assert.strictEqual(ensureSectionOrderHelper(expectedOrder, 'Description', 'Transcript'), expectedOrder);
assert.strictEqual(ensureSectionOrderHelper(meNoteBare, 'Description', 'Transcript'), meNoteBare);

// 32.8: Description source — frontmatter first when enabled and non-empty, else fetch
function resolveDescriptionSourceHelper(useFrontmatter, frontmatterDescription) {
	return useFrontmatter && typeof frontmatterDescription === 'string' && frontmatterDescription.trim()
		? 'frontmatter'
		: 'fetch';
}
assert.strictEqual(resolveDescriptionSourceHelper(true, 'Creator description\n0:00 Intro'), 'frontmatter');
assert.strictEqual(resolveDescriptionSourceHelper(true, ''), 'fetch');
assert.strictEqual(resolveDescriptionSourceHelper(true, '   '), 'fetch');
assert.strictEqual(resolveDescriptionSourceHelper(true, undefined), 'fetch');
assert.strictEqual(resolveDescriptionSourceHelper(true, 123), 'fetch');
assert.strictEqual(resolveDescriptionSourceHelper(false, 'Creator description'), 'fetch');
assert.match(defaultsSource, /DEFAULT_MEDIA_EXTENDED_DESCRIPTION_FROM_FRONTMATTER = true;/);

// Frontmatter description timestamps still become Media Extended links in the body
const fmDescBody = convertDescriptionTimestampsToMediaExtendedHelper('Chapters\n0:00 Intro\n01:23 Setup', 'dQw4w9WgXcQ');
assert(fmDescBody.includes('[01:23](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=83#t=01:23.00) Setup'));

console.log('✓ Media Extended note section detection, insertion/replacement, and video detection passed');

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

function getVideoNoteKindHelper(content, filePath, mediaFolder) {
	if (isMediaExtendedCompanionNoteHelper(content, filePath, mediaFolder)) return 'mediaExtended';
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (fmMatch && /^video_url:\s*["']?https?:\/\//m.test(fmMatch[1])) return 'summary';
	return null;
}

function splitYamlBlocksHelper(yaml) {
	const blocks = [];
	for (const line of yaml.split('\n')) {
		const keyMatch = line.match(/^([A-Za-z0-9_-]+):/);
		if (keyMatch) blocks.push({ key: keyMatch[1], lines: [line] });
		else if (/^\S/.test(line) || blocks.length === 0) blocks.push({ key: null, lines: [line] });
		else blocks[blocks.length - 1].lines.push(line);
	}
	return blocks;
}

function mergeYamlBlocksHelper(refreshExistingYaml, refreshUpdatesYaml) {
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

// Test 35: Cover embed in Media Extended notes and "Insert video cover at cursor"
console.log('Testing Media Extended cover embed...');

const coverMeta = {
	mxUid: 'test12345678901234567890',
	videoId: 'dQw4w9WgXcQ',
	title: 'Cover Test',
	description: 'Desc\n0:00 Intro',
	creator: 'Rick Astley',
	cover: 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp',
};
const coverTranscript = '- [00:00](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0#t=00:00.00) Hello';

// 35.1: Embed at the top of the body, above # Description, matching the frontmatter cover
const withCover = buildMediaExtendedNoteHelper(coverMeta, coverTranscript, 'Summary Note', { embedCover: true });
const coverBody = withCover.slice(withCover.indexOf('\n---\n') + 5);
assert(coverBody.startsWith('\n![Cover](https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp)\n\n# Description\n\n'));
assert(withCover.includes('cover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"'));
assert(withCover.trimEnd().endsWith('# Related\n\n- [[Summary Note]]'));

// 35.2: Off → no embed (and the pure builder defaults to off)
assert(!buildMediaExtendedNoteHelper(coverMeta, coverTranscript, 'Summary Note', { embedCover: false }).includes('![Cover]'));
assert(!buildMediaExtendedNoteHelper(coverMeta, coverTranscript, 'Summary Note').includes('![Cover]'));

// 35.3: Fallback cover (hqdefault) is used for both frontmatter and embed; default URL when no cover given
const hqCover = buildMediaExtendedNoteHelper({ ...coverMeta, cover: 'https://i.ytimg.com/vi_webp/jNQXAC9IVRw/hqdefault.webp', videoId: 'jNQXAC9IVRw' }, '', undefined, { embedCover: true });
assert(hqCover.includes('![Cover](https://i.ytimg.com/vi_webp/jNQXAC9IVRw/hqdefault.webp)'));
assert(hqCover.includes('cover: "https://i.ytimg.com/vi_webp/jNQXAC9IVRw/hqdefault.webp"'));
assert.strictEqual(getMediaExtendedCoverUrlHelper({ videoId: 'abc123XYZ00' }), 'https://i.ytimg.com/vi_webp/abc123XYZ00/maxresdefault.webp');
assert.strictEqual(getMediaExtendedCoverUrlHelper({ videoId: 'x', cover: '"https://example.com/c.webp"' }), 'https://example.com/c.webp');

// 35.4: Embed only, no description/transcript/related → frontmatter + embed
const coverOnly = buildMediaExtendedNoteHelper({ ...coverMeta, description: '' }, '', undefined, { embedCover: true });
assert(coverOnly.endsWith('---\n\n![Cover](https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp)\n'));

// 35.5: Adding a description later keeps the embed at the top
const coverThenDesc = upsertMarkdownSectionHelper(
	buildMediaExtendedNoteHelper({ ...coverMeta, description: '' }, '', 'Summary Note', { embedCover: true }),
	'Description', 'New description', ['Transcript', 'Related']
);
const coverThenDescBody = coverThenDesc.slice(coverThenDesc.indexOf('\n---\n') + 5);
assert(coverThenDescBody.startsWith('\n![Cover](https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp)\n\n# Description\n\nNew description\n\n# Related'));

// 35.6: Insert at cursor — inserts at the captured position with no duplicate check
function insertCoverAtHelper(content, offset, coverUrl) {
	const embed = buildCoverEmbedHelper(coverUrl);
	return content.slice(0, offset) + embed + content.slice(offset);
}
const cursorNote = 'Line one\n\nLine two';
const inserted = insertCoverAtHelper(cursorNote, cursorNote.indexOf('\n\nLine two') + 2, 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp');
assert.strictEqual(inserted, 'Line one\n\n![Cover](https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp)Line two');
const insertedTwice = insertCoverAtHelper(inserted, 0, 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp');
assert.strictEqual((insertedTwice.match(/!\[Cover\]/g) || []).length, 2);

console.log('✓ Media Extended cover embed passed');

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

// Test 37: "Add description to video summary note" (## Description with YouTube timestamp links)
console.log('Testing add description to video summary note...');

const summaryNoteFm = '---\ntitle: "Video"\nvideo_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"\ndescription: |-\n  Chapters\n  0:00 Intro\n  01:23 Setup\n---';
const summaryNoteBody = '![Thumbnail](https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg)\n\n## Summary\n\nText\n\n## Key points\n\n- Point\n\n# Related\n\n- [[Media Library/Video]]';
const summaryNoteFull = `${summaryNoteFm}\n\n${summaryNoteBody}\n`;
const ytDescriptionBody = convertTimestampsToLinksHelper('Chapters\n0:00 Intro\n01:23 Setup', 'dQw4w9WgXcQ', 'youtube');

// 37.1: Description timestamps become clickable standard YouTube links
assert(ytDescriptionBody.includes('[0:00](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0s) Intro'));
assert(ytDescriptionBody.includes('[01:23](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=83s) Setup'));
assert(!ytDescriptionBody.includes('#t='));

// 37.2: Classified as a summary note (and Media Extended notes are not)
assert.strictEqual(getVideoNoteKindHelper(summaryNoteFull, 'Video Summaries/Video.md', 'Media Library'), 'summary');
assert.strictEqual(getVideoNoteKindHelper(meNoteBare, 'Media Library/Video.md', 'Media Library'), 'mediaExtended');

// 37.3: Inserted as ## Description before # Related (Media Extended link stays last)
const withSummaryDesc = upsertMarkdownSectionHelper(summaryNoteFull, 'Description', ytDescriptionBody, ['Related'], 2);
assert(withSummaryDesc.includes(`## Key points\n\n- Point\n\n## Description\n\n${ytDescriptionBody}\n\n# Related\n\n- [[Media Library/Video]]\n`));
assert(withSummaryDesc.startsWith(summaryNoteFm));

// 37.4: Appended at the end when there's no # Related
const noRelated = `${summaryNoteFm}\n\n## Summary\n\nText\n`;
assert.strictEqual(upsertMarkdownSectionHelper(noRelated, 'Description', 'D', ['Related'], 2), `${summaryNoteFm}\n\n## Summary\n\nText\n\n## Description\n\nD\n`);

// 37.5: Existing ## Description is detected and replaced in place; level-2 sections end at the next ## or #
assert.notStrictEqual(findMarkdownSectionHelper(withSummaryDesc, 'Description', 2), null);
assert.strictEqual(findMarkdownSectionHelper(withSummaryDesc, 'Description', 1), null);
const replacedSummaryDesc = upsertMarkdownSectionHelper(withSummaryDesc, 'Description', 'New', ['Related'], 2);
assert(replacedSummaryDesc.includes('## Description\n\nNew\n\n# Related'));
assert.strictEqual((replacedSummaryDesc.match(/^## Description$/gm) || []).length, 1);
const midDesc = `${summaryNoteFm}\n\n## Description\n\nOld\n\n### Sub\n\nx\n\n## Key points\n\n- P\n`;
const replacedMid = upsertMarkdownSectionHelper(midDesc, 'Description', 'New', ['Related'], 2);
assert(replacedMid.includes('## Description\n\nNew\n\n## Key points\n\n- P\n'));
assert(!replacedMid.includes('### Sub'));

// 37.6: Level-1 behavior unchanged — ## subsections belong to a # section
const level1WithSub = '# Description\n\nA\n\n## Links\n\n- x\n\n# Related\n\n- y';
assert.deepStrictEqual(findMarkdownSectionHelper(level1WithSub, 'Description'), { start: 0, end: 8 });

console.log('✓ Add description to video summary note passed');

// Test 38: "Tag with AI" / "Tag with YouTube" — extracting and merging frontmatter tags
console.log('Testing tag commands: frontmatter tag extraction and deduplicated merge...');

function extractFrontmatterTagsHelper(content) {
	const fmMatch = content.replace(/\r\n/g, '\n').match(/^---\n(?:([\s\S]*?)\n)?---(?:\n|$)/);
	const tagsBlock = splitYamlBlocksHelper(fmMatch?.[1] ?? '').find((block) => block.key === 'tags');
	if (!tagsBlock) return [];
	const raw = [];
	const inline = tagsBlock.lines[0].replace(/^tags:/, '').trim();
	if (inline.startsWith('[') && inline.endsWith(']')) raw.push(...inline.slice(1, -1).split(','));
	else if (inline) raw.push(...inline.split(/[,\s]+/));
	for (const line of tagsBlock.lines.slice(1)) {
		const item = line.match(/^\s*-\s+(.*)$/);
		if (item) raw.push(item[1]);
	}
	return raw.map((tag) => tag.trim().replace(/^['"]|['"]$/g, '').replace(/^#/, '')).filter(Boolean);
}

function addTagsToNoteContentHelper(content, newTags) {
	const existing = extractFrontmatterTagsHelper(content);
	const existingDeduplicated = new Set(deduplicateTagsUpdatedHelper(existing));
	const combined = deduplicateTagsUpdatedHelper([...existing, ...newTags]);
	const added = combined.filter((tag) => !existingDeduplicated.has(tag));
	if (added.length === 0) return { content, added };
	const tagsBlock = ['tags:', ...combined.map((tag) => `  - ${tag}`)].join('\n');
	const normalized = content.replace(/\r\n/g, '\n');
	const fmMatch = normalized.match(/^---\n(?:([\s\S]*?)\n)?---(?:\n|$)/);
	if (!fmMatch) {
		const body = normalized.replace(/^\s+/, '');
		return { content: body ? `---\n${tagsBlock}\n---\n\n${body}` : `---\n${tagsBlock}\n---\n`, added };
	}
	const merged = fmMatch[1] ? mergeYamlBlocksHelper(fmMatch[1], tagsBlock) : tagsBlock;
	return { content: `---\n${merged}\n---\n${normalized.slice(fmMatch[0].length)}`, added };
}

// 38.1: Extraction handles list, inline, single/comma values, quotes, and #
assert.deepStrictEqual(extractFrontmatterTagsHelper('---\ntitle: T\ntags:\n  - music\n  - "pop-culture"\n---\nBody'), ['music', 'pop-culture']);
assert.deepStrictEqual(extractFrontmatterTagsHelper('---\ntags: [music, "#80s", pop]\n---\n'), ['music', '80s', 'pop']);
assert.deepStrictEqual(extractFrontmatterTagsHelper('---\ntags: music, pop\n---\n'), ['music', 'pop']);
assert.deepStrictEqual(extractFrontmatterTagsHelper('---\ntitle: T\n---\n'), []);
assert.deepStrictEqual(extractFrontmatterTagsHelper('No frontmatter'), []);

// 38.2: New tags merge into the existing list, deduplicated like the summary process (sanitized, collapsed variants)
const taggable = '---\ntitle: "Video"\nvideo_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"\ntags:\n  - music\n  - ai-machine-learning\ncustom: keep\n---\n\n## Summary\n\nText\n';
const tagged = addTagsToNoteContentHelper(taggable, ['Music', 'ai/machine-learning', 'Rick Astley', '#80s']);
assert.deepStrictEqual(tagged.added, deduplicateTagsUpdatedHelper(['music', 'ai-machine-learning', 'Music', 'ai/machine-learning', 'Rick Astley', '#80s']).filter((t) => !['music', 'ai-machine-learning'].includes(t)));
assert(tagged.content.includes('  - music\n'));
assert(tagged.content.includes('  - ai/machine-learning\n'));
assert(!tagged.content.includes('ai-machine-learning'));
assert.strictEqual((tagged.content.match(/^  - music$/gm) || []).length, 1);
assert(tagged.content.includes('custom: keep'));
assert(tagged.content.includes('title: "Video"'));
assert(tagged.content.endsWith('---\n\n## Summary\n\nText\n'));
assert.strictEqual((tagged.content.match(/^tags:/gm) || []).length, 1);

// 38.3: Nothing new → note returned unchanged (no rewrite)
const unchanged = addTagsToNoteContentHelper(taggable, ['music', 'MUSIC', '#music']);
assert.deepStrictEqual(unchanged.added, []);
assert.strictEqual(unchanged.content, taggable);

// 38.4: Inline tags are converted to a list when new tags are added; notes without tags or frontmatter get them
const inlineTagged = addTagsToNoteContentHelper('---\ntags: [music]\n---\nBody', ['pop']);
assert.strictEqual(inlineTagged.content, '---\ntags:\n  - music\n  - pop\n---\nBody');
assert.strictEqual(addTagsToNoteContentHelper('---\ntitle: T\n---\nBody', ['pop']).content, '---\ntitle: T\ntags:\n  - pop\n---\nBody');
assert.strictEqual(addTagsToNoteContentHelper('Body only\n', ['pop']).content, '---\ntags:\n  - pop\n---\n\nBody only\n');
assert.strictEqual(addTagsToNoteContentHelper('---\n---\nBody', ['pop']).content, '---\ntags:\n  - pop\n---\nBody');

// 38.5: Empty or invalid new tags add nothing
assert.deepStrictEqual(addTagsToNoteContentHelper(taggable, []).added, []);
assert.deepStrictEqual(addTagsToNoteContentHelper(taggable, ['', '   ', '#']).added, []);

console.log('✓ Tag commands: frontmatter tag extraction and deduplicated merge passed');

// Test 39: Create the companion note in either direction (video matching, folder-scoped lookup, rebuild merges)
console.log('Testing companion note creation in both directions...');

function extractVideoIdFromUrlHelper(url) {
	return url.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
}

function frontmatterMatchesVideoHelper(frontmatter, keys, videoId) {
	if (!frontmatter) return false;
	return keys.some((key) => typeof frontmatter[key] === 'string' && extractVideoIdFromUrlHelper(frontmatter[key]) === videoId);
}

function keepExtraFrontmatterHelper(existingContent, freshContent) {
	const pattern = /^---\n(?:([\s\S]*?)\n)?---(?:\n|$)/;
	const existingMatch = existingContent.replace(/\r\n/g, '\n').match(pattern);
	const fresh = freshContent.replace(/\r\n/g, '\n');
	const freshMatch = fresh.match(pattern);
	if (!existingMatch?.[1] || !freshMatch) return freshContent;
	return `---\n${mergeYamlBlocksHelper(existingMatch[1], freshMatch[1] ?? '')}\n---\n${fresh.slice(freshMatch[0].length)}`;
}

// 39.1: Video IDs from common URL shapes; non-YouTube values don't match
assert.strictEqual(extractVideoIdFromUrlHelper('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123'), 'dQw4w9WgXcQ');
assert.strictEqual(extractVideoIdFromUrlHelper('https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
assert.strictEqual(extractVideoIdFromUrlHelper('https://youtu.be/dQw4w9WgXcQ?t=42'), 'dQw4w9WgXcQ');
assert.strictEqual(extractVideoIdFromUrlHelper('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
assert.strictEqual(extractVideoIdFromUrlHelper('[[local-video.mp4]]'), null);
assert.strictEqual(extractVideoIdFromUrlHelper('https://vimeo.com/123456789'), null);

// 39.2: Frontmatter matching per note type
assert.strictEqual(frontmatterMatchesVideoHelper({ video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, ['video_url'], 'dQw4w9WgXcQ'), true);
assert.strictEqual(frontmatterMatchesVideoHelper({ video: 'https://youtu.be/dQw4w9WgXcQ' }, ['video', 'media'], 'dQw4w9WgXcQ'), true);
assert.strictEqual(frontmatterMatchesVideoHelper({ media: 'https://youtu.be/dQw4w9WgXcQ' }, ['video', 'media'], 'dQw4w9WgXcQ'), true);
assert.strictEqual(frontmatterMatchesVideoHelper({ video: 'https://youtu.be/jNQXAC9IVRw' }, ['video', 'media'], 'dQw4w9WgXcQ'), false);
assert.strictEqual(frontmatterMatchesVideoHelper({ video_url: 'https://youtu.be/dQw4w9WgXcQ' }, ['video', 'media'], 'dQw4w9WgXcQ'), false);
assert.strictEqual(frontmatterMatchesVideoHelper(undefined, ['video_url'], 'dQw4w9WgXcQ'), false);

// 39.3: Only the target folder (and subfolders) is searched — matching notes elsewhere are ignored
const vaultNotes = [
	{ path: 'Media Library/Never Gonna Give You Up.md', frontmatter: { 'mx-uid': 'a', video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
	{ path: 'Media Library/Archive/Renamed copy.md', frontmatter: { 'mx-uid': 'b', video: 'https://youtu.be/dQw4w9WgXcQ' } },
	{ path: 'Elsewhere/Stray media note.md', frontmatter: { 'mx-uid': 'c', video: 'https://youtu.be/dQw4w9WgXcQ' } },
	{ path: 'Video Summaries/Never Gonna Give You Up.md', frontmatter: { video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
	{ path: 'Inbox/Old summary.md', frontmatter: { video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
	{ path: 'Media Library Extra/Not inside.md', frontmatter: { video: 'https://youtu.be/dQw4w9WgXcQ' } },
];
const findInFolder = (folder, videoId, keys) =>
	testFilterFilesByFolderPaths(vaultNotes, [folder]).filter((n) => frontmatterMatchesVideoHelper(n.frontmatter, keys, videoId)).map((n) => n.path);
assert.deepStrictEqual(findInFolder('Media Library', 'dQw4w9WgXcQ', ['video', 'media']), ['Media Library/Never Gonna Give You Up.md', 'Media Library/Archive/Renamed copy.md']);
assert.deepStrictEqual(findInFolder('Video Summaries', 'dQw4w9WgXcQ', ['video_url']), ['Video Summaries/Never Gonna Give You Up.md']);
assert.deepStrictEqual(findInFolder('Video Summaries', 'jNQXAC9IVRw', ['video_url']), []);

// 39.4: Rebuilding a Media Extended note keeps user-added frontmatter (and tags), replaces generated keys and body
const userEditedMe = '---\nmx-uid: keepme\nvideo: https://youtu.be/dQw4w9WgXcQ\ntitle: Old\nmy_rating: 5\ntags:\n  - favorite\ncover: "[[old.jpg]]"\n---\n\nOld body with my notes\n';
const freshMe = '---\nmx-uid: keepme\nvideo: https://www.youtube.com/watch?v=dQw4w9WgXcQ\ntitle: New Title\ncover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"\n---\n\n![Cover](https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp)\n\n# Related\n\n- [[Video Summaries/Video]]\n';
const rebuiltMe = keepExtraFrontmatterHelper(userEditedMe, freshMe);
assert(rebuiltMe.includes('title: New Title'));
assert(rebuiltMe.includes('my_rating: 5'));
assert(rebuiltMe.includes('tags:\n  - favorite'));
assert(rebuiltMe.includes('cover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"'));
assert(!rebuiltMe.includes('Old body'));
assert(rebuiltMe.endsWith('\n# Related\n\n- [[Video Summaries/Video]]\n'));
assert.strictEqual(keepExtraFrontmatterHelper('No frontmatter', freshMe), freshMe);

// 39.5: Regenerating a summary note merges new frontmatter into the existing one (keeps added keys, merges tags)
const existingSummaryNote = '---\ntitle: "Old"\nvideo_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"\nmy_status: watched\ntags:\n  - favorite\n---\n\nOld summary\n';
const regenFm = { title: 'New', channel_name: 'C', channel_username: '@c', channel_url: 'u', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 't', thumbnail_text: '', tags: ['music'] };
const existingFmBlock = existingSummaryNote.match(/^---\n[\s\S]*?\n---/)[0];
const regenRaw = `${existingFmBlock}\n\n## Summary\n\nNew summary`;
const regenFmMatch = regenRaw.match(/^---\r?\n([\s\S]*?\r?\n)---(\r?\n)?/);
const regenerated = `---\n${mergeFrontmatter(regenFmMatch[1], regenFm)}\n---\n${regenRaw.slice(regenFmMatch[0].length)}`;
assert(regenerated.includes('title: "New"'));
assert(regenerated.includes('my_status: watched'));
assert(regenerated.includes('  - favorite'));
assert(regenerated.includes('  - music'));
assert(!regenerated.includes('Old summary'));
assert(regenerated.trimEnd().endsWith('## Summary\n\nNew summary'));

console.log('✓ Companion note creation in both directions passed');

// Test 40: Media Extended is optional — plugin detection, default off, and grouped settings
console.log('Testing Media Extended plugin detection, default, and settings grouping...');

const MEDIA_EXTENDED_PLUGIN_ID_HELPER = 'media-extended';
function resolveMediaExtendedPluginStatusHelper(registry) {
	if (!registry || (!registry.manifests && !registry.enabledPlugins && !registry.plugins)) return 'unknown';
	if (registry.plugins?.[MEDIA_EXTENDED_PLUGIN_ID_HELPER] || registry.enabledPlugins?.has(MEDIA_EXTENDED_PLUGIN_ID_HELPER)) return 'enabled';
	if (registry.manifests?.[MEDIA_EXTENDED_PLUGIN_ID_HELPER]) return 'disabled';
	return 'not-installed';
}

// 40.1: Detection from Obsidian's community plugin registry
assert.strictEqual(resolveMediaExtendedPluginStatusHelper({ manifests: { 'media-extended': {} }, enabledPlugins: new Set(['media-extended']), plugins: { 'media-extended': {} } }), 'enabled');
assert.strictEqual(resolveMediaExtendedPluginStatusHelper({ manifests: { 'media-extended': {} }, enabledPlugins: new Set(), plugins: {} }), 'disabled');
assert.strictEqual(resolveMediaExtendedPluginStatusHelper({ manifests: { 'dataview': {} }, enabledPlugins: new Set(['dataview']), plugins: { dataview: {} } }), 'not-installed');
assert.strictEqual(resolveMediaExtendedPluginStatusHelper({ manifests: {}, enabledPlugins: new Set(), plugins: {} }), 'not-installed');
// Registry unavailable → unknown (never prompts or blocks)
assert.strictEqual(resolveMediaExtendedPluginStatusHelper(undefined), 'unknown');
assert.strictEqual(resolveMediaExtendedPluginStatusHelper({}), 'unknown');

// 40.2: Prompt only when turning the setting on and the plugin is missing or disabled
const shouldPromptToInstall = (turnedOn, status) => turnedOn && (status === 'not-installed' || status === 'disabled');
assert.strictEqual(shouldPromptToInstall(true, 'not-installed'), true);
assert.strictEqual(shouldPromptToInstall(true, 'disabled'), true);
assert.strictEqual(shouldPromptToInstall(true, 'enabled'), false);
assert.strictEqual(shouldPromptToInstall(true, 'unknown'), false);
assert.strictEqual(shouldPromptToInstall(false, 'not-installed'), false);

// 40.3: Creating Media Extended notes is off by default; the note-content options keep their defaults
const defaultsNow = readFileSync(new URL('../src/defaults.ts', import.meta.url), 'utf8');
assert.match(defaultsNow, /DEFAULT_CREATE_MEDIA_EXTENDED_NOTES = false;/);
assert.match(defaultsNow, /DEFAULT_MEDIA_EXTENDED_INCLUDE_DESCRIPTION = true;/);
assert.match(defaultsNow, /DEFAULT_MEDIA_EXTENDED_INCLUDE_TRANSCRIPT = true;/);
assert.match(defaultsNow, /DEFAULT_MEDIA_EXTENDED_EMBED_COVER = true;/);

// 40.4: The plugin source never calls into the Media Extended plugin (detection lives in one helper)
const srcFiles = ['main.ts', 'utils/frontmatter.ts', 'services/youtube.ts', 'services/settingsManager.ts'];
for (const file of srcFiles) {
	const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
	assert.doesNotMatch(source, /\.plugins\b|enabledPlugins|getPlugin\(/, `${file} should not touch the plugin registry`);
}

// 40.5: Every Media Extended setting lives in the Media Extended settings tab, and nowhere else
const settingsSource = readFileSync(new URL('../src/ui/settings.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sectionBody = (name) => {
	const start = settingsSource.indexOf(`private ${name}(`);
	assert(start >= 0, `${name} should exist`);
	const next = settingsSource.indexOf('\n    private ', start + 1);
	return settingsSource.slice(start, next < 0 ? undefined : next);
};
const mediaExtendedTab = sectionBody('displayMediaExtendedSection');
const mediaExtendedSettingCalls = [
	'updateCreateMediaExtendedNotes',
	'updateMediaExtendedFolder',
	'updateMediaExtendedIncludeDescription',
	'updateMediaExtendedIncludeTranscript',
	'updateMediaExtendedEmbedCover',
	'promptCreateMediaExtendedNotes',
	'createMediaExtendedInVault',
];
for (const call of mediaExtendedSettingCalls) {
	assert(mediaExtendedTab.includes(call), `${call} should be in the Media Extended tab`);
	assert.strictEqual(settingsSource.split(call).length - 1, 1, `${call} should appear in exactly one place`);
}
for (const other of ['displaySummarySection', 'displayTagsAndMetadataSection', 'displayMaintenanceSection']) {
	assert(!/MediaExtended(Folder|Include|EmbedCover)|CreateMediaExtended/.test(sectionBody(other)), `${other} should have no Media Extended settings`);
}
// Turning the create toggle on triggers the install prompt
assert.match(mediaExtendedTab, /updateCreateMediaExtendedNotes\(value\);\s*if \(value\) \{\s*await this\.promptToInstallMediaExtended\(\);/);
// Five tabs in a sensible order
assert.deepStrictEqual(
	[...settingsSource.matchAll(/\{ name: '([^']+)', id: '[^']+', render:/g)].map((m) => m[1]),
	['AI Providers', 'Summary', 'Media Extended', 'Tags & Metadata', 'Maintenance']
);

console.log('✓ Media Extended plugin detection, default, and settings grouping passed');

// Test 41: The link to a new summary note is updated even when the source note's editor is unsaved
console.log('Testing summary link update against unsaved editor content...');

// Mirrors replaceInNote(): an open editor wins over the on-disk content
async function testReplaceInNote(openEditors, disk, path, search, replacement) {
	for (const editor of openEditors) {
		if (editor.path !== path) continue;
		const index = editor.value.indexOf(search);
		if (index !== -1) {
			editor.value = editor.value.slice(0, index) + replacement + editor.value.slice(index + search.length);
			return true;
		}
	}
	const found = disk[path].includes(search);
	disk[path] = disk[path].replace(search, () => replacement);
	return found;
}

const unsavedLink = '[[YouTube Summary MdxaU0l3FzI]]';
const titledLink = '[[Some $1 Video Title]]';

// 41.1: The link was just inserted, so it is in the editor but not yet on disk
const unsavedDisk = { 'Note.md': 'Intro\n' };
const unsavedEditors = [{ path: 'Note.md', value: `Intro\n${unsavedLink}` }];
assert.strictEqual(await testReplaceInNote(unsavedEditors, unsavedDisk, 'Note.md', unsavedLink, titledLink), true);
assert.strictEqual(unsavedEditors[0].value, `Intro\n${titledLink}`);
assert.strictEqual(unsavedDisk['Note.md'], 'Intro\n'); // disk is left for the editor's own save

// 41.2: The note is no longer open: the saved file is changed
const closedDisk = { 'Note.md': `Intro\n${unsavedLink}` };
assert.strictEqual(await testReplaceInNote([], closedDisk, 'Note.md', unsavedLink, titledLink), true);
assert.strictEqual(closedDisk['Note.md'], `Intro\n${titledLink}`);

// 41.3: Another note open in an editor is never touched, and a link Obsidian already updated is a no-op
const otherEditors = [{ path: 'Other.md', value: unsavedLink }];
const updatedDisk = { 'Note.md': `Intro\n${titledLink}` };
assert.strictEqual(await testReplaceInNote(otherEditors, updatedDisk, 'Note.md', unsavedLink, titledLink), false);
assert.strictEqual(otherEditors[0].value, unsavedLink);
assert.strictEqual(updatedDisk['Note.md'], `Intro\n${titledLink}`);

// 41.4: Failure cleanup removes the unsaved link the same way
const cleanupEditors = [{ path: 'Note.md', value: `https://youtu.be/MdxaU0l3FzI ${unsavedLink} tail` }];
await testReplaceInNote(cleanupEditors, { 'Note.md': '' }, 'Note.md', ` ${unsavedLink}`, '');
assert.strictEqual(cleanupEditors[0].value, 'https://youtu.be/MdxaU0l3FzI tail');

// 41.5: Both the rename and the cleanup go through replaceInNote, not vault.process on the source note
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
assert(mainSource.includes('await this.replaceInNote(sourceFile, oldLink, newLink);'));
assert(mainSource.includes("await this.replaceInNote(sourceFile, `${linkPrefix}${link}`, '');"));
assert(!/vault\.process\(sourceFile,/.test(mainSource));

console.log('✓ Summary link update against unsaved editor content passed');

// Test 42: watch_later / favorite checkbox properties in video summary frontmatter
console.log('Testing watch_later and favorite frontmatter properties...');

// Runs against the real src/utils/frontmatter.ts (its obsidian import is type-only)
const { build: esbuildBuild } = await import('esbuild');
const { fileURLToPath } = await import('node:url');
const frontmatterBundle = await esbuildBuild({
	entryPoints: [fileURLToPath(new URL('../src/utils/frontmatter.ts', import.meta.url))],
	bundle: true,
	format: 'esm',
	write: false,
	external: ['obsidian'],
	logLevel: 'silent',
});
const realFrontmatter = await import(
	`data:text/javascript;base64,${Buffer.from(frontmatterBundle.outputFiles[0].text).toString('base64')}`
);

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

// Test 43: "Upgrade video summary frontmatter" adds only the missing properties (real frontmatter.ts)
console.log('Testing frontmatter-only upgrade of video summary notes...');

const { addMissingUserFlags } = realFrontmatter;

// 43.1: Inserted before description/tags; every other character of the note is untouched
const legacySummary = [
	'---',
	'title: "Old: \\"quoted\\""',
	'video_url: "https://www.youtube.com/watch?v=MdxaU0l3FzI"',
	'my_rating:   5   ',
	'playlist_count: 12',
	'description: |-',
	'  First line',
	'',
	'  favorite: true (inside the description)',
	'tags:',
	'  - mine',
	'---',
	'',
	'# Body',
	'watch_later: true (in the body)',
	'',
].join('\n');
const upgradedSummary = addMissingUserFlags(legacySummary);
assert.strictEqual(
	upgradedSummary,
	legacySummary.replace('description: |-', 'watch_later: false\nfavorite: false\ndescription: |-')
);

// 43.2: Running it again changes nothing
assert.strictEqual(addMissingUserFlags(upgradedSummary), upgradedSummary);

// 43.3: Existing values are kept; only the missing property is added
const tickedSummary = '---\ntitle: "T"\nfavorite: true\ntags:\n  - a\n---\nBody\n';
assert.strictEqual(
	addMissingUserFlags(tickedSummary),
	'---\ntitle: "T"\nfavorite: true\nwatch_later: false\ntags:\n  - a\n---\nBody\n'
);
const bothSet = '---\nwatch_later: true\nfavorite: false\n---\nBody\n';
assert.strictEqual(addMissingUserFlags(bothSet), bothSet);

// 43.4: No description or tags: appended at the end of the frontmatter
assert.strictEqual(
	addMissingUserFlags('---\ntitle: "T"\nvideo_url: "https://youtu.be/x"\n---\n\nBody'),
	'---\ntitle: "T"\nvideo_url: "https://youtu.be/x"\nwatch_later: false\nfavorite: false\n---\n\nBody'
);

// 43.5: Windows line endings are preserved, and a note that ends at the closing --- works
assert.strictEqual(
	addMissingUserFlags('---\r\ntitle: "T"\r\ntags:\r\n  - a\r\n---\r\nBody\r\n'),
	'---\r\ntitle: "T"\r\nwatch_later: false\r\nfavorite: false\r\ntags:\r\n  - a\r\n---\r\nBody\r\n'
);
assert.strictEqual(addMissingUserFlags('---\ntitle: "T"\n---'), '---\ntitle: "T"\nwatch_later: false\nfavorite: false\n---');

// 43.6: Notes without frontmatter are left alone (a --- rule in the body is not frontmatter)
for (const untouched of ['', 'Just text\n', 'Intro\n\n---\ntitle: "T"\n---\n', '---\n---\nBody\n']) {
	assert.strictEqual(addMissingUserFlags(untouched), untouched);
}

// 43.7: The command only touches video summary notes and never fetches or merges metadata
const upgradeSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const upgradeBody = upgradeSource.slice(
	upgradeSource.indexOf('public async upgradeVideoSummaryFrontmatterInFolder('),
	upgradeSource.indexOf('public promptRefreshVideoMetadata(')
);
assert(upgradeBody.includes("getVideoNoteKind(content, file.path, mediaFolder) !== 'summary'"));
assert(upgradeBody.includes('addMissingUserFlags(current)'));
assert(!/youtubeService|YouTubeService|provider|updateNoteContentWithFrontmatter|mergeFrontmatter/.test(upgradeBody));
assert(upgradeSource.includes("id: 'upgrade-video-summary-frontmatter-folder'"));

console.log('✓ Frontmatter-only upgrade of video summary notes passed');

// Test 44: Live operation status — persistent notice, status bar, stages, and outcomes (real OperationProgress.ts)
console.log('Testing live operation status...');

// Bundle the real module with a recording stand-in for Obsidian's Notice
globalThis.__notices = [];
const progressBundle = await esbuildBuild({
	entryPoints: [fileURLToPath(new URL('../src/utils/OperationProgress.ts', import.meta.url))],
	bundle: true,
	format: 'esm',
	write: false,
	logLevel: 'silent',
	plugins: [{
		name: 'obsidian-stub',
		setup(build) {
			build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'stub' }));
			build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
				loader: 'js',
				contents: `export class Notice {
					constructor(message, duration) { this.message = message; this.duration = duration; this.hidden = false; globalThis.__notices.push(this); }
					setMessage(message) { this.message = message; }
					hide() { this.hidden = true; }
				}`,
			}));
		},
	}],
});
const progressModule = await import(
	`data:text/javascript;base64,${Buffer.from(progressBundle.outputFiles[0].text).toString('base64')}`
);
const { OperationProgress, LiveStatus, formatElapsed, shortenTitle, formatOperationStatus, describeFailedStage, ERROR_NOTICE_MS } = progressModule;

// 44.1: Elapsed time and title formatting
assert.strictEqual(formatElapsed(0), '0:00');
assert.strictEqual(formatElapsed(999), '0:00');
assert.strictEqual(formatElapsed(72_000), '1:12');
assert.strictEqual(formatElapsed(600_000), '10:00');
assert.strictEqual(formatElapsed(3_725_000), '1:02:05');
assert.strictEqual(formatElapsed(-5), '0:00');
assert.strictEqual(shortenTitle('  Short title  '), 'Short title');
assert.strictEqual(shortenTitle('x'.repeat(80)).length, 60);
assert(shortenTitle('x'.repeat(80)).endsWith('…'));
assert.deepStrictEqual(formatOperationStatus('Summarizing "Video"', 'Generating summary with qwen', 72_000), {
	notice: 'Summarizing "Video" · Generating summary with qwen… 1:12',
	statusBar: 'YT: Generating summary with qwen… 1:12',
});
assert.strictEqual(describeFailedStage('Fetching transcript'), ' (while fetching transcript)');
assert.strictEqual(describeFailedStage(''), '');

// Fakes for the status bar and timers
const realSetTimeout = globalThis.setTimeout;
const realWindow = globalThis.window;
const lingerCallbacks = [];
const intervals = [];
const clearedIntervals = [];
globalThis.setTimeout = (fn) => { lingerCallbacks.push(fn); return 0; };
globalThis.window = {
	setInterval: (fn) => { intervals.push(fn); return intervals.length; },
	clearInterval: (id) => { clearedIntervals.push(id); },
};
const makeStatusHost = () => {
	const items = [];
	return {
		items,
		addStatusBarItem: () => {
			const el = { text: '', removed: false, setText(t) { this.text = t; }, remove() { this.removed = true; } };
			items.push(el);
			return el;
		},
	};
};

try {
	// 44.2: Nothing is shown until the first stage, so a failed validation never flashes a status
	globalThis.__notices.length = 0;
	const host = makeStatusHost();
	const progress = new OperationProgress(host, 'Summarizing video');
	assert.strictEqual(globalThis.__notices.length, 0);
	assert.strictEqual(host.items.length, 0);
	assert.match(progress.describe(), /^Summarizing video \(\d+:\d\d\)$/);

	// 44.3: The first stage shows one persistent notice and one status bar item
	progress.setStage('Fetching transcript');
	assert.strictEqual(globalThis.__notices.length, 1);
	const liveNotice = globalThis.__notices[0];
	assert.strictEqual(liveNotice.duration, 0, 'the live notice must not time out');
	assert.match(liveNotice.message, /^Summarizing video · Fetching transcript… 0:0\d$/);
	assert.strictEqual(host.items.length, 1);
	assert.match(host.items[0].text, /^YT: Fetching transcript… 0:0\d$/);
	assert.strictEqual(intervals.length, 1, 'a one-second timer keeps the elapsed time current');

	// 44.4: Later stages and the label update the same notice in place
	progress.setLabel('Summarizing "My Video"');
	progress.setStage('Generating summary with qwen');
	assert.strictEqual(globalThis.__notices.length, 1);
	assert.strictEqual(host.items.length, 1);
	assert.match(liveNotice.message, /^Summarizing "My Video" · Generating summary with qwen… 0:0\d$/);
	intervals[0]();
	assert.match(host.items[0].text, /^YT: Generating summary with qwen… 0:0\d$/);
	assert.match(progress.describe(), /^Summarizing "My Video" \(generating summary with qwen, 0:0\d\)$/);

	// 44.5: Success hides the live notice, shows the result, and clears the status bar after a moment
	progress.done('Summary saved to "My Video"');
	assert.strictEqual(liveNotice.hidden, true);
	assert.deepStrictEqual(clearedIntervals, [1]);
	assert.strictEqual(globalThis.__notices.length, 2);
	assert.strictEqual(globalThis.__notices[1].message, 'Summary saved to "My Video"');
	assert.strictEqual(globalThis.__notices[1].duration, undefined);
	assert.strictEqual(host.items[0].text, 'YT: Done');
	assert.strictEqual(host.items[0].removed, false);
	lingerCallbacks.shift()();
	assert.strictEqual(host.items[0].removed, true);

	// 44.6: Ending twice does nothing more (stop() runs in every finally block)
	progress.stop();
	progress.fail('late');
	progress.setStage('Too late');
	assert.strictEqual(globalThis.__notices.length, 3, 'only the explicit fail() adds a notice');
	assert.strictEqual(host.items.length, 1);

	// 44.7: Failure names the stage and stays on screen longer
	globalThis.__notices.length = 0;
	const failHost = makeStatusHost();
	const failing = new OperationProgress(failHost, 'Summarizing video');
	failing.setStage('Generating summary with qwen');
	failing.fail('Error: Connection error.');
	assert.strictEqual(globalThis.__notices[0].hidden, true);
	assert.strictEqual(globalThis.__notices[1].message, 'Error: Connection error. (while generating summary with qwen)');
	assert.strictEqual(globalThis.__notices[1].duration, ERROR_NOTICE_MS);
	assert(ERROR_NOTICE_MS >= 10000);
	assert.strictEqual(failHost.items[0].text, 'YT: Failed');

	// 44.8: stop() clears everything silently, including the status bar item
	globalThis.__notices.length = 0;
	const stopHost = makeStatusHost();
	const stopped = new OperationProgress(stopHost, 'Tagging "Note"');
	stopped.setStage('Fetching tags from YouTube');
	stopped.stop();
	assert.strictEqual(globalThis.__notices.length, 1);
	assert.strictEqual(globalThis.__notices[0].hidden, true);
	assert.strictEqual(stopHost.items[0].removed, true);

	// 44.9: Works without a status bar (mobile)
	globalThis.__notices.length = 0;
	const mobile = new OperationProgress({}, 'Getting transcript');
	mobile.setStage('Fetching transcript');
	mobile.done('Transcript retrieved successfully!');
	assert.strictEqual(globalThis.__notices.length, 2);

	// 44.10: LiveStatus (shared with batch operations) updates both displays in place
	globalThis.__notices.length = 0;
	const batchHost = makeStatusHost();
	const live = new LiveStatus(batchHost, '[0/3] Starting...', 'YT: [0/3] Starting...');
	live.set('[1/3] (33%) Refresh video metadata: A', 'YT: [1/3] 33%');
	assert.strictEqual(globalThis.__notices.length, 1);
	assert.strictEqual(globalThis.__notices[0].message, '[1/3] (33%) Refresh video metadata: A');
	assert.strictEqual(batchHost.items[0].text, 'YT: [1/3] 33%');
	live.end('YT: Done (3/3)');
	assert.strictEqual(globalThis.__notices[0].hidden, true);
	assert.strictEqual(batchHost.items[0].text, 'YT: Done (3/3)');
} finally {
	globalThis.setTimeout = realSetTimeout;
	globalThis.window = realWindow;
}

// 44.11: Every command that fetches or generates reports through the shared status, and none of the
// short-lived "Fetching…" / "Generating…" notices remain
const statusSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert(!/new Notice\(['`](Fetching|Generating|Refreshing)/.test(statusSource));
assert(!statusSource.includes('Already processing'));
assert.strictEqual((statusSource.match(/this\.beginOperation\(/g) || []).length, 8);
assert.strictEqual(
	(statusSource.match(/this\.endOperation\(progress\);/g) || []).length,
	8,
	'every operation ends its status in a finally block'
);
const trackerSource = readFileSync(new URL('../src/utils/BatchProgressTracker.ts', import.meta.url), 'utf8');
assert(trackerSource.includes('new LiveStatus('));

console.log('✓ Live operation status passed');

console.log('\nAll tests passed successfully!');










