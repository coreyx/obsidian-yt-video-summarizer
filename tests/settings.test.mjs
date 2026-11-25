// Settings: model retirement migrations, Media Extended options, and the default prompt upgrade.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { loadSource } from './helpers/loadSource.mjs';

const { DEFAULT_PROMPT, LEGACY_DEFAULT_PROMPTS, upgradeSavedPrompt } = await loadSource('src/defaults.ts');
const realFrontmatter = await loadSource('src/utils/frontmatter.ts');

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

// Test 45: "Actionable insights" section in the default prompt, and upgrading saved default prompts (real defaults.ts)
console.log('Testing Actionable insights prompt section and saved prompt upgrade...');

// 45.1: The section sits between Technical terms and Conclusion in the output structure
const outputStructure = DEFAULT_PROMPT.slice(DEFAULT_PROMPT.indexOf('## Output Structure'));
const sectionOrder = [...outputStructure.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
assert.deepStrictEqual(sectionOrder, ['Output Structure', 'Summary', 'Key points', 'Technical terms', 'Actionable insights', 'Conclusion']);
assert(outputStructure.includes('## Actionable insights\n- [Actionable insight 1]\n- [Actionable insight 2]\n- [Additional insights...]\n\n## Conclusion'));

// 45.2: The instructions for it come before the output structure
const insightsGuidance = DEFAULT_PROMPT.slice(DEFAULT_PROMPT.indexOf('## Extracting Actionable Insights'), DEFAULT_PROMPT.indexOf('## Output Structure'));
for (const phrase of [
	'practical advice, workflows, implementation details, best practices, recommendations, lessons learned, warnings, optimization opportunities, and concrete takeaways',
	'Return a markdown bullet list.',
	'could apply in their own work or projects',
	'primarily informational rather than instructional, identify the most useful insights and explain how they might be applied',
]) {
	assert(insightsGuidance.includes(phrase), `guidance should include: ${phrase}`);
}
assert(!/\bpage\b/i.test(DEFAULT_PROMPT), 'the prompt is about a video, not a page');

// 45.3: The earlier default is kept word for word (it is what existing installs have saved)
assert.strictEqual(LEGACY_DEFAULT_PROMPTS.length, 1);
const legacyPrompt = LEGACY_DEFAULT_PROMPTS[0];
assert.strictEqual(legacyPrompt.length, 1167);
assert(!/actionable/i.test(legacyPrompt));
assert(legacyPrompt.includes('## Technical terms') && legacyPrompt.endsWith('omit that section entirely.'));
// Everything outside the new section is unchanged
assert.strictEqual(
	DEFAULT_PROMPT
		.replace(/## Extracting Actionable Insights\n\n[^\n]+\n\n/, '')
		.replace('## Actionable insights\n- [Actionable insight 1]\n- [Actionable insight 2]\n- [Additional insights...]\n\n', ''),
	legacyPrompt
);

// 45.4: An unedited saved copy of the old default is upgraded; anything else is left alone
assert.strictEqual(upgradeSavedPrompt(legacyPrompt), DEFAULT_PROMPT);
assert.strictEqual(upgradeSavedPrompt(`${legacyPrompt.replace(/\n/g, '\r\n')}\r\n  `), DEFAULT_PROMPT);
assert.strictEqual(upgradeSavedPrompt(DEFAULT_PROMPT), DEFAULT_PROMPT);
const editedPrompt = legacyPrompt.replace('[Write a brief conclusion]', '[Write a one-line conclusion]');
assert.strictEqual(upgradeSavedPrompt(editedPrompt), editedPrompt);
assert.strictEqual(upgradeSavedPrompt('Summarize this video in three bullets.'), 'Summarize this video in three bullets.');
assert.strictEqual(upgradeSavedPrompt(''), '');
assert.strictEqual(upgradeSavedPrompt(undefined), undefined);

// 45.5: Settings loading applies the upgrade, and wikilink stripping still stops at the new heading
const settingsManagerSource = readFileSync(new URL('../src/services/settingsManager.ts', import.meta.url), 'utf8');
assert(settingsManagerSource.includes('upgradeSavedPrompt(this.settings.customPrompt)'));
const strippedInsights = realFrontmatter.stripWikilinksFromTechnicalTerms(
	'## Technical terms\n- **[[RAG]]**: retrieval\n\n## Actionable insights\n- Read [[this note]] first\n\n## Conclusion\nDone.'
);
assert(strippedInsights.includes('- **RAG**: retrieval'));
assert(strippedInsights.includes('- Read [[this note]] first'));

console.log('✓ Actionable insights prompt section and saved prompt upgrade passed');
