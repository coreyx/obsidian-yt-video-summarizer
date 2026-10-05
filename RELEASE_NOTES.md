# Release Notes - YouTube Video Summarizer

## v1.17.0

### Highlights

YouTube Video Summarizer v1.17.0 makes Media Extended clearly optional and tidies up the settings screen:

* 🧩 **Media Extended Is Optional**: The plugin works fully without Media Extended. Companion notes are now off by default, and the settings tell you whether Media Extended is installed.
* 🗂️ **Reorganized Settings**: Settings are grouped into five tabs with section headings, with every Media Extended setting in one place.

### What's Changed in v1.17.0

#### 🧩 Media Extended
* **Create Media Extended notes** is now **off by default** for new installs. Your existing setting is kept, and you can still choose per video in the summary popup.
* The new **Media Extended** settings tab shows whether the Media Extended plugin is installed and enabled, with a button to open its page in Community plugins.
* Turning the setting on without Media Extended installed (or with it disabled) asks whether you'd like to open that page. The setting stays on either way: companion notes are regular Markdown, and their timestamp links open in your browser.

#### 🗂️ Settings
* **AI Providers**: unchanged.
* **Summary**: the prompt, generation options, and where summary notes go.
* **Media Extended**: plugin status, the create toggle, folder, note contents (cover, description, transcript), and creating missing notes.
* **Tags & Metadata**: tags, the video description, playlist discovery, and the YouTube Data API key.
* **Maintenance**: batch upgrades and the last batch report.
* No settings were removed or renamed; they've only moved.

---

## v1.16.0

### Highlights

YouTube Video Summarizer v1.16.0 lets you fill in what's missing on the notes you already have:

* 🏷️ **Tag With AI or YouTube**: Add tags to a video note on demand, from your AI model or from YouTube.
* 🔗 **Create the Other Note**: Turn a summary note into a Media Extended note, or a YouTube Media Extended note into an AI summary, with one command.

### What's Changed in v1.16.0

#### 🏷️ Tag With AI / Tag With YouTube
* **Tag with AI** suggests topic tags from the note's summary using your active AI model and your vault's existing tags (same as *Generate semantic topic tags*).
* **Tag with YouTube** adds the video's YouTube tags plus creator hashtags from the title and description.
* New tags are merged into frontmatter with the same deduplication as summarizing; nothing else in the note changes.

#### 🔗 Create Companion Note for Current Note
* **Create Media Extended note for current note** (from a summary note) builds the Media Extended note in your *Media Extended notes folder*.
* **Create video summary note for current note** (from a Media Extended note for a YouTube video) generates the AI summary in your *Video summaries folder*.
* Both link the two notes under `# Related` and are also available by right-clicking a note in the File Explorer.
* If a note for the same video already exists in the target folder, you're asked before it's rebuilt or regenerated. Properties and tags you added are kept.
* Summarizing a video again now also keeps properties and tags you added to its existing Media Extended note.

---

## v1.15.0

### Highlights

YouTube Video Summarizer v1.15.0 keeps summary notes lean and makes new notes work the way you'd expect:

* 📝 **Description on Demand**: Add the video description to a summary note only when you want it, with clickable chapter timestamps.
* 🗒️ **Smarter Blank Notes**: A new "Untitled" note that only has tags (for example, from a template) now gets the summary written into it.

### What's Changed in v1.15.0

#### 📝 Add Description to Video Summary Note
* New command **Add description to video summary note** adds a `## Description` section (before `# Related`) with every timestamp as a clickable YouTube link.
* If the note already has a `## Description`, you're asked before it's replaced.
* Uses the note's frontmatter description first, otherwise fetches it from YouTube. The setting is now called **Use frontmatter description when adding description to body** and applies to both "Add description" commands (your existing choice is kept).
* **Removed** the *Include video description in summary note* setting: summaries no longer copy the description into the body. It's still saved in frontmatter, where you can always find it.

#### 🗒️ Untitled Notes With Only Tags Count as Blank
* The summary is written into the current note when its name starts with "Untitled", it has no body, and `tags` is its only frontmatter. Your tags are kept and merged with any new ones.
* Any other note with content still gets a new summary note in your video summaries folder, linked at the cursor.

---

## v1.14.0

### Highlights

