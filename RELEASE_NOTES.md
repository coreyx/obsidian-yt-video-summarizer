# Release Notes - YouTube Video Summarizer v1.4.0

## Highlights

YouTube Video Summarizer v1.4.0 brings folder-targeted note upgrades, the latest Google Gemini 3.x model generation, and graceful model retirement with automatic migration:

* 📁 **Folder-Targeted Note Upgrades**: Upgrade all YouTube notes within any selected folder and its subfolders via right-click File Explorer context menu or interactive Command Palette search.
* 🤖 **Updated Gemini 3.x Lineup**: Added Google's latest flagship models, including **Gemini 3.8 Flash** (new recommended default), **Gemini 3.5 Flash**, **Gemini 3.5 Flash-Lite**, **Gemini 3.1 Pro**, and **Gemini 3.1 Flash-Lite**.
* 🛡️ **Model Retirement & Auto-Migration**: Cleanly retired shut down models (`gemini-2.0-flash` and `gemini-2.0-flash-lite`), automatically pruning them from settings and migrating active configurations to `gemini-3.8-flash` to prevent API errors.
* 📄 **Rich YAML Frontmatter**: Automatically populates note frontmatter with video title, channel name, channel username/handle, channel URL, video URL, thumbnail URL, vision OCR text, and topic tags.
* 👁️ **Multimodal Thumbnail Text Recognition**: Concurrently transcribes text overlays and headlines directly from video thumbnails into `thumbnail_text`.
* 📝 **Video Description Preservation**: Preserves the complete YouTube video description and external links directly in the note body under `## Description`.

---

## What's New in v1.4.0

### 📁 Folder-Targeted Note Upgrades
Easily re-process and upgrade existing notes within any specific directory in your vault:
* **Context Menu**: Right-click any folder in the Obsidian File Explorer and select **Upgrade YouTube notes in this folder**.
* **Command Palette**: Run **`Upgrade YouTube notes in folder...`** (`Ctrl/Cmd + P`) and use fuzzy search to pick any folder in your vault.
* **Settings Tab**: Convenient **`Upgrade in Folder...`** button next to **`Upgrade All in Vault`**.
* **Non-Destructive & Safe**: Only inspects notes missing frontmatter properties, strictly avoiding re-generating summaries, running LLM text inference, or touching existing tags.

### 🤖 Gemini 3.x Series & Model Retirement
* **`gemini-3.8-flash` (New Default)**: Flagship production model optimized for speed, long-horizon software engineering, agentic workflows, and vision text recognition.
* **`gemini-3.5-flash`**: Balanced price-performance model for multimodal summarization.
* **`gemini-3.5-flash-lite`**: High-efficiency, cost-effective model designed for high-throughput tasks.
* **`gemini-3.1-pro`**: Advanced reasoning model for complex or deep technical video content.
* **`gemini-3.1-flash-lite`**: Lightweight, low-latency multimodal model.
* **`gemini-3-pro-preview`**: Frontier preview model for complex reasoning and large context windows.
* **Automatic Retirement & Migration**:
  * Removed `gemini-2.0-flash` and `gemini-2.0-flash-lite` following Google's official service shutdown on June 1, 2026.
  * Settings manager automatically prunes retired models and migrates any previously selected retired model to `Gemini:gemini-3.8-flash`.

### 🧠 Anthropic Claude 5.5 & 5.1 Generation
* **New Flagships**:
  * `claude-sonnet-5-5` (Claude Sonnet 5.5, Recommended): Best combination of speed, reasoning intelligence, and multimodal vision.
  * `claude-opus-5-5`: Flagship model for complex knowledge work and long-running agentic tasks.
  * `claude-fable-5-1`: Specialized high-reasoning model for demanding analysis.
  * `claude-sonnet-5` & `claude-opus-5`: 5.0 generation flagships.
* **Retirement & Cleanup**:
  * Retired `claude-sonnet-4-20250514` and `claude-opus-4-20250514` (retired June 15, 2026) and deprecated Claude 3/3.5 endpoints.
  * Automatic pruning and migration in settings to prevent API failures.

### ⚡ OpenAI GPT-6 & GPT-5.6 Series
* **New Frontier Models**:
  * `gpt-6` (Astra): OpenAI's newest flagship reasoning model.
  * `gpt-5.6` (Sol), `gpt-5.6-terra`, and `gpt-5.6-luna`: Next-generation tier models balancing high reasoning and low cost.
* **Retirement & Cleanup**:
  * Automated pruning of retired, obsolete legacy models (`gpt-4-vision-preview`, `gpt-4-0314`, `gpt-4-0613`, etc.) with safe migration.

---

## Installation via BRAT

1. In Obsidian, open **Settings > Community plugins**.
2. Install and enable the **BRAT** (Beta Reviewers Auto-update Tester) plugin.
3. Open BRAT settings and click **Add Beta plugin**.
4. Enter the repository URL: `https://github.com/coreyx/obsidian-yt-video-summarizer`
5. Click **Add Plugin**, then enable **YouTube Video Summarizer** in Community plugins.
