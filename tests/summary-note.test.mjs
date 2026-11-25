// Video summary notes: body rendering, placement and paths, prompt options, folder filtering, and description/link updates.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { loadSource } from './helpers/loadSource.mjs';
import { createFakeApp, createFakeEditor } from './helpers/obsidianFakes.mjs';

const {
	buildSummaryBody,
	chooseSummaryTarget,
	composeSummaryNoteContent,
	findAvailableNotePath,
	insertLinkAtCursor,
	normalizeFolderSetting,
	replaceInNote,
} = await loadSource('src/utils/summaryNote.ts');
const { buildFrontmatter, convertTimestampsToLinks, filterFilesByFolder, filterFilesByFolderPaths, findMarkdownSection, getVideoNoteKind, stripWikilinksFromTechnicalTerms, upsertMarkdownSection } = await loadSource('src/utils/frontmatter.ts');
const { adaptPromptForWikilinks } = await loadSource('src/services/prompt.ts');

const defaultsSource = readFileSync(new URL('../src/defaults.ts', import.meta.url), 'utf8');
const meFrontmatter = '---\nmx-uid: abcdefghijklmnopqrstuvwx\nvideo: https://www.youtube.com/watch?v=dQw4w9WgXcQ\ntitle: Test\ndescription: ""\n---';
const meNoteBare = `${meFrontmatter}\n\n# Related\n\n- [[Summary Note]]\n`;

// Test 11: folder filtering and sorting
console.log('Testing folder filtering and sorting...');

function sortFolders(folders) {
	return [...folders].sort((a, b) => {
		if (a.isRoot) return -1;
		if (b.isRoot) return 1;
		return a.path.localeCompare(b.path);
	});
}

const mockFiles = [
	{ path: 'RootNote.md' },
	{ path: 'YouTube/Video1.md' },
	{ path: 'YouTube/2026/Video2.md' },
	{ path: 'Other/Note.md' },
	{ path: 'YouTube-Archived/Old.md' }, // Note prefix boundary test
];

// Obsidian's TFolder.isRoot is a method
const rootFolder = { path: '/', isRoot: () => true };
const ytFolder = { path: 'YouTube', isRoot: () => false };
const ytSubFolder = { path: 'YouTube/2026', isRoot: () => false };

assert.strictEqual(filterFilesByFolder(mockFiles, rootFolder).length, 5);

const ytFiltered = filterFilesByFolder(mockFiles, ytFolder);
assert.strictEqual(ytFiltered.length, 2);
assert.deepStrictEqual(ytFiltered.map((f) => f.path), [
	'YouTube/Video1.md',
	'YouTube/2026/Video2.md'
]);
// Ensures 'YouTube-Archived' was NOT incorrectly matched
assert(!ytFiltered.some((f) => f.path.startsWith('YouTube-Archived')));

const ytSubFiltered = filterFilesByFolder(mockFiles, ytSubFolder);
assert.strictEqual(ytSubFiltered.length, 1);
assert.strictEqual(ytSubFiltered[0].path, 'YouTube/2026/Video2.md');

const unsortedFolders = [
	{ path: 'Resources', isRoot: false },
	{ path: 'Archive', isRoot: false },
	{ path: '/', isRoot: true },
	{ path: 'YouTube', isRoot: false },
];
const sorted = sortFolders(unsortedFolders);
assert.strictEqual(sorted[0].path, '/');
assert.strictEqual(sorted[1].path, 'Archive');
assert.strictEqual(sorted[2].path, 'Resources');
assert.strictEqual(sorted[3].path, 'YouTube');
console.log('✓ folder filtering and sorting passed');

// Test 15: Optional note body title
console.log('Testing optional note body title...');
const mockTranscript = {
	title: 'Sample Video Title',
	author: 'Sample Author',
	channelUrl: 'https://youtube.com/@sample',
	description: 'Sample description text',
	videoId: '123',
	lines: [{ text: 'Hello there', offset: 1000, duration: 2000 }],
};
const bodyOptions = {
	transcript: mockTranscript,
	thumbnailUrl: 'https://img.youtube.com/vi/123/default.jpg',
	videoUrl: 'https://youtube.com/watch?v=123',
	summary: 'Summary content goes here',
};

