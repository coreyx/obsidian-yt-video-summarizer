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
  Runs `tests/test-features.mjs` verifying 28 feature areas (filename sanitization, tag deduplication, frontmatter serialization, model migration, timestamp linking, Media Extended formatting, description timestamp conversion, playlist discovery, vault tag caching, AI topic tagging, etc.).
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
  - **LM Studio Local Auto-Discovery**: [`detectLMStudioServer()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/lmStudio.ts) queries LM Studio's native `GET /api/v0/models` (falling back to `GET /v1/models`, which has no load state) across dual-stack candidate addresses (`localhost:1234` and `127.0.0.1:1234`), parses loaded and available models, registers the provider, and updates the active model with zero manual configuration.
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
  cover: "https://i.ytimg.com/vi_webp/VIDEO_ID/maxresdefault.webp"
  aspect_ratio: 427 / 240
  ---
  ```
* **Section Headings & Description Integration**:
  - Companion notes organize content under explicit markdown headings:
    - `# Description`: Contains the creator's video description with all chapter timestamps (`0:00`, `01:23`, `[01:23]`, `1:05:30`) automatically parsed and converted into clickable Media Extended playback links (`[HH:MM:SS](https://...&t=SECONDS#t=HH:MM:SS.00)`) via [`convertDescriptionTimestampsToMediaExtended()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts).
    - `# Transcript`: Contains the timestamped transcript with Media Extended playback URLs (omitted when *Include transcript in Media Extended note* is off for the run).
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
* **Batch Playlist Upgrading**:
  - Scans existing video summary notes missing top-level `playlist_` frontmatter properties using [`isNoteMissingPlaylistFrontmatter()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts).
  - Resolves creator playlist membership via URL parameters, description links, or channel playlists via YouTube Data API v3.
  - Updates note frontmatter via `updateNoteContentWithFrontmatter(..., { excludeTags: true })`, safely preserving user tags, custom properties, and AI summary content.
  - Flexible scoping: run on selected folders, configured folders, entire vault, or directly from the File Explorer folder context menu.

### 5. Frontmatter Management, Tag Normalization & AI Tagging

* **Files**: `src/utils/frontmatter.ts`, `src/utils/vaultTags.ts`, `src/main.ts`
* **Safe Frontmatter Merging**:
  `mergeFrontmatter()` updates standard properties (`title`, `channel_name`, `video_url`, `thumbnail`, `playlist_*`, `description`) while strictly preserving existing custom frontmatter properties and aliases.
* **Tag Deduplication Pipeline**:
  `deduplicateTags()` normalizes tags across title hashtags, description hashtags, YouTube Data API keywords, and AI topic tags:
  - Converts to lowercase kebab-case.
  - Strips `#` and filesystem-illegal characters.
  - Reconciles run-together hashtags with hyphenated variants (e.g. collapses `#RickAstley` into `rick-astley`).
  - Prioritizes hierarchical grouped tags with `/` (e.g. `ai/machine-learning` over flat `ai-machine-learning`).
* **AI Semantic Topic Tagging & Compressed Vault Tag Cache**:
  - Optional setting: `Generate semantic topic tags` (`addTopicsAsTags`).
  - Prior to triggering inference, rebuilds a compressed in-memory cache of all tags across the whole vault via [`buildVaultTagData()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/vaultTags.ts) (scanning `app.metadataCache.getTags()` and cached markdown frontmatter).
  - Detects established group prefixes (e.g. `ai/`, `dev/`).
  - Injects existing video tags, cached vault tag list, established prefixes, and strict rules into the prompt:
    1. Reuses existing tags from the cached vault list whenever semantically appropriate.
    2. Only creates new tags in kebab-case when no appropriate tag exists.
    3. Groups tags under established prefixes (e.g. `ai/machine-learning` instead of `ai-machine-learning`).
  - Detailed architecture guide available in [`AI_TAGGING.md`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/AI_TAGGING.md).

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
26. Media Extended note description, timestamp conversion, section headings, and empty line formatting.
    - 26b. Summary note YouTube timestamp links (description, transcript, AI summary), code/wikilink protection, per-run Media Extended description/transcript options, and body defaults.
27. Playlist frontmatter detection, YouTube Data API playlist upgrading, candidate filtering, and tag preservation.
28. Vault tag caching, compression, group prefix detection, AI topic tagging prompt, and grouped tag deduplication.

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
   - Both [`YouTubeURLModal`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/ui/modals/youtube-url.ts) and [`CustomPromptModal`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/ui/modals/CustomPromptModal.ts) accept an `initialMediaExtendedOptions: MediaExtendedRunOptions` constructor argument (`{ createNote, includeDescription, includeTranscript }`), see Q16.
   - When the modal is instantiated, this is built by `getDefaultMediaExtendedRunOptions()` from the permanent settings, pre-populating the modal's toggles to reflect the user's default preferences.
   - The modal copies the object, and toggling only modifies that local copy. It does **not** call any `this.settings.update*()` method or mutate `settings.json`.
2. **Per-Run Execution Override**:
   - When the user submits the modal, a copy of the options is passed to the submission callback.
   - [`summarizeVideo()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts) and [`retrieveTranscript()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts) take a `mediaExtendedOptions` parameter that defaults to `getDefaultMediaExtendedRunOptions()` (e.g. when a URL is selected in the editor and no modal is shown).
   - `mediaExtendedOptions.createNote` controls whether `createMediaExtendedCompanionNote()` is called, and the description/transcript flags are forwarded to it, while leaving the global configuration intact for future runs.

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
     - Fetches `GET /api/v0/models` (LM Studio's native REST API, the only list that reports `state` and `type`), falling back to `GET /v1/models` for older versions and other servers, and parses model entries via [`parseLMStudioModels()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/lmStudio.ts).
     - Identifies loaded models (`state === 'loaded'`), sorts them to the top of the candidate list, and drops embedding models (`type === 'embeddings'`).
   - **Settings Synchronization**: Implemented in [`syncLMStudioProvider()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/settingsManager.ts).
     - Automatically registers or updates the "LM Studio" provider in user settings (`type: 'openai'`, `apiKey: 'not-needed'`, `url: detectedUrl`).
     - Populates all discovered models and sets the **Active Model** to the detected loaded model (keeping the current selection if it is one of several loaded models, or if none is loaded and it is still available).
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
   - Implemented in [`convertTimestampsToLinks()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) (wrapped by `convertDescriptionTimestampsToMediaExtended()`); the same pipeline emits standard YouTube links for summary notes (see Q16):
     - **Timestamp Pattern**: Matches 2-part (`M:SS`, `MM:SS`) and 3-part (`H:MM:SS`, `HH:MM:SS`) timestamps where seconds are strictly `[0-5]\d`.
     - **Token Protection Steps**:
       0. Protects fenced code blocks, inline code, and wikilinks.
       1. Detects and converts existing markdown links where the link text is a timestamp (`[01:23](...)`), updating the target URL to the requested format (Media Extended: `https://www.youtube.com/watch?v=VIDEO_ID&t=SECONDS#t=MM:SS.00`) and replacing with a temporary protected token (`@@@TS_PROTECTED_TOKEN_N@@@`).
       2. Protects any other existing markdown links (`[text](url)`) to avoid corrupting link labels or target URLs.
       3. Protects raw URLs (`https://...` or `http://...`) so digits or port numbers inside URLs are never touched.
       4. Detects bracketed timestamps (`[01:23]`), converting them cleanly into `[01:23](url)` without generating double brackets (`[[01:23](url)]`).
       5. Detects standalone timestamps guarded by lookbehind (`(?<=^|[\s(>•*-])`) and lookahead (`(?=$|[\s):.,!?*-])(?!\\s*(?:am|pm)\\b)`). This safely matches timestamps after bullets, dashes, colons, or parentheses while rejecting times of day (e.g. `10:00 AM`) and aspect ratios (e.g. `16:9`).
       6. Restores all protected tokens, newest first, so tokens nested inside later tokens (e.g. inline code inside link text) are restored too.

3. **Heading Organization & Empty Line Formatting**:
   - In [`buildMediaExtendedNote()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts), companion note content is organized under explicit markdown headings:
     - `# Description\n\n${formattedDescription}` (if description exists and setting is enabled)
     - `# Transcript\n\n${formattedTranscript}` (if transcript exists)
     - `# Related\n\n- [[Summary Note]]`
   - In [`addRelatedLink()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts), creating or updating the `# Related` section always guarantees an empty line (`\n\n`) between the `# Related` header and the first bulleted wikilink. Because `addRelatedLink()` is used for both directions (summary note to companion note, and companion note to summary note), both files adhere to the clean markdown spacing standard.

---

### Q13: How does the "Upgrade video summary notes with playlist from YouTube Data API" command discover candidates and merge playlist frontmatter safely?

**Context**: User requested:
- Implement a new command: `Upgrade video summary notes with playlist from YouTube Data API (if they don't have the playlist_ properties)`.
- Follow the existing folder-scoped batch pattern (folder picker, configured folders, entire vault, and File Explorer folder context menu).
- Safely update frontmatter with `playlist_*` fields without corrupting existing tags, descriptions, or custom user properties.

**Answer**:
1. **Candidate Detection & Filter**:
   - Implemented in [`isNoteMissingPlaylistFrontmatter()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts).
   - Extracts the note's YAML frontmatter block (`/^---\r?\n([\s\S]*?)\r?\n---/`).
   - If no frontmatter exists, returns `true`.
   - Checks for any top-level key matching `/^playlist(_[a-zA-Z0-9_-]*)?:\s*/m`.
   - **Multiline YAML Safety**: Top-level keys strictly begin at column 0 (`^`). Indented lines inside a multiline description block (e.g. `description: |- \n  playlist_title: ...`) start with spaces and are ignored, avoiding false negatives when video descriptions happen to mention playlist attributes.
   - The candidate scanning pipeline in [`processNotesWithPlaylist()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts):
     1. Filters out Media Extended companion notes using [`isMediaExtendedCompanionNote()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts).
     2. Extracts the video URL using [`extractYouTubeUrlFromNote()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts).
     3. Checks [`isNoteMissingPlaylistFrontmatter()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts).

2. **Playlist Discovery Pipeline**:
   - For each candidate note, the video's metadata and playlist membership are fetched via [`YouTubeService.getVideoMetadata()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/youtube.ts):
     - **URL Check**: Scans for `&list=PLAYLIST_ID` and `&index=N` in the video URL.
     - **Description Parsing**: Scans the video description for playlist links (`youtube.com/playlist?list=...`).
     - **Channel Playlists API Lookup**: If an API key is configured, queries channel playlists and determines whether the video belongs to any curated series.
   - If playlist membership is discovered, `playlist_title`, `playlist_url`, `playlist_id`, `playlist_index`, and `playlist_count` are populated.
   - If the video is a standalone video not belonging to any playlist, the note is counted as having no playlist and skipped without corrupting its frontmatter or showing errors.

3. **Safe Frontmatter Merging & Tag Protection**:
   - Note contents are updated via [`updateNoteContentWithFrontmatter()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) with `{ excludeTags: true }`.
   - [`mergeFrontmatter()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts):
     - Targets and serializes `playlist_title`, `playlist_url`, `playlist_id`, `playlist_index`, and `playlist_count`.
     - Preserves all pre-existing user-defined frontmatter properties (e.g. `rating`, `status`, `aliases`).
     - When `{ excludeTags: true }` is passed, existing frontmatter tags are preserved verbatim without being overwritten by API tags.
     - Preserves the note's existing body, AI summary, and related links unchanged.

4. **Multi-Point Execution Scopes**:
   - **Command Palette**:
     - `Upgrade video summary notes with playlist from YouTube Data API`: Runs on configured folders (or opens folder picker if none configured).
     - `Upgrade video summary notes with playlist in folder...`: Opens an interactive folder fuzzy modal.
     - `Upgrade video summary notes with playlist in entire vault`: Scans all folders in the vault.
   - **File Explorer Context Menu**:
     - Right-clicking any folder displays `Upgrade video notes with playlist in this folder`.
   - **Settings Tab**:
     - Dedicated setting card **Upgrade playlist frontmatter** with *Upgrade in Folder...* and *Upgrade All in Vault* action buttons.

---

### Q14: How does the improved AI semantic topic tagging work, how is the vault tag cache built, and how does the prompt ensure tag reuse and hierarchical grouping?

**Context**: User requested:
- Improve AI tagging for new video summaries.
- In the AI tagging prompt, ask:
  1. What topic(s) does this video belong to?
  2. Is there any obvious tag that is missing in the existing set of tags?
- Important rules:
  - Always prefer to reuse a tag that already exists instead of creating a new one. Only create new tags when necessary if semantic meaning of the desired tag does not already exist in the cached tag list.
  - Use kebab case for any new tags created.
  - Group tags where it makes sense: If there is a large group prefix like `ai/`, group the more specific part under that instead of creating an entirely new tag at the top level (e.g. `ai/machine-learning` instead of `ai-machine-learning`).
- Require a compressed cache of all tags across the whole vault, rebuilt prior to triggering inference, and added to the AI context.
- Only activate this functionality if the AI tagging feature is enabled.
- Update the feature description in settings to mention that it is semantic and inferred, uses the configured AI model and inference, and may increase the context window and token usage.

**Answer**:
1. **Activation & Architecture**:
   - The AI topic tagging feature is controlled by the optional boolean setting `Generate semantic topic tags` (`addTopicsAsTags` in [`StoredSettings`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/types.ts)).
   - When disabled, no vault tag indexing occurs and no additional LLM inference call is made (zero overhead).
   - When enabled, [`rebuildVaultTagCache()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts) runs immediately before AI inference to provide up-to-date tag context.

2. **Compressed Vault Tag Cache**:
   - Implemented in [`src/utils/vaultTags.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/vaultTags.ts) via [`buildVaultTagData()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/vaultTags.ts):
     - **Discovery**: Reads Obsidian's fast dictionary `app.metadataCache.getTags()` and supplements by scanning in-memory markdown file caches (`cache.frontmatter.tags` and `cache.tags`).
     - **Sanitization & Counting**: Strips `#`, converts to lowercase, removes invalid/numeric tags, and aggregates occurrence counts.
     - **Frequency Ranking**: Sorts tags by occurrence count descending, then alphabetically.
     - **Token Safety (Compression)**: Limits tags to top 1,000 tags by frequency, formatting them into a compact comma-separated string to minimize token overhead while giving the model exact tag strings to copy.
     - **Group Prefix Detection**: [`extractGroupPrefixes()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/vaultTags.ts) extracts all existing hierarchical root and sub-group prefixes (e.g. `ai/`, `dev/`, `finance/`).

3. **Inference Prompt Structure**:
   - Implemented in [`buildTopicGenerationPrompt()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/vaultTags.ts) and shared across Gemini, Anthropic, and OpenAI providers:
     - Asks the two required questions:
       1. *What topic(s) does this video belong to?*
       2. *Is there any obvious tag that is missing in the existing set of tags?*
     - Supplies the video's pre-identified tags (from title/description hashtags and YouTube Data API keywords).
     - Injects the cached vault tag list and detected group prefixes.
     - Enforces the strict reuse, kebab-case, and hierarchical prefix rules (`ai/machine-learning` instead of `ai-machine-learning`).
     - Constrains output to 3 to 7 concise lowercase comma-separated tags with no `#` and no markdown chatter.

4. **Hierarchical Deduplication**:
   - In [`deduplicateTags()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts), the tag collapsing pass was refined: when collapsing tags that share the same alphanumeric key (e.g. `ai-machine-learning` vs `ai/machine-learning`), hierarchical tags containing `/` are explicitly preferred over flat hyphenated variants.

5. **Settings UI Transparency**:
   - The setting description in [`src/ui/settings.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/ui/settings.ts) explicitly informs users:
     *"Use AI semantic analysis and inference with your configured AI model to infer relevant topic tags and fill in obvious missing tags. Automatically indexes your entire vault's existing tag taxonomy into a compressed cache prior to inference to prioritize tag reuse and group under established hierarchies (e.g. ai/machine-learning). Note: This is semantic and inferred, adds your vault's tag list to the AI context, and may increase the size of the context window and token usage."*

---

### Q15: How does batch operation monitoring, real-time progress tracking, error logging, and the diagnostics report modal work across all upgrade commands?

**Context**: User requested:
- Real-time progress monitoring, error logging, notifications, and status tracking for the playlist upgrade command and all other batch upgrade commands.
- Provide clear visibility into which notes succeeded, which were skipped (e.g. video not part of a playlist), and which failed with exact error messages.

**Answer**:
1. **Architecture & Data Structures**:
   - Defined structured interfaces in [`src/types.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/types.ts):
     ```ts
     export interface BatchItemResult {
         filePath: string;
         fileName: string;
         url?: string;
         status: 'success' | 'skipped' | 'error';
         message: string;
         timestamp?: number;
     }

     export interface BatchOperationReport {
         operationName: string;
         scope: string;
         startTime: number;
         endTime?: number;
         total: number;
         succeeded: number;
         skipped: number;
         failed: number;
         items: BatchItemResult[];
     }
     ```

2. **Real-Time Progress & Notification Management**:
   - Implemented in [`src/utils/BatchProgressTracker.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/BatchProgressTracker.ts):
     - **In-Place Live Notification**: Uses Obsidian's `Notice(message, 0)` with indefinite duration, updating text in place via `liveNotice.setMessage('[i/N] (X%) ...')` as each file finishes processing. Prevents UI notification stacking while keeping the user informed. Cleanly dismissed with `liveNotice.hide()` upon completion.
     - **Status Bar Integration**: Dynamically adds a transient status bar item via `this.plugin.addStatusBarItem()` displaying live percentage (e.g. `YT: [3/12] 25%`) and automatically cleans it up 4 seconds after the operation concludes.
     - **Console & Memory Logging**: Logs structured tagged lines (`[YouTube Summarizer] [SUCCESS|SKIPPED|ERROR] ...`) to the developer console and records individual items into `BatchOperationReport`.
     - **Completion Notice**: Emits a single final summary toast notifying the user of total succeeded, skipped, and failed notes, with guidance to view full logs.

3. **Batch Report & Diagnostics Modal (`BatchReportModal`)**:
   - Implemented in [`src/ui/modals/BatchReportModal.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/ui/modals/BatchReportModal.ts):
     - **Header & Timing**: Displays operation name, target scope (`vault`, `folder "..."`), start time, and total elapsed duration in seconds.
     - **Overview Metrics**: Displays color-coded metric cards for *Total*, *Succeeded* (green), *Skipped* (warning/yellow), and *Failed* (danger/red).
     - **Status Filter Controls**: Interactive filter tabs allowing the user to filter items by *All*, *Succeeded*, *Skipped*, or *Failed*.
     - **Interactive Note Links**: Each processed note is rendered with its status badge, clickable note title (which opens the note directly in Obsidian workspace and closes the modal), YouTube URL link, and exact status/error explanation.
     - **Clipboard Export**: A *Copy Log to Clipboard* action exports the entire run as a formatted GitHub-flavored Markdown report table via [`formatBatchReportAsMarkdown()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/BatchProgressTracker.ts).

4. **Full Coverage Across All 4 Batch Operations**:
   - Covered in [`src/main.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts):
     1. [`processNotesWithPlaylist`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts): Tracks notes updated with playlist metadata, notes skipped because the video is not on a playlist, and any network/API errors.
     2. [`processNotesWithTagsAndDescription`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts): Tracks notes updated with YouTube description frontmatter and tags.
     3. [`processMediaExtendedNotes`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts): Tracks generated companion notes, line counts, and bidirectional link creation.
     4. [`upgradeNotes`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts): Tracks legacy note upgrades for metadata, thumbnail OCR, and channel handles.

5. **User Access & Settings**:
   - **Command Palette**: `View last batch operation report & logs` (`view-last-batch-report`) provides immediate access to the last run's diagnostic modal.
   - **Settings Tab**: A dedicated card in [`src/ui/settings.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/ui/settings.ts) shows the summary of the last batch operation and provides a *View Last Report & Logs* button.

---

### Q16: How are timestamp formats split between video summary notes and Media Extended notes, and how do the per-run description/transcript toggles work?

**Context**: User requested:
- Per-run toggles in the video summary popup to include/exclude the description and transcript in the Media Extended note (without changing permanent settings).
- Every timestamp in the Video Summary note (description, transcript, or otherwise) linked to the original YouTube video in standard YouTube format, including raw description timestamps.
- Every timestamp in the Media Extended note in Media Extended format.
- Defaults: description and transcript **off** in the summary note body, **on** in the Media Extended note.

**Answer**:
1. **Fixed Format per Note Type**:
   - [`buildTimestampUrl(videoId, offsetMs, format)`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) is the single URL builder. `'youtube'` → `https://www.youtube.com/watch?v=ID&t=65s` (seconds floored so the link never starts after the displayed label); `'mediaExtended'` → `https://www.youtube.com/watch?v=ID&t=66#t=01:05.61` (unchanged from earlier releases).
   - [`formatTranscript()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) always links every line and takes `{ format }` (default `'youtube'`). Summary notes and the transcript-only command use `'youtube'`; companion notes use `'mediaExtended'`.
   - [`generateSummary()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts) and [`retrieveTranscript()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts) run the `## Description` section through `convertTimestampsToLinks(..., 'youtube')`. `generateSummary()` also runs the AI summary text through it, so any timestamps the model emits are linked; code, inline code, and `[[wikilinks]]` are protected.
   - The `Link transcript timestamps to YouTube` and `Format timestamps for Media Extended` settings were removed because they could produce unlinked or Media Extended–formatted timestamps in summary notes. Stale keys in `data.json` are ignored and dropped on next save.
   - Frontmatter `description` stays raw text (YAML can't hold rendered links meaningfully).
2. **Per-Run Options**:
   - `MediaExtendedRunOptions` in [`types.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/types.ts) groups `createNote`, `includeDescription`, and `includeTranscript`.
   - [`renderMediaExtendedRunOptions()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/ui/components/MediaExtendedRunOptions.ts) renders the three toggles for both modals; the description/transcript toggles are disabled while `createNote` is off.
   - [`createMediaExtendedCompanionNote()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts) accepts optional `includeDescription`/`includeTranscript` overrides and falls back to the permanent settings, so batch commands (`processMediaExtendedNotes()`) keep using the permanent settings.
3. **Defaults**: `DEFAULT_INCLUDE_VIDEO_DESCRIPTION = false`, `DEFAULT_DUMP_TRANSCRIPT_IN_SUMMARY = false`, `DEFAULT_MEDIA_EXTENDED_INCLUDE_DESCRIPTION = true`, new `DEFAULT_MEDIA_EXTENDED_INCLUDE_TRANSCRIPT = true`. Defaults only apply when the user has no saved value.

---

### Q17: Where does a new video summary go, and how does writing stay correct when the user switches notes mid-run?

**Context**: User requested a default / fallback folder for video summaries (default `Video Summaries` in the vault root). From a blank note, the summary goes into that note. From a note with a body and/or frontmatter, a new note is created, a link is inserted at the cursor, and the summary is added to the new note when finished, regardless of where the user is focused.

**Answer**:
1. **Target resolution** (Step 0 of [`summarizeVideo()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts)): if the active note's editor text is blank, it is the target. Otherwise `createPendingSummaryNote()` creates `Video Summaries/YouTube Summary <videoId>.md` immediately and inserts a link at the cursor (after the selection when a URL is selected, so the URL is kept). The link is generated with `fileManager.generateMarkdownLink()`, so it follows the user's wikilink/markdown link preference.
2. **Naming**: As soon as the transcript (and title) is fetched, `renamePendingSummaryNote()` renames the note to the sanitized title (collision-free via `getAvailableNotePath()`, shared with `setNoteTitle()`). The link in the source note is rewritten directly with `vault.process()` so it doesn't depend on the "Automatically update internal links" preference; if Obsidian already updated it, the replace is a no-op. *Set note title from video* now only governs renaming a blank note the user started from.
3. **Focus independence**: All writes after the trigger use the vault (`vault.process()` / `fileManager`), never the editor, so the summary lands in the right file even if the user switches notes or tabs. A blank target that the user typed into during the run gets the summary appended with frontmatter merged, instead of being overwritten.
4. **Failure cleanup**: If the run ends without writing the summary (transcript fetch error, AI error, exception), `discardPendingSummaryNote()` removes exactly the inserted link text from the source note and moves the placeholder note to the trash (`fileManager.trashFile()`, respecting the user's trash setting).
5. **Scope**: Applies to the summarize commands. `Get YouTube video transcript` is unchanged (it is designed to write into the note that contains the video URL).

---

### Q18: How do the "Add description / transcript to Media Extended note" commands find the video, place the section, and handle an existing section?

**Context**: User requested a command to add a description to a Media Extended note by detecting the video and pulling it from the YouTube Data API, a second command to add the transcript, and a prompt to continue if a `# Description` / `# Transcript` header already exists.

**Answer**:
1. **Scope & detection** ([`addSectionToMediaExtendedNote()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts)): the active note must pass `isMediaExtendedCompanionNote()` (inside the Media Extended folder or has `mx-uid`). The video comes from [`extractYouTubeUrlFromNote()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts), which now checks `video_url`, then the Media Extended `video` / `media` keys (YouTube URLs only, so local media like `[[file.mp4]]` is ignored), then links in the body.
2. **Existing section check**: [`hasMarkdownSection()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) looks for a level-1 heading (`# Description` / `# Transcript`, case-insensitive), skipping frontmatter and code fences. If found, [`ConfirmModal.confirm()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/ui/modals/ConfirmModal.ts) asks to continue; closing the dialog counts as cancel.
3. **Sources**: the description is written to the body only; frontmatter `description:` is never modified. With *Use frontmatter description for Media Extended notes* on (default, `mediaExtendedDescriptionFromFrontmatter`), the frontmatter `description` (read via `metadataCache`, which parses `|-` block scalars) is copied into the body when non-empty. Otherwise the description uses `fetchYouTubeDataApiVideoData()` (now also returning `snippet.description`) when a YouTube Data API key is set, and falls back to InnerTube player metadata otherwise; the Notice says which source was used. The transcript uses `fetchTranscript()` (captions), since the Data API's caption download requires OAuth.
4. **Formatting & placement**: description timestamps go through `convertDescriptionTimestampsToMediaExtended()` and the transcript through `formatTranscript(..., { format: 'mediaExtended' })`, matching the rule that every timestamp in a Media Extended note uses Media Extended links. [`upsertMarkdownSection()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) replaces the section (heading through the next level-1 heading, including any `##` subheadings) or inserts it before the earliest anchor (`Transcript`/`Related` for the description, `Related` for the transcript), else appends it; sections are separated by one empty line. The write uses `vault.process()`.

---

### Q19: Where do the video stats in summary note frontmatter come from, and how is aspect ratio determined?

**Context**: User requested `duration`, `published_at`, `view_count`, `like_count`, and `aspect_ratio` in video summary notes if easily available from the YouTube API, without jumping through hoops for aspect ratio. Separately: `# Description` must always come before `# Transcript` in Media Extended notes.

**Answer**:
1. **Sources (no new requests)**: `duration`, `published_at`, `view_count`, and `like_count` were already collected by `extractMetadataFromPlayerData()` in [`youtube.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/services/youtube.ts) (InnerTube player data, YouTube Data API when a key is set, watch page fallback) for Media Extended notes. `aspect_ratio` comes from `getAspectRatioFromPlayerData()`: the largest `streamingData` format's width/height, reduced by GCD into CSS form (`16 / 9`, `4 / 3`, `9 / 16`). The ANDROID client response used for transcripts includes these dimensions (verified 2026-10-02 against `dQw4w9WgXcQ` → 3840×2160 and `jNQXAC9IVRw` → 320×240). If none are present, `aspect_ratio` is omitted.
2. **Frontmatter**: [`videoStatsFrontmatter()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) maps metadata to `FrontmatterData`; `buildVideoStatsLines()` is shared by `buildFrontmatter()` and `mergeFrontmatter()` so new and upgraded notes match. Formats mirror Media Extended notes (seconds, unquoted `YYYY-MM-DD` so Obsidian treats it as a date, unquoted `W / H`). Missing or malformed values are omitted; zero counts are kept. All six `FrontmatterData` builders in `main.ts` spread `videoStatsFrontmatter()`.
3. **Upgrade detection unchanged**: `isNoteMissingFrontmatter()` does not require the new keys, so batch upgrades don't re-fetch every existing note; the stats are written whenever an upgrade runs on a note for another reason (or via *Upgrade current note*).
4. **Media Extended aspect ratio**: `createMediaExtendedCompanionNote()` passes the detected ratio; `buildMediaExtendedFrontmatter()` still falls back to `427 / 240`.
5. **Description before Transcript**: after `upsertMarkdownSection()`, the add-section commands run [`ensureSectionOrder(content, 'Description', 'Transcript')`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts), which moves `# Description` directly above `# Transcript` if a note has them reversed. New companion notes are already built in order by `buildMediaExtendedNote()`.

---

### Q20: How does "Refresh video metadata" decide what to update, and how does it avoid clobbering notes?

**Context**: User asked for a reusable command for both Media Extended notes and video summary notes that refreshes metadata, for individual notes or a folder, so future metadata fields (or fixes like the Media Extended `cover` URL) can be applied to existing notes.

**Answer**:
1. **Entry points** ([`main.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts)): `refresh-video-metadata-current-note`, `refresh-video-metadata-folder` (folder picker), and `file-menu` items for a note (`refreshVideoMetadataInNote()`) and a folder (`refreshVideoMetadataInFolder()`, using `BatchProgressTracker` with a 300 ms delay between notes). Both share `refreshNoteVideoMetadata()`.
2. **Classification**: [`getVideoNoteKind()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) returns `mediaExtended` (`isMediaExtendedCompanionNote()`), `summary` (frontmatter has a `video_url` URL), or `null`. Notes that merely contain a YouTube link are skipped, so folder runs never add summary frontmatter to unrelated notes.
3. **Summary notes**: builds `FrontmatterData` like *Upgrade current note*, but with `excludeTags: true` (tags preserved), the existing `thumbnail_text` (from `metadataCache`, so no AI call), the note's own `video_url` (may carry playlist parameters), and `description` only when *Add description to frontmatter* is on; merged with `updateNoteContentWithFrontmatter()`. Thumbnail uses `getAvailableThumbnailUrl()`.
4. **Media Extended notes**: [`refreshMediaExtendedNoteContent()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) builds fresh Media Extended frontmatter (keeping the existing `mx-uid`, cover from `getCoverUrl()`), then [`mergeYamlBlocks()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) replaces matching top-level key blocks in place (including multi-line `description: |-`), appends new keys, and keeps every other key and comment. Notes that use `media:` instead of `video:` don't get a duplicate `video:`. The body is untouched, and refreshing is idempotent.
5. **Extending later**: add a field to `videoStatsFrontmatter()` / `buildVideoStatsLines()` (summary notes) or `buildMediaExtendedFrontmatter()` (Media Extended notes), and the refresh commands will backfill it.

---

### Q21: How is the cover embedded in Media Extended notes, and how does "Insert video cover at cursor" pick the image?

**Context**: User requested an option (on by default) to add the cover as an inline embed at the top of the body of Media Extended notes created by the plugin, and a command to insert it at the cursor in an existing note without checking whether one already exists.

**Answer**:
1. **One cover URL**: [`getMediaExtendedCoverUrl()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) returns the provided cover (quotes stripped) or the max-resolution WebP thumbnail. `buildMediaExtendedFrontmatter()` and the body embed both use it, so `cover:` and `![Cover](...)` always match (including the `hqdefault` fallback chosen by `YouTubeService.getCoverUrl()`).
2. **Embed in new notes**: `buildMediaExtendedNote()` takes `embedCover` (off by default in the pure function); `createMediaExtendedCompanionNote()` passes the *Embed cover in Media Extended notes* setting (`mediaExtendedEmbedCover`, default on). The embed is the first body block, so `upsertMarkdownSection()` inserts `# Description` / `# Transcript` after it and `addRelatedLink()` still appends `# Related` at the end. Refresh video metadata only touches frontmatter, so it never adds or moves the embed.
3. **Insert at cursor**: [`insertVideoCoverAtCursor()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts) captures the cursor before any network call, finds the video with `extractYouTubeUrlFromNote()`, prefers an `http(s)` `cover` frontmatter value (via `metadataCache`), else `getCoverUrl()`, and inserts `buildCoverEmbed(url)` with no duplicate check. Works in any note with a detectable YouTube video.

---

### Q22: When does the summarizer treat the current note as blank?

**Context**: User requested that a note count as blank even if it has tags when: (1) tags are the only frontmatter, (2) no body exists, and (3) the note name starts with "Untitled" (refines Q17).

**Answer**: [`isBlankNoteForSummary(content, noteName)`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) returns true for an empty note, or when **all** of these hold: the name starts with "Untitled" (case-insensitive, so "Untitled 3" matches), the content is a frontmatter block followed only by whitespace, and every top-level frontmatter key is `tags` (list or inline form; an empty `---`/`---` block also qualifies). Step 0 of `summarizeVideo()` uses it instead of `content.trim() === ''`. Writing then takes the existing merge path (`updateNoteContentWithFrontmatter()`), which keeps the note's tags and merges new ones; *Set note title from video* renames the Untitled note as before.

---

### Q23: Why was "Include video description in summary note" removed, and how does "Add description to video summary note" work?

**Context**: User asked to replace the option that always put the description in the summary note body with an on-demand command (like the Media Extended one), since the body copy is only useful to make description timestamps clickable — they aren't in frontmatter.

**Answer**:
1. **Removed**: the `includeVideoDescription` setting (types, defaults, settings manager, settings UI) and the `## Description` blocks in `generateSummary()` and `retrieveTranscript()`. The description still goes to frontmatter per *Add description to frontmatter*. Stale `includeVideoDescription` keys in `data.json` are ignored and dropped on the next save.
2. **Command** ([`addDescriptionToVideoSummaryNote()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts)): only runs on notes where `getVideoNoteKind()` is `summary`. Writes a level-2 `## Description` (matching the summary note's `##` sections) via `upsertMarkdownSection(..., ['Related'], 2)`, so it lands before `# Related` or at the end, and replaces an existing `## Description` after a `ConfirmModal`. Timestamps go through `convertTimestampsToLinks(..., 'youtube')`.
3. **Shared description source**: `getDescriptionForNote()` is used by both "Add description" commands: frontmatter `description` (via `metadataCache`) when the setting is on and it's non-empty, else `fetchVideoDescription()` (Data API with key, player metadata otherwise). The setting keeps its key `mediaExtendedDescriptionFromFrontmatter` for compatibility, but its label is now *Use frontmatter description when adding description to body*.
4. **Heading levels**: `findMarkdownSection()`, `hasMarkdownSection()`, and `upsertMarkdownSection()` take a `level` (default 1). A section ends at the next heading of the same or higher level, so `###` subsections belong to a `##` section and `##` subsections to a `#` section (unchanged level-1 behavior). `insertBefore` anchors are level-1 headings.

---

### Q24: How do "Tag with AI" and "Tag with YouTube" work, and how do they deduplicate?

**Context**: User requested a "Tag with AI" command that uses AI to add tags to frontmatter and a "Tag with YouTube" command that uses the YouTube API, applying the same tag deduplication as the normal summary process.

**Answer**:
1. **Entry point**: [`tagNote(file, 'ai' | 'youtube')`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts) (commands `tag-with-ai`, `tag-with-youtube`) requires a detectable YouTube video in the note, honors `isProcessing`, and writes via `vault.process()`.
2. **AI source** (`generateAITagsForNote()`): mirrors Step 4 of `summarizeVideo()` — `rebuildVaultTagCache()` then `provider.generateTopics()` with `buildTopicGenerationPrompt()` — passing the note body with frontmatter stripped (the summary), or the frontmatter `description` if the body is empty; `existingTags` are the note's current frontmatter tags and `title` is the frontmatter title or file name. Needs a selected model and a provider implementing `generateTopics`.
3. **YouTube source** (`fetchYouTubeTagsForNote()`): `fetchVideoMetadata()` tags (YouTube Data API with a key; InnerTube keywords / watch page otherwise) plus `extractTagsFromText()` hashtags from title and description when *Detect tags in video title and description* is on. The *Extract tags from YouTube Data API* toggle isn't consulted because running the command is an explicit request.
4. **Merge & dedup**: [`addTagsToNoteContent()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) reads existing tags with `extractFrontmatterTags()` (list, inline, or single value), computes `deduplicateTags([...existing, ...new])` exactly like `mergeFrontmatter()` does during summarizing, and replaces only the `tags` block via `mergeYamlBlocks()`. `added` is the deduplicated result minus the deduplicated existing tags; when it's empty the note is returned unchanged, so a no-op run never reformats existing tags.

---

### Q25: How do the "Create ... note for current note" commands find existing notes and rebuild them safely?

**Context**: User requested a "Create Media Extended note for current note" command (confirming before rebuilding an existing companion), the reverse for Media Extended notes of YouTube videos (prompting if a summary exists), and that existence checks search only the configured target folder, not the whole vault.

**Answer**:
1. **Summary → Media Extended** ([`createMediaExtendedNoteForSummaryNote()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/main.ts)): requires `getVideoNoteKind()` = `summary`; looks for an existing companion with `findVideoNotesInFolder(mediaExtendedFolder, videoId, ['video', 'media'])`; after `ConfirmModal`, fetches the transcript and calls `createMediaExtendedCompanionNote(transcript, file, undefined, existing)`. The new `existingCompanion` parameter rebuilds that exact file even if renamed; whenever an existing companion is overwritten, [`keepExtraFrontmatter()`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/frontmatter.ts) carries over keys the fresh note doesn't set (user properties, tags). The summary note gets the `# Related` link via `addRelatedLink()` (deduplicated).
2. **Media Extended → Summary** (`createSummaryNoteForMediaExtendedNote()`): requires `getVideoNoteKind()` = `mediaExtended` and a YouTube URL in the `video` / `media` frontmatter (body links don't count, so local-file media notes are refused). Checks `ensureAIReady()` (extracted from `summarizeVideo()`), looks for an existing summary with `findVideoNotesInFolder(videoSummaryFolder, videoId, ['video_url'])`, and after confirmation builds the note with `buildSummaryNoteParts()` — Steps 2–7 of `summarizeVideo()` (AI summary, thumbnail text, tags, body, frontmatter), now shared. New notes use `getAvailableNotePath()` in the video summaries folder; an existing note keeps its frontmatter merged via `updateNoteContentWithFrontmatter()` (added keys kept, tags merged) with the body replaced. Both notes are linked under `# Related`.
3. **Folder-scoped lookup**: `findVideoNotesInFolder()` uses `filterFilesByFolderPaths()` on the configured folder (subfolders included) and `frontmatterMatchesVideo()` on `metadataCache` frontmatter, comparing `extractVideoIdFromUrl()` results — so renamed notes in the folder are found, and notes elsewhere are ignored. No folder prompt: the existing *Media Extended notes folder* and *Video summaries folder* settings are the targets.
4. **File menu**: note right-click shows *Create Media Extended note* for summary notes (`video_url`, not in the Media Extended folder / no `mx-uid`) and *Create video summary note* for Media Extended notes with a YouTube `video` / `media` URL, based on cached frontmatter (the menu callback is synchronous).

---

### Q26: Does the plugin depend on Media Extended, and how are the settings organized?

**Context**: User asked to make sure the plugin works without the Media Extended plugin, default *Create Media Extended notes* to off, prompt to install Media Extended when that toggle is turned on without it, and group the Media Extended settings together while making the settings screen more intuitive.

**Answer**:
1. **No dependency**: nothing imports or calls Media Extended. Companion notes are plain Markdown with frontmatter (`mx-uid`, `video`, `cover`, ...), and Media Extended timestamp links are ordinary YouTube URLs with a `#t=` fragment, so they open in the browser when Media Extended is absent. The only code that looks at other plugins is [`src/utils/mediaExtendedPlugin.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/utils/mediaExtendedPlugin.ts).
2. **Detection**: `getMediaExtendedPluginStatus(app)` reads Obsidian's community plugin registry (`app.plugins`, not in the public typings) for plugin ID `media-extended` and returns `enabled` (loaded or in `enabledPlugins`), `disabled` (manifest present), `not-installed`, or `unknown` (registry unavailable — callers then do nothing). `openMediaExtendedPluginPage()` opens `obsidian://show-plugin?id=media-extended`.
3. **Default & prompt**: `DEFAULT_CREATE_MEDIA_EXTENDED_NOTES = false` (saved values are kept). In the settings toggle's `onChange`, the value is saved first; if it was turned on and the status is `not-installed` or `disabled`, `promptToInstallMediaExtended()` shows a `ConfirmModal` ("Open plugin page" / "Not now"). The setting stays on either way.
4. **Settings layout** ([`src/ui/settings.ts`](file:///c:/Users/corey/dev/github.com/coreyx/obsidian-yt-video-summarizer/src/ui/settings.ts)): `getTabs()` defines five tabs rendered by `displayAIProvidersSection()`, `displaySummarySection()` (prompt / generation / summary notes), `displayMediaExtendedSection()` (plugin status, create toggle, folder, note contents, create-missing buttons), `displayTagsAndMetadataSection()` (tags / video description / YouTube), and `displayMaintenanceSection()` (scan folders, batch upgrades, last batch report). Sections use `Setting.setHeading()`. Add new settings to the matching method; Test 40 asserts every Media Extended setting lives only in the Media Extended tab.
