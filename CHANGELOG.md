# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [1.17.2] - 2026-10-05

### Fixed
- **LM Studio / Local Servers No Longer Blocked by CORS**: Summarizing with an OpenAI-compatible provider failed with `Connection error.` when the server didn't allow the `app://obsidian.md` origin (LM Studio's default, with *Enable CORS* off). OpenAI-type providers now send requests through Obsidian's `requestUrl`, which isn't subject to CORS, so no server-side CORS setting is needed.

---

## [1.17.1] - 2026-10-05

### Fixed
- **LM Studio Detects the Loaded Model**: *Detect & Connect* / *Refresh from LM Studio* now read LM Studio's native `/api/v0/models` endpoint, which reports which model is loaded. The OpenAI-compatible `/v1/models` endpoint lists every downloaded model with no load state, so the active model was being set to the alphabetically first one. Embedding models are no longer imported, and when no model is loaded your current LM Studio model stays selected. Other OpenAI-compatible servers still fall back to `/v1/models`.

---

## [1.17.0] - 2026-10-05

### Added
- **Media Extended Plugin Detection**: The new Media Extended settings tab shows whether the Media Extended plugin is installed and enabled, with a button to open its page in Community plugins. Turning on *Create Media Extended notes* when it isn't installed (or is disabled) asks whether to open that page; the setting stays on either way, since the notes work as regular Markdown.

### Changed
- **Create Media Extended Notes Is Off by Default**: New installs no longer create Media Extended companion notes unless you turn the setting on (or choose it per video in the summary popup). Existing saved settings are kept. The plugin doesn't depend on Media Extended.
- **Reorganized Settings**: Settings are now grouped into five tabs with section headings: *AI Providers*, *Summary* (prompt, generation, summary notes), *Media Extended* (all Media Extended settings in one place), *Tags & Metadata* (tags, video description, YouTube), and *Maintenance* (batch upgrades and the last batch report). No settings were removed or renamed.

---

## [1.16.0] - 2026-10-02

### Added
- **Commands: Tag with AI / Tag with YouTube**: Add tags to the current video note's frontmatter. *Tag with AI* generates topic tags from the note's summary (or frontmatter description) with the active AI model, using the same prompt and vault tag cache as summarizing. *Tag with YouTube* adds the video's YouTube tags (Data API with a key, player metadata otherwise) plus title/description hashtags (per *Detect tags in video title and description*). Both merge with existing tags using the same deduplication as summarizing and leave the rest of the note unchanged.
- **Commands: Create Companion Note for Current Note**: `Create Media Extended note for current note` (from a video summary note) and `Create video summary note for current note` (from a Media Extended note for a YouTube video), plus matching File Explorer right-click items. New notes go in the configured *Media Extended notes folder* / *Video summaries folder*, and both notes are linked under `# Related`. An existing note for the same video is looked up only in that folder; if found, you're asked before it's rebuilt / regenerated in place, keeping frontmatter properties and tags you added.

### Changed
- **Rebuilding a Media Extended Note Keeps Your Properties**: When a companion note is regenerated over an existing one (e.g. summarizing the same video again), frontmatter properties and tags you added to it are now kept instead of being overwritten.

---

## [1.15.0] - 2026-10-02

### Added
- **Command: Add Description to Video Summary Note**: Adds the video description to a video summary note body as a `## Description` section (before `# Related`) with every timestamp converted into a clickable YouTube link. Asks before replacing an existing `## Description`. Uses the frontmatter description first (per *Use frontmatter description when adding description to body*), otherwise fetches it from YouTube.

### Changed
- **Use Frontmatter Description Setting Covers Both Commands**: Renamed *Use frontmatter description for Media Extended notes* to *Use frontmatter description when adding description to body*; it now applies to both "Add description" commands. Your existing choice is kept.
- **Untitled Notes With Only Tags Count as Blank**: The summarizer now writes into the current note (instead of creating a new note in the video summaries folder) when the note's name starts with "Untitled", it has no body, and `tags` is its only frontmatter. Existing tags are kept and merged with any new ones.

### Removed
- **`Include video description in summary note` setting**: Summaries no longer add the description to the note body (it stays in frontmatter). Use `Add description to video summary note` when you want clickable description timestamps in the body.

---

## [1.14.0] - 2026-10-02

