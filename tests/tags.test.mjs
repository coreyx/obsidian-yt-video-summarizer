// The vault tag cache, the AI tag prompt, and the Tag with AI / Tag with YouTube commands.
import assert from 'node:assert';
import {
	sanitizeTag,
	splitYamlBlocksHelper,
	mergeYamlBlocksHelper,
} from './helpers/legacy-copies.mjs';

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
