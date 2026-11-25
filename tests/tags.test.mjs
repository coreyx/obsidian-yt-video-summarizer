// The vault tag cache, the AI tag prompt, and the Tag with AI / Tag with YouTube commands.
import assert from 'node:assert';
import { loadSource } from './helpers/loadSource.mjs';

// Test 28: Vault tag cache extraction, compression, group prefix detection, prompt building, and grouped tag deduplication
const { buildTopicGenerationPrompt, buildVaultTagData, compressVaultTags, extractGroupPrefixes } = await loadSource('src/utils/vaultTags.ts');

const { addTagsToNoteContent, deduplicateTags, extractFrontmatterTags, mergeYamlBlocks, sanitizeTag } = await loadSource('src/utils/frontmatter.ts');

console.log('Testing vault tag caching, AI topic tagging prompt, and grouped tag deduplication...');





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
const extractedPrefixes = extractGroupPrefixes(mockTagsWithPrefixes);
assert.deepStrictEqual(extractedPrefixes, ['ai/', 'dev/', 'dev/frontend/']);
assert.deepStrictEqual(extractGroupPrefixes(['flat', 'no-slash', 'simple']), []);
assert.deepStrictEqual(extractGroupPrefixes([]), []);

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

const vaultTagData = buildVaultTagData(rawVaultTagRecord);
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
const emptyVaultData = buildVaultTagData({});
assert.strictEqual(emptyVaultData.totalCount, 0);
assert.strictEqual(emptyVaultData.compressedContext, '(none yet - feel free to create initial tags)');

// 28.3: buildTopicGenerationPromptHelper tests
const test28SampleSummary = 'This tutorial demonstrates how to train machine learning models using PyTorch and open source tools.';
const test28PromptOutput = buildTopicGenerationPrompt(test28SampleSummary, {
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
const testTagsOrder1 = deduplicateTags(['ai-machine-learning', 'ai/machine-learning']);
assert.deepStrictEqual(testTagsOrder1, ['ai/machine-learning']);

const testTagsOrder2 = deduplicateTags(['ai/machine-learning', 'ai-machine-learning']);
assert.deepStrictEqual(testTagsOrder2, ['ai/machine-learning']);

// Other hyphenated tags should still collapse run-together words
const testHyphenCollapse = deduplicateTags(['rickastley', 'rick-astley']);
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
	return buildVaultTagData(mockVaultTags);
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

// 38.1: Extraction handles list, inline, single/comma values, quotes, and #
assert.deepStrictEqual(extractFrontmatterTags('---\ntitle: T\ntags:\n  - music\n  - "pop-culture"\n---\nBody'), ['music', 'pop-culture']);
assert.deepStrictEqual(extractFrontmatterTags('---\ntags: [music, "#80s", pop]\n---\n'), ['music', '80s', 'pop']);
assert.deepStrictEqual(extractFrontmatterTags('---\ntags: music, pop\n---\n'), ['music', 'pop']);
assert.deepStrictEqual(extractFrontmatterTags('---\ntitle: T\n---\n'), []);
assert.deepStrictEqual(extractFrontmatterTags('No frontmatter'), []);

// 38.2: New tags merge into the existing list, deduplicated like the summary process (sanitized, collapsed variants)
const taggable = '---\ntitle: "Video"\nvideo_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"\ntags:\n  - music\n  - ai-machine-learning\ncustom: keep\n---\n\n## Summary\n\nText\n';
const tagged = addTagsToNoteContent(taggable, ['Music', 'ai/machine-learning', 'Rick Astley', '#80s']);
assert.deepStrictEqual(tagged.added, deduplicateTags(['music', 'ai-machine-learning', 'Music', 'ai/machine-learning', 'Rick Astley', '#80s']).filter((t) => !['music', 'ai-machine-learning'].includes(t)));
assert(tagged.content.includes('  - music\n'));
assert(tagged.content.includes('  - ai/machine-learning\n'));
assert(!tagged.content.includes('ai-machine-learning'));
assert.strictEqual((tagged.content.match(/^  - music$/gm) || []).length, 1);
assert(tagged.content.includes('custom: keep'));
assert(tagged.content.includes('title: "Video"'));
assert(tagged.content.endsWith('---\n\n## Summary\n\nText\n'));
assert.strictEqual((tagged.content.match(/^tags:/gm) || []).length, 1);

// 38.3: Nothing new → note returned unchanged (no rewrite)
const unchanged = addTagsToNoteContent(taggable, ['music', 'MUSIC', '#music']);
assert.deepStrictEqual(unchanged.added, []);
assert.strictEqual(unchanged.content, taggable);

// 38.4: Inline tags are converted to a list when new tags are added; notes without tags or frontmatter get them
const inlineTagged = addTagsToNoteContent('---\ntags: [music]\n---\nBody', ['pop']);
assert.strictEqual(inlineTagged.content, '---\ntags:\n  - music\n  - pop\n---\nBody');
assert.strictEqual(addTagsToNoteContent('---\ntitle: T\n---\nBody', ['pop']).content, '---\ntitle: T\ntags:\n  - pop\n---\nBody');
assert.strictEqual(addTagsToNoteContent('Body only\n', ['pop']).content, '---\ntags:\n  - pop\n---\n\nBody only\n');
assert.strictEqual(addTagsToNoteContent('---\n---\nBody', ['pop']).content, '---\ntags:\n  - pop\n---\nBody');

// 38.5: Empty or invalid new tags add nothing
assert.deepStrictEqual(addTagsToNoteContent(taggable, []).added, []);
assert.deepStrictEqual(addTagsToNoteContent(taggable, ['', '   ', '#']).added, []);

console.log('✓ Tag commands: frontmatter tag extraction and deduplicated merge passed');
