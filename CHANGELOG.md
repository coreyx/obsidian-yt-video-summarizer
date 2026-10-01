# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