// Default behavior: includeTitle = false
const bodyWithoutTitle = buildSummaryBody(bodyOptions);
assert.strictEqual(bodyWithoutTitle.includes('# Sample Video Title'), false);
assert.strictEqual(bodyWithoutTitle.startsWith('![Thumbnail](https://img.youtube.com/vi/123/default.jpg)'), true);
// The description stays in frontmatter ("Add description to video summary note" adds it to the body)
assert.strictEqual(bodyWithoutTitle.includes('Sample description text'), false);
assert.strictEqual(bodyWithoutTitle.includes('## Transcript'), false);

// Enabled behavior: includeTitle = true
const bodyWithTitle = buildSummaryBody({ ...bodyOptions, includeTitle: true });
assert.strictEqual(bodyWithTitle.startsWith('# Sample Video Title\n\n![Thumbnail]'), true);

// Layout: thumbnail, meta line, inline tags, then the summary
assert.strictEqual(
	buildSummaryBody({ ...bodyOptions, inlineTags: ['ai', 'pkm'] }),
	'![Thumbnail](https://img.youtube.com/vi/123/default.jpg)\n\n'
		+ '👤 [Sample Author](https://youtube.com/@sample)  🔗 [Watch video](https://youtube.com/watch?v=123)\n\n'
		+ '**Tags:** #ai #pkm\n\n'
		+ 'Summary content goes here'
);

// Timestamps the AI wrote in the summary link to the video
assert(buildSummaryBody({ ...bodyOptions, summary: 'At 01:05 it starts' }).includes('[01:05](https://www.youtube.com/watch?v=123&t=65s)'));

// A transcript-only note (no summary) always has its Transcript section
const transcriptOnlyBody = buildSummaryBody({ ...bodyOptions, summary: undefined });
assert(transcriptOnlyBody.endsWith('## Transcript\n\n- [00:01](https://www.youtube.com/watch?v=123&t=1s) Hello there'));
assert(!transcriptOnlyBody.includes('Summary content'));
console.log('✓ Optional note body title passed');

// Test 16: Optional wikilinks in technical terms
console.log('Testing optional wikilinks in technical terms...');

// Case 1: Standard wikilinks in technical terms with wikilinks in summary
const sampleSummary = [
	'## Summary',
	'This discusses [[AI]] and [[Neural Networks]].',
	'',
	'## Key points',
	'- Key point 1',
	'',
	'## Technical terms',
	'- **[[Machine Learning]]**: A subset of AI.',
	'- **[[Transformer|Transformer Architecture]]**: Attention-based model.',
	'- [[Backpropagation]]: Optimization algorithm.',
	'',
	'## Conclusion',
	'In conclusion, [[AI]] continues to evolve.'
].join('\n');

const stripped = stripWikilinksFromTechnicalTerms(sampleSummary);

// Terms should be preserved without [[ ]]
assert.strictEqual(stripped.includes('- **Machine Learning**: A subset of AI.'), true);
assert.strictEqual(stripped.includes('- **Transformer Architecture**: Attention-based model.'), true);
assert.strictEqual(stripped.includes('- Backpropagation: Optimization algorithm.'), true);

// Outside sections should maintain their wikilinks
assert.strictEqual(stripped.includes('This discusses [[AI]] and [[Neural Networks]].'), true);
assert.strictEqual(stripped.includes('In conclusion, [[AI]] continues to evolve.'), true);

// Case 2: Technical terms at the end of the text (no trailing section)
const sampleEndingTerms = [
	'## Summary',
	'Summary text.',
	'',
	'## Technical terms',
	'- **[[Kubernetes]]**: Container platform.',
	'- **[[Docker]]**: Container engine.'
].join('\n');

