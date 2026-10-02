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
  Runs `tests/test-features.mjs` verifying 26 feature areas (filename sanitization, tag deduplication, frontmatter serialization, model migration, timestamp linking, Media Extended formatting, description timestamp conversion, playlist discovery, etc.).
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

* **Files**: `src/services/providers/`, `src/services/lmStudio.ts`, `src/defaults.ts`
* **Provider Implementations**:
  - **Gemini**: `@google/generative-ai` with support for multimodal image OCR on thumbnails and topic tag generation.
  - **OpenAI**: `openai` SDK using `max_completion_tokens` (instead of deprecated `max_tokens`) to ensure compatibility with modern reasoning models (`o1`, `o3-mini`, `o4-mini`).
  - **Anthropic**: `@anthropic-ai/sdk` with system prompt separation.
  - **OpenAI-Compatible & Local Providers**: Any OpenAI-compatible server (LM Studio, Ollama, LocalAI, vLLM, OpenRouter, Groq). Base URLs are automatically normalized via [`normalizeOpenAIBaseUrl()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/lmStudio.ts) (appending `/v1` if omitted and trimming trailing slashes). Empty API keys fall back to `'not-needed'` to satisfy client SDK constructors for local offline servers.
  - **LM Studio Local Auto-Discovery**: [`detectLMStudioServer()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/lmStudio.ts) queries `GET /v1/models` across dual-stack candidate addresses (`localhost:1234` and `127.0.0.1:1234`), parses loaded and available models, registers the provider, and updates the active model with zero manual configuration.
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
* **Section Headings & Description Integration**:
  - Companion notes organize content under explicit markdown headings:
    - `# Description`: Contains the creator's video description with all chapter timestamps (`0:00`, `01:23`, `[01:23]`, `1:05:30`) automatically parsed and converted into clickable Media Extended playback links (`[HH:MM:SS](https://...&t=SECONDS#t=HH:MM:SS.00)`) via [`convertDescriptionTimestampsToMediaExtended()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts).
    - `# Transcript`: Contains the timestamped transcript with Media Extended playback URLs.
    - `# Related`: Contains the bidirectional wikilink back to the original summary note (`- [[Summary Note]]`).
  - **Clean Spacing**: Every heading (`# Description`, `# Transcript`, `# Related`) is followed by an empty line (`\n\n`) before content begins.
* **Bidirectional Linking**:
  When a companion note is created, the summary note receives a `- [[Media Library/Note Name]]` link under `# Related` (also formatted with an empty line after the heading). Similarly, the Media Extended companion note receives a link back to the summary note.

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
23. Folder parsing, folder filtering, and folder-scoped discovery.
24. Summary prompt Media Extended checkbox and per-run override resolution.
25. OpenAI-compatible URL normalization, LM Studio model parsing & provider sync.

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

---

### Q8: Where do the "Create Missing Media Extended Notes" and "Upgrade Tags & Description" commands discover notes from, and is this documented?

**Context**: User asked where these two commands get the folder from to discover the candidate notes, and where it is documented.

**Answer**:
1. **Discovery Scope (Vault-Wide Scan)**:
   - Neither command restricts input discovery to a specific folder. Both commands call `this.app.vault.getMarkdownFiles()`, scanning **all Markdown files across the entire Obsidian vault**.
   - **Exclusion of Companion Notes**: To prevent infinite loops or modifying companion notes, both commands pass candidate files through [`isMediaExtendedCompanionNote()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts), which immediately ignores:
     - Any file residing inside the configured Media Extended folder (default: `Media Library/`).
     - Any file containing `mx-uid:` in its frontmatter.
   - **Candidate Qualification**: Only notes containing a valid YouTube URL (via [`extractYouTubeUrlFromNote()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts)) and satisfying the respective condition (missing companion link in `# Related`, or missing `description:` in frontmatter) are processed.
2. **Destination Folder for Media Extended Notes**:
   - The *destination* folder where newly generated Media Extended companion notes are written is retrieved from `this.settings.getMediaExtendedFolder()`, which defaults to `"Media Library"` at the vault root and is configurable in the plugin settings UI under **Media Extended -> Media Extended Folder**.