YouTube Video Summarizer v1.14.0 puts the video's cover image right in your notes:

* 🖼️ **Cover at the Top of Media Extended Notes**: New Media Extended notes now open with the video's cover image, above the description and transcript.
* 📌 **Insert a Cover Anywhere**: A new command drops the video's cover image into any note at your cursor.

### What's Changed in v1.14.0

#### 🖼️ Cover Embed in Media Extended Notes
* New setting **Embed cover in Media Extended notes** (on by default) adds `![Cover](https://i.ytimg.com/...)` at the top of the body of new companion notes.
* The image uses the same URL as the note's `cover` property, including the high-quality fallback for older videos.
* Adding a description or transcript later keeps the cover at the top, and refreshing metadata never moves or duplicates it. Existing notes aren't changed; use the new command to add a cover to them.

#### 📌 Insert Video Cover at Cursor
* Run **Insert video cover at cursor** in any note with a YouTube video to insert `![Cover](url)` where your cursor is.
* Uses the note's `cover` property when it's a URL, otherwise the YouTube thumbnail (so older notes with a broken cover still get a working image).
* Doesn't check for an existing cover image, so you can place it wherever you like.

---

## v1.13.0

### Highlights

YouTube Video Summarizer v1.13.0 is about richer, more reliable metadata, and keeping your existing notes up to date with it:

* 🔄 **Refresh Video Metadata**: Refresh the frontmatter of a single note or a whole folder of video summary and Media Extended notes, picking up new fields and fixes without touching your summaries, tags, or custom properties.
* 📊 **Video Stats in Summary Notes**: Summary notes now record `duration`, `published_at`, `view_count`, `like_count`, and `aspect_ratio`.
* 🎬 **Fill In Media Extended Notes**: New commands add a `# Description` or `# Transcript` section to a Media Extended note, with Media Extended timestamp links.
* 🖼️ **Images That Load**: Media Extended covers now point to the real YouTube thumbnail, and thumbnails fall back gracefully for older videos.

### What's Changed in v1.13.0

#### 🔄 Refresh Video Metadata
* Run **Refresh video metadata in current note** or **Refresh video metadata in folder...**, or right-click a note or folder in the File Explorer.
* **Summary notes**: title, channel, thumbnail, video stats, playlist, and description (per your settings) are refreshed.
* **Media Extended notes**: all Media Extended frontmatter, including `cover` and `aspect_ratio`, is refreshed while keeping `mx-uid`.
* Never changes the note body, tags, AI-extracted thumbnail text, `video_url`, or properties you added. No AI model is used, and folder runs show live progress and a report.

#### 📊 Video Stats
* `duration` (seconds), `published_at`, `view_count`, `like_count`, and `aspect_ratio` (e.g. `16 / 9`) are added to summary notes when YouTube provides them, in the same format Media Extended notes use.
* Media Extended notes use the video's real aspect ratio (e.g. `9 / 16` for Shorts) instead of always `427 / 240`.

#### 🎬 Media Extended Notes
* **Add description to Media Extended note** and **Add transcript to Media Extended note** write a body section with Media Extended timestamp links. If the section already exists, you're asked before it's replaced, and `# Description` always stays above `# Transcript`.
* New setting **Use frontmatter description for Media Extended notes** (on by default) copies the note's frontmatter description into the body; otherwise the description is fetched from the YouTube Data API (with a no-key fallback).

#### 🖼️ Fixes
* Media Extended `cover` now uses the full thumbnail URL (`https://i.ytimg.com/vi_webp/<id>/maxresdefault.webp`) instead of a link to a missing local file. Run **Refresh video metadata** on your Media Extended folder to fix existing notes.
* Covers and summary note thumbnails fall back to the high-quality thumbnail when YouTube has no max-resolution one (common for older videos).

---

## v1.12.0

### Highlights

YouTube Video Summarizer v1.12.0 changes where summaries go, so your existing notes stay as you wrote them:

* 📂 **New Video Summaries Folder**: Choose a default / fallback folder for new summary notes (default `Video Summaries` in the vault root).
* 🔗 **Summarize From Any Note**: Running the summarizer from a note that already has content or frontmatter now creates a new summary note in that folder and drops a link to it at your cursor. Your note is otherwise left untouched.
* 🧭 **Keep Working While It Runs**: The summary is written to the right note when it's ready, even if you've switched to another note or tab.

