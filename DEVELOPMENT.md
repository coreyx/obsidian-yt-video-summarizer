# Development Documentation

This document provides architectural overviews, technical design decisions, subsystem guides, development workflows, and a log of developer questions and answers for the **YouTube Video Summarizer** Obsidian plugin.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory & File Structure](#directory--file-structure)
3. [Development Workflow & Commands](#development-workflow--commands)
4. [Subsystem Deep Dives](#subsystem-deep-dives)
   - [YouTube Metadata & Transcript Ingestion](#1-youtube-metadata--transcript-ingestion)
   - [AI Provider Engine & Model Retirement](#2-ai-provider-engine--model-retirement)
   - [Media Extended Companion Notes](#3-media-extended-companion-notes)
   - [Creator Playlist Discovery](#4-creator-playlist-discovery)
   - [Frontmatter Management & Tag Normalization](#5-frontmatter-management--tag-normalization)
5. [Testing Strategy](#testing-strategy)
6. [Release Process](#release-process)
7. [Developer Q&A Log](#developer-qa-log)

---

## Architecture Overview

The plugin operates as an Obsidian desktop/mobile plugin built with TypeScript and esbuild. Its primary function is to ingest YouTube videos, extract metadata and transcripts without external dependencies, optionally process the transcript through AI language models (Gemini, OpenAI, Anthropic, or custom endpoints), and format structured notes in the Obsidian vault with frontmatter, tags, Media Extended support, and playlist links.

```
┌────────────────────────────────────────────────────────┐
│                      Obsidian App                      │
└───────────────────────────┬────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   src/main.ts   │  (Plugin lifecycle & commands)
                   └────────┬────────┘
        ┌───────────────────┼────────────────────┐
        │                   │                    │
┌───────▼────────┐  ┌───────▼────────┐   ┌───────▼────────┐
│ YouTubeService │  │ ProviderFactory│   │FrontmatterUtils│
│(InnerTube/v3)  │  │(Gemini/OAI/Ant)│   │(YAML/Tag/ME)   │
└───────┬────────┘  └───────┬────────┘   └───────┬────────┘
        │                   │                    │
        ▼                   ▼                    ▼
 YouTube Video Data     AI Summaries     Obsidian Vault Notes
 & Transcripts                           & Media Companion Notes
```

---

## Directory & File Structure

```
├── .github/workflows/
│   └── release.yml          # GitHub Actions release workflow
├── src/
│   ├── constants.ts         # Regex constants (Video ID, playlist, title)
│   ├── defaults.ts          # Default settings, system prompts, model definitions
│   ├── types.ts             # TypeScript interfaces and type definitions
│   ├── main.ts              # Plugin main entrypoint, commands, and orchestration
│   ├── services/
│   │   ├── youtube.ts       # YouTube InnerTube & Data API v3 service
│   │   ├── promptService.ts # Template builder for AI summary prompts
│   │   ├── settingsManager.ts # Settings state management and persistence
│   │   └── providers/       # AI provider implementations
│   │       ├── base.ts      # Base provider interface and utilities
│   │       ├── factory.ts   # Provider factory & retirement migration
│   │       ├── gemini.ts    # Google Gemini API client
│   │       ├── openai.ts    # OpenAI API client (max_completion_tokens)
│   │       ├── anthropic.ts # Anthropic Claude API client
│   │       └── custom.ts    # Custom OpenAI-compatible provider
│   ├── ui/
│   │   ├── settings.ts      # Plugin settings tab UI
│   │   ├── modals.ts        # Input modals (URL, custom prompts, add provider)
│   │   └── components.ts   # Reusable UI components (accordions, toggles)
│   └── utils/
│       └── frontmatter.ts   # YAML frontmatter builder/merger, tag deduplication,
│                            # timestamp formatters, Media Extended note builder
├── tests/
│   └── test-features.mjs    # Comprehensive standalone test suite (21 feature suites)
├── CHANGELOG.md             # Keep a Changelog format
├── DEVELOPMENT.md           # This developer guide and Q&A log
├── README.md                # User-facing documentation
├── RELEASE_NOTES.md         # Release notes for GitHub Releases
├── esbuild.config.mjs       # Build bundle configuration
├── manifest.json            # Obsidian plugin manifest
├── package.json             # Dependencies and build scripts
└── versions.json            # Obsidian version compatibility mapping
```

---

## Development Workflow & Commands

### Prerequisites
* **Node.js**: v18+ recommended
* **npm**: v8+

### Setup
```bash
npm install
```

### Build & Test Commands
* **Run Unit Tests**:
  ```bash
  npm test
  ```
  Runs `tests/test-features.mjs` verifying 21 feature areas (filename sanitization, tag deduplication, frontmatter serialization, model migration, timestamp linking, Media Extended formatting, playlist discovery, etc.).
* **Compile TypeScript & Bundle (Production)**:
  ```bash
  npm run build
  ```
  Executes `tsc -noEmit -skipLibCheck` and bundles via `esbuild` into `main.js`.
* **Development Watch Mode**:
  ```bash
  npm run dev
  ```
* **Auto-Sync to Local Obsidian Vault**:
  ```bash
  npm run sync
  ```
  Copies `main.js`, `manifest.json`, and `styles.css` directly to a local development vault if configured in `.env`.

---

## Subsystem Deep Dives

### 1. YouTube Metadata & Transcript Ingestion

* **Files**: `src/services/youtube.ts`, `src/constants.ts`
* **Zero-API-Key Transcripts**:
  Uses YouTube's InnerTube Android client API (`https://www.youtube.com/youtubei/v1/player` with public Android client keys) to fetch video metadata and caption tracks. This mirrors `youtube-transcript-api` without requiring third-party Python runtimes or Google Cloud API credentials.
* **Metadata Extraction Fallbacks**:
  - InnerTube player response (`playerData.videoDetails`)
  - Watch HTML scraping for channel username handle (`@handle`), keywords, and like count
  - Optional YouTube Data API v3 when a key is provided in settings

### 2. AI Provider Engine & Model Retirement

* **Files**: `src/services/providers/`, `src/defaults.ts`
* **Provider Implementations**:
  - **Gemini**: `@google/generative-ai` with support for multimodal image OCR on thumbnails and topic tag generation.
  - **OpenAI**: `openai` SDK using `max_completion_tokens` (instead of deprecated `max_tokens`) to ensure compatibility with modern reasoning models (`o1`, `o3-mini`, `o4-mini`).
  - **Anthropic**: `@anthropic-ai/sdk` with system prompt separation.
  - **Custom**: Any OpenAI-compatible endpoint with user-defined base URLs.
* **Automatic Retirement Migration**:
  When providers deprecate or shut down models, lists in `src/defaults.ts` (`RETIRED_GEMINI_MODELS`, `RETIRED_OPENAI_MODELS`, `RETIRED_ANTHROPIC_MODELS`) automatically prune obsolete entries from user settings on startup and re-point the active selection to supported models.

### 3. Media Extended Companion Notes

* **Files**: `src/utils/frontmatter.ts`, `src/main.ts`
* **Purpose**: Generates separate companion notes formatted for the [Media Extended](https://github.com/aidenlx/media-extended) plugin in a designated folder (default: `Media Library/`).
* **Frontmatter Schema**:
  ```yaml
  ---
  mx-uid: [24-char unique id]
  video: https://www.youtube.com/watch?v=VIDEO_ID
  title: "Video Title"
  description: |-
    Description content...
  duration: 214
  creator: Creator Name
  published_at: 2026-10-02
  view_count: 1000000
  like_count: 50000
  cover: "[[mx-cover-youtube_VIDEO_ID.jpg]]"
  aspect_ratio: 427 / 240
  ---
  ```
* **Bidirectional Linking**:
  When a companion note is created, the summary note receives a `- [[Media Library/Note Name]]` link under `# Related`. Similarly, the Media Extended companion note receives a link back to the summary note.

### 4. Creator Playlist Discovery

* **Files**: `src/services/youtube.ts`, `src/utils/frontmatter.ts`, `src/main.ts`
* **Discovery Tiers**:
  1. **URL Check**: Extracts `&list=PLAYLIST_ID` and optional `&index=N` from the input URL.
  2. **Description Parsing**: Scans the video description for creator series links (`youtube.com/playlist?list=...`).
  3. **Channel API Lookup**: If an API key and channel ID are present, queries `playlists.list?channelId=...` and verifies membership using `playlistItems.list`.
* **System Mix Filtering**: Explicitly ignores YouTube Mixes (`RD...`), Watch Later (`WL`), and Liked Videos (`LL`).
* **Output**:
  - Frontmatter fields: `playlist_title`, `playlist_url`, `playlist_id`, `playlist_index`, `playlist_count`.
  - Body header badge: `📋 [Playlist: Title (3/12)](url)`.

### 5. Frontmatter Management & Tag Normalization

* **Files**: `src/utils/frontmatter.ts`
* **Safe Frontmatter Merging**:
  `mergeFrontmatter()` updates standard properties (`title`, `channel_name`, `video_url`, `thumbnail`, `playlist_*`, `description`) while strictly preserving existing custom frontmatter properties and aliases.
* **Tag Deduplication Pipeline**:
  `deduplicateTags()` normalizes tags across title hashtags, description hashtags, and YouTube Data API keywords:
  - Converts to lowercase kebab-case.
  - Strips `#` and filesystem-illegal characters.
  - Reconciles run-together hashtags with hyphenated variants (e.g. collapses `#RickAstley` into `rick-astley`).

---

## Testing Strategy

All new features and regression protections are maintained in `tests/test-features.mjs`.

### Running Tests
```bash
npm test
```

### Feature Suites Covered
1. `sanitizeFileName`: File system and wikilink safety across Windows/Mac/Linux.
2. `sanitizeTag`: Tag format sanitization for Obsidian.
3. `buildFrontmatter`: Frontmatter serialization.
4. `mergeFrontmatter`: Safe YAML merging without data loss.
5. `decodeHTML`: Unescaping HTML entities in titles and descriptions.
6. `parseTopics`: Topic extraction from LLM responses.
7. `extractTagsFromText`: Hashtag regex detection in titles and descriptions.
8. `extractYouTubeUrlFromNote`: URL detection in existing notes.
9. `isNoteMissingFrontmatter`: Identifying upgrade candidates.
10. `mergeFrontmatter with excludeTags`: Safe batch upgrading without overwriting tags.
11. Folder filtering & sorting for folder-scoped upgrades.
12. Gemini model retirement and auto-migration.
13. Anthropic & OpenAI model retirement and auto-migration.
14. OpenAI parameter construction (`max_completion_tokens` vs `max_tokens`).
15. Optional note body title formatting.
16. Optional technical term wikilink formatting.
17. Transcript formatting and timestamp playback links.
18. YouTube Data API tags extraction.
19. Media Extended companion note formatting and bidirectional links.
20. YouTube description frontmatter block and cross-source tag deduplication.
21. Creator playlist discovery, frontmatter serialization, and header formatting.
22. Missing companion note detection and missing description frontmatter upgrade.

---

## Release Process

When cutting a new release:

1. **Update Version**:
   - `package.json` (`version`)
   - `manifest.json` (`version`)
   - `versions.json` (add new version pointing to `minAppVersion`)
2. **Update Documentation**:
   - `CHANGELOG.md` (add new version section following Keep a Changelog)
   - `RELEASE_NOTES.md` (highlight key features for GitHub Releases)
   - `README.md` (update feature list and sample output if syntax changed)
3. **Build & Verify**:
   ```bash
   npm test
   npm run build
   ```
4. **Git Tag & Push**:
   ```bash
   git add -A
   git commit -m "feat: description of release, bump version to x.y.z"
   git tag x.y.z
   git push origin main
   git push origin x.y.z
   ```
5. **Publish GitHub Release**:
   ```bash
   gh release create x.y.z main.js manifest.json styles.css -R coreyx/obsidian-yt-video-summarizer --title "x.y.z" -F RELEASE_NOTES.md
   ```

---

## Developer Q&A Log

This section preserves technical and design questions asked during development for future reference.

---

### Q1: Where does the `mx-uid` field come from?

**Context**: In user request #8, the sample frontmatter for a Media Extended note included `mx-uid: vcxchy79gecb4s69v25oxq9s`.

**Answer**:
1. **Origin in Media Extended Plugin**:
   `mx-uid` stands for **Media Extended Unique Identifier** from the [Media Extended](https://github.com/aidenlx/media-extended) plugin (developed by `aidenlx`). Media Extended treats markdown notes with media metadata as "Media Notes". It uses `mx-uid` in the frontmatter as an internal primary key to bind that specific note to the media player instance, maintaining playback position, player states, and timestamped annotations without relying on the file path or name.
2. **Implementation in Our Plugin**:
   - **Generation**: Implemented in [`generateMxUid()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts). It generates a random 24-character lowercase alphanumeric string (`[a-z0-9]`), matching the format expected by Media Extended.
   - **Preservation on Update**: In [`createMediaExtendedCompanionNote()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts), when updating an existing companion note, the plugin inspects the existing frontmatter for `mx-uid` and **preserves it** instead of generating a new ID. This prevents breaking existing Media Extended player bindings and annotations in the user's vault.

---

### Q2: Why does YouTube Data API v3 not provide a direct lookup from `videoId` to `playlistId`, and how is playlist discovery solved?

**Context**: User requested discovering if an ingested video belongs to a creator playlist and recording playlist details in frontmatter.

**Answer**:
* **API Limitation**: The official YouTube Data API v3 does **not** offer a reverse lookup endpoint to query which playlists contain a specific `videoId`. The API only supports querying items within a known playlist (`playlistItems.list?playlistId=...`) or querying playlists owned by a channel (`playlists.list?channelId=...`).
* **Multi-Tier Solution**:
  1. **URL Detection**: Frequently, URLs copied by users already contain `&list=PLAYLIST_ID` and `&index=N`.
  2. **Description Parsing**: Creators commonly link the series playlist in the video description (`youtube.com/playlist?list=...`).
  3. **Channel API Queries**: When an API key and `channelId` are present, query the creator's playlists via `playlists.list?channelId=...`, then test candidate playlists with `playlistItems.list?playlistId=...&videoId=...` to retrieve the video's 1-based position (`position + 1`) and item count.

---

### Q3: Why are YouTube Mixes (`RD...`), Watch Later (`WL`), and Liked Videos (`LL`) ignored in playlist discovery?

**Context**: YouTube URLs copied from the home page or sidebar often contain `&list=RD...` (an infinite auto-generated mix).

**Answer**:
* YouTube mixes starting with `RD` are algorithmic, auto-generated radio playlists created dynamically for the viewer, not curated playlists created by the video author.
* `WL` (Watch Later) and `LL` (Liked Videos) are private user system playlists.
* The feature is specifically intended to discover **creator playlists** (e.g. series, albums, tutorials). Filtering out `RD`, `WL`, and `LL` ensures that only intentional creator playlists (`PL...`, `OLAK...`, etc.) are recognized and recorded.

---

### Q4: How does the tag deduplication pipeline handle discrepancies between YouTube Data API tags and hashtags?

**Context**: Creators write hashtags like `#RickAstley` or `#NeverGonnaGiveYouUp` in descriptions, while the YouTube Data API returns tags like `Rick Astley` or `Never Gonna Give You Up`.

**Answer**:
* Directly merging these raw sources would result in duplicate tags (`rickastley` and `rick-astley`).
* The [`deduplicateTags()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) pipeline:
  1. Sanitizes all tags to lowercase kebab-case (e.g. `"Rick Astley"` -> `"rick-astley"`).
  2. Identifies tags that differ only by separator hyphens (e.g. `"rickastley"` vs `"rick-astley"`).
  3. Always prefers the hyphenated/separated variant (`"rick-astley"`) over the collapsed run-together form (`"rickastley"`), ensuring clean, readable Obsidian tags.

---

### Q5: Why does the OpenAI provider use `max_completion_tokens` instead of `max_tokens`?

**Context**: In v1.5.1, OpenAI reasoning models (`o1`, `o3-mini`, `o4-mini`) threw errors when called with `max_tokens`.

**Answer**:
* OpenAI deprecated `max_tokens` for newer models in favor of `max_completion_tokens`.
* Furthermore, reasoning models use completion tokens for internal reasoning steps ("thinking tokens") before outputting visible text. Calling `max_tokens` triggers a hard API error.
* The plugin uses `max_completion_tokens` by default and includes an automatic fallback to `max_tokens` if an older custom/third-party OpenAI-compatible proxy rejects `max_completion_tokens`.

---

### Q6: How does the plugin detect whether a video summary note is missing a matching Media Extended companion note?

**Context**: User requested a command to "Create Media Extended for any video summary note that doesn't have a matching Media Extended note (detect by presence of # Related and a wikilink to the note]".

**Answer**:
* In [`hasRelatedMediaExtendedLink()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts), the scanner inspects the note's `# Related` markdown heading:
  1. If `# Related` is absent, the note is marked as missing its companion note.
  2. If `# Related` is present, it tests whether the section contains a wikilink matching either the expected companion note title (`[[Media Library/Title]]` or `[[Title]]`) or any wikilink targeting the configured Media Extended folder (`[[Media Library/...]]`).
* If no matching wikilink is found in `# Related`, the note is treated as unlinked. The command generates the companion note with full Media Extended frontmatter and timestamped captions, and inserts the bidirectional wikilink into `# Related`.
* Self-detection: Companion notes themselves (identified by `mx-uid:` frontmatter or presence inside `Media Library/`) are excluded to avoid circular generation.

---

### Q7: How does the description & tags upgrade command identify candidate notes and safely upgrade them?

**Context**: User requested a command to "Upgrade video summary notes with tags from YouTube Data API & description frontmatter (if they don't have the description property)".

**Answer**:
* **Candidate Detection**:
  [`isNoteMissingDescriptionFrontmatter()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) checks whether the note's YAML frontmatter contains a `description:` key. Notes already possessing `description:` (or companion notes in `Media Library/`) are skipped.
* **Safe Frontmatter Upgrade**:
  For matching notes, the command queries YouTube metadata (and YouTube Data API v3 if configured), extracts tags from title & description, merges Data API tags, normalizes tags through `deduplicateTags()`, and updates the note via `updateNoteContentWithFrontmatter()`. Existing OCR thumbnail text and custom frontmatter properties are preserved without re-running AI inference or overwriting existing note content.
