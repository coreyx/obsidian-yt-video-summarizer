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
-   📄 **Rich YAML Frontmatter**: Automatically stores `title`, `channel_name`, `channel_username` (e.g. `@creator`), `channel_url`, `video_url`, `thumbnail`, `thumbnail_text`, `duration` (seconds), `published_at`, `view_count`, `like_count`, `aspect_ratio`, `description`, and `tags`. Video stats are included when YouTube provides them. Every summary note also gets `watch_later` and `favorite` checkbox properties (unticked) for you to use.
-   👁️ **Thumbnail Vision & Text Recognition (OCR)**: Uses multimodal vision models to transcribe visible text, titles, and overlays from the video thumbnail.
-   📝 **Video Description Preservation**: Stores the creator's complete video description in frontmatter, and on demand adds it to the note body with every timestamp converted into a clickable link to that moment in the video.
-   🏷️ **Semantic Topic & YouTube Metadata Tagging**: Combines creator video tags from YouTube Data API / metadata, hashtags from the title and description, and AI topic analysis to tag notes in YAML frontmatter or inline.
-   ✏️ **Automatic Note Renaming**: Automatically renames notes using sanitized, file-system-safe YouTube video titles with collision handling.
-   🔄 **Non-Destructive Metadata Refresh**: Re-fetch video details for one note or a whole folder to bring frontmatter up to date without altering summaries or tags, and without running any AI model.
-   📜 **Full Transcript Retrieval & Timestamps**: Extract complete video transcripts with clickable timestamps, with zero AI token cost. Video summary notes use standard YouTube links (`[01:05](https://www.youtube.com/watch?v=...&t=65s)`); Media Extended companion notes use Media Extended playback links (`[01:05](https://www.youtube.com/watch?v=...&t=66#t=01:05.61)`).
-   🎬 **Media Extended Companion Notes (Optional)**: Can create separate companion notes formatted for the [Media Extended](https://github.com/aidenlx/media-extended) plugin in a configurable folder (defaults to `Media Library`) with bidirectional wikilinks in a `# Related` section. Off by default; Media Extended is not required for anything else.
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
-   Optional: the [Media Extended](https://github.com/aidenlx/media-extended) plugin, only if you want to play videos inside Obsidian from Media Extended companion notes. The plugin works fully without it.

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
   - The plugin will query LM Studio's `/api/v0/models` endpoint (falling back to `/v1/models`), automatically register the "LM Studio" provider, import all loaded/available local models, and set the **Active Model** to the model currently loaded in LM Studio!
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

### Settings Tabs

Settings are organized into five tabs: **AI Providers** (above), **Summary**, **Media Extended**, **Tags & Metadata**, and **Maintenance**.

### Summary

The Summary tab controls how summaries are generated and where summary notes go.

**Summary Prompt**: Allows you to customize the instructions sent to the AI model.
This is useful if you need specialized summary formats or want to focus on specific aspects of videos.

**Maximum Number of Tokens**: You can safely increase this value depending on your provider:
- For Gemini and Anthropic: Up to 8,000 tokens
- For OpenAI: Up to 16,000 tokens with gpt-4o-mini or up to 32,000 tokens with GPT-4.1 models

If the summary is truncated (i.e., it hit the token limit), the plugin appends a warning: `[Summary truncated due to max token limit. Please increase 'Max Tokens' in settings.]`

**Temperature**: Adjust this value to control how deterministic or creative your summaries will be.
Lower values (closer to 0) produce more consistent and focused summaries, while higher values introduce more creativity and variation.

**Generate Wikilinks for Technical Terms**: Formats extracted technical terms with Obsidian `[[wikilinks]]` (e.g. `- **[[Term]]**: explanation`). Enabled by default. When disabled, terms are retained as bold text without wikilinks (`- **Term**: explanation`).

**Video Summaries Folder**: Default / fallback folder for new video summary notes, used when you summarize from a note that already has content or frontmatter. Defaults to `Video Summaries` in the vault root.

**Set Note Title from Video**: When summarizing into a blank note, automatically renames it to the sanitized title of the YouTube video, ensuring safe filenames across Windows, macOS, Linux, and Obsidian wikilinks. New notes created in the video summaries folder are always named after the video.

**Include Title in Note Body**: Includes the video title as a heading (`# Title`) in the note body. Disabled by default since the title is already preserved in the note filename and YAML frontmatter.

**Include Transcript in Summary Note**: Appends the full video transcript under a `## Transcript` section when generating an AI summary note, with each timestamp linked to the video (e.g. `[01:05](https://www.youtube.com/watch?v=...&t=65s)`). Disabled by default.

**Timestamp links**: Every timestamp written to a video summary note (transcript, description, or AI summary) is linked to the original YouTube video in standard YouTube format (`&t=SECONDSs`). Every timestamp written to a Media Extended companion note is linked in Media Extended format (`&t=SECONDS#t=mm:ss.ms`).

### Media Extended

Everything about the optional [Media Extended](https://github.com/aidenlx/media-extended) companion notes lives in this tab. **Media Extended is not required**: this plugin never calls it, the companion notes are regular Markdown, and their timestamp links open in your browser when Media Extended isn't installed. The tab shows whether Media Extended is installed and enabled, with a button to open its page in Community plugins.

**Create Media Extended Notes**: Automatically creates a separate companion note formatted for the [Media Extended](https://github.com/aidenlx/media-extended) plugin whenever a YouTube video is ingested. **Disabled by default.** When you turn it on and Media Extended isn't installed (or is disabled), you're asked whether to open its page in Community plugins; the setting stays on either way. You can also choose per video in the summary popup.

**Media Extended Notes Folder**: Vault folder where separate Media Extended companion notes will be created. Defaults to `"Media Library"` in the vault root.

**Embed Cover in Media Extended Notes**: Adds the video cover as an inline image (`![Cover](https://i.ytimg.com/...)`) at the top of the body of new Media Extended companion notes, using the same URL as the `cover` frontmatter. Enabled by default.

**Include Description in Media Extended Note**: Includes the video description under `# Description` in the companion note, with timestamps converted into Media Extended playback links. Enabled by default.

**Include Transcript in Media Extended Note**: Includes the timestamped transcript under `# Transcript` in the companion note. Enabled by default.

**Create Missing Media Extended Notes**: Buttons to create companion notes for existing video summary notes in a folder or the whole vault.

### Tags & Metadata

**Generate Semantic Topic Tags**: Uses AI semantic analysis and inference with your configured AI model to infer relevant topic tags and identify obvious missing tags. When enabled, the plugin automatically indexes your entire vault's existing tag taxonomy into a compressed in-memory cache prior to inference, providing the model with your vault's existing tags and established group prefixes (e.g. `ai/`, `dev/`). The prompt strictly enforces reusing existing tags whenever semantically appropriate, formatting new tags in lowercase kebab-case, and nesting specific concepts under established group prefixes (e.g. `ai/machine-learning` instead of `ai-machine-learning`). See [AI_TAGGING.md](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/AI_TAGGING.md) for full architectural documentation. *Note: This feature is semantic and inferred, adds your vault's tag list to the AI context, and may increase the context window size and token usage.*

**Detect Tags in Video Title and Description**: Extracts creator hashtags (`#tag`) directly from the YouTube title and description and adds them to your tags.

**Extract Tags from YouTube Data API**: Extracts the complete set of creator video tags/keywords from YouTube metadata / Data API and applies them as Obsidian tags. Enabled by default.

**Add Tags to Frontmatter**: Inserts tags into the YAML frontmatter `tags:` property.

**Add Inline Tags**: Inserts tags inline in the note body formatted as `**Tags:** #tag1 #tag2`.

**Add Description to Frontmatter**: Includes the full YouTube video description in the YAML frontmatter under `description: |-`. Enabled by default.

**Use Frontmatter Description When Adding Description to Body**: When running `Add description to video summary note` or `Add description to Media Extended note`, copy the note's frontmatter description into the body instead of fetching it from YouTube; falls back to fetching when it's missing or empty. Enabled by default.

**Discover Playlist from Creator**: Automatically discovers if the video belongs to a creator playlist (via URL parameters, video description links, or YouTube Data API channel lookup) and records playlist metadata (`playlist_title`, `playlist_url`, `playlist_id`, `playlist_index`, `playlist_count`) in the YAML frontmatter and note body. Enabled by default.

**YouTube Data API Key (Optional)**: Optional Google Cloud YouTube Data API v3 key. When omitted, tags are extracted automatically from YouTube player metadata with no key required.

### Maintenance

Batch tools for notes you already have, plus the report from the last batch run. These never re-generate summaries.

**Refresh Video Metadata**: Re-fetches video details for every video summary and Media Extended note in a folder you pick (see Method 9).

**Batch Operation Status & Logs**: Summary of the last batch run, with a button to open the full report (see Method 7).

Model pricing is displayed in the settings UI — next to each model in the provider accordions and in the active model dropdown.

## Usage

**Where the summary goes**: Run the summarizer from a **blank note** and the summary is written into that note. A note also counts as blank when its name starts with "Untitled", it has no body, and its only frontmatter is `tags` (e.g. a new note from a template); your tags are kept and merged with any new ones. Run it from a note that already has a body and/or frontmatter, and a new note is created in the *Video summaries folder* (default `Video Summaries/`), a link to it is inserted at your cursor, and the summary is written to the new note when it's ready — you can keep working in other notes in the meantime. If the summary fails, the new note is moved to the trash and the link is removed.

### Method 1: Command Palette

1. Copy YouTube URL
2. Open command palette (`Ctrl/Cmd + P`)
3. Search for "Summarize YouTube Video"
4. Paste URL when prompted
5. Optionally toggle "Create Media Extended note", "Include description in Media Extended note", and "Include transcript in Media Extended note" (each inherits your permanent setting for this run without altering it)

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
6. Optionally toggle "Create Media Extended note", "Include description in Media Extended note", and "Include transcript in Media Extended note" (each inherits your permanent setting for this run without altering it)
7. The instructions are appended to the default prompt for this summarization only


### Method 4: Retrieve Video Transcript (No AI)

1. Open command palette (`Ctrl/Cmd + P`)
2. Run `Get YouTube video transcript`
3. Paste the YouTube URL (or select a URL in your note, or run from an active note containing a URL)
4. The full transcript with clickable YouTube timestamp links is inserted immediately — **no AI model or API key required**!

### Method 5: Create Missing Media Extended Notes

- **Specific Folder**:
  - **Context Menu**: Right-click any folder in the Obsidian File Explorer and select **Create missing Media Extended notes in this folder**.
  - **Command Palette**: Run `Create Media Extended notes for video summaries in folder...` and pick a folder.
  - **Settings Tab**: Click **Create in Folder...** under *Create missing Media Extended notes*.
- **Entire Vault**: Click **Create All in Vault** in settings.

Scans the target scope (excluding notes already inside the configured Media Extended folder, default `Media Library/`) for video summary notes that do not have a matching Media Extended companion note (detected by checking for `# Related` and a wikilink to the companion note), automatically creates the companion note in `Media Library/` (configurable in settings) with timestamped transcripts, and links them bidirectionally.

### Method 6: Connect or Refresh LM Studio (Local LLMs)

- **Command Palette**: Run `Detect and connect local LM Studio instance` (`Ctrl/Cmd + P`).
- **Settings Tab**: Open **AI Providers** → **LM Studio (Local LLM)** and click **Detect & Connect**.
- **Provider Accordion**: Click **Refresh from LM Studio** inside the LM Studio provider card.

Automatically connects to your local LM Studio instance (`http://localhost:1234/v1` or `http://127.0.0.1:1234/v1`), detects loaded/available local models, updates the LM Studio provider, and sets the active model for 100% private, free summarization.

### Method 7: Batch Operation Monitoring, Live Progress, & Logs

Every batch operation (refreshing video metadata in a folder and creating missing Media Extended notes) features comprehensive real-time monitoring, error logging, and inspection:

- **Live Progress Notifications**: As a batch operation runs across your notes, a single in-place notification continuously updates with current note progress (`[i/N] (X%) Processing: ...`), preventing notification spam.
- **Status Bar Indicator**: Obsidian's bottom status bar dynamically displays the ongoing operation and live percentage (`YT: [3/12] 25%`), automatically dismissing when complete.
- **Detailed Activity & Error Logging**: Every file processed is categorized with its exact outcome:
  - `✓ Success`: Updated with new metadata or a companion note.
  - `⊘ Skipped`: Note skipped with the reason (e.g. it already has a companion note).
  - `✕ Error`: Exact error message captured if network or API failures occurred.
- **Diagnostics Report Modal**:
  - Run the command `View last batch operation report & logs` from the Command Palette (`Ctrl/Cmd + P`), or click **View Last Report & Logs** in plugin settings.
  - Displays summary metric pills (Total, Succeeded, Skipped, Failed), elapsed execution duration, interactive filter tabs, clickable note links to jump straight to notes in Obsidian, and a **Copy Log to Clipboard** button exporting a GitHub-flavored Markdown table.

### Method 8: Add Description or Transcript to a Media Extended Note

1. Open a Media Extended companion note (a note in your Media Extended notes folder, or with `mx-uid` frontmatter)
2. Run `Add description to Media Extended note` or `Add transcript to Media Extended note` from the Command Palette
3. The video is detected from the note's `video:` frontmatter (or a YouTube link in the note)
4. If the note already has a `# Description` / `# Transcript` section, you're asked whether to continue; continuing replaces that section
5. The section is written with Media Extended timestamp links, in companion note order (`# Description`, `# Transcript`, `# Related`). `# Description` always ends up above `# Transcript`, even if the note had them the other way around.

By default, the description is copied from the note's frontmatter `description:` (only the body gets the new `# Description` section; frontmatter is never changed). If the frontmatter description is missing or empty, or *Use frontmatter description when adding description to body* is off, it's fetched from the **YouTube Data API** when a YouTube Data API key is set, and from YouTube's player metadata otherwise (no key required). The transcript comes from the video's captions.

### Method 9: Refresh Video Metadata

Re-fetches a video's metadata from YouTube and refreshes the frontmatter of video summary notes and Media Extended notes. Use it to pick up newly supported metadata fields, current view/like counts, or to fix notes created with older versions (for example, Media Extended covers that pointed to a missing local image).

- **One note**: run `Refresh video metadata in current note`, or right-click a note in the File Explorer → **Refresh video metadata**
- **A folder** (including subfolders): run `Refresh video metadata in folder...`, or right-click a folder → **Refresh video metadata in this folder**. Progress and per-note results appear in the batch report (`View last batch operation report & logs`)

What gets refreshed:
- **Video summary notes** (notes with `video_url` frontmatter): `title`, channel fields, `thumbnail` (with low-resolution fallback), `duration`, `published_at`, `view_count`, `like_count`, `aspect_ratio`, playlist fields (when *Discover playlist from creator* is on), and `description` (when *Add description to frontmatter* is on).
- **Media Extended notes**: all Media Extended frontmatter fields, including `cover` and `aspect_ratio`, keeping the existing `mx-uid`.

What's never changed: the note body, `tags`, AI-extracted `thumbnail_text`, `video_url`, your `watch_later` / `favorite` checkboxes (added unticked if the note doesn't have them yet), and any frontmatter properties the plugin doesn't manage. No AI model is used.

### Method 10: Insert Video Cover at Cursor

1. Open any note with a YouTube video (in `video_url` / `video` / `media` frontmatter, or a YouTube link in the note)
2. Place the cursor where the image should go
3. Run `Insert video cover at cursor` from the Command Palette

Inserts `![Cover](url)` at the cursor, using the note's `cover` frontmatter when it's a URL, otherwise the YouTube thumbnail (max resolution, or high quality for older videos). It doesn't check whether the note already has a cover image.

### Method 11: Add Description to a Video Summary Note

1. Open a video summary note (a note with `video_url` frontmatter)
2. Run `Add description to video summary note` from the Command Palette
3. If the note already has a `## Description` section, you're asked whether to continue; continuing replaces it
4. A `## Description` section is added before `# Related` (or at the end), with every timestamp converted into a clickable YouTube link (`[01:23](https://www.youtube.com/watch?v=...&t=83s)`)

The description is always stored in frontmatter, where its timestamps aren't clickable; use this command when you want clickable chapter links. The description source follows *Use frontmatter description when adding description to body* (frontmatter first, then YouTube).

### Method 12: Tag a Note With AI or YouTube

Run either command from the Command Palette in a video summary or Media Extended note (any note with a YouTube video):

- **`Tag with AI`**: The active AI model suggests 3 to 7 topic tags from the note's summary (or its frontmatter description if the body is empty), using the same prompt and vault tag cache as *Generate semantic topic tags*, so it prefers tags you already use and your group prefixes (e.g. `ai/`).
- **`Tag with YouTube`**: Adds the video's YouTube tags (YouTube Data API when a key is set, otherwise YouTube's player metadata) plus creator hashtags from the title and description (when *Detect tags in video title and description* is on).

New tags are merged into the frontmatter `tags` with the same deduplication as summarizing (e.g. `ai/machine-learning` replaces `ai-machine-learning`, and `Music` / `#music` / `music` collapse into one). The rest of the frontmatter and the body aren't changed, and the note isn't touched if there's nothing new.

### Method 13: Create the Companion Note for the Current Note

- **From a video summary note**: run `Create Media Extended note for current note` (or right-click the note → **Create Media Extended note**). Creates the Media Extended note in your *Media Extended notes folder* with your Media Extended settings (description, transcript, cover embed) and links the two notes under `# Related`.
- **From a Media Extended note** whose media is a YouTube video: run `Create video summary note for current note` (or right-click → **Create video summary note**). Generates the AI summary note in your *Video summaries folder*, exactly like summarizing, and links the two notes under `# Related`. Media Extended notes for local files or other sites are skipped.

Each command looks for an existing note for the same video only in its target folder (and subfolders). If one exists, you're asked first: the Media Extended note is **rebuilt**, or the summary note is **regenerated**, in place. Frontmatter properties and tags you added are kept.

### Method 14: Upgrade Video Summary Frontmatter

Run `Upgrade video summary frontmatter in folder...` from the Command Palette and pick a folder (pick the vault root for every note). It adds the `watch_later` and `favorite` checkbox properties, unticked, to each video summary note that doesn't have them yet.

Nothing is fetched and no AI model is used. Existing properties, values you've set, and the note body are left exactly as they are; the new lines go just before `description` / `tags`. Running it again changes nothing.

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
duration: 213
published_at: 2009-10-25
view_count: 1822608029
like_count: 19404514
aspect_ratio: 16 / 9
playlist_title: "Series Playlist Title"
playlist_url: "https://www.youtube.com/playlist?list=PLAYLIST_ID"
playlist_id: "PLAYLIST_ID"
playlist_index: 3
playlist_count: 12
watch_later: false
favorite: false
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
cover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"
aspect_ratio: 16 / 9
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

The summary sections are customizable via the summary prompt setting. Note body title heading (`# Title`), technical term wikilinks, frontmatter properties, topic tags, and video description in companion notes (with automatic timestamp conversion) can each be toggled on or off in the plugin settings. To add the description to a summary note's body, use `Add description to video summary note`.

## Development

For architecture documentation, technical design decisions, testing guides, and the developer Q&A log, see [DEVELOPMENT.md](DEVELOPMENT.md).

## Support

If this plugin helps your YouTube + Obsidian workflow, consider supporting development.

❤️ [Sponsor this plugin on GitHub](https://github.com/sponsors/mbramani)

Your support helps maintain the plugin, fix bugs, improve documentation, and add new features. No pressure — starring the repo or sharing feedback also helps a lot.

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