### What's Changed in v1.12.0

#### 📂 Note Placement
* **Blank note** → the summary is written into that note (as before); *Set note title from video* still renames it.
* **Note with a body and/or frontmatter** → a new note is created in the *Video summaries folder* and linked at the cursor (after the selected URL, if you selected one). It's named after the video as soon as the title is fetched, and the link updates to match.
* Links follow your Obsidian link format preference (wikilinks or markdown links).

#### 🛟 Safer Runs
* Summaries are written through the vault instead of the active editor, so changing focus mid-run can't send them to the wrong note.
* If a run fails, the new note is moved to the trash and its link is removed from your note.
* If you type into a blank note while it's being summarized, the summary is appended instead of overwriting your text.

---

## v1.11.0

### Highlights

YouTube Video Summarizer v1.11.0 makes timestamps reliably clickable everywhere, gives you per-video control over Media Extended companion notes, and fixes playlist titles:

* ⏱️ **Every Timestamp Is a Link**: In video summary notes, every timestamp — in the transcript, the description, or the AI summary — now links to that moment in the YouTube video (`[01:05](https://www.youtube.com/watch?v=...&t=65s)`). Plain chapter timestamps in descriptions (`0:00 Intro`, `[04:20]`, `(05:15)`) are converted automatically. Media Extended companion notes always use Media Extended playback links (`#t=01:05.61`).
* 🎬 **Per-Video Media Extended Choices**: The summary and transcript popups now let you include or skip the description and the transcript in the Media Extended note for that video only, alongside the existing "Create Media Extended note" toggle. Your permanent settings are never changed.
* 📋 **Playlist Titles Fixed**: Playlist titles no longer show up as a generic "Playlist". A new **Fix playlist title placeholder** command repairs notes created by earlier versions.
* 📊 **Batch Progress & Reports**: Batch upgrade commands show live progress and keep a detailed report you can review and export.

### What's Changed in v1.11.0

#### ⏱️ Timestamp Links
* **Summary notes** link every timestamp to YouTube in standard format; code blocks, inline code, wikilinks, times of day (`10:00 AM`), and other links are left untouched.
* **Media Extended notes** link every timestamp in Media Extended format.
* The *Link transcript timestamps to YouTube* and *Format timestamps for Media Extended* settings were removed, since each note type now has a fixed format.

#### 🎬 Media Extended Notes
* New per-run toggles: *Include description in Media Extended note* and *Include transcript in Media Extended note* (greyed out when note creation is off).
* New permanent setting: *Include transcript in Media Extended note* (on by default).

#### ⚙️ New Defaults
* The video description is now **off by default** in the summary note body (it remains on by default in Media Extended notes and in frontmatter). Existing saved settings are kept.

#### 📋 Playlists
* Titles come from the YouTube Data API when a key is set, with a no-key fallback; if no real title is found, the placeholder is omitted rather than saved.
* **Fix playlist title placeholder** (Command Palette and folder right-click menu) repairs existing notes using only the stored `playlist_id`.

#### 📊 Batch Operations
* Live progress notices and status bar updates for all batch upgrade commands.
* **View last batch operation report & logs** opens a report with per-note results, filters, clickable note links, and Markdown export.

---

## v1.10.0

### Highlights

YouTube Video Summarizer v1.10.0 brings major enhancements to semantic tagging, local model integration, creator playlist discovery, and folder-scoped workflow execution:

* 🧠 **Context-Aware AI Semantic Topic Tagging**: Automatically indexes your entire vault's tag taxonomy into a compressed cache prior to inference, allowing the AI model to reuse existing tags, identify missing topics, and organize tags hierarchically (e.g. `ai/machine-learning` instead of flat `ai-machine-learning`). See [`AI_TAGGING.md`](AI_TAGGING.md) for full architectural documentation.
* 💻 **LM Studio One-Click Auto-Detection & OpenAI-Compatible Servers**: Connect local offline models running in LM Studio (`http://localhost:1234/v1`) with a single click. Plus full support for running any custom OpenAI-compatible server (LM Studio, Ollama, LocalAI, vLLM, OpenRouter) as the Active Model with zero API costs.
* 📋 **Upgrade Notes with Creator Playlists Command**: Automatically scan notes missing playlist frontmatter, discover playlist membership via YouTube Data API and metadata fallbacks, and merge playlist metadata safely without altering summaries or overwriting tags.
* 📁 **Folder-Scoped Batch Operations**: Restrict batch upgrades to specific folders, comma-separated configured scan folders, whole vault, or directly via Obsidian File Explorer right-click folder context menus.
* 🎬 **Media Extended Enhancements**: Organized companion notes under clean section headings (`# Description`, `# Transcript`, `# Related`), added an option to include creator descriptions with automatically converted Media Extended playback timestamps (`#t=mm:ss.ms`), and added an interactive per-run companion note checkbox in summary modals.

