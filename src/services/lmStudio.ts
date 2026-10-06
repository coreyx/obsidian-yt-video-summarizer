import { requestUrl } from 'obsidian';

export interface LMStudioModelInfo {
    id: string;
    displayName: string;
    isLoaded?: boolean;
}

export interface LMStudioDetectionResult {
    success: boolean;
    url: string;
    models: LMStudioModelInfo[];
    error?: string;
}

/**
 * Normalizes an OpenAI-compatible base URL.
 * Ensures that the URL has protocol, strips trailing slashes, and appends /v1 if missing.
 */
export function normalizeOpenAIBaseUrl(rawUrl: string): string {
    let clean = (rawUrl || '').trim();
    if (!clean) {
        return 'http://localhost:1234/v1';
    }

    // If user omitted protocol (e.g. "localhost:1234" or "127.0.0.1:1234")
    if (!/^https?:\/\//i.test(clean)) {
        clean = `http://${clean}`;
    }

    clean = clean.replace(/\/+$/, '');

    // If it doesn't already end with /v1 (or /v1beta, etc.)
    if (!/\/v\d+([a-z0-9_-]+)?$/i.test(clean)) {
        clean = `${clean}/v1`;
    }

    return clean;
}

/**
 * Derives LM Studio's native REST model-list endpoint from an OpenAI-compatible base URL.
 * Unlike /v1/models, it reports each model's load state and type.
 */
export function getLMStudioNativeModelsUrl(baseUrl: string): string {
    return `${baseUrl.replace(/\/v\d+([a-z0-9_-]+)?$/i, '')}/api/v0/models`;
}

/**
 * Parses model objects from an LM Studio /api/v0/models or OpenAI-compatible /v1/models response.
 * Handles LM Studio extensions (state: 'loaded', type: 'embeddings') and standard OpenAI format.
 */
export function parseLMStudioModels(responseData: any): LMStudioModelInfo[] {
    if (!responseData) return [];

    const rawList = Array.isArray(responseData)
        ? responseData
        : Array.isArray(responseData.data)
            ? responseData.data
            : [];

    const models: LMStudioModelInfo[] = [];

    for (const item of rawList) {
        if (!item) continue;
        const id = typeof item === 'string' ? item : item.id || item.name;
        if (!id || typeof id !== 'string') continue;

        // Embedding models can't generate summaries
        if (item.type === 'embeddings' || item.type === 'embedding') continue;

        const isLoaded = item.state === 'loaded' || item.loaded === true;
        const displayName = item.displayName || item.name || id;

        models.push({
            id: id.trim(),
            displayName: String(displayName).trim(),
            isLoaded
        });
    }

    // Sort loaded models to the top
    models.sort((a, b) => {
        if (a.isLoaded && !b.isLoaded) return -1;
        if (!a.isLoaded && b.isLoaded) return 1;
        return a.displayName.localeCompare(b.displayName);
    });

    return models;
}

/**
 * Fetches a model-list endpoint as JSON.
 * `reachable` is false when no HTTP response came back at all (server down or wrong host).
 */
async function fetchModelsJson(endpoint: string): Promise<{ data: any; reachable: boolean; error?: string }> {
    let data: any = null;
    let reachable = false;
    let error: string | undefined;

    // Attempt via Obsidian's requestUrl first (bypasses CORS in Electron / Mobile)
    if (typeof requestUrl === 'function') {
        try {
            const response = await requestUrl({
                url: endpoint,
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                throw: false
            });
            reachable = true;
            if (response.status === 200) {
                data = response.json;
            } else {
                error = `HTTP ${response.status} from ${endpoint}`;
            }
        } catch (reqErr: any) {
            error = reqErr?.message || String(reqErr);
        }
    }

    // Fallback to standard fetch if requestUrl wasn't available or didn't return data
    if (!data && typeof fetch === 'function') {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            reachable = true;
            if (response.ok) {
                data = await response.json();
            } else {
                error = `HTTP ${response.status} from ${endpoint}`;
            }
        } catch (fetchErr: any) {
            error = fetchErr?.message || String(fetchErr);
        }
    }

    return { data, reachable, error };
}

/**
 * Detects an LM Studio instance and fetches the list of available/loaded models.
 * Tries the primary URL first and automatically falls back between localhost and 127.0.0.1.
 */
export async function detectLMStudioServer(targetUrl?: string): Promise<LMStudioDetectionResult> {
    const primaryUrl = normalizeOpenAIBaseUrl(targetUrl || 'http://localhost:1234/v1');

    // Generate candidate URLs (handling localhost vs 127.0.0.1)
    const candidateUrls: string[] = [primaryUrl];
    if (primaryUrl.includes('localhost')) {
        candidateUrls.push(primaryUrl.replace('localhost', '127.0.0.1'));
    } else if (primaryUrl.includes('127.0.0.1')) {
        candidateUrls.push(primaryUrl.replace('127.0.0.1', 'localhost'));
    }

    let lastError: string | undefined;

    for (const url of candidateUrls) {
        try {
            // LM Studio's native endpoint is the only one that says which model is loaded;
            // /v1/models lists every downloaded model with no state.
            const native = await fetchModelsJson(getLMStudioNativeModelsUrl(url));
            if (native.data) {
                const models = parseLMStudioModels(native.data);
                if (models.length > 0) {
                    return {
                        success: true,
                        url,
                        models
                    };
                }
            }
            if (!native.reachable) {
                lastError = native.error;
                continue;
            }

            // Older LM Studio versions and other OpenAI-compatible servers
            const openai = await fetchModelsJson(`${url}/models`);
            if (openai.data) {
                return {
                    success: true,
                    url,
                    models: parseLMStudioModels(openai.data)
                };
            }
            lastError = openai.error || native.error;
        } catch (err: any) {
            lastError = err?.message || String(err);
        }
    }

    return {
        success: false,
        url: primaryUrl,
        models: [],
        error: lastError || 'Server unreachable or not responding'
    };
}
