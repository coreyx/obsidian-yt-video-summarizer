# YouTube Video Summarizer for Obsidian

Generate AI-powered summaries of YouTube videos directly in Obsidian using Gemini, OpenAI, Anthropic, and other compatible LLMs.

> [!IMPORTANT]
> **Newest Features in v1.3.0+**: Rich YAML frontmatter metadata, multimodal thumbnail text recognition (vision OCR), YouTube video description archival, smart topic & hashtag tagging, automatic note renaming, and previous note upgrading are currently in pre-release. **You must install via [BRAT](#method-2-beta-installation-via-brat-recommended-for-latest-features) to get these features (for now)** until they are approved in the official Obsidian Community Plugins store.

## Demo

![Demo](assets/demo.gif)

## Features

-   🎥 **Transcript Extraction**: Extract accurate transcripts from YouTube videos using lightweight InnerTube support.
-   🤖 **Multi-Provider AI Summaries**: Generate rich summaries using Gemini, OpenAI, Anthropic (Claude), and OpenAI/Anthropic-compatible providers (OpenRouter, Grok, Ollama, etc.).
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
5. Click **Add Plugin**. BRAT will download and install the latest release (`1.3.0`).
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

### Adding Custom AI Providers

The plugin supports adding custom AI providers that are compatible with OpenAI or Anthropic APIs.
This is useful for services like OpenRouter, Grok, or self-hosted models.

To add a custom provider, click the "Add Provider" button at the bottom of the AI Providers tab.
You'll need to specify a name for your provider, select the API compatibility type, enter your API key, and optionally set a custom API endpoint URL.

> **Examples of compatible providers**: 
> - OpenRouter has been tested with this plugin using the endpoint URL: `https://openrouter.ai/api/v1`.
> You can find your API keys at [OpenRouter Settings](https://openrouter.ai/settings/keys) and explore available models on their website.
> - Grok has been tested using the endpoint URL: `https://api.x.ai/v1`. API keys and model names can be found in the [Grok console](https://console.x.ai/).
> - Any other provider with compatible API endpoints can also be added

Custom providers can be edited or removed using the respective icons next to their names.

### Selecting the Active Model

At the top of the settings page, you can select which model will be used for generating summaries
from the "Active Model" dropdown. This dropdown shows all available models from all configured providers.

After selecting a model, it will be used for all summary operations until you change it again.

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

**Generate Semantic Topic Tags**: Uses AI semantic analysis of the generated summary to produce relevant topic tags.

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

### Method 2: Selection

1. Paste YouTube URL in note
2. Select the URL
3. Use command palette or context menu to summarize

### Method 3: Summarize with Custom Prompt

1. Copy YouTube URL
2. Open command palette (`Ctrl/Cmd + P`)
3. Search for "Summarize YouTube Video (with prompt)"
4. Paste the URL
5. Enter custom instructions in the prompt modal
6. The instructions are appended to the default prompt for this summarization only

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

- **Command Palette**: Run `Create Media Extended notes for video summaries without companion note` (`Ctrl/Cmd + P`).
- **Settings Tab**: Click **Create Missing Notes** under the *Create Media Extended notes* section.

Scans the vault for video summary notes that do not have a matching Media Extended companion note (detected by checking for `# Related` and a wikilink to the companion note), automatically creates the companion note in `Media Library/` (configurable) with timestamped transcripts, and links them bidirectionally.

### Method 7: Upgrade Notes with Tags & Description Frontmatter

- **Command Palette**: Run `Upgrade video summary notes with tags and description frontmatter` (`Ctrl/Cmd + P`).
- **Settings Tab**: Click **Upgrade Tags & Description** under the *Upgrade previous notes* section.

Identifies video summary notes that lack the `description` frontmatter property, queries YouTube metadata / Data API for creator tags and the full video description, and safely merges them into the YAML frontmatter without touching existing summaries.

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

When **Create Media Extended notes** is enabled (on by default), a companion note is automatically generated in `Media Library/` (configurable) with bidirectional linking:

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

- [01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=66#t=01:05.61) Transcript line with Media Extended playback link
- [02:02](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123#t=02:02.65) Next transcript line

# Related
- [[Original Summary Note]]
```

The summary sections are customizable via the summary prompt setting. Note body title heading (`# Title`), technical term wikilinks, frontmatter properties, topic tags, and the video description section can each be toggled on or off in the plugin settings.

## Development

For architecture documentation, technical design decisions, testing guides, and the developer Q&A log, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Support

If this plugin helps your YouTube + Obsidian workflow, consider supporting development.

❤️ [Sponsor this plugin on GitHub](https://github.com/sponsors/mbramani)

Your support helps maintain the plugin, fix bugs, improve documentation, and add new features. No pressure — starring the repo or sharing feedback also helps a lot.

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