const strippedEnding = stripWikilinksFromTechnicalTerms(sampleEndingTerms);
assert.strictEqual(strippedEnding.includes('- **Kubernetes**: Container platform.'), true);
assert.strictEqual(strippedEnding.includes('- **Docker**: Container engine.'), true);
assert.strictEqual(strippedEnding.includes('[['), false);

// Case 3: Prompt adaptation logic
const mockDefaultPrompt = '## Technical terms\n- **[[Term 1]]**: [Explanation 1]\n- **[[Term 2]]**: [Explanation 2]';
const adaptedEnabled = adaptPromptForWikilinks(mockDefaultPrompt, true);
assert.strictEqual(adaptedEnabled.includes('**[[Term 1]]**'), true);

const adaptedDisabled = adaptPromptForWikilinks(mockDefaultPrompt, false);
assert.strictEqual(adaptedDisabled.includes('**[[Term 1]]**'), false);
assert.strictEqual(adaptedDisabled.includes('**Term 1**'), true);
assert.strictEqual(adaptedDisabled.includes('do NOT use wikilinks'), true);
console.log('✓ Optional wikilinks in technical terms passed');

// Test 23: Folder filtering and folder-scoped discovery
console.log('Testing folder filtering and folder-scoped discovery...');

// Case 1: filterFilesByFolderPaths
const mockVaultFiles = [
	{ path: 'YouTube/Rick Astley.md' },
	{ path: 'YouTube/Tutorials/Agent.md' },
	{ path: 'Notes/Videos/Conference.md' },
	{ path: 'Articles/Blog.md' },
	{ path: 'RootNote.md' }
];

const filteredByPaths = filterFilesByFolderPaths(mockVaultFiles, ['YouTube', 'Notes/Videos']);
assert.strictEqual(filteredByPaths.length, 3);
assert.deepStrictEqual(
	filteredByPaths.map((f) => f.path),
	['YouTube/Rick Astley.md', 'YouTube/Tutorials/Agent.md', 'Notes/Videos/Conference.md']
);

// Empty folder list returns all files
assert.strictEqual(filterFilesByFolderPaths(mockVaultFiles, []).length, 5);

// Case 2: filterFilesByFolder (single folder or root)
const mockSubFolder = { path: 'YouTube', isRoot: () => false };
const vaultRootFolder = { path: '/', isRoot: () => true };

const filteredByFolder = filterFilesByFolder(mockVaultFiles, mockSubFolder);
assert.strictEqual(filteredByFolder.length, 2);
assert.deepStrictEqual(
	filteredByFolder.map((f) => f.path),
	['YouTube/Rick Astley.md', 'YouTube/Tutorials/Agent.md']
);

const filteredByRoot = filterFilesByFolder(mockVaultFiles, vaultRootFolder);
assert.strictEqual(filteredByRoot.length, 5);

console.log('✓ Folder filtering and folder-scoped discovery passed');

// Test 31: Video summary note placement (blank note vs. new note in fallback folder)
console.log('Testing video summary note placement, fallback folder paths, and source note link handling...');

// 31.1: Fallback folder default and normalization
assert.strictEqual(normalizeFolderSetting(undefined, 'Video Summaries'), 'Video Summaries');
assert.strictEqual(normalizeFolderSetting('   ', 'Video Summaries'), 'Video Summaries');
assert.strictEqual(normalizeFolderSetting('/Notes\\Videos/', 'Video Summaries'), 'Notes/Videos');
assert.match(defaultsSource, /DEFAULT_VIDEO_SUMMARY_FOLDER = 'Video Summaries';/);

// 31.2: Target resolution — a blank note receives the summary; any other note (or none) gets a new note
assert.strictEqual(chooseSummaryTarget('', 'My Note'), 'current-note');
assert.strictEqual(chooseSummaryTarget('  \n\n ', 'My Note'), 'current-note');
assert.strictEqual(chooseSummaryTarget('Some notes', 'Untitled'), 'new-note');
// Tags-only frontmatter counts as blank only in a new "Untitled" note (e.g. tags from a template)
assert.strictEqual(chooseSummaryTarget('---\ntags: [a]\n---\n', 'Untitled 2'), 'current-note');
assert.strictEqual(chooseSummaryTarget('---\ntags: [a]\n---\n', 'My Note'), 'new-note');
assert.strictEqual(chooseSummaryTarget('---\ntags: [a]\n---\n\nBody', 'Untitled'), 'new-note');
assert.strictEqual(chooseSummaryTarget('', null), 'new-note');

