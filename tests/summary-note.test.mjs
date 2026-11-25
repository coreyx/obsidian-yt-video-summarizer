// Video summary notes: body rendering, placement and paths, prompt options, folder filtering, and description/link updates.
import assert from 'node:assert';
import { loadSource } from './helpers/loadSource.mjs';
import { readFileSync } from 'node:fs';

const { convertTimestampsToLinks, filterFilesByFolder, filterFilesByFolderPaths, findMarkdownSection, getVideoNoteKind, stripWikilinksFromTechnicalTerms, upsertMarkdownSection } = await loadSource('src/utils/frontmatter.ts');

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
function generateSummaryHelper(transcript, thumbnailUrl, url, summaryText, inlineTags, includeDescription, includeTitle) {
	const metaLines = [
		`👤 [${transcript.author}](${transcript.channelUrl})  🔗 [Watch video](${url})`
	];

	if (inlineTags && inlineTags.length > 0) {
		metaLines.push(`**Tags:** ${inlineTags.map((t) => `#${t}`).join(' ')}`);
	}

	const summaryParts = [];
	if (includeTitle && transcript.title) {
		summaryParts.push(`# ${transcript.title}`);
	}

	summaryParts.push(
		`![Thumbnail](${thumbnailUrl})`,
		metaLines.join('\n\n'),
		summaryText
	);

	if (includeDescription && transcript.description && transcript.description.trim()) {
		summaryParts.push(`## Description\n\n${transcript.description.trim()}`);
	}

	return summaryParts.join('\n\n');
}

const mockTranscript = {
	title: 'Sample Video Title',
	author: 'Sample Author',
	channelUrl: 'https://youtube.com/@sample',
	description: 'Sample description text',
};

// Default behavior: includeTitle = false
const bodyWithoutTitle = generateSummaryHelper(
	mockTranscript,
	'https://img.youtube.com/vi/123/default.jpg',
	'https://youtube.com/watch?v=123',
	'Summary content goes here',
	undefined,
	true,
	false
);
assert.strictEqual(bodyWithoutTitle.startsWith('# Sample Video Title'), false);
assert.strictEqual(bodyWithoutTitle.includes('# Sample Video Title'), false);
assert.strictEqual(bodyWithoutTitle.startsWith('![Thumbnail](https://img.youtube.com/vi/123/default.jpg)'), true);

// Enabled behavior: includeTitle = true
const bodyWithTitle = generateSummaryHelper(
	mockTranscript,
	'https://img.youtube.com/vi/123/default.jpg',
	'https://youtube.com/watch?v=123',
	'Summary content goes here',
	undefined,
	true,
	true
);
assert.strictEqual(bodyWithTitle.startsWith('# Sample Video Title'), true);
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
function adaptPromptForWikilinks(basePrompt, linkTerms) {
	if (!linkTerms) {
		let prompt = basePrompt
			.replace(/\*\*\[\[Term 1\]\]\*\*/g, '**Term 1**')
			.replace(/\*\*\[\[Term 2\]\]\*\*/g, '**Term 2**')
			.replace(/\[\[Term (\d+)\]\]/g, 'Term $1');
		prompt += '\n\nImportant formatting rule: In the "Technical terms" section, do NOT use wikilinks (do NOT enclose terms in [[ ]]). Format terms as bold text only (e.g. - **Term**: explanation).';
		return prompt;
	}
	return basePrompt;
}

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

function normalizeVideoSummaryFolderHelper(value) {
	return (value ?? 'Video Summaries').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Video Summaries';
}

// Mirrors summarizeVideo Step 0: blank note → write into it; body and/or frontmatter (or no file) → new note
function resolveSummaryTargetHelper(editorText, hasSourceFile) {
	return hasSourceFile && editorText.trim() === '' ? 'current-note' : 'new-note';
}

function getAvailableNotePathHelper(existingPaths, folderPath, baseName, currentPath, extension = 'md') {
	const parentDir = folderPath && folderPath !== '/' ? `${folderPath}/` : '';
	let targetPath = `${parentDir}${baseName}.${extension}`;
	let counter = 1;
	while (existingPaths.has(targetPath) && targetPath !== currentPath) {
		targetPath = `${parentDir}${baseName} (${counter}).${extension}`;
		counter++;
	}
	return targetPath;
}

// 31.1: Fallback folder default and normalization
assert.strictEqual(normalizeVideoSummaryFolderHelper(undefined), 'Video Summaries');
assert.strictEqual(normalizeVideoSummaryFolderHelper('   '), 'Video Summaries');
assert.strictEqual(normalizeVideoSummaryFolderHelper('/Notes\\Videos/'), 'Notes/Videos');
assert.match(defaultsSource, /DEFAULT_VIDEO_SUMMARY_FOLDER = 'Video Summaries';/);

// 31.2: Target resolution
assert.strictEqual(resolveSummaryTargetHelper('', true), 'current-note');
assert.strictEqual(resolveSummaryTargetHelper('  \n\n ', true), 'current-note');
assert.strictEqual(resolveSummaryTargetHelper('Some notes', true), 'new-note');
assert.strictEqual(resolveSummaryTargetHelper('---\ntags: [a]\n---\n', true), 'new-note');
assert.strictEqual(resolveSummaryTargetHelper('---\ntags: [a]\n---\n\nBody', true), 'new-note');
assert.strictEqual(resolveSummaryTargetHelper('', false), 'new-note');

// 31.3: Collision-free paths in the fallback folder (renaming a note onto its own path is a no-op)
const existing = new Set(['Video Summaries/My Video.md', 'Video Summaries/My Video (1).md']);
assert.strictEqual(getAvailableNotePathHelper(existing, 'Video Summaries', 'Other Video'), 'Video Summaries/Other Video.md');
assert.strictEqual(getAvailableNotePathHelper(existing, 'Video Summaries', 'My Video'), 'Video Summaries/My Video (2).md');
assert.strictEqual(getAvailableNotePathHelper(existing, 'Video Summaries', 'My Video', 'Video Summaries/My Video.md'), 'Video Summaries/My Video.md');
assert.strictEqual(getAvailableNotePathHelper(new Set(), '', 'Root Note'), 'Root Note.md');

// 31.4: Link inserted at the cursor, updated after rename, removed on failure
function insertAtHelper(content, offset, text) {
	return content.slice(0, offset) + text + content.slice(offset);
}
const sourceBefore = 'Watch this: https://youtu.be/dQw4w9WgXcQ\nMore notes below.';
const urlEnd = sourceBefore.indexOf('\n');
const placeholderLink = '[[YouTube Summary dQw4w9WgXcQ]]';
const withLink = insertAtHelper(sourceBefore, urlEnd, ` ${placeholderLink}`);
assert.strictEqual(withLink, 'Watch this: https://youtu.be/dQw4w9WgXcQ [[YouTube Summary dQw4w9WgXcQ]]\nMore notes below.');

// User keeps typing elsewhere in the note while the summary runs
const editedMeanwhile = `${withLink}\nA new line typed during summarization.`;
const renamedLink = '[[Never Gonna Give You Up]]';
const afterRename = editedMeanwhile.replace(placeholderLink, () => renamedLink);
assert(afterRename.includes('https://youtu.be/dQw4w9WgXcQ [[Never Gonna Give You Up]]\n'));
assert(afterRename.endsWith('A new line typed during summarization.'));
// Idempotent if Obsidian already updated the link itself
assert.strictEqual(afterRename.replace(placeholderLink, () => renamedLink), afterRename);

// Failure cleanup removes exactly the inserted text
const afterCleanup = afterRename.replace(` ${renamedLink}`, '');
assert.strictEqual(afterCleanup, `${sourceBefore}\nA new line typed during summarization.`);

// 31.5: Writing into a blank note that the user typed into during summarization appends instead of overwriting
function writeSummaryHelper(current, isNewNote, fm, body) {
	return isNewNote || current.trim() === '' ? `${fm}\n\n${body}` : `${current.trimEnd()}\n\n${body}`;
}
assert.strictEqual(writeSummaryHelper('Summarizing https://youtu.be/x…\n', true, '---\ntitle: T\n---', 'Body'), '---\ntitle: T\n---\n\nBody');
assert.strictEqual(writeSummaryHelper('', false, '---\ntitle: T\n---', 'Body'), '---\ntitle: T\n---\n\nBody');
assert.strictEqual(writeSummaryHelper('Typed meanwhile\n', false, '---\ntitle: T\n---', 'Body'), 'Typed meanwhile\n\nBody');

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

// Mirrors replaceInNote(): an open editor wins over the on-disk content
async function testReplaceInNote(openEditors, disk, path, search, replacement) {
	for (const editor of openEditors) {
		if (editor.path !== path) continue;
		const index = editor.value.indexOf(search);
		if (index !== -1) {
			editor.value = editor.value.slice(0, index) + replacement + editor.value.slice(index + search.length);
			return true;
		}
	}
	const found = disk[path].includes(search);
	disk[path] = disk[path].replace(search, () => replacement);
	return found;
}

const unsavedLink = '[[YouTube Summary MdxaU0l3FzI]]';
const titledLink = '[[Some $1 Video Title]]';

// 41.1: The link was just inserted, so it is in the editor but not yet on disk
const unsavedDisk = { 'Note.md': 'Intro\n' };
const unsavedEditors = [{ path: 'Note.md', value: `Intro\n${unsavedLink}` }];
assert.strictEqual(await testReplaceInNote(unsavedEditors, unsavedDisk, 'Note.md', unsavedLink, titledLink), true);
assert.strictEqual(unsavedEditors[0].value, `Intro\n${titledLink}`);
assert.strictEqual(unsavedDisk['Note.md'], 'Intro\n'); // disk is left for the editor's own save

// 41.2: The note is no longer open: the saved file is changed
const closedDisk = { 'Note.md': `Intro\n${unsavedLink}` };
assert.strictEqual(await testReplaceInNote([], closedDisk, 'Note.md', unsavedLink, titledLink), true);
assert.strictEqual(closedDisk['Note.md'], `Intro\n${titledLink}`);

// 41.3: Another note open in an editor is never touched, and a link Obsidian already updated is a no-op
const otherEditors = [{ path: 'Other.md', value: unsavedLink }];
const updatedDisk = { 'Note.md': `Intro\n${titledLink}` };
assert.strictEqual(await testReplaceInNote(otherEditors, updatedDisk, 'Note.md', unsavedLink, titledLink), false);
assert.strictEqual(otherEditors[0].value, unsavedLink);
assert.strictEqual(updatedDisk['Note.md'], `Intro\n${titledLink}`);

// 41.4: Failure cleanup removes the unsaved link the same way
const cleanupEditors = [{ path: 'Note.md', value: `https://youtu.be/MdxaU0l3FzI ${unsavedLink} tail` }];
await testReplaceInNote(cleanupEditors, { 'Note.md': '' }, 'Note.md', ` ${unsavedLink}`, '');
assert.strictEqual(cleanupEditors[0].value, 'https://youtu.be/MdxaU0l3FzI tail');

// 41.5: Both the rename and the cleanup go through replaceInNote, not vault.process on the source note
const mainSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
assert(mainSource.includes('await this.replaceInNote(sourceFile, oldLink, newLink);'));
assert(mainSource.includes("await this.replaceInNote(sourceFile, `${linkPrefix}${link}`, '');"));
assert(!/vault\.process\(sourceFile,/.test(mainSource));

console.log('✓ Summary link update against unsaved editor content passed');
