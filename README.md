# YouTube Video Summarizer for Obsidian

Generate AI-powered summaries of YouTube videos directly in Obsidian using Gemini, OpenAI, Anthropic, and other compatible LLMs.

> [!IMPORTANT]
> **Newest Features in v1.3.0+**: Rich YAML frontmatter metadata, multimodal thumbnail text recognition (vision OCR), YouTube video description archival, smart topic & hashtag tagging, automatic note renaming, and previous note upgrading are currently in pre-release. **You must install via [BRAT](#method-2-beta-installation-via-brat-recommended-for-latest-features) to get these features (for now)** until they are approved in the official Obsidian Community Plugins store.

## Demo

![Demo](assets/demo.gif)

## Features

-   🎥 **Transcript Extraction**: Extract accurate transcripts from YouTube videos using lightweight InnerTube support.
-   🤖 **Multi-Provider AI Summaries**: Generate rich summaries using Gemini, OpenAI, Anthropic (Claude), and OpenAI/Anthropic-compatible providers (OpenRouter, Grok, Ollama, LM Studio, etc.).
-   🏠 **LM Studio & Local OpenAI-Compatible Server Support**: One-click auto-detection for local [LM Studio](https://lmstudio.ai/) instances and full compatibility with local or self-hosted OpenAI-compatible servers (Ollama, LocalAI, vLLM, OpenRouter) with zero cloud token cost.
-   📄 **Rich YAML Frontmatter**: Automatically stores `title`, `channel_name`, `channel_username` (e.g. `@creator`), `channel_url`, `video_url`, `thumbnail`, `thumbnail_text`, `description`, and `tags`.
-   👁️ **Thumbnail Vision & Text Recognition (OCR)**: Uses multimodal vision models to transcribe visible text, titles, and overlays from the video thumbnail.
-   📝 **Video Description Preservation**: Optionally archives the creator's complete video description, timestamps, and external links directly in the note body.
-   🏷️ **Semantic Topic & YouTube Metadata Tagging**: Combines creator video tags from YouTube Data API / metadata, hashtags from the title and description, and AI topic analysis to tag notes in YAML frontmatter or inline.
-   ✏️ **Automatic Note Renaming**: Automatically renames notes using sanitized, file-system-safe YouTube video titles with collision handling.
-   🔄 **Non-Destructive Note Upgrading**: One-click upgrade for active notes or entire vaults to populate missing frontmatter on older notes without altering summaries or re-running LLM inference.
-   📜 **Full Transcript Retrieval & Timestamps**: Extract complete video transcripts with clickable YouTube timestamps and Media Extended links (`[01:05](https://www.youtube.com/watch?v=...&t=66#t=01:05.61)`), with zero AI token cost.
-   🎬 **Media Extended Companion Notes**: Automatically creates separate companion notes formatted for the [Media Extended](https://github.com/aidenlx/media-extended) plugin in a configurable folder (defaults to `Media Library`) with bidirectional wikilinks in a `# Related` section.
-   🔍 **Key Points & Technical Terms**: Automatically extracts key takeaways and links technical terms with `[[wikilinks]]`.
-   ⚙️ **Fully Customizable**: Tweak prompts, tokens, temperature, and toggle individual metadata fields to fit your workflow.

## Installation

### Method 1: Community Plugins Directory
> *Note: Community Plugins installs the current stable store release. To get the newest features (v1.3.0+), install via BRAT below.*

1. Open Obsidian **Settings**.
2. Go to **Community Plugins** and ensure **Restricted mode** is disabled.
3. Click **Browse** and search for **YouTube Video Summarizer**.
4. Click **Install**, then **Enable**.

### Method 2: Beta Installation via BRAT (Recommended for Latest Features)
> **Required for New Features (for now)**: To get rich frontmatter, thumbnail OCR vision, video description archival, topic tags, note renaming, and note upgrading, install via [Obsidian42 - BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install and enable the **Obsidian42 - BRAT** community plugin from Obsidian's Community Plugins tab.
2. In Obsidian **Settings**, select **BRAT** under Community plugins.
3. Under **Beta Plugin List**, click **Add Beta plugin**.
4. Enter the repository URL:
   ```text
   https://github.com/coreyx/obsidian-yt-video-summarizer
   ```
   *(or enter `coreyx/obsidian-yt-video-summarizer`)*
5. Click **Add Plugin**. BRAT will download and install the latest release (`1.10.0`).
6. Open **Settings** → **Community Plugins**, locate **YouTube Video Summarizer**, and toggle it **on**.

## Requirements

-   Obsidian v0.15.0+
-   API key for one of the supported LLM providers:
    -   Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))
    -   OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
    -   Anthropic API key ([Get one here](https://console.anthropic.com/settings/keys))
    -   Key for any LLM provider, offering OpenAI or Antropic compatible API

## Configuration

### Initial Setup

To start using the YouTube Video Summarizer plugin, you need to:

1. Navigate to the plugin settings by clicking on the Settings icon in Obsidian and finding "YouTube Video Summarizer" in the Community plugins section.
2. In the "AI Providers" tab, select an AI provider (Gemini, OpenAI, Anthropic, etc.) by expanding its section.
3. Enter your API key for the selected provider.
4. Choose an active model from the dropdown at the top of the settings page.

Once these steps are completed, the plugin is ready to generate summaries of YouTube videos.

### Managing AI Models

Each AI provider comes with pre-configured models, but you can add, edit, or remove models based on your needs.

You can add a new model by clicking the "Add Model" button within a provider section. You'll need to specify
the model name (technical name used by the API) and optionally a display name. For editing models,
only the display name can be modified as the model name is the technical identifier used by the API.

> **Note for OpenAI users**: Make sure that both default and custom models you use are available in your OpenAI project.
You can verify model availability in your [OpenAI dashboard](https://platform.openai.com/docs/models).

### Using LM Studio (Local LLMs with One-Click Auto-Detect)

The plugin includes native auto-detection for [LM Studio](https://lmstudio.ai/), allowing you to summarize YouTube videos completely locally and privately with **zero API costs**:

1. **Start Local Server in LM Studio**:
   - Open LM Studio and download or load your preferred model (e.g. `Qwen 2.5 Coder`, `Llama 3.2`, `Mistral 7B`).
   - Navigate to the **Developer** tab (or Local Server icon) and click **Start Server**.
   - By default, LM Studio serves on `http://localhost:1234` (or `http://127.0.0.1:1234`).
2. **Auto-Detect & Connect**:
   - In Obsidian, open **Settings** → **YouTube Video Summarizer** → **AI Providers**.
   - Under **LM Studio (Local LLM)**, verify the server URL (`http://localhost:1234/v1`) and click **Detect & Connect** (or run the command `Detect and connect local LM Studio instance` from Obsidian's Command Palette).
   - The plugin will query LM Studio's `/v1/models` endpoint, automatically register the "LM Studio" provider, import all loaded/available local models, and set the **Active Model** to your detected local model!
3. **Switching or Reloading Models**:
   - Whenever you load a different model in LM Studio, click **Refresh from LM Studio** inside the LM Studio provider accordion (or click **Detect & Connect** again) to sync the latest loaded model without re-configuring anything.

### Configuring OpenAI-Compatible Servers for Active Model

In addition to built-in frontier models (Google Gemini, OpenAI GPT, Anthropic Claude), you can configure **any OpenAI API compatible server**—both local offline runtimes and remote gateways—and select it as your **Active Model**:

| Server / Service | Provider Type | Default Base URL | API Key | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **LM Studio** | `OpenAI` | `http://localhost:1234/v1` | `not-needed` (or left blank) | Use **Detect & Connect** button for 1-click setup |
| **Ollama** | `OpenAI` | `http://localhost:11434/v1` | `not-needed` (or `ollama`) | Start Ollama and run `ollama serve` |
| **LocalAI** | `OpenAI` | `http://localhost:8080/v1` | `not-needed` | Self-hosted OpenAI-compatible REST server |
| **vLLM** | `OpenAI` | `http://localhost:8000/v1` | `not-needed` | High-throughput local LLM inference server |
| **OpenRouter** | `OpenAI` | `https://openrouter.ai/api/v1` | Your OpenRouter API key | Multi-model cloud gateway ([Get key](https://openrouter.ai/settings/keys)) |
| **Grok (xAI)** | `OpenAI` | `https://api.x.ai/v1` | Your xAI API key | xAI Grok platform ([Get key](https://console.x.ai/)) |
| **Groq** | `OpenAI` | `https://api.groq.com/openai/v1` | Your Groq API key | Ultra-low-latency LPU inference |
| **Together AI** | `OpenAI` | `https://api.together.xyz/v1` | Your Together API key | Cloud open-source models |

#### Step-by-Step Manual Setup:

1. Open Obsidian **Settings** → **YouTube Video Summarizer** → **AI Providers**.
2. Scroll to the bottom and click **Add Provider**.
3. Fill in the provider details:
   - **Provider Name**: Enter a name (e.g. `Ollama`, `LocalAI`, `OpenRouter`, `vLLM`).
   - **Provider Type**: Select **`OpenAI`**.
   - **Base URL**: Enter your server's base URL (e.g. `http://localhost:11434/v1`).
     *(Note: The plugin automatically normalizes URLs and appends `/v1` if you omit it).*
   - **API Key**: Enter your service API key. If running a local server without authentication, you can leave it blank or enter `not-needed`.
4. Click **Save Provider**.
5. Inside the newly created provider accordion, click **Add Model**:
   - **Model Name**: The technical model identifier expected by your server (e.g. `llama3.2`, `mistral`, `qwen2.5-coder-7b-instruct`).
   - **Display Name**: An optional human-friendly name (e.g. `Llama 3.2 3B Local`).
6. Scroll back to the top of the **AI Providers** tab, open the **Active Model** dropdown, and select your newly added model (e.g. `Ollama / Llama 3.2 3B Local`).
7. All subsequent YouTube summaries will now be processed by your custom OpenAI-compatible server!

### Selecting the Active Model

At the top of the **AI Providers** tab, the **Active Model** dropdown displays all available models across all configured providers:
- Built-in frontier models (`Gemini / Gemini 3.8 Flash`, `OpenAI / GPT-4o`, `Anthropic / Claude Sonnet 5.5`)
- Local LLM servers (`LM Studio / qwen2.5-coder-7b-instruct`, `Ollama / llama3.2`)
- Custom third-party cloud gateways (`OpenRouter / ...`, `Grok / ...`)

Select any model from this dropdown to make it active. All video summarization commands will use the selected active model until you switch it.

### Summary Settings

The Summary Settings tab provides several options for customizing how your video summaries are generated:

**Summary Prompt**: Allows you to customize the instructions sent to the AI model.
This is useful if you need specialized summary formats or want to focus on specific aspects of videos.

**Maximum Number of Tokens**: You can safely increase this value depending on your provider:
- For Gemini and Anthropic: Up to 8,000 tokens
- For OpenAI: Up to 16,000 tokens with gpt-4o-mini or up to 32,000 tokens with GPT-4.1 models

If the summary is truncated (i.e., it hit the token limit), the plugin appends a warning: `[Summary truncated due to max token limit. Please increase 'Max Tokens' in settings.]`

**Temperature**: Adjust this value to control how deterministic or creative your summaries will be.
Lower values (closer to 0) produce more consistent and focused summaries, while higher values introduce more creativity and variation.

**Set Note Title from Video**: Automatically renames the active note to the sanitized title of the YouTube video, ensuring safe filenames across Windows, macOS, Linux, and Obsidian wikilinks.

**Include Title in Note Body**: Includes the video title as a heading (`# Title`) in the note body. Disabled by default since the title is already preserved in the note filename and YAML frontmatter.

**Generate Wikilinks for Technical Terms**: Formats extracted technical terms with Obsidian `[[wikilinks]]` (e.g. `- **[[Term]]**: explanation`). Enabled by default. When disabled, terms are retained as bold text without wikilinks (`- **Term**: explanation`).

**Include Video Description**: Archives the complete YouTube video description, including external links, creator notes, and timestamps, under a `## Description` section in the note body.

**Add Description to Frontmatter**: Includes the full YouTube video description in the YAML frontmatter under `description: |-`. Enabled by default.

**Include Transcript in Summary Note**: Appends the full video transcript under a `## Transcript` section when generating an AI summary note. Disabled by default.

**Link Transcript Timestamps to YouTube**: Formats transcript timestamps as clickable YouTube links that open the video directly at that exact second (e.g. `[01:05](https://youtube.com/watch?v=...&t=66)`). Enabled by default.

**Format Timestamps for Media Extended**: Formats transcript timestamp links with Media Extended fragments (`#t=mm:ss.ms`, e.g. `[01:05](https://www.youtube.com/watch?v=...&t=66#t=01:05.61)`) for seamless playback integration with the Media Extended plugin. Requires timestamp linking to be enabled. Enabled by default.

**Create Media Extended Notes**: Automatically creates a separate companion note formatted for the [Media Extended](https://github.com/aidenlx/media-extended) plugin whenever a YouTube video is ingested. Enabled by default.

**Media Extended Notes Folder**: Vault folder where separate Media Extended companion notes will be created. Defaults to `"Media Library"` in the vault root.

**Generate Semantic Topic Tags**: Uses AI semantic analysis and inference with your configured AI model to infer relevant topic tags and identify obvious missing tags. When enabled, the plugin automatically indexes your entire vault's existing tag taxonomy into a compressed in-memory cache prior to inference, providing the model with your vault's existing tags and established group prefixes (e.g. `ai/`, `dev/`). The prompt strictly enforces reusing existing tags whenever semantically appropriate, formatting new tags in lowercase kebab-case, and nesting specific concepts under established group prefixes (e.g. `ai/machine-learning` instead of `ai-machine-learning`). See [AI_TAGGING.md](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/AI_TAGGING.md) for full architectural documentation. *Note: This feature is semantic and inferred, adds your vault's tag list to the AI context, and may increase the context window size and token usage.*

**Detect Tags in Video Title and Description**: Extracts creator hashtags (`#tag`) directly from the YouTube title and description and adds them to your tags.

**Extract Tags from YouTube Data API**: Extracts the complete set of creator video tags/keywords from YouTube metadata / Data API and applies them as Obsidian tags. Enabled by default.

**YouTube Data API Key (Optional)**: Optional Google Cloud YouTube Data API v3 key. When omitted, tags are extracted automatically from YouTube player metadata with no key required.

**Discover Playlist from Creator**: Automatically discovers if the video belongs to a creator playlist (via URL parameters, video description links, or YouTube Data API channel lookup) and records playlist metadata (`playlist_title`, `playlist_url`, `playlist_id`, `playlist_index`, `playlist_count`) in the YAML frontmatter and note body. Enabled by default.

**Add Tags to Frontmatter**: Inserts tags into the YAML frontmatter `tags:` property.

**Add Inline Tags**: Inserts tags inline in the note body formatted as `**Tags:** #tag1 #tag2`.

**Upgrade Previous Notes**: Scans your vault and automatically adds missing frontmatter metadata to existing YouTube notes without altering summaries, generating tags, or running AI inference.

Model pricing is displayed in the settings UI — next to each model in the provider accordions and in the active model dropdown.

## Usage

### Method 1: Command Palette

1. Copy YouTube URL
2. Open command palette (`Ctrl/Cmd + P`)
3. Search for "Summarize YouTube Video"
4. Paste URL when prompted
5. Optionally toggle the "Create Media Extended note" checkbox (inherits your permanent setting for this run without altering it)

### Method 2: Selection

1. Paste YouTube URL in note
2. Select the URL
3. Use command palette or context menu to summarize

### Method 3: Summarize with Custom Prompt

1. Copy YouTube URL
2. Open command palette (`Ctrl/Cmd + P`)
3. Search for "Summarize YouTube Video (with prompt)"
4. Paste the URL (or select URL in note)
5. Enter custom instructions in the prompt modal
6. Optionally toggle the "Create Media Extended note" checkbox (inherits your permanent setting for this run without altering it)
7. The instructions are appended to the default prompt for this summarization only


### Method 4: Retrieve Video Transcript (No AI)

1. Open command palette (`Ctrl/Cmd + P`)
2. Run `Get YouTube video transcript`
3. Paste the YouTube URL (or select a URL in your note, or run from an active note containing a URL)
4. The full transcript with clickable timestamps and Media Extended links is inserted immediately — **no AI model or API key required**!

### Method 5: Upgrade Previous Notes

If you have notes created with previous versions of the plugin that lack the new frontmatter:

- **Single Note**: Open the note and run `Upgrade current note with YouTube frontmatter` from the Command Palette (`Ctrl/Cmd + P`).
- **Specific Folder**:
  - **Context Menu**: Right-click any folder in the Obsidian File Explorer and select **Upgrade YouTube notes in this folder**.
  - **Command Palette**: Run `Upgrade YouTube notes in folder...` and search/select the desired folder.
  - **Settings Tab**: Click **Upgrade in Folder...** in the plugin settings under *Upgrade previous notes*.
- **Entire Vault**: Run `Upgrade all YouTube notes in vault` from the Command Palette, or click **Upgrade All in Vault** in the plugin settings tab.

This safely populates the new metadata (`title`, `channel_name`, `channel_username`, `channel_url`, `video_url`, `thumbnail`, and `thumbnail_text`) without altering your existing summaries, running LLM inference, or overwriting existing tags.

### Method 6: Create Missing Media Extended Notes

- **Specific Folder**:
  - **Context Menu**: Right-click any folder in the Obsidian File Explorer and select **Create missing Media Extended notes in this folder**.
  - **Command Palette**: Run `Create Media Extended notes for video summaries in folder...` and pick a folder.
  - **Settings Tab**: Click **Create in Folder...** under *Create missing Media Extended notes*.
- **Configured Folders**: In Settings, configure **Video notes folders to scan (optional)** (e.g. `YouTube, Notes/Videos`). The default command `Create Media Extended notes for video summaries without companion note` will automatically target those folders without scanning the entire vault.
- **Entire Vault**: Run `Create Media Extended notes for video summaries in entire vault` from the Command Palette, or click **Create All in Vault** in settings.

Scans the target scope (excluding notes already inside the configured Media Extended folder, default `Media Library/`) for video summary notes that do not have a matching Media Extended companion note (detected by checking for `# Related` and a wikilink to the companion note), automatically creates the companion note in `Media Library/` (configurable in settings) with timestamped transcripts, and links them bidirectionally.

### Method 7: Upgrade Notes with Tags & Description Frontmatter

- **Specific Folder**:
  - **Context Menu**: Right-click any folder in the Obsidian File Explorer and select **Upgrade video notes with tags and description in this folder**.
  - **Command Palette**: Run `Upgrade video summary notes with tags and description in folder...` and pick a folder.
  - **Settings Tab**: Click **Upgrade Tags & Description in Folder...** under *Upgrade tags & description frontmatter*.
- **Configured Folders**: In Settings, configure **Video notes folders to scan (optional)**. The default command `Upgrade video summary notes with tags and description frontmatter` will automatically target those folders without scanning the entire vault.
- **Entire Vault**: Run `Upgrade video summary notes with tags and description in entire vault` from the Command Palette, or click **Upgrade Tags & Description in Vault** in settings.

Identifies video summary notes in the selected scope that lack the `description` frontmatter property, queries YouTube metadata / Data API for creator tags and the full video description, and safely merges them into the YAML frontmatter without touching existing summaries.

### Method 8: Upgrade Notes with Playlist from YouTube Data API

- **Specific Folder**:
  - **Context Menu**: Right-click any folder in the Obsidian File Explorer and select **Upgrade video notes with playlist in this folder**.
  - **Command Palette**: Run `Upgrade video summary notes with playlist in folder...` and pick a folder.
  - **Settings Tab**: Click **Upgrade in Folder...** under *Upgrade playlist frontmatter*.
- **Configured Folders**: In Settings, configure **Video notes folders to scan (optional)**. The default command `Upgrade video summary notes with playlist from YouTube Data API` will automatically target those folders without scanning the entire vault.
- **Entire Vault**: Run `Upgrade video summary notes with playlist in entire vault` from the Command Palette, or click **Upgrade All in Vault** under *Upgrade playlist frontmatter* in settings.

Identifies video summary notes in the selected scope that lack `playlist_` frontmatter properties (`playlist_title`, `playlist_url`, `playlist_id`, etc.), queries YouTube Data API to check whether each video belongs to a creator playlist (via URL parameters, description playlist links, or channel playlists), and safely merges the playlist metadata into the YAML frontmatter without touching existing summaries or tags.

### Method 9: Connect or Refresh LM Studio (Local LLMs)

- **Command Palette**: Run `Detect and connect local LM Studio instance` (`Ctrl/Cmd + P`).
- **Settings Tab**: Open **AI Providers** → **LM Studio (Local LLM)** and click **Detect & Connect**.
- **Provider Accordion**: Click **Refresh from LM Studio** inside the LM Studio provider card.

Automatically connects to your local LM Studio instance (`http://localhost:1234/v1` or `http://127.0.0.1:1234/v1`), detects loaded/available local models, updates the LM Studio provider, and sets the active model for 100% private, free summarization.

## Output Format

The plugin generates structured notes with comprehensive YAML frontmatter and markdown sections:

```markdown
---
title: "Video Title"
channel_name: "Channel Name"
channel_username: "@channel"
channel_url: "https://www.youtube.com/@channel"
video_url: "https://www.youtube.com/watch?v=VIDEO_ID"
thumbnail: "https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg"
thumbnail_text: "TEXT EXTRACTED FROM THUMBNAIL"
playlist_title: "Series Playlist Title"
playlist_url: "https://www.youtube.com/playlist?list=PLAYLIST_ID"
playlist_id: "PLAYLIST_ID"
playlist_index: 3
playlist_count: 12
description: |-
  Full video description and timestamps...
tags:
  - topic-one
  - topic-two
---

![Video thumbnail](https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg)

👤 [Channel Name](channel-url)  🔗 [Watch video](video-url)  📋 [Playlist: Series Playlist Title (3/12)](playlist-url)

## Summary
[Summary of the video content...]

## Key points
- [Key point 1]
- [Key point 2]

## Technical terms
- **[[Term]]**: [Definition]

## Conclusion
[Brief takeaway...]

## Description
[Original YouTube video description and external links...]

# Related

- [[Media Library/Video Title]]
```

### Media Extended Companion Note Format

When **Create Media Extended notes** is enabled (on by default), a companion note is automatically generated in `Media Library/` (configurable) with bidirectional linking, structured section headings (`# Description`, `# Transcript`, `# Related`), and empty lines before content:

```markdown
---
mx-uid: vcxchy79gecb4s69v25oxq9s
video: https://www.youtube.com/watch?v=dQw4w9WgXcQ
title: "Video Title"
description: |-
  Complete video description...
duration: 214
creator: Channel Name
published_at: 2009-10-25
view_count: 1818745023
like_count: 19404514
cover: "[[mx-cover-youtube_dQw4w9WgXcQ.jpg]]"
aspect_ratio: 427 / 240
---

# Description

Welcome to this video tutorial! Check out the chapter timestamps below:
- [0:00](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0#t=00:00.00) Introduction
- [01:23](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=83#t=01:23.00) Getting Started
- [04:15](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=255#t=04:15.00) Deep Dive

# Transcript

- [01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=66#t=01:05.61) Transcript line with Media Extended playback link
- [02:02](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123#t=02:02.65) Next transcript line

# Related

- [[Original Summary Note]]
```

The summary sections are customizable via the summary prompt setting. Note body title heading (`# Title`), technical term wikilinks, frontmatter properties, topic tags, video description in companion notes (with automatic timestamp conversion), and the video description section can each be toggled on or off in the plugin settings.

## Development

For architecture documentation, technical design decisions, testing guides, and the developer Q&A log, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Support

If this plugin helps your YouTube + Obsidian workflow, consider supporting development.

❤️ [Sponsor this plugin on GitHub](https://github.com/sponsors/mbramani)

Your support helps maintain the plugin, fix bugs, improve documentation, and add new features. No pressure — starring the repo or sharing feedback also helps a lot.

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
