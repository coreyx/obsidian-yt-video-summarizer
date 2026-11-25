---
status: approved
---

# Make the test suite exercise the real plugin source

`npm test` runs `tests/test-features.mjs`, which defines 94 of its own copies of the plugin's functions and asserts against those copies, so a change or break in `src/` can still pass. This change makes every test import the real code from `src/` (bundled for Node with esbuild, with a small stand-in for the `obsidian` module), moves logic that is currently unreachable from a test into exported functions, deletes every copy, splits the 4,300-line test file into one file per area, and proves the suite now fails when `src/` is broken. End-to-end testing inside a real Obsidian (WebdriverIO) is out of scope and will be planned separately.

## User Review Required

> [!IMPORTANT]
> **Production code is refactored, not just tests.** About 15 pieces of logic live inside `main.ts`, `youtube.ts`, the AI providers, and `FolderSuggestModal.ts` where no test can call them. They will be moved into exported functions (mostly in new `src/utils/` modules) that the original code then calls. The moves are meant to change no behavior, and are checked by the build, the full suite, and the manual smoke test below, but they do touch the summary, tagging, and YouTube-fetch paths.

> [!IMPORTANT]
> **Switching a test to the real code may make it fail.** A copy that drifted from `src/` was testing old behavior. When that happens: if `src/` is right, the test's expectation is corrected and the change noted in the walkthrough; if `src/` looks wrong, implementation stops and the bug is raised with you rather than fixed silently inside this spec.

> [!NOTE]
> Copies that turn out to stand for logic `src/` no longer has (for example, migration steps that were removed) are deleted rather than kept alive by extracting dead code. Each one is listed in the walkthrough with the reason.

> [!NOTE]
> A function that is only an internal step of an exported one (`buildVideoStatsLines` inside `buildFrontmatter`, `splitYamlBlocks` inside `mergeYamlBlocks`) is tested through the exported function instead of being exported just for tests.

> [!NOTE]
> Tests that read `src/` files as text and search for strings (e.g. "main.ts calls `getInferTopics()`") stay where they check wiring inside `main.ts` that has no runnable unit. They are weaker than behavior tests, so the walkthrough lists the ones that remain.

## Open Questions

None at this time. (Decided: split the suite into one file per area, TASK-4.)

## Proposed Changes

### Test harness

#### [NEW] `tests/helpers/obsidian-stub.mjs`
- [x] **TASK-1:** Write a minimal stand-in for the `obsidian` module, covering what the modules under test import at runtime:
  - `requestUrl(params)`: calls a handler a test sets with `setRequestUrlHandler(fn)`, and throws a clear error when none is set, so no test reaches the network by accident.
  - `Notice`: a class that records each message in an exported `notices` array (with `resetNotices()`), instead of showing UI.
  - Empty classes for names imported only to extend or type-check at runtime (`Plugin`, `Modal`, `Setting`, `TFile`, `TFolder`, `FuzzySuggestModal`, `PluginSettingTab`), plus `normalizePath` matching Obsidian's behavior (forward slashes, no leading/trailing or doubled slashes).

#### [NEW] `tests/helpers/loadSource.mjs`
- [x] **TASK-2:** Add `loadSource(srcPath)`, which bundles a `src/` entry point with esbuild (ESM, in memory, `src/*` path alias resolved as in `tsconfig.json`) and redirects every `obsidian` import to `obsidian-stub.mjs` through an esbuild plugin, then imports the result. Bundles are cached by path. This replaces the hand-written esbuild blocks in Tests 42 to 46.

#### [MODIFY] `tests/test-features.mjs`
- [x] **TASK-3:** Switch Tests 42, 44, 45, and 46 to `loadSource()` and remove their inline esbuild setup.

#### [NEW] `tests/*.test.mjs`, [DELETE] `tests/test-features.mjs`, [MODIFY] `package.json`
- [x] **TASK-4:** Split `tests/test-features.mjs` into one file per area, moving each numbered test unchanged (assertions and copies as they are, so this step changes no behavior) and keeping its `// Test <n>` header so later tasks can still name it:
  - `frontmatter.test.mjs`: building and merging frontmatter, tags in frontmatter, sanitizing, sections, the `topic` property.
  - `timestamps.test.mjs`: timestamp parsing, links, and transcript formatting.
  - `media-extended.test.mjs`: companion notes, covers, Related links, plugin detection.
  - `youtube.test.mjs`: HTML decoding, thumbnails, playlists, video stats, YouTube tags.
  - `tags.test.mjs`: vault tag cache, AI tag prompt, tag commands, deduplication.
  - `providers.test.mjs`: OpenAI request settings, topic-tag parsing, LM Studio.
  - `settings.test.mjs`: model migrations, Media Extended options, settings layout, default prompt upgrade.
  - `summary-note.test.mjs`: summary body, note targets and paths, prompt adjustment, folder picker.
  - `operations.test.mjs`: batch reports and live operation status.
  - Set `"test"` in `package.json` to `node --test tests/`, which runs every `tests/**/*.test.mjs` file (helpers under `tests/helpers/` are not named `.test.mjs`) and fails if any file fails. Before deleting `tests/test-features.mjs`, check that the split files together contain every `// Test <n>` and the same number of `assert` calls.

