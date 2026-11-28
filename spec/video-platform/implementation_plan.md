---
status: approved
---

# Record each summary's host and platform, and leave other sites' notes alone

Video summary notes from other sites may share the summary folder, and a base may want to filter notes by where the video is from. Summary notes get two new properties after `video_url`:
- `host`: the URL's hostname.
- `platform`: `youtube` for every YouTube host.

Today the plugin treats any note with a `video_url` as a YouTube video, so it could write one YouTube video's data into another site's note. It will now recognize those notes and skip them. Finally, the 810 existing summary notes in your vault's `Video Summaries` folder get both properties.

## User Review Required

> [!IMPORTANT]
> **TASK-8 edits 810 notes in your vault.** It works the same way as the `published_at` and `created` updates:
> - All 810 notes are backed up first.
> - Notes are written in place, so their creation and modified times stay the same and sorting by modified time doesn't change.
> - A check afterward confirms that the only change in each note is the two new lines.
>
> The 5 notes in the folder without a `video_url` (`Untitled`, `Video Summaries`, and three notes holding only `tags` and `created`) are left alone. The run happens with Obsidian open, as before.

> [!NOTE]
> Examples of `host`, which is lowercased with the port and a leading `www.` removed:
> - `https://www.youtube.com/watch?v=…` → `youtube.com`
> - `https://youtu.be/…` → `youtu.be`
> - `https://m.youtube.com/…` → `m.youtube.com`
> - `https://music.youtube.com/…` → `music.youtube.com`
>
> `platform` is `youtube` for all of these, and for `youtube-nocookie.com`. The plugin only writes YouTube notes, so it only ever writes `platform: youtube`. Media Extended companion notes don't get either property.

> [!NOTE]
> *Refresh video metadata* sets `host` and `platform` from the note's own `video_url`. It adds them when they're missing and corrects them when they don't match the URL. They're always worked out from the URL, so this never loses anything.

> [!NOTE]
> A note whose `video_url` is from another site is skipped with a message naming its host, e.g. `"…" is a video from vimeo.com, not YouTube.` This applies to:
> - single-note commands
> - the right-click menu
> - folder and vault runs, where the note counts as skipped, not failed
>
> A note with a YouTube link in its body but a non-YouTube `video_url` is also treated as the other site's note. The link in the body is only something the note mentions.

## Open Questions

