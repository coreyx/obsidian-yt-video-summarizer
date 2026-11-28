# Walkthrough: Make the test suite exercise the real plugin source

The test suite used to assert against its own copies of the plugin's functions (94 of them in one 4,300-line file), so a change or break in `src/` could still pass. Every test now runs the real code from `src/`, bundled for Node by esbuild with a stand-in for the `obsidian` module. Logic no test could reach was moved into exported functions that the plugin itself calls, every copy is gone, and the suite is split into one file per area. A verification script proves the suite fails when any of 86 plugin functions is broken.

This work shipped in release 1.22.0.

## What Was Implemented

### 1. Test harness
- **`tests/helpers/obsidian-stub.mjs`**: stands in for `obsidian` at runtime. `requestUrl` calls a handler the test sets with `setRequestUrlHandler()`, and throws when none is set, so no test can reach the network by accident. `Notice` records messages in `notices`. It also provides empty base classes (`Plugin`, `Modal`, `Setting`, `TFile`, `TFolder`, `FuzzySuggestModal`, `PluginSettingTab`) and an Obsidian-compatible `normalizePath`.
- **`tests/helpers/loadSource.mjs`**: `loadSource(srcPath)` bundles a `src/` entry point in memory, resolves the `src/*` alias, sends every `obsidian` import to the stub, and caches the bundle per path. It replaced the hand-written esbuild blocks in Tests 42 to 46.
- **`tests/helpers/obsidianFakes.mjs`, `tests/helpers/settings.mjs`**: fake editors, a fake app, and a fake plugin whose `loadData()`/`saveData()` drive the real `SettingsManager`.

### 2. Suite layout
- **`tests/test-features.mjs`** was split into nine files: `frontmatter`, `timestamps`, `media-extended`, `youtube`, `tags`, `providers`, `settings`, `summary-note` and `operations` (`tests/<area>.test.mjs`). Each test keeps its `// Test <n>` header.
- **`package.json`**: `npm test` is now `node --test tests/`. It runs every `*.test.mjs` file and fails if any one fails.

### 3. Copies replaced by imports of the real code
- **`src/utils/frontmatter.ts`**: 47 copies replaced by imports. The copies of three internal helpers are now checked through the public functions instead: `buildVideoStatsLines` through `buildFrontmatter`/`mergeFrontmatter`, and `splitYamlBlocks` through `mergeYamlBlocks`.
- **`vaultTags.ts`, `lmStudio.ts`, `mediaExtendedPlugin.ts`, `BatchProgressTracker.ts`**: 9 copies replaced by imports.
- **`YouTubeService`**: the static methods (`decodeHTML`, `getCoverUrl`, `getAvailableThumbnailUrl`, `extractPlaylistId`, `extractPlaylistIndex`, `formatAspectRatio`, `getAspectRatioFromPlayerData`) are tested directly. The thumbnail checks answer the HEAD request through the stub's `requestUrl`.

### 4. Logic moved out of plugin internals so it can be tested
These moves don't change behavior. Each function is now called by the code it came from.
- **`src/utils/youtubeMetadata.ts`** (new): `tagsFromDataApiItem`, `tagsFromPlayerDataKeywords`, `tagsFromWatchPageHtml`, `findPlaylistIdInDescription`, `collectVideoTags`. These came from inline code in `youtube.ts` and `main.ts`.
- **`vaultTags.ts`**:
  - `parseTopicTags()` replaces three identical private `parseTopics()` methods in the Anthropic, Gemini and OpenAI providers.
  - `collectVaultTagCounts()` came from `rebuildVaultTagCache()`.
- **`providers/openai.ts`**: `buildChatCompletionParams()` and `toLegacyMaxTokensParams()` replace three copies of the request-building code and the inline `max_tokens` fallback.
- **`src/utils/mediaExtendedOptions.ts`** (new): `defaultMediaExtendedRunOptions`, `resolveCompanionNoteOptions`. The plan expected this logic in `SettingsManager`, but it was in `main.ts`, so it moved here.
- **`src/utils/summaryNote.ts`** (new):
  - `buildSummaryBody` and `buildVideoMetaLine` replace two copies of the layout code, one in `generateSummary()` and one in the transcript-only path.
  - Note placement and editing: `normalizeFolderSetting`, `chooseSummaryTarget`, `findAvailableNotePath`, `composeSummaryNoteContent`, `insertTextAt`, `insertLinkAtCursor`, `frontmatterDescriptionToUse`, `replaceInNote`.