### Exported functions the tests already copy

#### [MODIFY] `tests/frontmatter.test.mjs`, `tests/timestamps.test.mjs`, `tests/media-extended.test.mjs`
- [x] **TASK-5:** Replace the copies of `src/utils/frontmatter.ts` exports with imports from `loadSource('src/utils/frontmatter.ts')` and delete the copies. This covers 46 copies across Tests 1 to 4, 7, 8, 10, 11, 16, 17, 19 to 23, 26, 32 to 35 and others (`sanitizeFileName`, `sanitizeTag`, `buildFrontmatter`, `mergeFrontmatter` and its `WithExclude`/`WithDesc`/`WithPlaylist` variants, `extractTagsFromText`, `extractYouTubeUrlFromNote`, `filterFilesByFolder`, `filterFilesByFolderPaths`, `stripWikilinksFromTechnicalTerms`, `formatTimestampParts`, `buildTimestampUrl`, `formatTranscript`, `generateMxUid`, `buildMediaExtendedFrontmatter`, `addRelatedLink`, the timestamp parsing and conversion functions, `getMediaExtendedCoverUrl`, `buildCoverEmbed`, `buildMediaExtendedNote`, `deduplicateTags`, `isMediaExtendedCompanionNote`, `hasRelatedMediaExtendedLink`, `findMarkdownSection`, `upsertMarkdownSection`, `ensureSectionOrder`, `videoStatsFrontmatter`). Test 33's `buildVideoStatsLinesHelper` and `mergeStatsHelper` and Test 34's `splitYamlBlocksHelper` are rewritten to assert through `buildFrontmatter`, `mergeFrontmatter`, and `mergeYamlBlocks`.
- [x] **TASK-6:** Replace the copies of the other exported functions and delete them: `vaultTags.ts` (`extractGroupPrefixes`, `compressVaultTags`, `buildVaultTagData`, `buildTopicGenerationPrompt`, Test 28), `lmStudio.ts` (`normalizeOpenAIBaseUrl`, `getLMStudioNativeModelsUrl`, `parseLMStudioModels`, Test 25), `mediaExtendedPlugin.ts`, and `BatchProgressTracker.ts` (`formatBatchReportAsMarkdown`, Test 29).

### YouTube service (public static methods, run against the `requestUrl` stand-in)

#### [MODIFY] `tests/youtube.test.mjs`
- [x] **TASK-7:** Test the real `YouTubeService` static methods instead of copies, and delete the copies: `decodeHTML` (Test 5), `getCoverUrl` and `getAvailableThumbnailUrl` (Test 19, with `requestUrl` answering 200 or 404 per thumbnail URL), `extractPlaylistId` and `extractPlaylistIndex` (Test 21), `formatAspectRatio` and `getAspectRatioFromPlayerData` (Test 33).

#### [NEW] `src/utils/youtubeMetadata.ts`
- [x] **TASK-8:** Move the tag-extraction and playlist-from-description parsing that is written inline in `youtube.ts` into exported pure functions, with TSDoc: tags from a YouTube Data API response body, tags from player-data `keywords`, tags from the HTML `<meta name="keywords">` fallback, merging all tag sources, and finding a playlist link/title in a video description. `YouTubeService` calls them in place of the inline code.

#### [MODIFY] `tests/youtube.test.mjs`
- [x] **TASK-9:** Point Test 18 (`extractTagsFromDataApiResponse`, `extractTagsFromPlayerDataKeywords`, `extractTagsFromHtmlFallback`, `mergeAllVideoTags`) and Test 21 (`extractPlaylistFromDescHelper`) at the functions from TASK-8, and delete the copies.

### AI providers

#### [MODIFY] `src/utils/vaultTags.ts`, `src/services/providers/anthropic.ts`, `gemini.ts`, `openai.ts`
- [x] **TASK-10:** Replace the three identical private `parseTopics()` methods with one exported `parseTopicTags(text)` in `vaultTags.ts`, used by all three providers, and point Test 6 at it.

#### [MODIFY] `src/services/providers/openai.ts`
- [x] **TASK-11:** Export two pure functions from `openai.ts`, used by `OpenAIProvider`: `buildChatCompletionParams(model, prompt, maxTokens, temperature)` (`max_completion_tokens`, temperature left out for `o1`/`o3`/`o4` reasoning models) and `toLegacyMaxTokensParams(params)` (the `max_tokens` fallback for servers that reject `max_completion_tokens`). Point Test 14 (`buildOpenAIParams`, `simulateFallback`) at them and delete the copies.

