# Release Notes - YouTube Video Summarizer v1.5.0

## Highlights

YouTube Video Summarizer v1.5.0 brings a comprehensive model upgrade for **Anthropic Claude** and **OpenAI**, alongside a universal retirement cleanup and auto-migration system across all built-in providers:

* 🧠 **Anthropic Claude 5.5 & 5.1 Generation**: Support for **Claude Sonnet 5.5** (new Anthropic recommended default), **Claude Opus 5.5**, **Claude Fable 5.1**, **Claude Sonnet 5**, and **Claude Opus 5**.
* ⚡ **OpenAI GPT-6 & GPT-5.6 Series**: Added **GPT-6 (Astra)** and the **GPT-5.6 series** (**Sol**, **Terra**, **Luna**) alongside existing multimodal and reasoning models.
* 🛡️ **Universal Model Retirement & Auto-Migration**: Cleanly retired obsolete endpoints across Anthropic, OpenAI, and Gemini. If a user previously selected a shut-down model, it automatically migrates to a working model on startup to prevent API call failures.
* 📁 **Folder-Targeted Note Upgrades**: Upgrade previous YouTube notes within any selected folder and its subfolders via right-click File Explorer context menu or interactive Command Palette search.
* 🤖 **Gemini 3.8 Series**: Full support for Google's latest **Gemini 3.8 Flash** (plugin default), **Gemini 3.5**, and **Gemini 3.1** series.

---

## What's New in v1.5.0

### 🧠 Anthropic Claude 5.5 & 5.1 Generation
* **`claude-sonnet-5-5` (Claude Sonnet 5.5, Recommended)**: Flagship model offering the best combination of reasoning intelligence, speed, and vision text recognition (`Input $2.00 / Output $10.00 per 1M tokens`).
* **`claude-opus-5-5`**: Heavyweight reasoning model for complex knowledge extraction and long-running agentic tasks (`Input $4.00 / Output $20.00 per 1M tokens`).
* **`claude-fable-5-1`**: Demanding reasoning and long-horizon analysis (`Input $10.00 / Output $50.00 per 1M tokens`).
* **`claude-sonnet-5` & `claude-opus-5`**: Core 5.0 generation models.
* **`claude-haiku-4-5`**: Fast and economical (`Input $1.00 / Output $5.00 per 1M tokens`).
* **Retirement Cleanup**:
  * Removed `claude-sonnet-4-20250514` and `claude-opus-4-20250514` following their official retirement on June 15, 2026.
  * Cleaned up deprecated legacy Claude 3/3.5 endpoints.

### ⚡ OpenAI GPT-6 & GPT-5.6 Series
* **`gpt-6` (Astra)**: OpenAI's newest flagship reasoning model (`Input $10.00 / Output $50.00 per 1M tokens`).
* **`gpt-5.6` (Sol)**: Fast, high-intelligence model (`Input $4.00 / Output $20.00 per 1M tokens`).
* **`gpt-5.6-terra`**: Balanced performance and cost tier (`Input $2.00 / Output $12.00 per 1M tokens`).
* **`gpt-5.6-luna`**: High-throughput, cost-efficient model (`Input $0.20 / Output $1.20 per 1M tokens`).
* **Retirement Cleanup**:
  * Automatically prunes retired legacy endpoints (`gpt-4-vision-preview`, `gpt-4-0314`, `gpt-4-0613`, etc.).

### 🛡️ Cross-Provider Auto-Migration
* Settings manager checks the built-in provider model lists upon loading.
* If a previously saved configuration had an active model that was retired, it is automatically migrated to `Gemini:gemini-3.8-flash` to prevent API failures while keeping custom/user-added models completely untouched.

---

## Installation via BRAT

1. In Obsidian, open **Settings > Community plugins**.
2. Install and enable the **BRAT** (Beta Reviewers Auto-update Tester) plugin.
3. Open BRAT settings and click **Add Beta plugin**.
4. Enter the repository URL: `https://github.com/coreyx/obsidian-yt-video-summarizer`
5. Click **Add Plugin**, then enable **YouTube Video Summarizer** in Community plugins.