---

### What's Changed in v1.10.0

#### 🧠 Improved AI Topic Tagging & Compressed Vault Tag Cache
* **Whole-Vault Tag Indexing**: Automatically builds a compressed cache of all existing tags across your vault immediately prior to inference, passing established group prefixes and existing tags into the prompt.
* **Strict Taxonomy Rules**: Prompts the AI model to answer what topic(s) the video belongs to and what obvious tag is missing, strictly prioritizing the reuse of existing vault tags, kebab-case formatting, and hierarchical grouping under established prefixes (e.g. `ai/machine-learning` instead of `ai-machine-learning`).
* **Hierarchical Deduplication**: Normalization logic in `deduplicateTags()` explicitly favors nested tags with `/` over flat hyphenated variants.
* **Zero Overhead**: Inactive and completely bypassed when `Generate semantic topic tags` is toggled off.

#### 💻 Local LLMs: LM Studio Auto-Detection & OpenAI-Compatible Server Support
* **Auto-Discovery**: Click **Detect & Connect** in settings (or run Command Palette command `Detect and connect local LM Studio instance`) to detect LM Studio, fetch loaded models, and configure the active model instantly.
* **Refresh Support**: Click **Refresh from LM Studio** to sync newly loaded model weights without re-entering configurations.
* **OpenAI-Compatible Active Model**: Connect any OpenAI-compatible API gateway (Ollama, LocalAI, vLLM, OpenRouter) as the Active Model with automatic `/v1` endpoint normalization and fallback parameter handling (`max_completion_tokens` vs `max_tokens`).

#### 📋 Upgrade Notes with Creator Playlists
* **Command Palette**: Run `Upgrade video summary notes with playlist from YouTube Data API`, `...in folder...`, or `...in entire vault`.
* **Settings Card**: Action buttons under *Upgrade playlist frontmatter* to process selected folders or the whole vault.
* **Safe Frontmatter Merging**: Safely populates `playlist_title`, `playlist_url`, `playlist_id`, `playlist_index`, and `playlist_count` while strictly preserving custom properties, tags, and summary body text.

#### 📁 Folder-Scoped Batch Operations
* **Configured Scan Folders**: Specify comma-separated folders under `Scan folders for batch upgrades` (e.g. `YouTube, Media/Summaries`) to automatically restrict batch runs.
* **Folder Picker**: Dedicated commands open an interactive folder search modal (`FuzzySuggestModal`).
* **File Explorer Context Menu**: Right-click any folder in Obsidian's navigation tree to trigger targeted upgrades for notes inside that folder.

#### 🎬 Media Extended Enhancements
* **Section Headings & Spacing**: Companion notes now feature distinct `# Description`, `# Transcript`, and `# Related` sections with standardized spacing.
* **Description Timestamp Conversion**: Video description timestamps (e.g. `01:23`, `[04:20]`, `1:05:30`) are converted into clickable Media Extended playback links.
* **Per-Run Checkbox Toggle**: Summary prompt modals feature an interactive checkbox to choose whether to generate companion notes on a per-video basis without changing your permanent setting.

---

## Installation via BRAT

1. In Obsidian, open **Settings > Community plugins**.
2. Install and enable the **BRAT** (Beta Reviewers Auto-update Tester) plugin.
3. Open BRAT settings and click **Add Beta plugin**.
4. Enter the repository URL: `https://github.com/coreyx/obsidian-yt-video-summarizer`
5. Click **Add Plugin**, then enable **YouTube Video Summarizer** in Community plugins.
