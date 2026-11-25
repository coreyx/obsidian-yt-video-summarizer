// AI provider helpers: topic tag parsing, OpenAI request settings, and LM Studio.
import assert from 'node:assert';
import { loadSource } from './helpers/loadSource.mjs';
import { loadSettingsManager } from './helpers/settings.mjs';

const { getLMStudioNativeModelsUrl, normalizeOpenAIBaseUrl, parseLMStudioModels } = await loadSource('src/services/lmStudio.ts');
const { buildChatCompletionParams, toLegacyMaxTokensParams } = await loadSource('src/services/providers/openai.ts');
const { parseTopicTags } = await loadSource('src/utils/vaultTags.ts');

// Test 6: Topics parsing from LLM response

console.log('Testing parseTopicTags...');
const llmResponse = 'artificial-intelligence, #Machine Learning, deep learning\nNeural Networks, 123, , AI Ethics';
const parsedTopics = parseTopicTags(llmResponse);
assert.deepStrictEqual(parsedTopics, [
	'artificial-intelligence',
	'machine-learning',
	'deep-learning',
	'neural-networks',
	'ai-ethics'
]);
console.log('✓ parseTopicTags passed');

// Test 14: OpenAI parameter construction (max_completion_tokens & reasoning temperature)
console.log('Testing OpenAI parameter construction...');
// For standard models (gpt-4o, gpt-5.x, etc.)
const standardParams = buildChatCompletionParams('gpt-4o', 'Summarize this', 4000, 0.7);
assert.deepStrictEqual(standardParams.messages, [{ role: 'user', content: 'Summarize this' }]);
assert.strictEqual(standardParams.max_completion_tokens, 4000);
assert.strictEqual(standardParams.max_tokens, undefined);
assert.strictEqual(standardParams.temperature, 0.7);

// For reasoning models (o1, o3-mini, o4-mini)
for (const model of ['o1', 'o3-mini', 'O4-mini']) {
	const reasoningParams = buildChatCompletionParams(model, 'Summarize this', 4000, 0.7);
	assert.strictEqual(reasoningParams.max_completion_tokens, 4000);
	assert.strictEqual(reasoningParams.max_tokens, undefined);
	assert.strictEqual('temperature' in reasoningParams, false, `${model}: temperature must be omitted for reasoning models`);
}

// Fallback to max_tokens when a server rejects max_completion_tokens, for each way servers word it
const legacyParams = { model: 'legacy-model', max_completion_tokens: 1000 };
for (const message of [
	'unrecognized parameter: max_completion_tokens',
	'Extra fields not permitted',
	'Unknown parameter: foo',
	'Unsupported parameter',
]) {
	const fallbackResult = toLegacyMaxTokensParams(legacyParams, { message });
	assert.strictEqual(fallbackResult.max_tokens, 1000, message);
	assert.strictEqual('max_completion_tokens' in fallbackResult, false, message);
}
assert.strictEqual(legacyParams.max_completion_tokens, 1000, 'the original request is left unchanged');
// No retry for unrelated errors, or for a request that never sent max_completion_tokens
assert.strictEqual(toLegacyMaxTokensParams(legacyParams, new Error('401 Unauthorized')), null);
assert.strictEqual(toLegacyMaxTokensParams({ model: 'm', max_tokens: 1000 }, { message: 'unrecognized parameter' }), null);
console.log('✓ OpenAI parameter construction passed');

// Test 25: OpenAI-compatible URL normalization, LM Studio model parsing & provider sync
console.log('Testing OpenAI-compatible URL normalization and LM Studio model parsing...');

// 25.1: URL normalization tests
assert.strictEqual(normalizeOpenAIBaseUrl(''), 'http://localhost:1234/v1');
assert.strictEqual(normalizeOpenAIBaseUrl('localhost:1234'), 'http://localhost:1234/v1');
assert.strictEqual(normalizeOpenAIBaseUrl('http://localhost:1234'), 'http://localhost:1234/v1');
assert.strictEqual(normalizeOpenAIBaseUrl('http://localhost:1234/'), 'http://localhost:1234/v1');
assert.strictEqual(normalizeOpenAIBaseUrl('http://localhost:1234/v1'), 'http://localhost:1234/v1');
assert.strictEqual(normalizeOpenAIBaseUrl('http://localhost:1234/v1/'), 'http://localhost:1234/v1');
assert.strictEqual(normalizeOpenAIBaseUrl('http://127.0.0.1:11434'), 'http://127.0.0.1:11434/v1');
assert.strictEqual(normalizeOpenAIBaseUrl('https://openrouter.ai/api/v1'), 'https://openrouter.ai/api/v1');
assert.strictEqual(normalizeOpenAIBaseUrl('https://api.groq.com/openai/v1/'), 'https://api.groq.com/openai/v1');

// Native LM Studio endpoint derived from the OpenAI-compatible base URL
assert.strictEqual(getLMStudioNativeModelsUrl('http://localhost:1234/v1'), 'http://localhost:1234/api/v0/models');
assert.strictEqual(getLMStudioNativeModelsUrl('http://127.0.0.1:1234/v1'), 'http://127.0.0.1:1234/api/v0/models');

