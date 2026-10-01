# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  - Added command `Upgrade YouTube notes in folder...` and a right-click folder context menu item (`Upgrade YouTube notes in this folder`) to upgrade notes within any specific folder and its subfolders.
  - Added command `Upgrade all YouTube notes in vault` and settings buttons (`Upgrade All in Vault` / `Upgrade in Folder...`) for batch upgrades.
  - Re-processes notes to populate missing frontmatter metadata (title, channel_name, channel_username, channel_url, video_url, thumbnail, thumbnail_text) without re-running LLM summary inference, changing summary text, or generating new tags.
  - Preserves any preexisting tags and user-defined properties in frontmatter.
- **Automatic Note Renaming**:
  - Optional setting (enabled by default) to automatically rename the active note to the sanitized title of the YouTube video.
  - Sanitizes filenames against Windows, macOS, Linux, and Obsidian wikilink restrictions, with automatic collision resolution.
- **Settings Controls**: Added UI toggles for all new features and upgrade buttons (`Upgrade All in Vault` and `Upgrade in Folder...`) in the Summary settings section.

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