None at this time. (Decided with the user: only `www.` is removed from `host`; summary notes only; no `platform` mapping beyond YouTube, since the plugin never writes another site's note.)

## Proposed Changes

### Host and platform

#### [NEW] `src/utils/videoPlatform.ts`
- [x] **TASK-1:** Add these functions, with TSDoc:
  - `videoHost(url: string): string | null`: parses the URL with `URL`, then lowercases the hostname and removes a leading `www.`. The port is dropped by using `hostname` rather than `host`. Returns `null` for anything that isn't an `http(s)` URL.
  - `videoPlatform(host: string | null): string | null`: returns `'youtube'` when the host is `youtube.com`, `youtu.be`, `youtube-nocookie.com`, or a subdomain of any of them (e.g. `m.`, `music.`). Returns `null` otherwise.
  - `isYouTubeVideoUrl(url: string): boolean`: shorthand for `videoPlatform(videoHost(url)) === 'youtube'`.
  - The YouTube hosts are one exported constant, `YOUTUBE_HOSTS`.

### Writing the properties

#### [MODIFY] `src/utils/frontmatter.ts`
- [x] **TASK-2:** Add `host?: string` and `platform?: string` to `FrontmatterData`, documented.
  - `buildFrontmatter()` writes them right after `video_url`, when present, as quoted strings like the other text properties.
  - `mergeFrontmatter()` adds both to `targetKeys`, so an existing value is replaced. A note that doesn't have them gets them inserted directly after its `video_url` line, not appended at the end.
- [x] **TASK-3:** Add `videoSourceFrontmatter(url)`, which returns `{ host, platform }` from `videoHost`/`videoPlatform` and leaves out whichever is `null`.

#### [MODIFY] `src/main.ts`
- [x] **TASK-4:** Spread `videoSourceFrontmatter(url)` into the three `FrontmatterData` objects that set `video_url`:
  - the summary in `summarizeVideo`
  - *Refresh video metadata*, in `refreshNoteVideoMetadata`
  - the transcript command, in `retrieveTranscript`

### Leaving other sites' notes alone

#### [MODIFY] `src/utils/frontmatter.ts`
- [ ] **TASK-5:** Make the note readers platform-aware:
  - `extractYouTubeUrlFromNote()` returns a frontmatter `video_url` only when `isYouTubeVideoUrl()` is true. When the note has a `video_url` from another site, it returns `null` without falling back to links in the body.
  - `frontmatterMatchesVideo()` only matches values that pass `isYouTubeVideoUrl()`.
  - Add `otherPlatformVideoHost(content): string | null`, which returns the host when the note's `video_url` isn't YouTube.
  - `getVideoNoteKind()` keeps classifying such a note as `'summary'`; the callers decide to skip it.

#### [MODIFY] `src/main.ts`
- [ ] **TASK-6:** Where a command now finds no YouTube video, use `otherPlatformVideoHost()` to give the other-site message instead of "No YouTube video found". The places:
  - `refreshNoteVideoMetadata`, which also returns `status: 'skipped'` with that message so folder runs count it as skipped
  - `addDescriptionToVideoSummaryNote` and `tagNote`
  - `insertVideoCoverAtCursor`
  - `createMediaExtendedNoteForSummaryNote`
  - the Summarize command's fallback to the note's own URL

  The file menu stops offering *Create Media Extended note* for a non-YouTube `video_url`. `processMediaExtendedNotes` already skips notes with no YouTube URL and needs no change.

### Tests and docs

#### [MODIFY] `tests/frontmatter.test.mjs`, `tests/media-extended.test.mjs`
- [ ] **TASK-7:** Add Test 49, using `loadSource()` against the real `src/`:
  - `videoHost`/`videoPlatform`/`isYouTubeVideoUrl` on each YouTube host form, a port, uppercase, an IP, a non-URL, and a Vimeo and a TikTok URL.
  - `buildFrontmatter` order: `video_url`, then `host`, then `platform`.
  - `mergeFrontmatter` inserting the properties after `video_url` in a note without them, and correcting a wrong value.
  - `extractYouTubeUrlFromNote` returning `null` for a TikTok `video_url` with a YouTube link in the body.
  - `frontmatterMatchesVideo` rejecting a TikTok URL whose path holds an 11-character ID-like segment.
  - `otherPlatformVideoHost`.
  - Add the new functions to the mutation list in `scratch/test_real_source.mjs`, and a wiring check that the three `FrontmatterData` builders in `main.ts` call `videoSourceFrontmatter`.

### Your vault

#### [NEW] `scratch/add_host_platform.py` (scratchpad, not committed)
- [ ] **TASK-8:** Back up the 810 notes, then add `host` and `platform` after `video_url` in each, using the same rules as TASK-1.
  - Notes are written in place, so the file's creation time is kept, and the modified time is put back afterward.
  - It works oldest-modified first, and skips notes without a `video_url` or that already have the two properties.
  - It's tested first on a copy of the folder.
  - A check afterward confirms, for every note, that the only change is the two new lines and that both file times are unchanged.
  - Results are logged per note.

#### [MODIFY] `README.md`, `CHANGELOG.md`, `DEVELOPMENT.md`
- [ ] **TASK-9:** Update the docs:
  - `README.md`: add `host` and `platform` to the frontmatter property list and the example notes.
  - `CHANGELOG.md`: under Unreleased, add `host`/`platform` and the other-site skipping (as a fix for the mistaken video match).
  - `DEVELOPMENT.md`: add Test 49 to the test table.

## Verification Plan

### Automated Tests
`npm test`, `npm run build` and `node scratch/test_real_source.mjs`, which together check:

1. Test 49 passes against the real source (TASK-7).
2. No test file copies a plugin function.
3. The suite fails when any of the new functions is broken, by mutation.
4. Every existing test still passes. Tests that pin the frontmatter order (Tests 3, 46, 48) are updated only where `host`/`platform` now appear.

For TASK-8, the vault check:

5. Exactly 810 notes changed.
6. In each, the only difference is the `host` and `platform` lines right after `video_url`.
7. Both file times match the backup.
8. The 5 notes without a `video_url` are untouched.

### Manual Verification
1. After installing the release through BRAT, summarize a video into a new note. Check that `host: "youtube.com"` and `platform: "youtube"` come right after `video_url`.
2. Run *Refresh video metadata* on an older note whose `video_url` is a `youtu.be` link. Check that it gets `host: "youtu.be"` and `platform: "youtube"` and nothing else in the note changes.
3. In a test vault, create a note with `video_url: "https://vimeo.com/76979871"` in the summary folder, then:
   - Run *Refresh video metadata* on it and check for the message naming `vimeo.com`.
   - Check that the note is unchanged.
   - Check that the right-click menu doesn't offer *Create Media Extended note*.
4. Run *Refresh video metadata in folder* on that folder. Check that the Vimeo note is reported as skipped, not failed.
5. In a base over `Video Summaries`, add the filter `platform == "youtube"` and check that all 810 notes are listed.
