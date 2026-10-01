# Release Notes - YouTube Video Summarizer v1.5.1

## Highlights

YouTube Video Summarizer v1.5.1 resolves an issue with OpenAI models where API calls failed with the error `"max_tokens is not supported with this model, use 'max_completion_tokens' instead"`.

* 🛠️ **OpenAI `max_completion_tokens` Migration**: Updated all OpenAI chat completion requests (`summarizeVideo`, `extractThumbnailText`, `generateTopics`) to use `max_completion_tokens` as required by OpenAI reasoning models and modern completions.
* 🧠 **Reasoning Model Parameter Safety**: Reasoning models (`o1`, `o3-mini`, `o4-mini`, etc.) strictly reject `temperature`; this parameter is now automatically omitted for reasoning models to prevent API errors.
* 🔄 **Custom Server / Proxy Fallback**: Built-in automatic fallback retries with `max_tokens` if a custom or older OpenAI-compatible proxy rejects `max_completion_tokens`.
* 🔒 **Provider Isolation**: Ensured Anthropic Claude and Google Gemini providers remain untouched, using their appropriate native parameters.

---

## What's Changed in v1.5.1

### 🛠️ OpenAI Model Parameter Fixes
* **Resolved `max_tokens` Deprecation**: Modern OpenAI models (including `o1`, `o3-mini`, `o4-mini`, and recent GPT completions) require `max_completion_tokens` instead of `max_tokens`. All OpenAI completion endpoints have been updated.
* **Reasoning Temperature Handling**: OpenAI reasoning models throw an error when passed a `temperature` parameter. The provider now inspects the active model and omits `temperature` for reasoning models while preserving user-configured temperature for standard models.
* **Backward-Compatible Proxy Fallback**: Added helper logic to intercept proxy/server rejection of `max_completion_tokens` and seamlessly fall back to `max_tokens`.

---

## Installation via BRAT

1. In Obsidian, open **Settings > Community plugins**.
2. Install and enable the **BRAT** (Beta Reviewers Auto-update Tester) plugin.
3. Open BRAT settings and click **Add Beta plugin**.
4. Enter the repository URL: `https://github.com/coreyx/obsidian-yt-video-summarizer`
5. Click **Add Plugin**, then enable **YouTube Video Summarizer** in Community plugins.