// 31.3: Collision-free paths in the fallback folder (renaming a note onto its own path is a no-op)
const existing = new Set(['Video Summaries/My Video.md', 'Video Summaries/My Video (1).md']);
const exists = (path) => existing.has(path);
assert.strictEqual(findAvailableNotePath('Video Summaries', 'Other Video', exists), 'Video Summaries/Other Video.md');
assert.strictEqual(findAvailableNotePath('Video Summaries', 'My Video', exists), 'Video Summaries/My Video (2).md');
assert.strictEqual(findAvailableNotePath('Video Summaries', 'My Video', exists, 'Video Summaries/My Video.md'), 'Video Summaries/My Video.md');
assert.strictEqual(findAvailableNotePath('', 'Root Note', () => false), 'Root Note.md');
assert.strictEqual(findAvailableNotePath('/', 'Root Note', () => false), 'Root Note.md');
assert.strictEqual(findAvailableNotePath('Media', 'cover', () => false, undefined, 'jpg'), 'Media/cover.jpg');

// 31.4: Link inserted at the cursor, updated after rename, removed on failure
const sourceBefore = 'Watch this: https://youtu.be/dQw4w9WgXcQ\nMore notes below.';
const urlStart = sourceBefore.indexOf('https://');
const urlEnd = sourceBefore.indexOf('\n');
const placeholderLink = '[[YouTube Summary dQw4w9WgXcQ]]';

// With the URL selected, the URL is kept and the link goes after it; the cursor ends up after the link
const sourceEditor = createFakeEditor(sourceBefore, { selection: [urlStart, urlEnd] });
const linkPrefix = insertLinkAtCursor(sourceEditor, placeholderLink);
assert.strictEqual(linkPrefix, ' ');
assert.strictEqual(sourceEditor.getValue(), 'Watch this: https://youtu.be/dQw4w9WgXcQ [[YouTube Summary dQw4w9WgXcQ]]\nMore notes below.');
assert.strictEqual(sourceEditor.cursorOffset(), urlEnd + ` ${placeholderLink}`.length);
assert.strictEqual(sourceEditor.somethingSelected(), false);

// With nothing selected, the link goes at the cursor with no space
const plainEditor = createFakeEditor('Notes: ', { cursor: 7 });
assert.strictEqual(insertLinkAtCursor(plainEditor, placeholderLink), '');
assert.strictEqual(plainEditor.getValue(), `Notes: ${placeholderLink}`);

// The user keeps typing elsewhere in the note while the summary runs; the rename updates only the link
sourceEditor.replaceRange('\nA new line typed during summarization.', sourceEditor.offsetToPos(sourceEditor.getValue().length));
const sourceApp = createFakeApp({ files: { 'Source.md': sourceBefore }, openEditors: { 'Source.md': sourceEditor } });
const sourceNote = { path: 'Source.md' };
const renamedLink = '[[Never Gonna Give You Up]]';
assert.strictEqual(await replaceInNote(sourceApp, sourceNote, placeholderLink, renamedLink), true);
assert(sourceEditor.getValue().includes('https://youtu.be/dQw4w9WgXcQ [[Never Gonna Give You Up]]\n'));
assert(sourceEditor.getValue().endsWith('A new line typed during summarization.'));
// Nothing to do if Obsidian already updated the link itself
assert.strictEqual(await replaceInNote(sourceApp, sourceNote, placeholderLink, renamedLink), false);

// Failure cleanup removes exactly the inserted text
await replaceInNote(sourceApp, sourceNote, `${linkPrefix}${renamedLink}`, '');
assert.strictEqual(sourceEditor.getValue(), `${sourceBefore}\nA new line typed during summarization.`);