### Added
- **Embed Cover in Media Extended Notes**: New setting (on by default) that adds the video cover as an inline image (`![Cover](url)`) at the top of the body of new Media Extended companion notes, using the same URL as the `cover` frontmatter.
- **Command: Insert Video Cover at Cursor**: Inserts the note's video cover as an inline image at the cursor. Uses the `cover` frontmatter when it's a URL, otherwise the YouTube thumbnail with the low-resolution fallback. No check for an existing cover image.

---

## [1.13.0] - 2026-10-02

### Added
- **Commands: Refresh Video Metadata**: `Refresh video metadata in current note` and `Refresh video metadata in folder...`, plus File Explorer right-click items for notes and folders. Re-fetches each video's metadata and refreshes the frontmatter of video summary notes (title, channel, thumbnail, video stats, playlist, and description per settings) and Media Extended notes (all Media Extended fields, including `cover` and `aspect_ratio`, keeping `mx-uid`). Never changes the note body, tags, `thumbnail_text`, `video_url`, or unrelated properties, and uses no AI. Folder runs use the batch progress tracker and report.
- **Commands: Add Description / Transcript to Media Extended Note**: `Add description to Media Extended note` and `Add transcript to Media Extended note` detect the video in the active Media Extended companion note and write a `# Description` or `# Transcript` section with Media Extended timestamp links, keeping the `# Description`, `# Transcript`, `# Related` order (`# Description` is moved above `# Transcript` if a note has them out of order). If the section already exists, you're asked before it's replaced. The description is copied from the note's frontmatter `description:` by default (the frontmatter itself is never changed); when that's missing or empty, or the new *Use frontmatter description for Media Extended notes* setting (on by default) is off, it's pulled from the YouTube Data API when an API key is set, with a no-key fallback to YouTube player metadata.
- **Video Stats in Summary Note Frontmatter**: Video summary notes now include `duration` (seconds), `published_at` (YYYY-MM-DD), `view_count`, `like_count`, and `aspect_ratio` (e.g. `16 / 9`) when YouTube provides them, in the same formats Media Extended notes use. Applies to new summaries, the transcript command, and the upgrade commands (which refresh these values when they run).

### Fixed
- **Media Extended Cover Points to a Real Image**: The companion note `cover` was a wikilink to a local file that was never created (`[[mx-cover-youtube_<id>.jpg]]`). It's now the full thumbnail URL, `https://i.ytimg.com/vi_webp/<id>/maxresdefault.webp`, falling back to `hqdefault.webp` when YouTube has no max-resolution thumbnail (common for old or low-resolution videos).
- **Missing Thumbnails in Summary Notes for Older Videos**: The video summary note `thumbnail` property and body image used `maxresdefault.jpg`, which doesn't exist for many old or low-resolution videos. They now fall back to `hqdefault.jpg` when the max-resolution thumbnail is missing. Applies to new summaries, the transcript command, and upgrade commands.

### Changed
- **Real Aspect Ratio in Media Extended Notes**: Companion notes use the video's actual aspect ratio (e.g. `9 / 16` for Shorts, `4 / 3` for older videos) instead of always `427 / 240`, which remains the fallback. The ratio comes from the stream dimensions already in the player data, with no extra request.
- **Video Detection From Media Extended Frontmatter**: Notes are now matched to their video via the Media Extended `video:` / `media:` frontmatter keys (YouTube URLs only) in addition to `video_url:` and links in the note.

---

## [1.12.0] - 2026-10-02

### Added
- **Video Summaries Folder Setting**: New default / fallback folder for new video summary notes (`Video Summaries` in the vault root by default).

### Changed
- **Summaries From Existing Notes Go to a New Note**: Summarizing from a note that already has a body and/or frontmatter now creates a new note in the video summaries folder, inserts a link to it at the cursor, and writes the summary to that note when it finishes, regardless of which note is focused. Previously the summary was inserted into the existing note. Summarizing from a blank note still writes into that note. On failure the new note is moved to the trash and the link removed.

---

## [1.11.0] - 2026-10-02

