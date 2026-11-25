// AI provider helpers: topic tag parsing, OpenAI request settings, and LM Studio.
import assert from 'node:assert';
import { loadSource } from './helpers/loadSource.mjs';

// Test 6: Topics parsing from LLM response
const { getLMStudioNativeModelsUrl, normalizeOpenAIBaseUrl, parseLMStudioModels } = await loadSource('src/services/lmStudio.ts');

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

// Test 25: OpenAI-compatible URL normalization, LM Studio model parsing & provider sync
console.log('Testing OpenAI-compatible URL normalization and LM Studio model parsing...');




function testSyncLMStudioProvider(settings, url, models) {
	const normalizedUrl = normalizeOpenAIBaseUrl(url);
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
const updatedModels = parseLMStudioModels(updatedResp);
const resyncResult = testSyncLMStudioProvider(testSettings, 'http://127.0.0.1:1234/v1', updatedModels);
assert.strictEqual(testSettings.providers.length, 2); // still 2 providers
assert.strictEqual(resyncResult.modelCount, 1);
assert.strictEqual(testSettings.providers[1].url, 'http://127.0.0.1:1234/v1');
assert.strictEqual(testSettings.selectedModelId, 'LM Studio:deepseek-r1-distill-qwen-7b');

// Nothing loaded: the current LM Studio selection is kept instead of jumping to the first model
const noneLoaded = parseLMStudioModels({
	data: [
		{ id: 'aaa-model', state: 'not-loaded' },
		{ id: 'deepseek-r1-distill-qwen-7b', state: 'not-loaded' }
	]
});
testSyncLMStudioProvider(testSettings, 'http://127.0.0.1:1234/v1', noneLoaded);
assert.strictEqual(testSettings.selectedModelId, 'LM Studio:deepseek-r1-distill-qwen-7b');

// Several loaded: the current selection is kept when it is one of them
const twoLoaded = parseLMStudioModels({
	data: [
		{ id: 'aaa-model', state: 'loaded' },
		{ id: 'deepseek-r1-distill-qwen-7b', state: 'loaded' }
	]
});
testSyncLMStudioProvider(testSettings, 'http://127.0.0.1:1234/v1', twoLoaded);
assert.strictEqual(testSettings.selectedModelId, 'LM Studio:deepseek-r1-distill-qwen-7b');

// Current selection not loaded: switch to the loaded model
const otherLoaded = parseLMStudioModels({
	data: [
		{ id: 'aaa-model', state: 'loaded' },
		{ id: 'deepseek-r1-distill-qwen-7b', state: 'not-loaded' }
	]
});
testSyncLMStudioProvider(testSettings, 'http://127.0.0.1:1234/v1', otherLoaded);
assert.strictEqual(testSettings.selectedModelId, 'LM Studio:aaa-model');

console.log('✓ OpenAI-compatible URL normalization and LM Studio model parsing passed');
