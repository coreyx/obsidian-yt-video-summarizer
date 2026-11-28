---
status: approved
---

# Write the video description to `video_description` in summary notes

Video summary notes store the YouTube description in a `description` frontmatter property. You've renamed it to `video_description` across the `Video Summaries` folder, but the plugin still writes `description`. After this change, new summaries, the transcript command and *Refresh video metadata* write `video_description` instead. The commands that read the description read `video_description` first, then `description` for older notes. Media Extended notes keep `description`.

## User Review Required

> [!IMPORTANT]
> **Older notes are migrated on refresh.** When *Refresh video metadata* runs on a summary note that still has a `description` property, and *Add description to frontmatter* is on, the property is renamed to `video_description` where it sits, with the fresh text. When that setting is off, the refresh leaves the old property alone. A note is never left with both properties.
>
> This doesn't affect your vault, which has no summary notes with `description` left. It matters for anyone else who updates the plugin.

> [!IMPORTANT]
> **Bases and queries filtering on `description`** won't see notes summarized after this change. Your own vault already uses `video_description`. For other users, this is a change to the plugin's output format. See Open Questions.

> [!NOTE]
> **Media Extended notes are unchanged.** They're in `Media Library` (35 notes, all with `description`). Their `description` property belongs to the Media Extended note format, so they keep it.

## Open Questions

None at this time. (Decided with the user: a normal `Changed` entry, not a breaking change. The plugin keeps reading `description` and *Refresh video metadata* migrates old notes, so only outside queries are affected, and the changelog says so.)

## Proposed Changes

### Writing the property

#### [MODIFY] `src/utils/frontmatter.ts`
- [x] **TASK-1:** Write and merge `video_description` in summary-note frontmatter.
  - In `FrontmatterData`, rename `description?` to `video_description?`, matching the property it writes, as the other fields do.
  - `buildFrontmatter()` writes `video_description: |-` (or `video_description: ""` for an empty description) where `description` goes today.
  - `mergeFrontmatter()`:
    - treats a `video_description` block as the managed key: replaced in place when a value is given, kept otherwise;
    - when the note has a legacy `description` block and a value is given, writes `video_description` in that block's place;
    - leaves a legacy `description` block untouched when no value is given;
    - appends `video_description` at the end, as today, when the note has neither.
  - `MediaExtendedMetadata`, `buildMediaExtendedFrontmatter()`, the Media Extended refresh and `mergeYamlBlocks()` are unchanged.

#### [MODIFY] `src/main.ts`
- [ ] **TASK-2:** Use the new field and read both property names.
  - The three `FrontmatterData` builders (summary, transcript command, *Refresh video metadata*) set `video_description:` instead of `description:`. The tag sources and `MediaExtendedMetadata` objects keep `description`.
  - `getDescriptionForNote()` (*Add description* for summary and Media Extended notes) and `generateAITagsForNote()` (*Tag with AI*) read the frontmatter description through a new exported helper, `frontmatterVideoDescription(frontmatter)` in `src/utils/summaryNote.ts`. It returns `video_description` when that's a string, otherwise `description`.

### Tests

#### [MODIFY] `tests/frontmatter.test.mjs`, `tests/summary-note.test.mjs`
- [ ] **TASK-3:** Update the tests to the new key and add Test 51.
  - **Existing tests:** Tests 20 and 42 and the other summary-note cases that build or merge `description` switch to `video_description`. The Media Extended cases keep `description`.
  - **Test 51:**
    - new frontmatter writes `video_description` and no `description`;
    - merging replaces an existing `video_description` in place;
    - merging renames a legacy `description` block in place when a value is given, and leaves it alone when none is;
    - a note never ends up with both properties;
    - `frontmatterVideoDescription()` prefers `video_description`, falls back to `description`, and ignores non-strings;
    - wiring checks that `main.ts` reads the description through the helper in both places.
  - **Mutation check:** add `frontmatterVideoDescription` to the list in `scratch/test_real_source.mjs`.

### Docs

#### [MODIFY] `README.md`, `CHANGELOG.md`, `DEVELOPMENT.md`
- [ ] **TASK-4:** Document the new property name.
  - **README:**
    - the frontmatter property list,
    - the *Add Description to Frontmatter* setting (`video_description: |-`),
    - *Refresh video metadata*'s list, including the migration of an old `description`,
    - the *Add description* source note,
    - the summary-note example.
  - **CHANGELOG:** a `Changed` entry under Unreleased, or per the answer to the open question.
  - **DEVELOPMENT:** Test 51 in the test table.

## Verification Plan

### Automated Tests
`npm test`, `npm run build` and `node scratch/test_real_source.mjs`, which together check that:
1. Test 51 and the updated tests pass against the real source.
2. No test copies a plugin function.
3. The suite fails when `frontmatterVideoDescription` or any other listed function is broken.
4. The Media Extended tests still expect `description`.

### Manual Verification
These need a build of the plugin in your vault, or the next BRAT release.

1. Summarize a new video. Check that the note has `video_description` and no `description`, with the text right after `favorite`, where `description` used to go.
2. Run *Refresh video metadata* on an existing summary note. Check that `video_description` is updated in place and no `description` is added.
3. In a test note, rename `video_description` back to `description`, then run *Refresh video metadata*. Check that it comes back as `video_description` in the same place.
4. With the body empty, run *Add description to video summary note* on a summary note. Check that the text comes from `video_description` (the notice says "from frontmatter").
5. Run *Refresh video metadata* on a Media Extended note in `Media Library`. Check that it still has `description` and no `video_description`.