### Added
- **Command: Fix Playlist Title Placeholder**: Added `Fix playlist title placeholder` command (folder picker) and a File Explorer folder context menu item. Finds notes that have a `playlist_id` but a generic `Playlist` placeholder title, fetches only the playlist details (no full video metadata fetch), and replaces the placeholder in frontmatter and in any legacy `Playlist: Playlist` body link.
- **Batch Operation Progress Tracking & Report**: All batch upgrade commands now show live in-place progress notices and status bar updates, log every processed note, and produce a report viewable in an interactive modal (metric cards, filter tabs, clickable note links, Markdown export). Added the `View last batch operation report & logs` command and a *Batch operation status and logs* settings card.
- **Per-Run Media Extended Description & Transcript Toggles**: The YouTube URL and custom prompt modals now include "Include description in Media Extended note" and "Include transcript in Media Extended note" toggles alongside "Create Media Extended note". They inherit the permanent settings, apply to the current run only, and are disabled while note creation is off.
- **Include Transcript in Media Extended Note Setting**: New permanent setting controlling whether companion notes include the `# Transcript` section. Enabled by default.

### Changed
- **Standard YouTube Timestamp Links in Summary Notes**: Every timestamp in a video summary note — transcript, `## Description` section, and any timestamps in the AI summary — is now a markdown link to the original video in standard YouTube format (`[01:05](https://www.youtube.com/watch?v=...&t=65s)`). Raw description timestamps are converted automatically; code blocks, inline code, wikilinks, and non-timestamp links are left untouched.
- **Media Extended Format in Companion Notes**: Timestamps in Media Extended companion notes (description and transcript) always use Media Extended playback links (`&t=SECONDS#t=mm:ss.ms`).
- **Summary Note Description Off by Default**: `Include video description in summary note` now defaults to off. Existing saved settings are preserved.

### Fixed
- **Playlist Title Always Showing as "Playlist"**: Playlist titles are now resolved from the YouTube Data API (when a key is set) with a no-key fallback that reads the playlist page; when no real title is found, `playlist_title` is omitted instead of written as `Playlist`. Notes with the old placeholder are treated as missing playlist frontmatter so the playlist upgrade command can repair them.

### Removed
- **`Link transcript timestamps to YouTube` and `Format timestamps for Media Extended` settings**: Superseded by the fixed per-note formats above (summary notes always use YouTube links, companion notes always use Media Extended links).

---

## [1.10.0] - 2026-10-02

