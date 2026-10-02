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
 * Parses model objects from an OpenAI-compatible /v1/models response.
 * Handles LM Studio extensions (such as state: 'loaded') and standard OpenAI format.
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
        const endpoint = `${url}/models`;
        try {
            let data: any = null;

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
                    if (response.status === 200) {
                        data = response.json;
                    } else {
                        lastError = `HTTP ${response.status} from ${endpoint}`;
                    }
                } catch (reqErr: any) {
                    lastError = reqErr?.message || String(reqErr);
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
                    if (response.ok) {
                        data = await response.json();
                    } else {
                        lastError = `HTTP ${response.status} from ${endpoint}`;
                    }
                } catch (fetchErr: any) {
                    lastError = fetchErr?.message || String(fetchErr);
                }
            }

            if (data) {
                const models = parseLMStudioModels(data);
                return {
                    success: true,
                    url,
                    models
                };
            }
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
