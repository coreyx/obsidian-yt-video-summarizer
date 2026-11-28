---
status: approved
---

# Add `topic` to the video summary notes that don't have it

789 of the 810 video summary notes in your vault's `Video Summaries` folder have no `topic`, because topics are only inferred when a summary is created. This works them out with your current model, OpenAI `gpt-5.4-nano`, in batches of 25 notes per request. Each batch uses the Summary section already in each note, so no transcripts are downloaded again. All batches draw on one shared set of topic names. You review the full list before anything is written. The notes are then updated in place, without changing their file times.

## User Review Required

> [!IMPORTANT]
> **Cost and what is sent.** About 32 requests and roughly 0.2M tokens: ~0.17M input and ~0.03M output, including the reasoning tokens GPT-5 models bill as output. That's about $0.07.
>
> Each request sends OpenAI 25 notes' titles and Summary sections, plus the instructions and the current list of topic names. That's the same kind of content the plugin already sends when it summarizes.
>
> The run uses the OpenAI API key stored in the plugin's settings in your vault. The key is read into memory only: it's never printed, logged or written anywhere.
>
> The run stops by itself if the reported total passes 0.5M tokens, more than twice the estimate.

> [!IMPORTANT]
> **TASK-5 edits 789 notes in your vault**, the same way as the `published_at` and `created` updates:
> - It only starts after you've approved the full list from TASK-4.
> - All 789 notes are backed up first.
> - Notes are written in place, so their creation and modified times stay the same.
> - A check afterward confirms that the only change in each note is the new `topic` list.

> [!NOTE]
> **Shared topic names.** The first batch is given the topics your 21 newest notes already use, and each later batch also gets every name chosen so far. All are asked to reuse an existing name when it fits, and to add a new one only when none does. New summaries still pick their topics independently, as they do today.

> [!NOTE]
> The first batch runs on its own as a pilot. You see its 25 notes' topics and its real token count before the other ~31 batches run. If the reasoning tokens make it cost much more than estimated, the plan stops there.

## Open Questions

None at this time. (Decided with the user: OpenAI `gpt-5.4-nano`, shared topic names, full review before writing.)

## Proposed Changes

### Batched topic prompt

#### [MODIFY] `src/utils/videoTopics.ts`
- [x] **TASK-1:** Add two exported functions, with TSDoc, so the batch format is tested against the real source:
  - `buildBatchVideoTopicsPrompt(notes: { id: number; title: string; summary: string }[], knownTopics: string[]): string`. It reuses the rules of `buildVideoTopicsPrompt()` (1 to 3 Title Case subject areas, most central first) and adds the list of topic names to reuse. It asks for exactly one line per note: `<id>: Topic A; Topic B`.
  - `parseBatchVideoTopics(text: string, ids: number[]): Map<number, string[]>`. It parses each line with the same clean-up as `parseVideoTopics()` (Title Case, no duplicates, at most 3, nothing over 50 characters), ignores ids that weren't asked for, and leaves out notes with no usable answer.

#### [MODIFY] `tests/providers.test.mjs`
- [x] **TASK-2:** Add Test 50, using `loadSource()`. It checks:
  - The prompt lists every note's id, title and summary, and the known topics.
  - Parsing handles extra spaces, list markers, comma or semicolon separators, missing ids, unasked ids, and more than three topics.
  - It also adds both functions to the mutation list in `scratch/test_real_source.mjs`.

### The backfill

#### [NEW] `topic_backfill.mjs` (scratchpad, not committed)
- [x] **TASK-3:** Work out the topics and write them to a proposal file. The vault isn't changed.
  - **Input:** each note's title and its `## Summary` section. A note with no Summary section uses its first body section instead.
  - **Notes covered:** notes with a `video_url` and no `topic`, sorted oldest-modified first and grouped 25 per request.
  - **Request:** sent to `https://api.openai.com/v1/chat/completions` with `gpt-5.4-nano` and the plugin's request settings (`buildChatCompletionParams`, loaded from `src/` with esbuild). `max_completion_tokens` is raised to 4000 so the hidden reasoning tokens can't use up the whole answer.
  - **Shared names:** the known-topic list starts with the 21 existing notes' topics, and each batch's new names are added to it.
  - **Retries:** a note missing from a reply is retried once, in one extra batch with the other missing notes.
  - **Logging:** each request's `usage` is logged, and the run stops at a total of 0.5M tokens.
  - **Pilot:** the first batch runs alone and the script stops, for the pilot review.
  - **Output:** proposals are written to `topic_proposals.json` (note path → topics) and a readable `topic_proposals.md`. The `.md` lists every note with its topics, then every distinct topic name with its note count.
- [x] **TASK-4:** Review with the user:
  1. Show the pilot results and token count, then run the remaining batches.
  2. Show the full proposal, especially the topic-name counts.
  3. Apply any renames, merges or per-note changes the user asks for, directly in `topic_proposals.json`, and show the counts again.

  Nothing goes on to TASK-5 without the user's go-ahead on the final list.
- [ ] **TASK-5:** Write the approved topics.
  - Back up the 789 notes.
  - In each note, insert the `topic` list just before `tags`, matching what the plugin writes (`topic:` then `  - <Topic>` lines). A note without `tags` gets it at the end of its frontmatter.
  - Notes are written in place, oldest-modified first, and both file times are put back afterward.
  - A note that has gained a `topic` since the proposal was made is skipped.
  - It's tested first on a copy of the folder.
  - A check afterward confirms, for every note, that the only change is the new `topic` lines and that both file times are unchanged.
  - Results are logged per note.

## Verification Plan

### Automated Tests
`npm test`, `npm run build` and `node scratch/test_real_source.mjs`, which together check:
1. Test 50 passes against the real source.
2. No test copies a plugin function.
3. The suite fails when either new function is broken, by mutation.

For the backfill:

4. The pilot's logged token usage is in line with the estimate before the full run.
5. Every one of the 789 notes has a proposal, or is listed with the reason it has none.
6. After TASK-5, exactly the proposed notes changed, each only by its `topic` lines, with both file times matching the backup.
7. The 21 notes that already had topics are untouched.

### Manual Verification
1. Open a few updated notes in Obsidian. Check that `topic` shows as a list property just before `tags`, and that the notes keep their place when the folder is sorted by modified time.
2. In a base over `Video Summaries`, group by `topic`. Check the groups match the approved name counts, with no unexpected near-duplicates.
3. Check the OpenAI usage page for the day of the run. The total should be close to the logged usage, about 0.2M tokens.
