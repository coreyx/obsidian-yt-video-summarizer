# Release Notes - YouTube Video Summarizer v1.8.0

## Highlights

YouTube Video Summarizer v1.8.0 introduces creator playlist discovery, YouTube Data API tag ingestion, dedicated Media Extended companion notes with bidirectional linking, and frontmatter video descriptions:

* 📋 **Creator Playlist Discovery**: Automatically detects whether an ingested video belongs to a creator playlist using URL parameters (`&list=`), video description links, or channel Data API lookups. Injects playlist title, URL, ID, index position, and item count into frontmatter and adds an interactive badge in the note header (`📋 [Playlist: Title (X/Y)](url)`).
* 🏷️ **YouTube Data API Tags & Smart Deduplication**: Ingests complete video tags/keywords from the YouTube Data API v3 and metadata. Intelligently deduplicates tags across title, description, and API metadata, reconciling kebab-case, case differences, and run-together hashtags.
* 🎬 **Media Extended Companion Notes**: Automatically generates separate companion notes formatted for the [Media Extended](https://github.com/aidenlx/media-extended) plugin in a dedicated vault folder (defaults to `Media Library/`), complete with `mx-uid`, cover embed, duration, and timestamped transcripts.
* 🔗 **Bidirectional Companion Note Linking**: Automatically links AI summary notes and Media Extended companion notes to each other using wikilinks in a `# Related` section.
* 📝 **Video Description in Frontmatter**: Ingests full YouTube video descriptions into YAML frontmatter (`description: |-`) by default with a configurable toggle.

---

## What's Changed in v1.8.0

### 📋 Creator Playlist Discovery
* Discovers series/playlist metadata automatically from:
  1. Input video URLs containing `&list=PLAYLIST_ID` and `&index=N` (ignoring system mixes like `RD...`, `WL`, and `LL`).
  2. Series playlist links posted by creators in the video description.
  3. YouTube Data API queries for the channel's playlists and video membership positions.
* Injects structured playlist metadata into YAML frontmatter:
  - `playlist_title`: Title of the series/playlist.
  - `playlist_url`: Direct URL to the playlist.
  - `playlist_id`: YouTube playlist identifier.
  - `playlist_index`: 1-based index position of this video in the playlist.
  - `playlist_count`: Total number of videos in the playlist.
* Renders a clickable playlist badge in the note body header:
  `👤 [Author](authorUrl)  🔗 [Watch video](videoUrl)  📋 [Playlist: Series Title (3/12)](playlistUrl)`
* Fully supported in **Summarize video**, **Get transcript**, and batch **Upgrade previous notes**.

### 🏷️ YouTube Data API Tags & Smart Deduplication
* Ingests full creator tags/keywords from YouTube Data API v3 and InnerTube metadata into Obsidian tags.
* Enhanced tag deduplication collapses duplicate tags across title, description, and Data API, normalizing `#RickAstley` to `rick-astley` without redundant tags.
* Configurable setting: **Extract tags from YouTube Data API** and optional **YouTube Data API key**.

### 🎬 Media Extended Companion Notes & Bidirectional Linking
* When **Create Media Extended notes** is enabled (on by default), ingesting a video creates a companion note in `Media Library/` (configurable).
* Includes Media Extended frontmatter: `mx-uid`, `video`, `title`, `description`, `duration`, `creator`, `published_at`, `view_count`, `like_count`, `cover`, and `aspect_ratio`.
* Automatically establishes two-way wikilinks between the AI summary note and the Media Extended note under `# Related`.

### 📝 Video Description in YAML Frontmatter
* Full YouTube video description is saved in frontmatter under `description: |-`.
* Configurable in plugin settings under **Add description to frontmatter** (enabled by default).

---

## Installation via BRAT

1. In Obsidian, open **Settings > Community plugins**.
2. Install and enable the **BRAT** (Beta Reviewers Auto-update Tester) plugin.
3. Open BRAT settings and click **Add Beta plugin**.
4. Enter the repository URL: `https://github.com/coreyx/obsidian-yt-video-summarizer`
5. Click **Add Plugin**, then enable **YouTube Video Summarizer** in Community plugins.
