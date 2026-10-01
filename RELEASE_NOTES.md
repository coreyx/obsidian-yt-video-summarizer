# Release Notes - YouTube Video Summarizer v1.6.0

## Highlights

YouTube Video Summarizer v1.6.0 introduces cleaner note formatting options, giving you full control over note body titles and technical term linking:

* 📝 **Optional Note Body Title**: Disabled by default! Because the sanitized video title is already placed in the note filename and in the YAML frontmatter (`title:`), the `# Video Title` heading in the note body is now optional to eliminate redundancy.
* 🔗 **Optional Wikilinks in Technical Terms**: Added a setting to toggle Obsidian `[[wikilinks]]` generation in the "Technical terms" section. Enabled by default. When toggled off, terms are kept in bold text without wikilinks (`- **Term**: explanation`).
* ⚙️ **Configurable in Settings**: Both new options can be toggled at any time from the plugin settings tab.

---

## What's Changed in v1.6.0

### 📝 Optional Note Body Title
* Previously, the note body always began with `# Video Title`. Since notes are automatically renamed to the video title and include `title` in frontmatter, this heading was redundant for most workflows.
* You can now re-enable the title heading in settings if desired via **Include title in note body**.

### 🔗 Optional Technical Term Wikilinks
* The plugin can now generate technical terms with or without Obsidian `[[wikilinks]]`.
* When **Generate wikilinks for technical terms** is turned off:
  * The prompt automatically instructs the AI model not to use wikilinks.
  * A post-processor cleans any remaining `[[` and `]]` brackets from terms in the Technical terms section while preserving the term name in bold and leaving other sections untouched.

---

## Installation via BRAT

1. In Obsidian, open **Settings > Community plugins**.
2. Install and enable the **BRAT** (Beta Reviewers Auto-update Tester) plugin.
3. Open BRAT settings and click **Add Beta plugin**.
4. Enter the repository URL: `https://github.com/coreyx/obsidian-yt-video-summarizer`
5. Click **Add Plugin**, then enable **YouTube Video Summarizer** in Community plugins.