- **`prompt.ts`**: `adaptPromptForWikilinks()` came from `buildPrompt()`.
- **`FolderSuggestModal.ts`**: `sortFolders()` came from `getItems()`.
- **`frontmatter.ts` / `mediaExtendedPlugin.ts`** (TASK-17): `upsertMediaExtendedSection()`, `findNotesForVideo()`, `shouldPromptToInstallMediaExtended()`. Before this, those tests rebuilt the same chain of calls the plugin makes.

### 5. Copies that had drifted from the plugin
Switching to the real code showed that some tests were checking old or wrong behavior. In every case `src/` was right, so each test now expects what the plugin actually does:
- **Test 11:** the copy read `TFolder.isRoot` as a boolean. In Obsidian it's a method, and a function is always truthy, so the copy could never have sorted real folders. The fixtures now call it as a method.
- **Test 14:** the copy missed three of the server error wordings that trigger the `max_tokens` fallback.
- **Test 15:** the copy still rendered a description section that the real body no longer has. The description stays in frontmatter, and the test now checks that it's left out of the body.
- **Test 18:** the copy skipped `deduplicateTags`. With the real code, `secondbrain` and `second-brain` collapse into `second-brain`.
- **Test 28:** the copy only reproduced the case where topic tagging is off. The test now runs the real `rebuildVaultTagCache()` with topic tagging both on and off.
- **Test 29:** the test now checks the progress and summary notices a user sees, instead of a copy's internal list of updates.
- **Test 31:** the copy counted only an empty note as blank. The plugin also counts an "Untitled" note whose frontmatter holds only tags. The copy also appended the body without the frontmatter merge the plugin does.

No copy turned out to stand for logic that `src/` no longer has, so nothing was deleted as dead code.

### 6. Documentation
- **`DEVELOPMENT.md`**: *Testing Strategy* now covers:
  - the per-area test files and `loadSource()`
  - the stub and the fakes, and what each supports
  - the rule that tests never copy plugin code
  - how to run the verification script
- **`AI_TAGGING.md`**: now lists Test 28.6.

## Verification & Test Results

### Automated Tests
Ran `node scratch/test_real_source.mjs` on 2026-11-27, at release 1.22.0:
- **No copies left:** no test file defines a function named like an exported `src/` function, with or without a `Helper`/`test` affix. **Passed**
- **Unchanged baseline:** the suite passes on unmodified source. **Passed**
- **Mutation check:** for each of 86 target functions, the script breaks that one function in a temporary copy of `src/` and `tests/`, runs the suite there, and expects it to fail. **Passed**: every mutation made the suite fail. The real `src/` is never modified.
  - The target list grew from about 30 in the plan to 77 by TASK-18. It reached 86 with the later `topic`, `published_at` and `created` work.
  - In one run during later work, `git checkout` after a mutation wiped an uncommitted change in `src/utils/dateTime.ts`. That run modified the real tree by hand; it wasn't the script. The change was restored before committing. The script itself only works in its temporary directory.

### Regression Testing
- `npm test`: 9 files, 9 pass, 0 fail.
- `npm run build` (`tsc -noEmit` plus the esbuild production bundle): succeeded.
- Both were run after each task during implementation. Failures that came up were the drift cases listed above, and each was resolved before its task was committed.

## Manual Verification

Not yet done. 1.22.0 is on BRAT, so these steps can be run in your vault with no manual copying:

1. In BRAT, run *Check for updates to all beta plugins*, then reload Obsidian.
2. Run **Summarize video** on a YouTube video that belongs to a playlist, into a new note. Check that the note has the thumbnail, the meta line (channel, video link, playlist link), tags, `topic`, and the summary sections.
3. Run **Insert transcript** on a blank note and check that the transcript-only note renders as before.
4. Run **Tag with AI**, then **Tag with YouTube**, on that note and check that tags are added.
5. Run *Refresh video metadata in folder...* and check that the folder picker lists folders in the same order as before.
6. With LM Studio running, click **Detect & Connect** in the AI Providers tab and check that models are listed.

## Follow-ups

- **End-to-end tests in a real Obsidian** (WebdriverIO) were out of scope and still need their own spec.
- **Tests that still read `src/` as text.** These check wiring inside `main.ts` or settings UI that has no runnable unit, which is weaker than running behavior. They're in Tests 26b, 40, 41, 44, 45, 46 and 48. Some could be replaced if more of `main.ts` moves into tested functions, or by end-to-end tests.