// 25.2: Model parsing tests
const mockLMStudioResp = {
	object: 'list',
	data: [
		{ id: 'mistral-7b-instruct', state: 'unloaded' },
		{ id: 'qwen2.5-coder-7b-instruct', state: 'loaded', type: 'llm' },
		{ id: 'llama-3.2-3b-instruct', state: 'unloaded' }
	]
};
const parsedModels = parseLMStudioModels(mockLMStudioResp);
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
const parsedOpenAI = parseLMStudioModels(mockOpenAIList);
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
const parsedNative = parseLMStudioModels(mockNativeResp);
assert.strictEqual(parsedNative.length, 2);
assert.strictEqual(parsedNative[0].id, 'qwen3-coder-30b-a3b-instruct');
assert.strictEqual(parsedNative[0].isLoaded, true);
assert.strictEqual(parsedNative[1].id, 'gemma-4-e4b-it');
assert.strictEqual(parsedNative[1].isLoaded, false);

// Empty and invalid handling
assert.deepStrictEqual(parseLMStudioModels(null), []);
assert.deepStrictEqual(parseLMStudioModels({ data: [] }), []);
assert.deepStrictEqual(parseLMStudioModels({ data: [{ id: '' }, null, 123] }), []);

// 25.3: Sync LM Studio provider into settings (the real SettingsManager)
const { manager: lmSettings, lastSaved: lmSaved } = await loadSettingsManager({
	settings: {
		providers: [{ name: 'Gemini', type: 'gemini', isBuiltIn: true, apiKey: '', models: [{ name: 'gemini-3.8-flash', displayName: 'Gemini 3.8 Flash' }] }],
		selectedModelId: 'Gemini:gemini-3.8-flash',
	},
});
const lmStudioProviders = () => lmSaved().providers.filter((p) => p.name === 'LM Studio');

// Initial sync adds "LM Studio" and sets active model to loaded model
const syncResult = await lmSettings.syncLMStudioProvider('http://localhost:1234', parsedModels);
assert.strictEqual(syncResult.modelCount, 3);
assert.strictEqual(syncResult.activeModelId, 'LM Studio:qwen2.5-coder-7b-instruct');
assert.strictEqual(lmSaved().selectedModelId, 'LM Studio:qwen2.5-coder-7b-instruct');
assert.strictEqual(lmStudioProviders().length, 1);
assert.strictEqual(lmStudioProviders()[0].url, 'http://localhost:1234/v1');
assert.strictEqual(lmStudioProviders()[0].apiKey, 'not-needed');
assert.strictEqual(lmStudioProviders()[0].type, 'openai');

// Re-syncing updates models without duplicating provider
const updatedResp = {
	data: [{ id: 'deepseek-r1-distill-qwen-7b', state: 'loaded' }]
};
const updatedModels = parseLMStudioModels(updatedResp);
const resyncResult = await lmSettings.syncLMStudioProvider('http://127.0.0.1:1234/v1', updatedModels);
assert.strictEqual(lmStudioProviders().length, 1); // still one LM Studio provider
assert.strictEqual(resyncResult.modelCount, 1);
assert.strictEqual(lmStudioProviders()[0].url, 'http://127.0.0.1:1234/v1');
assert.strictEqual(lmSaved().selectedModelId, 'LM Studio:deepseek-r1-distill-qwen-7b');

// Nothing loaded: the current LM Studio selection is kept instead of jumping to the first model
const noneLoaded = parseLMStudioModels({
	data: [
		{ id: 'aaa-model', state: 'not-loaded' },
		{ id: 'deepseek-r1-distill-qwen-7b', state: 'not-loaded' }
	]
});
await lmSettings.syncLMStudioProvider('http://127.0.0.1:1234/v1', noneLoaded);
assert.strictEqual(lmSaved().selectedModelId, 'LM Studio:deepseek-r1-distill-qwen-7b');

// Several loaded: the current selection is kept when it is one of them
const twoLoaded = parseLMStudioModels({
	data: [
		{ id: 'aaa-model', state: 'loaded' },
		{ id: 'deepseek-r1-distill-qwen-7b', state: 'loaded' }
	]
});
await lmSettings.syncLMStudioProvider('http://127.0.0.1:1234/v1', twoLoaded);
assert.strictEqual(lmSaved().selectedModelId, 'LM Studio:deepseek-r1-distill-qwen-7b');

// Current selection not loaded: switch to the loaded model
const otherLoaded = parseLMStudioModels({
	data: [
		{ id: 'aaa-model', state: 'loaded' },
		{ id: 'deepseek-r1-distill-qwen-7b', state: 'not-loaded' }
	]
});
await lmSettings.syncLMStudioProvider('http://127.0.0.1:1234/v1', otherLoaded);
assert.strictEqual(lmSaved().selectedModelId, 'LM Studio:aaa-model');

console.log('✓ OpenAI-compatible URL normalization and LM Studio model parsing passed');