3. **Where It Is Documented**:
   - In [`README.md`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/README.md#method-6-create-missing-media-extended-notes) under **Method 6** and **Method 7** ("Scans the vault...").
   - In code JSDoc comments in [`src/main.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts#L810-L813) and [`src/main.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts#L910-L913).
   - In this development document ([`DEVELOPMENT.md`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/DEVELOPMENT.md#q8-where-do-the-create-missing-media-extended-notes-and-upgrade-tags--description-commands-discover-notes-from-and-is-this-documented)).

---

### Q9: Why and how is note discovery restricted to specific folders instead of scanning the entire vault?

**Context**: User requested: *"We do need to restrict it to certain folders as it wouldn't be efficient to run it vault-wide unless the user wanted."*

**Answer**:
1. **Performance & Efficiency Rationale**:
   - In large vaults with thousands or tens of thousands of markdown files, scanning every note requires reading each file from disk to check for YouTube URLs, companion notes, and frontmatter. This is I/O-intensive and unnecessary when a user organizes video notes into designated folders (e.g. `YouTube`, `Videos`, `Notes/Summaries`).
   - Running vault-wide should be an explicit, opt-in choice rather than the default behavior.
2. **Multi-Layered Architecture**:
   - **Persistent Setting (`scanFolders`)**:
     A configurable setting (`Video notes folders to scan (optional)`) in plugin settings accepts a comma-separated list of folder paths. If populated, default batch commands and settings buttons automatically target these folders without scanning the rest of the vault.
   - **Interactive Selection (`FolderSuggestModal`)**:
     Commands ending in `in folder...` and corresponding settings buttons open a fuzzy-search modal listing all vault folders, with `/ (Vault root)` as the top item for 1-click vault-wide execution when explicitly desired.
     If `scanFolders` is empty, calling the default batch commands automatically prompts via `FolderSuggestModal` to prevent accidental vault-wide scans.
   - **File Explorer Context Menus**:
     Right-clicking any folder in the Obsidian File Explorer provides instant folder-scoped actions:
     - `Upgrade YouTube notes in this folder`
     - `Create missing Media Extended notes in this folder`
     - `Upgrade video notes with tags and description in this folder`
   - **Dedicated Vault Commands & Buttons**:
     Explicit commands (`... in entire vault`) and buttons (`... All in Vault`) allow running across the whole vault whenever the user intentionally chooses to do so.
3. **Filtering & Path Normalization**:
   - Implemented via [`parseFolderList()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts), [`filterFilesByFolderPaths()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts), and [`filterFilesByFolder()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts). It normalizes slashes, handles trailing slashes, and performs strict prefix matching (`${folder}/` or exact match).

---

### Q10: How does the per-run Media Extended checkbox at the summary prompt work without altering the permanent setting?

**Context**: User requested: *"Checkbox to choose at summary prompt whether to create Media Extended note or not, even if it's turned on (important: inherits state of permanent setting but doesn't change it)"*

**Answer**:
1. **State Inheritance without Mutation**:
   - Both [`YouTubeURLModal`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/ui/modals/youtube-url.ts) and [`CustomPromptModal`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/ui/modals/CustomPromptModal.ts) accept an `initialCreateMediaExtended: boolean` constructor argument.
   - When the modal is instantiated, this parameter is initialized from `this.settings.getCreateMediaExtendedNotes()`, pre-populating the modal's toggle to reflect the user's permanent default preference.
   - Toggling the checkbox in the modal only modifies a local instance property (`this.createMediaExtended`) on the modal itself. It does **not** call `this.settings.updateCreateMediaExtendedNotes()` or mutate `settings.json`.
2. **Per-Run Execution Override**:
   - When the user submits the modal, the local boolean value is passed to the submission callback.
   - In [`summarizeVideo()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts) and [`retrieveTranscript()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts), the method checks `createMediaExtendedOverride !== undefined ? createMediaExtendedOverride : this.settings.getCreateMediaExtendedNotes()`.
   - If an override is provided for that run, it controls whether `createMediaExtendedCompanionNote()` is called, while leaving the global configuration intact for future runs.

---

### Q11: How does the OpenAI-compatible Active Model architecture work, and how does the LM Studio auto-detection connect and discover local models?

**Context**: User requested:
- Documenting the OpenAI-compatible setting for Active Model to instruct users how to configure an OpenAI API compatible server instead of built-in frontier models.
- Implementing an LM Studio setting that automatically detects a local LM Studio instance (`http://localhost:1234/v1` or `http://127.0.0.1:1234/v1`) and connects to it, discovering loaded models and setting the active model (similar to Cline).

**Answer**:
1. **OpenAI-Compatible Architecture & Active Model Selection**:
   - The plugin abstracts all AI interactions behind the [`AIModelProvider`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/types.ts) interface.
   - For custom providers, selecting Provider Type **`OpenAI`** instantiates [`OpenAIProvider`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/providers/openai.ts) with the custom `baseURL`.
   - **Credential Fallback**: The official `openai` JS SDK throws an error during constructor initialization if `apiKey` is an empty string. Since local offline servers (LM Studio, Ollama, LocalAI, vLLM) do not require authentication by default, [`OpenAIProvider`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/providers/openai.ts) defaults to `'not-needed'` whenever the user provides an empty API key.
   - **Base URL Normalization**: [`normalizeOpenAIBaseUrl()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/lmStudio.ts) automatically prefixes missing protocols, strips trailing slashes, and appends `/v1` if omitted, preventing common user errors when entering server addresses.
   - **Parameter Compatibility**: While modern OpenAI models use `max_completion_tokens`, some custom or legacy servers reject this parameter. [`OpenAIProvider`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/providers/openai.ts) catches parameter rejection errors and seamlessly falls back to `max_tokens`.
   - **Connection Testing Resilience**: Many local servers implement `GET /v1/models` (`client.models.list()`) but return 404 on `GET /v1/models/{model}` (`client.models.retrieve()`). [`testConnection()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/providers/openai.ts) falls back to `client.models.list()` to avoid false negative connection failures.
   - **Active Model Integration**: Once added, any model under a custom provider appears in the unified **Active Model** dropdown at the top of the AI Providers settings tab (`Provider / Display Name`) and is used for all summary tasks.

2. **LM Studio One-Click Auto-Detection & Connection**:
   - **Discovery Pipeline**: Implemented in [`detectLMStudioServer()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/lmStudio.ts).
     - Tests the target URL with dual-stack candidate resolution (`localhost:1234` and `127.0.0.1:1234`) using Obsidian's `requestUrl` (bypassing Electron CORS restrictions) with `fetch` fallback.
     - Fetches `GET /v1/models` and parses model entries via [`parseLMStudioModels()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/lmStudio.ts).
     - Identifies loaded models (`state === 'loaded'`) and sorts them to the top of the candidate list.
   - **Settings Synchronization**: Implemented in [`syncLMStudioProvider()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/settingsManager.ts).
     - Automatically registers or updates the "LM Studio" provider in user settings (`type: 'openai'`, `apiKey: 'not-needed'`, `url: detectedUrl`).
     - Populates all discovered models and sets the **Active Model** to the detected loaded model.
   - **Multi-Point UI Access**:
     - **Settings Tab**: A dedicated "LM Studio (Local LLM)" card with a **Detect & Connect** button.
     - **Provider Accordion**: A **Refresh from LM Studio** button inside the LM Studio card to quickly re-sync newly loaded models after switching weights in LM Studio.
     - **Command Palette**: A dedicated command `Detect and connect local LM Studio instance` for keyboard-driven local model switching.

---

### Q12: How are descriptions and timestamps integrated into Media Extended companion notes, and how is heading spacing standardized?

**Context**: User requested:
1. New option to put description in Media Extended companion note (on by default).
2. If description has timestamps, bring them over but modify them to be in Media Extended format.
3. Add headings for each section to Media Extended note:
   - `# Description` for the description
   - `# Transcript` for the transcript
   - Continue to carry over transcript timestamps as Media Extended links.
4. Put an empty line before the content begins after added headings, including in the Video Summary note after the `# Related` heading.

**Answer**:
1. **Description Inclusion & Setting Architecture**:
   - Added `DEFAULT_MEDIA_EXTENDED_INCLUDE_DESCRIPTION = true` in [`src/defaults.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/defaults.ts).
   - Added `mediaExtendedIncludeDescription` property in [`StoredSettings`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/types.ts) and getter/setter methods in [`SettingsManager`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/settingsManager.ts).
   - In [`SettingsTab`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/ui/settings.ts), a toggle control *Include description in Media Extended note* lets users enable or disable description inclusion.
   - When generating companion notes in [`createMediaExtendedCompanionNote()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts), the option `{ includeDescription: this.settings.getMediaExtendedIncludeDescription() }` is passed to [`buildMediaExtendedNote()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts).

2. **Description Timestamp Parsing & Conversion Pipeline**:
   - Implemented in [`convertDescriptionTimestampsToMediaExtended()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts):
     - **Timestamp Pattern**: Matches 2-part (`M:SS`, `MM:SS`) and 3-part (`H:MM:SS`, `HH:MM:SS`) timestamps where seconds are strictly `[0-5]\d`.
     - **Token Protection Steps**:
       1. Detects and converts existing markdown links where the link text is a timestamp (`[01:23](...)`), updating the target URL to Media Extended format `https://www.youtube.com/watch?v=VIDEO_ID&t=SECONDS#t=MM:SS.00` and replacing with a temporary protected token (`@@@ME_PROTECTED_TOKEN_N@@@`).
       2. Protects any other existing markdown links (`[text](url)`) to avoid corrupting link labels or target URLs.
       3. Protects raw URLs (`https://...` or `http://...`) so digits or port numbers inside URLs are never touched.
       4. Detects bracketed timestamps (`[01:23]`), converting them cleanly into `[01:23](url)` without generating double brackets (`[[01:23](url)]`).
       5. Detects standalone timestamps guarded by lookbehind (`(?<=^|[\s(>•-])`) and lookahead (`(?=$|[\s):.,!?-])(?!\\s*(?:am|pm)\\b)`). This safely matches timestamps after bullets, dashes, colons, or parentheses while rejecting times of day (e.g. `10:00 AM`) and aspect ratios (e.g. `16:9`).
       6. Restores all protected tokens.

3. **Heading Organization & Empty Line Formatting**:
   - In [`buildMediaExtendedNote()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts), companion note content is organized under explicit markdown headings:
     - `# Description\n\n${formattedDescription}` (if description exists and setting is enabled)
     - `# Transcript\n\n${formattedTranscript}` (if transcript exists)
     - `# Related\n\n- [[Summary Note]]`
   - In [`addRelatedLink()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts), creating or updating the `# Related` section always guarantees an empty line (`\n\n`) between the `# Related` header and the first bulleted wikilink. Because `addRelatedLink()` is used for both directions (summary note to companion note, and companion note to summary note), both files adhere to the clean markdown spacing standard.



