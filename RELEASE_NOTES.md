# Release Notes - YouTube Video Summarizer v1.2.2

## Highlights

This release resolves a critical issue where the API key configuration field was invisible in the plugin options screen, forcing users to manually edit `data.json`. It also includes major quality-of-life improvements to provider settings, resilient configuration loading, and multi-window Obsidian support.

---

## What's Changed

### 🛠️ Fixed API Key and Provider Settings Visibility
* **Direct DOM Appending**: Previously, the provider accordion builder executed a `document.querySelector` search during `display()` while the settings tab container was still detached from the window document. This resulted in `null` queries that silently prevented all provider accordions and API key input fields from rendering. Accordions are now directly appended to the container element, guaranteeing reliable rendering under all Obsidian lifecycles.
* **Auto-Expanded Active Provider**: When opening plugin settings, the active model's provider accordion (e.g., Gemini) is now expanded by default. Users no longer need to hunt for where to input their API key.
* **Responsive Model Selection**: Selecting a different active model in the dropdown now automatically expands that model's provider accordion so its API key and configuration are immediately accessible.

### 🛡️ Resilient Configuration Loading & Migration
* **Support for Manual Edits**: If you manually edited `data.json` with a top-level `"apiKey"` or `"geminiApiKey"` (or without internal metadata flags like `"isBuiltIn": true`), the plugin now safely detects, standardizes, and migrates the key into the active provider without generating duplicate entries or losing credentials.
* **Flat and Wrapped Schema Support**: Seamlessly parses both `{ settings: { ... } }` and flat `{ ... }` structures from previous plugin versions or custom setups.

### 🪟 Obsidian Multi-Window & Popout Support
* All settings DOM lookups and toggles are now strictly scoped to the settings tab's container element rather than `document`, ensuring full compatibility when settings are opened in Obsidian popout windows or secondary monitors.

### 📝 Contributors & Licensing
* Added new contributor **Corey Struzan** to the MIT License copyright notice.