### Settings

#### [MODIFY] `tests/settings.test.mjs`
- [x] **TASK-12:** Test the real `SettingsManager` (constructed with a fake plugin whose `loadData()` returns fixture settings and whose `saveData()` records what was saved) in place of the copies in Test 12 (`migrateSelectedModelId`), Test 13 (`multiProviderMigrate`), Test 24 (`resolveMediaExtendedOption`), Test 25 (`testSyncLMStudioProvider`), and Test 26b (`resolveCompanionOptionsHelper`). Any copy whose migration path no longer exists in `settingsManager.ts` is deleted and listed in the walkthrough.

### Summary note logic now inside `main.ts`

#### [NEW] `src/utils/summaryNote.ts`
- [ ] **TASK-13:** Move the summary-body rendering from `YouTubeSummarizerPlugin.generateSummary()` (thumbnail, the meta line with channel, video and playlist links, inline tags, title, summary, and the optional transcript dump) into an exported `buildSummaryBody(options)`, with TSDoc. `generateSummary()` and the transcript-only path call it. Point Test 15 (`generateSummaryHelper`), Test 17 (`generateSummaryDumpHelper`), and Test 21 (`formatMetaLine`) at it and delete the copies.
- [ ] **TASK-14:** Move the pure parts of note placement and editing out of `main.ts` into exported functions in the same module: normalizing the video summary folder, choosing where a summary is written (`resolveSummaryTarget`), finding a free note path given an `exists(path)` callback (`getAvailableNotePath`), inserting text at an editor offset, choosing between the frontmatter and YouTube description, inserting a cover at the cursor, and the text replacement used by `replaceInNote()`. The plugin methods keep their vault and editor calls and delegate the decisions. Point Tests 31, 32, 35, and 41 at them and delete the copies.
- [ ] **TASK-15:** Move the custom-prompt adjustment for the *Link technical terms* setting out of `buildPrompt()` into an exported `adaptPromptForWikilinks(prompt, linkTerms)`, and the tag collection from file caches out of `rebuildVaultTagCache()` into an exported `collectVaultTags(appTags, fileCaches)` in `vaultTags.ts`. Point Test 16 and Test 28 (`simulateRebuildCache`) at them and delete the copies.

### Folder picker

#### [MODIFY] `src/ui/modals/FolderSuggestModal.ts`
- [ ] **TASK-16:** Move the folder ordering in `FolderSuggestModal` into an exported `sortFolders(folders)` that the modal calls, and point Test 11 at it.

### Finish

#### [MODIFY] `tests/*.test.mjs`
- [ ] **TASK-17:** Resolve every remaining copy (Test 28's `deduplicateTagsUpdatedHelper` and anything the earlier tasks did not reach): point it at real code, or delete it with the reason recorded. Afterwards no test file defines a function that re-implements plugin logic; only fixtures, fakes, and assertion helpers remain.

#### [MODIFY] `DEVELOPMENT.md`
- [ ] **TASK-18:** Update *Testing Strategy* / *Running Tests*: tests live in one `tests/<area>.test.mjs` file per area and run with `node --test`; they load the real `src/` through `tests/helpers/loadSource.mjs`, the `obsidian` stand-in and what it supports, the rule that tests never copy plugin code, and how to run the mutation check.

## Verification Plan

### Automated Tests

`scratch/test_real_source.mjs` (committed with this spec as the verification record), run with `node scratch/test_real_source.mjs`. It prints pass/fail per check:

1. **No copies left:** parses every `tests/*.test.mjs` file and fails if any function defined in one has the same name as a function exported from `src/` (with or without a `Helper`/`test` affix).
2. **Mutation check:** for each target function in a fixed list (at least one per test group above, about 30), copies `src/` and `tests/` into a temporary directory, breaks that one function (its body made to return a wrong value or throw), runs the suite there, and expects it to fail. A mutation that leaves the suite passing is reported as an untested function. The real `src/` is never modified.
3. **Unchanged baseline:** the suite passes on the unmodified source.

Also run after each task: `npm test` and `npm run build`.

### Manual Verification

1. `npm run build`, then copy `main.js`, `manifest.json`, and `styles.css` into a test vault's `.obsidian/plugins/yt-video-summarizer/` and reload Obsidian.
2. Summarize a YouTube video into a new note with **Summarize video** and confirm the note has the thumbnail, the meta line (channel, video link, playlist link for a video in a playlist), tags, `topic`, and the summary sections.
3. Run **Insert transcript** on a blank note and confirm the transcript-only note renders as before.
4. Run **Tag with AI** and **Tag with YouTube** on that note and confirm tags are added.
5. Open the folder picker (e.g. *Refresh video metadata in folder...*) and confirm folders are listed in the same order as before.
6. With LM Studio running, click **Detect & Connect** in the AI Providers tab and confirm models are listed.
