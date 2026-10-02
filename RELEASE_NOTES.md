# Release Notes - YouTube Video Summarizer v1.9.0

## Highlights

YouTube Video Summarizer v1.9.0 introduces two new dedicated vault commands for companion note creation and metadata upgrading, along with comprehensive developer documentation:

* 🎬 **Create Missing Media Extended Notes Command**: New command scans your vault for any video summary notes that do not currently have a companion note linked under `# Related`, generates the Media Extended companion notes in your configured folder, and links them bidirectionally.
* 🏷️ **Upgrade Notes with Tags & Description Frontmatter Command**: New command scans your vault for video summary notes that lack the `description` frontmatter property, fetches complete creator tags from YouTube Data API v3 and the full video description, and safely merges them into frontmatter without running AI inference.
* 📚 **Complete Developer Documentation**: New [`DEVELOPMENT.md`](DEVELOPMENT.md) provides full architecture overviews, subsystem deep dives, testing strategy, and an active Developer Q&A log preserving technical design rationale.

---

## What's Changed in v1.9.0

### 🎬 Create Missing Media Extended Notes
* **Command Palette**: Run `Create Media Extended notes for video summaries without companion note` (`Ctrl/Cmd + P`).
* **Settings Tab**: Click **Create Missing Notes** under the *Create Media Extended notes* section.
* Detection rule: Inspects markdown notes containing YouTube URLs outside of `Media Library/` and verifies whether `# Related` contains a wikilink to the companion note (`[[Media Library/Title]]` or `[[Title]]`).
* Creates the companion note with full Media Extended frontmatter (`mx-uid`, duration, cover embed, etc.) and timestamped transcript, and appends the bidirectional link to `# Related`.

### 🏷️ Upgrade Notes with Tags & Description Frontmatter
* **Command Palette**: Run `Upgrade video summary notes with tags and description frontmatter` (`Ctrl/Cmd + P`).
* **Settings Tab**: Click **Upgrade Tags & Description** under the *Upgrade previous notes* section.
* Detection rule: Automatically finds all video summary notes whose frontmatter lacks the `description:` property.
* Ingests full creator tags/keywords from YouTube Data API v3 and the complete video description into YAML frontmatter (`description: |-`) with tag deduplication, preserving existing summaries and notes.

### 📚 Developer Documentation & Q&A Log
* Added [`DEVELOPMENT.md`](DEVELOPMENT.md) documenting plugin architecture, InnerTube ingestion, AI model retirement, playlist discovery heuristics, and tag deduplication.
* Includes an ongoing Developer Q&A log covering `mx-uid` origins, YouTube Data API reverse lookup strategies, mix filtering, and OpenAI token handling.

---

## Installation via BRAT

1. In Obsidian, open **Settings > Community plugins**.
2. Install and enable the **BRAT** (Beta Reviewers Auto-update Tester) plugin.
3. Open BRAT settings and click **Add Beta plugin**.
4. Enter the repository URL: `https://github.com/coreyx/obsidian-yt-video-summarizer`
5. Click **Add Plugin**, then enable **YouTube Video Summarizer** in Community plugins.