// 31.5: What the summary note ends up containing
const summaryFm = {
	title: 'T',
	video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
	channel_name: 'C',
	channel_username: '',
	channel_url: 'https://www.youtube.com/@c',
	thumbnail: 'thumb',
	thumbnail_text: '',
	tags: ['new-tag'],
};
const fmBlock = buildFrontmatter(summaryFm);
// A new note's placeholder text, or a blank note, is replaced by frontmatter and body
assert.strictEqual(composeSummaryNoteContent('Summarizing https://youtu.be/x…\n', true, summaryFm, 'Body'), `${fmBlock}\n\nBody`);
assert.strictEqual(composeSummaryNoteContent('', false, summaryFm, 'Body'), `${fmBlock}\n\nBody`);
// Text typed into the blank note meanwhile is kept: the body is appended and the frontmatter added
assert.strictEqual(composeSummaryNoteContent('Typed meanwhile\n', false, summaryFm, 'Body'), `${fmBlock}\n\nTyped meanwhile\n\nBody`);
// An "Untitled" note's own tags are kept alongside the new ones
const mergedIntoTagged = composeSummaryNoteContent('---\ntags:\n  - mine\n---\n', false, summaryFm, 'Body');
assert(mergedIntoTagged.includes('tags:\n  - mine\n  - new-tag\n---'));
assert(mergedIntoTagged.includes('title: "T"'));
assert(mergedIntoTagged.trimEnd().endsWith('Body'));

console.log('✓ Video summary note placement, fallback folder paths, and source note link handling passed');

// Test 37: "Add description to video summary note" (## Description with YouTube timestamp links)
console.log('Testing add description to video summary note...');

const summaryNoteFm = '---\ntitle: "Video"\nvideo_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"\ndescription: |-\n  Chapters\n  0:00 Intro\n  01:23 Setup\n---';
const summaryNoteBody = '![Thumbnail](https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg)\n\n## Summary\n\nText\n\n## Key points\n\n- Point\n\n# Related\n\n- [[Media Library/Video]]';
const summaryNoteFull = `${summaryNoteFm}\n\n${summaryNoteBody}\n`;
const ytDescriptionBody = convertTimestampsToLinks('Chapters\n0:00 Intro\n01:23 Setup', 'dQw4w9WgXcQ', 'youtube');

// 37.1: Description timestamps become clickable standard YouTube links
assert(ytDescriptionBody.includes('[0:00](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0s) Intro'));
assert(ytDescriptionBody.includes('[01:23](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=83s) Setup'));
assert(!ytDescriptionBody.includes('#t='));

// 37.2: Classified as a summary note (and Media Extended notes are not)
assert.strictEqual(getVideoNoteKind(summaryNoteFull, 'Video Summaries/Video.md', 'Media Library'), 'summary');
assert.strictEqual(getVideoNoteKind(meNoteBare, 'Media Library/Video.md', 'Media Library'), 'mediaExtended');

// 37.3: Inserted as ## Description before # Related (Media Extended link stays last)
const withSummaryDesc = upsertMarkdownSection(summaryNoteFull, 'Description', ytDescriptionBody, ['Related'], 2);
assert(withSummaryDesc.includes(`## Key points\n\n- Point\n\n## Description\n\n${ytDescriptionBody}\n\n# Related\n\n- [[Media Library/Video]]\n`));
assert(withSummaryDesc.startsWith(summaryNoteFm));

// 37.4: Appended at the end when there's no # Related
const noRelated = `${summaryNoteFm}\n\n## Summary\n\nText\n`;
assert.strictEqual(upsertMarkdownSection(noRelated, 'Description', 'D', ['Related'], 2), `${summaryNoteFm}\n\n## Summary\n\nText\n\n## Description\n\nD\n`);

