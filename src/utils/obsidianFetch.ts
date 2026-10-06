import { requestUrl } from 'obsidian';

// Headers the platform sets itself; passing them through requestUrl can make the request fail
const SKIPPED_REQUEST_HEADERS = new Set(['content-length', 'content-type', 'host', 'connection']);

// Statuses for which the Response constructor rejects a body
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

/**
 * A fetch() implementation backed by Obsidian's requestUrl, which is not subject to CORS.
 * Local servers (LM Studio, Ollama, LocalAI) don't send CORS headers for app://obsidian.md
 * by default, so the browser fetch used by the provider SDKs gets blocked on preflight.
 * Responses are buffered, so this does not support streaming.
 */
export async function obsidianFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    const headers: Record<string, string> = {};
    let contentType: string | undefined;
    new Headers(init?.headers).forEach((value, key) => {
        if (key === 'content-type') {
            contentType = value;
        }
        if (!SKIPPED_REQUEST_HEADERS.has(key)) {
            headers[key] = value;
        }
    });

    const signal = init?.signal ?? undefined;
    if (signal?.aborted) {
        throw new DOMException('The request was aborted.', 'AbortError');
    }

    const body = init?.body;
    const request = requestUrl({
        url,
        method: init?.method ?? 'GET',
        headers,
        contentType,
        body: typeof body === 'string' || body instanceof ArrayBuffer ? body : undefined,
        throw: false
    });

    // requestUrl can't be cancelled, so on abort stop waiting for it instead
    const response = await (signal
        ? Promise.race([
            request,
            new Promise<never>((_, reject) => {
                signal.addEventListener(
                    'abort',
                    () => reject(new DOMException('The request was aborted.', 'AbortError')),
                    { once: true }
                );
            })
        ])
        : request);

    return new Response(NULL_BODY_STATUSES.has(response.status) ? null : response.arrayBuffer, {
        status: response.status,
        headers: response.headers
    });
}