### Added
- **AI Semantic Topic Tagging & Compressed Vault Tag Cache**: Upgraded `Generate semantic topic tags` with whole-vault context awareness. Rebuilds a compressed in-memory cache of your vault's existing tag taxonomy prior to inference to maximize tag reuse and prevent tag sprawl. The enhanced prompt instructs the model to identify what topic(s) the video belongs to, fill in obvious missing tags, strictly prefer reusing existing vault tags, use lowercase kebab-case, and nest under established group prefixes (e.g. `ai/machine-learning` instead of `ai-machine-learning`). Dedicated documentation added in [`AI_TAGGING.md`](AI_TAGGING.md).
- **Hierarchical Group Tag Deduplication**: Enhanced `deduplicateTags()` to explicitly favor hierarchical tags containing `/` (e.g. `ai/machine-learning`) over flat hyphenated variants (`ai-machine-learning`) when normalizing and collapsing similar tags.
- **LM Studio One-Click Auto-Detection & OpenAI-Compatible Active Model**: Native auto-detection of local LM Studio servers (`http://localhost:1234/v1` and `http://127.0.0.1:1234/v1`). Automatically discovers loaded local models, adds or syncs the LM Studio provider, and sets the active model for private, 100% offline summarization. Added Command Palette command `Detect and connect local LM Studio instance` and Settings tab card.
- **OpenAI-Compatible Server Support**: Full support for running any custom OpenAI-compatible server (LM Studio, Ollama, LocalAI, vLLM, OpenRouter) as the Active Model with resilient authentication fallbacks and URL normalization.
- **Command: Upgrade Notes with Playlist from YouTube Data API**: Added Command Palette commands (`Upgrade video summary notes with playlist from YouTube Data API`, `...in folder...`, `...in entire vault`) and a Settings tab card. Detects notes missing `playlist_` properties, discovers creator playlist membership via YouTube Data API and metadata fallbacks, and merges playlist frontmatter while preserving existing tags and summaries.
- **Folder-Scoped Batch Processing & Scan Folders Setting**: Added flexible scoping for all batch operations (`Scan folders for batch upgrades` setting, interactive folder picker modal, whole vault commands, and right-click folder context menu integration in Obsidian's File Explorer).
- **Per-Run Media Extended Checkbox**: Added an interactive toggle checkbox in the YouTube URL input modal and custom prompt modal to selectively choose whether to create a Media Extended companion note for the current summarization without altering permanent settings.
- **Media Extended Descriptions & Converted Playback Timestamps**: Organized Media Extended companion notes under clean section headings (`# Description`, `# Transcript`, `# Related`) with standardized spacing. Includes a high-fidelity parser that automatically converts timestamps in video descriptions into clickable Media Extended playback URLs.

---

## [1.9.0] - 2026-10-02

### Added
- **Command: Create Missing Media Extended Companion Notes**: Added `Create Media Extended notes for video summaries without companion note` command in the Command Palette and a corresponding action button in the plugin settings. Scans the vault for video summary notes lacking a companion note (detected by absence of `# Related` and companion wikilink), creates the Media Extended companion notes in your configured folder, and links them bidirectionally.
- **Command: Upgrade Notes with Tags & Description Frontmatter**: Added `Upgrade video summary notes with tags and description frontmatter` command in the Command Palette and plugin settings. Automatically detects video summary notes that lack the `description` frontmatter property, fetches complete creator tags from YouTube Data API v3 and the full video description, and safely merges them into frontmatter without touching summaries or running AI models.
- **Developer Documentation**: Added comprehensive [`DEVELOPMENT.md`](DEVELOPMENT.md) detailing architecture, subsystems, testing strategy, release process, and a Developer Q&A log preserving technical design decisions (including `mx-uid` origins, playlist reverse lookup strategy, system playlist filtering, and tag deduplication).

---

## [1.8.0] - 2026-10-02

### Added
- **Creator Playlist Discovery**: Automatically detects whether a video belongs to a creator playlist (via URL parameters, video description links, or YouTube Data API channel lookup). Serializes playlist metadata (`playlist_title`, `playlist_url`, `playlist_id`, `playlist_index`, `playlist_count`) into YAML frontmatter and adds an interactive, clickable playlist badge in the note header (`📋 [Playlist: Title (X/Y)](url)`).
- **YouTube Data API Tags & Smart Deduplication**: Ingests complete creator video tags/keywords from the YouTube Data API v3 and InnerTube metadata into Obsidian tags. Features robust tag deduplication that reconciles hashtag variations across title, description, and API metadata (e.g. collapsing `#RickAstley` to `rick-astley`).
- **Separate Media Extended Companion Notes**: Automatically generates standalone companion notes in a configurable vault folder (defaults to `Media Library`) formatted specifically for the Media Extended plugin with `mx-uid`, video URL, duration, cover embed, and timestamped playback transcript.
- **Bidirectional Note Linking**: Automatically establishes bidirectional wikilinks between the AI summary note and its Media Extended companion note under a `# Related` section.
- **YouTube Description in Frontmatter**: Ingests the full YouTube video description into YAML frontmatter (`description: |-`) by default with configurable toggle.

---

## [1.7.0] - 2026-10-01

### Added
- **Dedicated Video Transcript Retrieval**: Added `Get YouTube video transcript` command to the Obsidian Command Palette. Fetches the complete video transcript directly without running AI inference or consuming API tokens, complete with video metadata, thumbnail, tags, and frontmatter.
- **Transcript Dump in Summary Notes**: Added an optional setting `Include transcript in summary note` (disabled by default) to append the complete video transcript under a `## Transcript` section when generating an AI summary.
- **Clickable YouTube Timestamp Links**: Added an option to convert transcript timestamps into clickable YouTube links that jump directly to that point in the video (`[01:05](https://youtube.com/watch?v=...&t=66)`). Enabled by default.
- **Media Extended Timestamp Links**: Formatted timestamp links with Media Extended fragments (`[mm:ss](https://www.youtube.com/watch?v=...&t=SEC#t=mm:ss.SS)`) for seamless integrated playback and seeking with the Media Extended plugin player. Enabled by default via `Format timestamps for Media Extended`.

---

## [1.6.0] - 2026-09-30

### Added
- **Optional Note Body Title**: Made the `# Video Title` heading in the note body optional and turned it off by default, eliminating redundant titles since the video title is already placed in the note name and YAML frontmatter.
- **Optional Wikilinks in Technical Terms**: Added a setting to turn Obsidian `[[wikilinks]]` generation on or off in the "Technical terms" section. Enabled by default. When disabled, technical terms are retained in bold text without wikilinks (`- **Term**: explanation`).

---

## [1.5.1] - 2026-09-30

### Fixed
- **OpenAI Model Compatibility (`max_completion_tokens`)**: Replaced deprecated `max_tokens` with `max_completion_tokens` across OpenAI completions to fix the `"max_tokens is not supported with this model, use 'max_completion_tokens' instead"` error thrown by reasoning models (`o1`, `o3-mini`, `o4-mini`) and modern GPT completions.
- **Reasoning Model Temperature Handling**: Omitted the `temperature` parameter for reasoning models (`o1`, `o3`, `o4`) to prevent `"temperature is not supported with this model"` errors.
- **Proxy Fallback**: Added automatic fallback to `max_tokens` if an older custom OpenAI-compatible server explicitly rejects `max_completion_tokens`.

---

## [1.5.0] - 2026-09-30

### Added
- **Updated Anthropic Claude Model Lineup**:
  - Added new generation flagships: `claude-sonnet-5-5` (Claude Sonnet 5.5, Recommended), `claude-opus-5-5`, `claude-fable-5-1`, `claude-sonnet-5`, and `claude-opus-5`.
  - Retired discontinued models: `claude-sonnet-4-20250514` and `claude-opus-4-20250514` (retired June 15, 2026), and pruned deprecated Claude 3/3.5 models.
  - Automatically prunes retired Anthropic models from settings and migrates active selections to prevent API failures.
- **Updated OpenAI Model Lineup**:
  - Added newest frontier models: `gpt-6` (Astra), `gpt-5.6` (Sol), `gpt-5.6-terra`, and `gpt-5.6-luna`.
  - Added automated pruning of legacy, retired OpenAI endpoints (`gpt-4-vision-preview`, `gpt-4-0314`, `gpt-4-0613`, `gpt-3.5-turbo-0301`, etc.) with safe migration fallback.
- **Multi-Provider Retirement Migration**:
  - Universal retirement handling across Gemini, Anthropic, and OpenAI built-in providers.
  - Transparently prunes dead models on startup and safely preserves valid custom and user-added models.

---

## [1.4.0] - 2026-09-30

### Added
- **Folder-Targeted Note Upgrades**:
  - Right-click folder context menu item (`Upgrade YouTube notes in this folder`) in the Obsidian File Explorer.
  - Command Palette command `Upgrade YouTube notes in folder...` with an interactive fuzzy folder suggest modal.
  - Convenient `Upgrade in Folder...` button in the plugin settings tab alongside `Upgrade All in Vault`.
  - Recursively upgrades all YouTube notes within any selected folder and its subfolders to populate missing frontmatter metadata without re-generating summaries, running AI inference, or touching tags.
- **Updated Gemini Model Lineup**:
  - Added latest flagship and production models: `gemini-3.8-flash` (new default recommended model), `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-pro`, `gemini-3.1-flash-lite`, and `gemini-3-pro-preview`.
  - Retired and removed shut down models that are no longer operational: `gemini-2.0-flash` and `gemini-2.0-flash-lite` (discontinued June 1, 2026), as well as older legacy `gemini-1.5` series.
  - Added automatic retirement migration in settings: prunes shut down models from built-in provider configurations and safely migrates active selections to `Gemini:gemini-3.8-flash` to prevent API failures.

---

## [1.3.0] - 2026-09-30

### Added
- **Frontmatter Metadata**: Automatically generates structured YAML frontmatter containing:
  - `title`: Video title
  - `channel_name`: Channel author / display name
  - `channel_username`: YouTube handle (e.g. `@channel`)
  - `channel_url`: Channel link
  - `video_url`: Video link
  - `thumbnail`: Thumbnail image URL
  - `thumbnail_text`: Text extracted from the thumbnail image via vision OCR
  - `tags`: Topic tags (when tags in frontmatter is enabled)
- **Thumbnail Vision Analysis & Text Recognition**:
  - Automatically fetches the highest available resolution video thumbnail.
  - Concurrently analyzes the thumbnail image with the active multimodal model (Gemini, OpenAI, or Anthropic) to transcribe visible text into `thumbnail_text`.
  - Gracefully falls back to empty string if the model does not support vision capabilities.
- **YouTube Video Description in Body**:
  - Optional setting (enabled by default) to preserve and store the full video description and external links under a `## Description` section in the note body.
  - Preserves paragraph formatting, line breaks, and URLs.
- **Semantic Topic Tagging**:
  - Optional setting (enabled by default) to semantically analyze the generated summary and produce relevant topic tags.
  - Supports adding tags directly to YAML frontmatter (default: enabled).
  - Supports adding inline tags to the note body as `**Tags:** #tag1 #tag2` (default: disabled).
  - Normalizes and sanitizes tags for Obsidian tag compatibility.
- **Title and Description Tag Detection**:
  - Optional setting (enabled by default) to detect hashtags (`#tag`) in the YouTube video title and description.
  - Automatically merges detected tags with semantic topic tags and adds them to YAML frontmatter.
- **Previous Notes Upgrade**:
  - Added command `Upgrade current note with YouTube frontmatter` to upgrade the active note.
  - Added command `Upgrade all YouTube notes in vault` and settings button `Upgrade Notes in Vault` for vault-wide batch upgrades.
  - Re-processes notes to populate missing frontmatter metadata (title, channel_name, channel_username, channel_url, video_url, thumbnail, thumbnail_text) without re-running LLM summary inference, changing summary text, or generating new tags.
  - Preserves any preexisting tags and user-defined properties in frontmatter.
- **Automatic Note Renaming**:
  - Optional setting (enabled by default) to automatically rename the active note to the sanitized title of the YouTube video.
  - Sanitizes filenames against Windows, macOS, Linux, and Obsidian wikilink restrictions, with automatic collision resolution.
- **Settings Controls**: Added UI toggles for all new features and an upgrade button in the Summary settings section.

---

## [1.2.2] - 2026-09-30

### Fixed
- **API Key and Provider Visibility in Settings Tab**: Fixed an issue where provider accordions and API key input fields failed to render when opening the plugin settings tab due to querying `document.querySelector` on a detached container element.
- **Active Provider Auto-Expansion**: The active model's provider accordion (e.g., Gemini) is now expanded by default on settings display so that users can immediately view and edit the API key.
- **Dynamic Model Selection Updates**: Changing the active model from the dropdown now automatically expands the corresponding provider's accordion.
- **Robust Config Loading & Migration**: Enhanced configuration loader to seamlessly support both wrapped (`{ settings: { ... } }`) and flat (`{ ... }`) JSON structures in `data.json`, and automatically migrate legacy or manually edited `apiKey` / `geminiApiKey` keys.
- **Resilient Built-In Provider Sync**: Standardized provider matching and deduplication so manual edits to `data.json` omitting internal metadata (like `isBuiltIn: true`) will not create duplicate or empty provider entries.
- **Multi-Window & Popout Compatibility**: Scoped all accordion toggling, dropdown updates, and reload queries to the settings container element rather than the global `document` object.
- **Prevent Stale Settings Instances**: Replaced static `this.settings` in `SettingsTab` with a dynamic getter to ensure the settings tab always operates on live configuration data.

### Changed
- Updated MIT license copyright notice to include new contributor Corey Struzan.

---

## [1.2.1] - 2026-04-28

### Fixed
- Hardened YouTube transcript fetching against non-2xx responses (including 400 and 403 errors).
- Refreshed InnerTube client defaults and Android user-agent SDK mapping.
- Deep-cloned provider defaults to avoid shared reference mutations on load.
- Improved model validation and model ID parsing in settings.

### Added
- Updated built-in Gemini, OpenAI, and Anthropic model definitions with updated pricing details.
- Added custom per-summarization prompt modal dialog.
- Added pricing indicators in model settings lists and dropdowns.
- Added project sponsor section in settings.

---

## [1.2.0] - 2026-01-12

### Added
- Token limit truncation warnings across Gemini, OpenAI, and Anthropic providers.
- Increased default max tokens setting to 10,000 in defaults.

---

## [1.1.7] - 2026-01-12

### Added
- Local auto-sync script for development vaults.

---

## [1.1.6] - 2025-05-10

### Fixed
- YouTube transcript extraction and timestamp handling fixes.

---

## [1.1.5] - 2025-01-08

### Fixed
- Mobile settings layout: aligned Edit and Remove icons onto the same row as the model name.

---

## [1.0.0] - 2025-01-02

### Added
- Initial release: YouTube video summarizer using Gemini AI.
- Automated transcript extraction and structured markdown summary generation.
- Custom summary prompt templates, max tokens, and temperature controls.
