// Settings: model retirement migrations, Media Extended options, and the default prompt upgrade.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { loadSource } from './helpers/loadSource.mjs';
import { loadSettingsManager } from './helpers/settings.mjs';

const {
	DEFAULT_PROMPT,
	DEFAULT_SELECTED_MODEL,
	LEGACY_DEFAULT_PROMPTS,
	RETIRED_ANTHROPIC_MODELS,
	RETIRED_GEMINI_MODELS,
	RETIRED_OPENAI_MODELS,
	upgradeSavedPrompt,
} = await loadSource('src/defaults.ts');
const { defaultMediaExtendedRunOptions, resolveCompanionNoteOptions } = await loadSource('src/utils/mediaExtendedOptions.ts');
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

// Every model in the list above is retired by the plugin
for (const model of retiredModels) {
	assert(RETIRED_GEMINI_MODELS.includes(model), `${model} should be retired`);
}
assert.strictEqual(DEFAULT_SELECTED_MODEL, 'Gemini:gemini-3.8-flash');

// Saved settings as an existing install has them: a Gemini provider still listing retired models
const savedWithGemini = (selectedModelId) => ({
	settings: {
		providers: [{
			name: 'Gemini',
			type: 'gemini',
			isBuiltIn: true,
			apiKey: '',
			models: [
				{ name: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash Deprecated' },
				{ name: 'gemini-2.0-flash-lite', displayName: 'Gemini 2.0 Flash-Lite Deprecated' },
				{ name: 'gemini-3.8-flash', displayName: 'Gemini 3.8 Flash (Recommended)' },
				{ name: 'gemini-3.5-flash', displayName: 'Gemini 3.5 Flash' },
			],
		}],
		selectedModelId,
	},
});
const modelNamesOf = (settings, providerName) => settings.providers.find((p) => p.name === providerName).models.map((m) => m.name);

// Loading prunes the retired models and moves a retired selection to the default model
const retiredGeminiLoad = await loadSettingsManager(savedWithGemini('Gemini:gemini-2.0-flash'));
const loadedGeminiModels = modelNamesOf(retiredGeminiLoad.lastSaved(), 'Gemini');
assert(!loadedGeminiModels.includes('gemini-2.0-flash'));
assert(!loadedGeminiModels.includes('gemini-2.0-flash-lite'));
assert(loadedGeminiModels.includes('gemini-3.8-flash') && loadedGeminiModels.includes('gemini-3.5-flash'));
assert.strictEqual(retiredGeminiLoad.lastSaved().selectedModelId, DEFAULT_SELECTED_MODEL);

// A current model stays selected; one that no longer exists moves to the default
assert.strictEqual((await loadSettingsManager(savedWithGemini('Gemini:gemini-3.5-flash'))).lastSaved().selectedModelId, 'Gemini:gemini-3.5-flash');
assert.strictEqual((await loadSettingsManager(savedWithGemini('Gemini:non-existent'))).lastSaved().selectedModelId, DEFAULT_SELECTED_MODEL);
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

for (const model of retiredAnthropic) {
	assert(RETIRED_ANTHROPIC_MODELS.includes(model), `${model} should be retired`);
}
for (const model of retiredOpenAI) {
	assert(RETIRED_OPENAI_MODELS.includes(model), `${model} should be retired`);
}

// Saved Anthropic and OpenAI providers that still list retired models
const savedWithAllProviders = (selectedModelId) => ({
	settings: {
		providers: [
			{
				name: 'Anthropic',
				type: 'anthropic',
				isBuiltIn: true,
				apiKey: '',
				models: [
					{ name: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4 Deprecated' },
					{ name: 'claude-sonnet-5-5', displayName: 'Claude Sonnet 5.5 (Recommended)' },
					{ name: 'claude-opus-5-5', displayName: 'Claude Opus 5.5' },
				],
			},
			{
				name: 'OpenAI',
				type: 'openai',
				isBuiltIn: true,
				apiKey: '',
				models: [
					{ name: 'gpt-4-0613', displayName: 'GPT-4 0613' },
					{ name: 'gpt-6', displayName: 'GPT-6 (Astra)' },
					{ name: 'gpt-4o', displayName: 'GPT-4o' },
				],
			},
		],
		selectedModelId,
	},
});

const multiLoad = await loadSettingsManager(savedWithAllProviders('Anthropic:claude-sonnet-4-20250514'));
assert(!modelNamesOf(multiLoad.lastSaved(), 'Anthropic').includes('claude-sonnet-4-20250514'));
assert(modelNamesOf(multiLoad.lastSaved(), 'Anthropic').includes('claude-sonnet-5-5'));
assert(!modelNamesOf(multiLoad.lastSaved(), 'OpenAI').includes('gpt-4-0613'));
assert(modelNamesOf(multiLoad.lastSaved(), 'OpenAI').includes('gpt-6'));
// A model the user added themselves is kept when it isn't retired
assert(modelNamesOf(multiLoad.lastSaved(), 'OpenAI').includes('gpt-4o'));

// Retired selections move to the default; current ones stay
const selectedAfterLoad = async (selectedModelId) => (await loadSettingsManager(savedWithAllProviders(selectedModelId))).lastSaved().selectedModelId;
assert.strictEqual(await selectedAfterLoad('Anthropic:claude-sonnet-4-20250514'), DEFAULT_SELECTED_MODEL);
assert.strictEqual(await selectedAfterLoad('Anthropic:claude-sonnet-5-5'), 'Anthropic:claude-sonnet-5-5');
assert.strictEqual(await selectedAfterLoad('OpenAI:gpt-4-0613'), DEFAULT_SELECTED_MODEL);
assert.strictEqual(await selectedAfterLoad('OpenAI:gpt-6'), 'OpenAI:gpt-6');
console.log('✓ Anthropic and OpenAI model retirement and migration passed');

// Test 24: Summary prompt Media Extended checkbox and per-run override resolution
console.log('Testing summary prompt Media Extended checkbox override resolution...');

const withMediaExtendedSettings = (createNote, includeDescription, includeTranscript) => loadSettingsManager({
	settings: {
		providers: [],
		createMediaExtendedNotes: createNote,
		mediaExtendedIncludeDescription: includeDescription,
		mediaExtendedIncludeTranscript: includeTranscript,
	},
});

// Case 1 & 2: The prompt's checkboxes start from the permanent settings
for (const enabled of [true, false]) {
	const { manager } = await withMediaExtendedSettings(enabled, enabled, !enabled);
	assert.deepStrictEqual(defaultMediaExtendedRunOptions(manager), {
		createNote: enabled,
		includeDescription: enabled,
		includeTranscript: !enabled,
	});
}

// Case 3 & 4: A choice made in the prompt applies to this run only; the permanent settings and the saved data don't change
for (const enabled of [true, false]) {
	const { manager, saves } = await withMediaExtendedSettings(enabled, enabled, enabled);
	const savesBefore = saves.length;
	const runOptions = { ...defaultMediaExtendedRunOptions(manager), createNote: !enabled, includeDescription: !enabled, includeTranscript: !enabled };
	assert.deepStrictEqual(resolveCompanionNoteOptions(runOptions, manager), { includeDescription: !enabled, includeTranscript: !enabled });
	assert.strictEqual(manager.getCreateMediaExtendedNotes(), enabled);
	assert.strictEqual(manager.getMediaExtendedIncludeDescription(), enabled);
	assert.strictEqual(manager.getMediaExtendedIncludeTranscript(), enabled);
	assert.strictEqual(saves.length, savesBefore, 'nothing is saved for a one-run choice');
}

// Without a choice for this run, the companion note follows the permanent settings
const { manager: unchangedManager } = await withMediaExtendedSettings(true, false, true);
assert.deepStrictEqual(resolveCompanionNoteOptions(undefined, unchangedManager), { includeDescription: false, includeTranscript: true });
assert.deepStrictEqual(resolveCompanionNoteOptions({ includeDescription: true }, unchangedManager), { includeDescription: true, includeTranscript: true });

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