// 37.5: Existing ## Description is detected and replaced in place; level-2 sections end at the next ## or #
assert.notStrictEqual(findMarkdownSection(withSummaryDesc, 'Description', 2), null);
assert.strictEqual(findMarkdownSection(withSummaryDesc, 'Description', 1), null);
const replacedSummaryDesc = upsertMarkdownSection(withSummaryDesc, 'Description', 'New', ['Related'], 2);
assert(replacedSummaryDesc.includes('## Description\n\nNew\n\n# Related'));
assert.strictEqual((replacedSummaryDesc.match(/^## Description$/gm) || []).length, 1);
const midDesc = `${summaryNoteFm}\n\n## Description\n\nOld\n\n### Sub\n\nx\n\n## Key points\n\n- P\n`;
const replacedMid = upsertMarkdownSection(midDesc, 'Description', 'New', ['Related'], 2);
assert(replacedMid.includes('## Description\n\nNew\n\n## Key points\n\n- P\n'));
assert(!replacedMid.includes('### Sub'));

// 37.6: Level-1 behavior unchanged — ## subsections belong to a # section
const level1WithSub = '# Description\n\nA\n\n## Links\n\n- x\n\n# Related\n\n- y';
assert.deepStrictEqual(findMarkdownSection(level1WithSub, 'Description'), { start: 0, end: 8 });

console.log('✓ Add description to video summary note passed');

// Test 41: The link to a new summary note is updated even when the source note's editor is unsaved
console.log('Testing summary link update against unsaved editor content...');

const unsavedLink = '[[YouTube Summary MdxaU0l3FzI]]';
const titledLink = '[[Some $1 Video Title]]';
const note = { path: 'Note.md' };

// 41.1: The link was just inserted, so it is in the editor but not yet on disk
const unsavedEditor = createFakeEditor(`Intro\n${unsavedLink}`);
const unsavedApp = createFakeApp({ files: { 'Note.md': 'Intro\n' }, openEditors: { 'Note.md': unsavedEditor } });
assert.strictEqual(await replaceInNote(unsavedApp, note, unsavedLink, titledLink), true);
assert.strictEqual(unsavedEditor.getValue(), `Intro\n${titledLink}`);
assert.strictEqual(unsavedApp.files['Note.md'], 'Intro\n'); // disk is left for the editor's own save

// 41.2: The note is no longer open: the saved file is changed ("$1" in the link is kept literally)
const closedApp = createFakeApp({ files: { 'Note.md': `Intro\n${unsavedLink}` } });
assert.strictEqual(await replaceInNote(closedApp, note, unsavedLink, titledLink), true);
assert.strictEqual(closedApp.files['Note.md'], `Intro\n${titledLink}`);

// 41.3: Another note open in an editor is never touched, and a link Obsidian already updated is a no-op
const otherEditor = createFakeEditor(unsavedLink);
const updatedApp = createFakeApp({ files: { 'Note.md': `Intro\n${titledLink}` }, openEditors: { 'Other.md': otherEditor } });
assert.strictEqual(await replaceInNote(updatedApp, note, unsavedLink, titledLink), false);
assert.strictEqual(otherEditor.getValue(), unsavedLink);
assert.strictEqual(updatedApp.files['Note.md'], `Intro\n${titledLink}`);

// 41.4: Failure cleanup removes the unsaved link the same way
const cleanupEditor = createFakeEditor(`https://youtu.be/MdxaU0l3FzI ${unsavedLink} tail`);
await replaceInNote(createFakeApp({ files: { 'Note.md': '' }, openEditors: { 'Note.md': cleanupEditor } }), note, ` ${unsavedLink}`, '');
assert.strictEqual(cleanupEditor.getValue(), 'https://youtu.be/MdxaU0l3FzI tail');

// 41.5: Both the rename and the cleanup go through replaceInNote, not vault.process on the source note
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
assert(mainSource.includes('await replaceInNote(this.app, sourceFile, oldLink, newLink);'));
assert(mainSource.includes("await replaceInNote(this.app, sourceFile, `${linkPrefix}${link}`, '');"));
assert(!/vault\.process\(sourceFile,/.test(mainSource));

console.log('✓ Summary link update against unsaved editor content passed');
