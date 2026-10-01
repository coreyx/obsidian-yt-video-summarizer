# Release Notes - YouTube Video Summarizer v1.7.0

## Highlights

YouTube Video Summarizer v1.7.0 brings powerful new transcript retrieval capabilities and native media player integration:

* 📜 **Direct Video Transcript Retrieval**: New dedicated `Get YouTube video transcript` command in the Command Palette extracts full video transcripts with metadata, thumbnail, tags, and frontmatter without using AI or consuming API tokens.
* 📑 **Transcript Dump in Summary Mode**: Optional setting (`Include transcript in summary note`) to append the full transcript under a `## Transcript` section when generating AI summaries (disabled by default).
* ⏱️ **Clickable YouTube Timestamp Links**: Timestamps are formatted as clickable links that jump directly to that point in the YouTube video (`[01:05](https://youtube.com/watch?v=...&t=66)`). Enabled by default.
* 🎬 **Media Extended Player Integration**: Seamless compatibility with the [Media Extended](https://github.com/aidenlx/media-extended) plugin using fragment timestamps (`[01:05](https://www.youtube.com/watch?v=...&t=66#t=01:05.61)`). Clicking timestamps directly seeks within Obsidian's embedded Media Extended video player. Enabled by default.

---

## What's Changed in v1.7.0

### 📜 Direct Transcript Retrieval (Zero AI Tokens)
* Retrieve complete transcripts directly via the Command Palette command **Get YouTube video transcript**.
* Works by prompting for a YouTube URL, using an active note URL, or selecting a URL in text.
* Inserts complete metadata: note title, thumbnail embed, creator links, tags, and YAML frontmatter.

### 📑 Include Transcript in Summary Notes
* You can now choose to archive the raw video transcript alongside the AI summary note.
* Located under **Settings > Include transcript in summary note** (disabled by default).

### 🎬 Media Extended Plugin Playback Links
* Timestamp links are generated with exact millisecond playback fragments matching Media Extended's format:
  `[01:05](https://www.youtube.com/watch?v=VIDEO_ID&t=66#t=01:05.61)`
* Works with videos of any length (both `mm:ss` and `hh:mm:ss`).
* Fully configurable in plugin settings via **Link transcript timestamps to YouTube** and **Format timestamps for Media Extended**.

---

## Installation via BRAT

1. In Obsidian, open **Settings > Community plugins**.
2. Install and enable the **BRAT** (Beta Reviewers Auto-update Tester) plugin.
3. Open BRAT settings and click **Add Beta plugin**.
4. Enter the repository URL: `https://github.com/coreyx/obsidian-yt-video-summarizer`
5. Click **Add Plugin**, then enable **YouTube Video Summarizer** in Community plugins.
