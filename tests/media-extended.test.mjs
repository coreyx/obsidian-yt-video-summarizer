// Media Extended companion notes: frontmatter, covers, sections, Related links, detection, and plugin settings.
import assert from 'node:assert';
import { loadSource } from './helpers/loadSource.mjs';
import { readFileSync } from 'node:fs';

// Test 19: Media Extended companion notes, frontmatter, and bidirectional linking
const { addRelatedLink, buildCoverEmbed, buildMediaExtendedFrontmatter, buildMediaExtendedNote, convertDescriptionTimestampsToMediaExtended, convertDescriptionTimestampsToYouTube, convertTimestampsToLinks, ensureSectionOrder, extractVideoIdFromUrl, filterFilesByFolderPaths, findMarkdownSection, formatTranscript, frontmatterMatchesVideo, generateMxUid, getMediaExtendedCoverUrl, hasRelatedMediaExtendedLink, isMediaExtendedCompanionNote, keepExtraFrontmatter, mergeFrontmatter, mergeYamlBlocks, parseTimestampToMediaExtendedUrl, parseTimestampToUrl, upsertMarkdownSection } = await loadSource('src/utils/frontmatter.ts');

console.log('Testing Media Extended companion notes and bidirectional linking...');

// Case 1: generateMxUid test
const uid1 = generateMxUid();
const uid2 = generateMxUid();
assert.strictEqual(uid1.length, 24);
assert.match(uid1, /^[a-z0-9]{24}$/);
assert.notStrictEqual(uid1, uid2);

// Case 2: Matching sample frontmatter format
const sampleRickAstleyData = {
	mxUid: 'vcxchy79gecb4s69v25oxq9s',
	videoId: 'dQw4w9WgXcQ',
	title: 'Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)',
	description: 'The official video for “Never Gonna Give You Up” by Rick Astley.\n\nNever: The Autobiography 📚 OUT NOW!',
	duration: 214,
	creator: 'Rick Astley',
	publishedAt: '2009-10-25',
	viewCount: 1818745023,
	likeCount: 19404514,
	cover: 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp',
	aspectRatio: '427 / 240',
};

const sampleFm = buildMediaExtendedFrontmatter(sampleRickAstleyData);
assert(sampleFm.includes('mx-uid: vcxchy79gecb4s69v25oxq9s'));
assert(sampleFm.includes('video: https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
assert(sampleFm.includes('title: Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)'));
assert(sampleFm.includes('description: |-\n  The official video for “Never Gonna Give You Up” by Rick Astley.\n\n  Never: The Autobiography 📚 OUT NOW!'));
assert(sampleFm.includes('duration: 214'));
assert(sampleFm.includes('creator: Rick Astley'));
assert(sampleFm.includes('published_at: 2009-10-25'));
assert(sampleFm.includes('view_count: 1818745023'));
assert(sampleFm.includes('like_count: 19404514'));
assert(sampleFm.includes('cover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"'));

// Default cover (no explicit cover) is the full max-resolution WebP thumbnail URL, never a local wikilink
const defaultCoverFm = buildMediaExtendedFrontmatter({ videoId: 'z02Y-1OvWSM', title: 'T', creator: 'C' });
assert(defaultCoverFm.includes('cover: "https://i.ytimg.com/vi_webp/z02Y-1OvWSM/maxresdefault.webp"'));
assert(!defaultCoverFm.includes('[['));

// getCoverUrl: falls back to hqdefault when maxres is missing (404); keeps maxres on success or network error
async function getCoverUrlHelper(videoId, headStatus) {
	const maxres = `https://i.ytimg.com/vi_webp/${videoId}/maxresdefault.webp`;
	try {
		const status = await headStatus(maxres);
		if (status === 404) return `https://i.ytimg.com/vi_webp/${videoId}/hqdefault.webp`;
	} catch {
		// keep maxres
	}
	return maxres;
}
assert.strictEqual(await getCoverUrlHelper('dQw4w9WgXcQ', async () => 200), 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp');
assert.strictEqual(await getCoverUrlHelper('jNQXAC9IVRw', async () => 404), 'https://i.ytimg.com/vi_webp/jNQXAC9IVRw/hqdefault.webp');
assert.strictEqual(await getCoverUrlHelper('dQw4w9WgXcQ', async () => { throw new Error('offline'); }), 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp');

// getAvailableThumbnailUrl (video summary notes): same fallback on the img.youtube.com JPEG thumbnails
async function getAvailableThumbnailUrlHelper(videoId, headStatus) {
	const maxres = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
	try {
		if ((await headStatus(maxres)) === 404) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
	} catch {
		// keep maxres
	}
	return maxres;
}
assert.strictEqual(await getAvailableThumbnailUrlHelper('dQw4w9WgXcQ', async () => 200), 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
assert.strictEqual(await getAvailableThumbnailUrlHelper('jNQXAC9IVRw', async () => 404), 'https://img.youtube.com/vi/jNQXAC9IVRw/hqdefault.jpg');
assert.strictEqual(await getAvailableThumbnailUrlHelper('dQw4w9WgXcQ', async () => { throw new Error('offline'); }), 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
assert(sampleFm.includes('aspect_ratio: 427 / 240'));

// Case 3: Title with special characters is properly quoted
const specialTitleData = {
	videoId: 'xyz789',
	title: 'Guide: How to use Obsidian with AI',
	creator: 'Tech Channel',
};
const specialFm = buildMediaExtendedFrontmatter(specialTitleData);
assert(specialFm.includes('title: "Guide: How to use Obsidian with AI"'));

// Case 4: addRelatedLink helper when no # Related section exists
const noteWithoutRelated = '# Summary\n\nThis is a summary of the video.';
const linkedNote = addRelatedLink(noteWithoutRelated, 'Media Library/Rick Astley - Never Gonna Give You Up');
assert(linkedNote.includes('# Related\n\n- [[Media Library/Rick Astley - Never Gonna Give You Up]]'));

// Case 5: addRelatedLink helper when # Related already exists
const noteWithRelated = '# Summary\n\nNotes.\n\n# Related\n- [[Existing Link]]';
const linkedNote2 = addRelatedLink(noteWithRelated, 'Media Library/Rick Astley - Never Gonna Give You Up');
assert(linkedNote2.includes('# Related\n\n- [[Existing Link]]\n- [[Media Library/Rick Astley - Never Gonna Give You Up]]'));

// Case 6: addRelatedLink helper does not duplicate links
const linkedNote3 = addRelatedLink(linkedNote2, 'Media Library/Rick Astley - Never Gonna Give You Up');
assert.strictEqual(linkedNote2, linkedNote3);

// Case 7: addRelatedLink helper handles note names with dollar signs ($100, $$)
const dollarLinked = addRelatedLink('# Summary', 'Media Library/$100 AI Budget');
assert(dollarLinked.includes('- [[Media Library/$100 AI Budget]]'));

// Case 8: buildMediaExtendedNote helper complete note creation
const sampleLines = [
	{ text: 'First line', duration: 2, offset: 65610 },
	{ text: 'Second line', duration: 3, offset: 122650 }
];
const formattedSampleLines = formatTranscript(sampleLines, 'dQw4w9WgXcQ', { format: 'mediaExtended' });
const fullMediaExtendedNote = buildMediaExtendedNote(
	sampleRickAstleyData,
	formattedSampleLines,
	'Rick Astley - Never Gonna Give You Up'
);
assert(fullMediaExtendedNote.startsWith('---\nmx-uid: vcxchy79gecb4s69v25oxq9s'));
assert(fullMediaExtendedNote.includes('# Description\n\n'));
assert(fullMediaExtendedNote.includes('# Transcript\n\n'));
assert(fullMediaExtendedNote.includes('- [01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=66#t=01:05.61) First line'));
assert(fullMediaExtendedNote.includes('- [02:02](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123#t=02:02.65) Second line'));
assert(fullMediaExtendedNote.includes('# Related\n\n- [[Rick Astley - Never Gonna Give You Up]]'));

// Case 9: Bidirectional link simulation
// Summary note links to Media Library/Title
const summaryBody = '# Summary\n\nKey takeaways from the video.';
const summaryWithRelated = addRelatedLink(summaryBody, 'Media Library/Rick Astley - Never Gonna Give You Up');
assert(summaryWithRelated.includes('- [[Media Library/Rick Astley - Never Gonna Give You Up]]'));

// Media Extended companion note links back to original summary note
assert(fullMediaExtendedNote.includes('- [[Rick Astley - Never Gonna Give You Up]]'));

console.log('✓ Media Extended companion notes and bidirectional linking passed');

// Test 22: Detection of missing companion notes
console.log('Testing missing companion note detection...');

// Case 1: isMediaExtendedCompanionNote identification
const companionNoteContent = `---
mx-uid: vcxchy79gecb4s69v25oxq9s
video: https://www.youtube.com/watch?v=dQw4w9WgXcQ
title: Rick Astley - Never Gonna Give You Up
---

- [01:05](https://youtube.com/watch?v=dQw4w9WgXcQ&t=66#t=01:05.61) Intro`;

const regularSummaryContent = `---
title: "Rick Astley - Never Gonna Give You Up"
channel_name: "Rick Astley"
video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
---

## Summary
Great music video.`;

assert.strictEqual(isMediaExtendedCompanionNote(companionNoteContent, 'Media Library/Rick Astley.md'), true);
assert.strictEqual(isMediaExtendedCompanionNote(companionNoteContent, 'Custom Folder/Rick Astley.md'), true); // Has mx-uid
assert.strictEqual(isMediaExtendedCompanionNote(regularSummaryContent, 'Media Library/Rick Astley.md'), true); // In media folder
assert.strictEqual(isMediaExtendedCompanionNote(regularSummaryContent, 'YouTube/Rick Astley.md'), false); // Regular summary

// Case 2: hasRelatedMediaExtendedLink detection
const summaryWithCompanionLink = `---
title: "Rick Astley"
video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
---

## Summary
Some text.

# Related
- [[Media Library/Rick Astley - Never Gonna Give You Up]]`;

const summaryWithDifferentRelatedLink = `---
title: "Rick Astley"
video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
---

## Summary
Some text.

# Related
- [[80s Music History]]`;

const summaryWithNoRelated = `---
title: "Rick Astley"
video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
---

## Summary
Some text.`;

assert.strictEqual(hasRelatedMediaExtendedLink(summaryWithCompanionLink, 'Media Library', 'Rick Astley - Never Gonna Give You Up'), true);
assert.strictEqual(hasRelatedMediaExtendedLink(summaryWithDifferentRelatedLink, 'Media Library', 'Rick Astley - Never Gonna Give You Up'), false);
assert.strictEqual(hasRelatedMediaExtendedLink(summaryWithNoRelated, 'Media Library', 'Rick Astley - Never Gonna Give You Up'), false);

console.log('✓ Missing companion note detection passed');

// Test 26: Description in Media Extended note, timestamp conversion, section headings, and empty lines
console.log('Testing Media Extended note description, timestamp conversion, and section headings...');

// 26.1: parseTimestampToMediaExtendedUrlHelper unit tests
const testVideoId = 'abc123XYZ';
assert.strictEqual(
	parseTimestampToMediaExtendedUrl('0:00', testVideoId),
	'https://www.youtube.com/watch?v=abc123XYZ&t=0#t=00:00.00'
);
assert.strictEqual(
	parseTimestampToMediaExtendedUrl('01:23', testVideoId),
	'https://www.youtube.com/watch?v=abc123XYZ&t=83#t=01:23.00'
);
assert.strictEqual(
	parseTimestampToMediaExtendedUrl('1:23:45', testVideoId),
	'https://www.youtube.com/watch?v=abc123XYZ&t=5025#t=01:23:45.00'
);
assert.strictEqual(parseTimestampToMediaExtendedUrl('invalid', testVideoId), null);

// 26.2: convertDescriptionTimestampsToMediaExtendedHelper tests
const sampleRawDescription = `Welcome to this tutorial!
Chapters:
0:00 - Introduction
- 01:23 Getting Started
• 02:45 Basic Workflow
03:50: Best Practices
[04:20] Advanced Tips
(05:15) Q&A Session
1:05:30 Final Thoughts

Resources:
See [our blog](https://example.com/guide:1) for written steps.
Visit https://example.com/repo/12:34 for the source code.
Already formatted: [06:00](https://youtube.com/watch?v=old&t=360)
Note: Meeting is at 10:00 AM (not a video timestamp)
Aspect ratio is 16:9 widescreen`;

const convertedDesc = convertDescriptionTimestampsToMediaExtended(sampleRawDescription, testVideoId);

// 0:00 converted
assert(convertedDesc.includes('[0:00](https://www.youtube.com/watch?v=abc123XYZ&t=0#t=00:00.00) - Introduction'));
// - 01:23 converted
assert(convertedDesc.includes('- [01:23](https://www.youtube.com/watch?v=abc123XYZ&t=83#t=01:23.00) Getting Started'));
// • 02:45 converted
assert(convertedDesc.includes('• [02:45](https://www.youtube.com/watch?v=abc123XYZ&t=165#t=02:45.00) Basic Workflow'));
// 03:50: converted with colon preserved
assert(convertedDesc.includes('[03:50](https://www.youtube.com/watch?v=abc123XYZ&t=230#t=03:50.00): Best Practices'));
// [04:20] bracketed converted without double brackets
assert(convertedDesc.includes('[04:20](https://www.youtube.com/watch?v=abc123XYZ&t=260#t=04:20.00) Advanced Tips'));
assert(!convertedDesc.includes('[[04:20]('));
// (05:15) parenthesized preserved
assert(convertedDesc.includes('([05:15](https://www.youtube.com/watch?v=abc123XYZ&t=315#t=05:15.00)) Q&A Session'));
// 1:05:30 3-part timestamp converted
assert(convertedDesc.includes('[1:05:30](https://www.youtube.com/watch?v=abc123XYZ&t=3930#t=01:05:30.00) Final Thoughts'));
// Existing link converted to Media Extended URL
assert(convertedDesc.includes('[06:00](https://www.youtube.com/watch?v=abc123XYZ&t=360#t=06:00.00)'));
// Regular markdown link preserved
assert(convertedDesc.includes('[our blog](https://example.com/guide:1)'));
// Raw URL preserved
assert(convertedDesc.includes('https://example.com/repo/12:34'));
// 10:00 AM not matched as timestamp
assert(convertedDesc.includes('10:00 AM'));
// 16:9 aspect ratio not matched
assert(convertedDesc.includes('16:9 widescreen'));

// 26.3: Empty description handling
assert.strictEqual(convertDescriptionTimestampsToMediaExtended('', testVideoId), '');
assert.strictEqual(convertDescriptionTimestampsToMediaExtended(undefined, testVideoId), undefined);

// 26.4: buildMediaExtendedNoteHelper with sections and empty lines
const testMetadata = {
	mxUid: 'test12345678901234567890',
	videoId: testVideoId,
	title: 'Complete TypeScript Guide',
	description: 'A great tutorial.\n0:00 Intro\n01:23 Code walkthrough',
	duration: 300,
	creator: 'Code Master'
};
const testTranscript = '- [00:00](https://www.youtube.com/watch?v=abc123XYZ&t=0#t=00:00.00) Hello world\n- [01:23](https://www.youtube.com/watch?v=abc123XYZ&t=83#t=01:23.00) Let us begin';
const testRelatedNote = 'TypeScript Summary Note';

// Default includes description (on by default)
const fullNoteWithDesc = buildMediaExtendedNote(testMetadata, testTranscript, testRelatedNote);
assert(fullNoteWithDesc.startsWith('---\nmx-uid: test12345678901234567890'));
// Section headings must exist
assert(fullNoteWithDesc.includes('\n\n# Description\n\n'));
assert(fullNoteWithDesc.includes('\n\n# Transcript\n\n'));
assert(fullNoteWithDesc.includes('\n\n# Related\n\n'));
// Empty lines must follow each heading before content
assert(fullNoteWithDesc.includes('# Description\n\nA great tutorial.'));
assert(fullNoteWithDesc.includes('# Transcript\n\n- [00:00]'));
assert(fullNoteWithDesc.includes('# Related\n\n- [[TypeScript Summary Note]]'));
// Timestamps in description must be converted to Media Extended links
assert(fullNoteWithDesc.includes('[01:23](https://www.youtube.com/watch?v=abc123XYZ&t=83#t=01:23.00) Code walkthrough'));

// 26.5: Turning off includeDescription setting
const meNoteWithoutDesc = buildMediaExtendedNote(testMetadata, testTranscript, testRelatedNote, {
	includeDescription: false
});
assert(!meNoteWithoutDesc.includes('# Description'));
assert(meNoteWithoutDesc.includes('# Transcript\n\n- [00:00]'));
assert(meNoteWithoutDesc.includes('# Related\n\n- [[TypeScript Summary Note]]'));

// 26.6: Empty line after # Related in Video Summary note
const summaryBodyNote = '# Video Summary\n\nHere are the key takeaways.';
const summaryLinked = addRelatedLink(summaryBodyNote, 'Media Library/Complete TypeScript Guide');
assert(summaryLinked.includes('\n\n# Related\n\n- [[Media Library/Complete TypeScript Guide]]\n'));

console.log('✓ Media Extended note description, timestamp conversion, and section headings passed');

// Test 26b: Summary note YouTube timestamp links, per-run Media Extended options, and body defaults
console.log('Testing summary note YouTube timestamp links, per-run Media Extended options, and defaults...');

// 26b.1: Description timestamps become standard YouTube links in the summary note
const ytDesc = convertDescriptionTimestampsToYouTube(sampleRawDescription, testVideoId);
assert(ytDesc.includes('[0:00](https://www.youtube.com/watch?v=abc123XYZ&t=0s) - Introduction'));
assert(ytDesc.includes('- [01:23](https://www.youtube.com/watch?v=abc123XYZ&t=83s) Getting Started'));
assert(ytDesc.includes('• [02:45](https://www.youtube.com/watch?v=abc123XYZ&t=165s) Basic Workflow'));
assert(ytDesc.includes('[03:50](https://www.youtube.com/watch?v=abc123XYZ&t=230s): Best Practices'));
assert(ytDesc.includes('[04:20](https://www.youtube.com/watch?v=abc123XYZ&t=260s) Advanced Tips'));
assert(ytDesc.includes('([05:15](https://www.youtube.com/watch?v=abc123XYZ&t=315s)) Q&A Session'));
assert(ytDesc.includes('[1:05:30](https://www.youtube.com/watch?v=abc123XYZ&t=3930s) Final Thoughts'));
// Existing timestamp link re-pointed at this video in YouTube format
assert(ytDesc.includes('[06:00](https://www.youtube.com/watch?v=abc123XYZ&t=360s)'));
assert(!ytDesc.includes('#t='));
assert(ytDesc.includes('[our blog](https://example.com/guide:1)'));
assert(ytDesc.includes('https://example.com/repo/12:34'));
assert(ytDesc.includes('10:00 AM'));
assert(ytDesc.includes('16:9 widescreen'));

// 26b.2: AI summary text — bold timestamps linked; code, inline code, and wikilinks untouched
const aiSummary = [
	'## Key Points',
	'- **05:23** The [[TypeScript]] compiler is introduced',
	'- Config uses `timeout: 12:30` inline',
	'- See [[Notes 10:15]] for more',
	'```',
	'cron: 10:30',
	'```',
	'- Covered at [07:45] in detail',
].join('\n');
const linkedSummary = convertTimestampsToLinks(aiSummary, testVideoId, 'youtube');
assert(linkedSummary.includes('**[05:23](https://www.youtube.com/watch?v=abc123XYZ&t=323s)**'));
assert(linkedSummary.includes('[[TypeScript]]'));
assert(linkedSummary.includes('`timeout: 12:30`'));
assert(linkedSummary.includes('[[Notes 10:15]]'));
assert(linkedSummary.includes('```\ncron: 10:30\n```'));
assert(linkedSummary.includes('[07:45](https://www.youtube.com/watch?v=abc123XYZ&t=465s)'));
assert(!linkedSummary.includes('TS_PROTECTED_TOKEN'));

// 26b.3: Nested protected tokens (inline code inside link text) restore fully
const nested = convertTimestampsToLinks('See [the `cfg` file](https://example.com) at 01:00', testVideoId, 'youtube');
assert.strictEqual(nested, 'See [the `cfg` file](https://example.com) at [01:00](https://www.youtube.com/watch?v=abc123XYZ&t=60s)');

// 26b.4: Per-run Media Extended options override permanent settings without changing them
function resolveCompanionOptionsHelper(settings, runOptions) {
	return {
		includeDescription: runOptions?.includeDescription ?? settings.mediaExtendedIncludeDescription,
		includeTranscript: runOptions?.includeTranscript ?? settings.mediaExtendedIncludeTranscript,
	};
}
const permanentSettings = { mediaExtendedIncludeDescription: true, mediaExtendedIncludeTranscript: true };
assert.deepStrictEqual(resolveCompanionOptionsHelper(permanentSettings), { includeDescription: true, includeTranscript: true });
assert.deepStrictEqual(
	resolveCompanionOptionsHelper(permanentSettings, { createNote: true, includeDescription: false, includeTranscript: false }),
	{ includeDescription: false, includeTranscript: false }
);
assert.deepStrictEqual(permanentSettings, { mediaExtendedIncludeDescription: true, mediaExtendedIncludeTranscript: true });

// Transcript excluded for the run: companion note has no # Transcript section
const meNoTranscript = buildMediaExtendedNote(testMetadata, '', testRelatedNote, { includeDescription: true });
assert(meNoTranscript.includes('# Description\n\n'));
assert(!meNoTranscript.includes('# Transcript'));
assert(meNoTranscript.includes('# Related\n\n- [[TypeScript Summary Note]]'));

// Both excluded: frontmatter + related link only
const meBare = buildMediaExtendedNote(testMetadata, '', testRelatedNote, { includeDescription: false });
assert(!meBare.includes('# Description'));
assert(!meBare.includes('# Transcript'));
assert(meBare.includes('# Related\n\n- [[TypeScript Summary Note]]'));

// 26b.5: Body defaults — summary note off, Media Extended note on
const defaultsSource = readFileSync(new URL('../src/defaults.ts', import.meta.url), 'utf8');
// The "include description in summary note body" option was removed (use "Add description to video summary note")
assert.doesNotMatch(defaultsSource, /DEFAULT_INCLUDE_VIDEO_DESCRIPTION/);
assert.match(defaultsSource, /DEFAULT_DUMP_TRANSCRIPT_IN_SUMMARY = false;/);
assert.match(defaultsSource, /DEFAULT_MEDIA_EXTENDED_INCLUDE_DESCRIPTION = true;/);
assert.match(defaultsSource, /DEFAULT_MEDIA_EXTENDED_INCLUDE_TRANSCRIPT = true;/);

console.log('✓ Summary note YouTube timestamp links, per-run Media Extended options, and defaults passed');

// Test 32: Add description / transcript to Media Extended notes (section detection, upsert, video detection)
console.log('Testing Media Extended note section detection, insertion/replacement, and video detection...');

function extractYouTubeUrlFromFrontmatterHelper(content) {
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fmMatch) return null;
	for (const key of ['video_url', 'video', 'media']) {
		const m = fmMatch[1].match(new RegExp(`^${key}:\\s*["']?([^"'\\r\\n]+)["']?`, 'm'));
		const value = m?.[1].trim();
		if (value && (key === 'video_url' || /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(value))) {
			return value;
		}
	}
	return null;
}

const meFrontmatter = '---\nmx-uid: abcdefghijklmnopqrstuvwx\nvideo: https://www.youtube.com/watch?v=dQw4w9WgXcQ\ntitle: Test\ndescription: ""\n---';
const meNoteBare = `${meFrontmatter}\n\n# Related\n\n- [[Summary Note]]\n`;
const meNoteFull = `${meFrontmatter}\n\n# Description\n\nOld description\n\n# Transcript\n\n- [00:00](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0#t=00:00.00) Hi\n\n# Related\n\n- [[Summary Note]]\n`;

// 32.1: Video detection from Media Extended frontmatter (video / media keys), ignoring non-YouTube values
assert.strictEqual(extractYouTubeUrlFromFrontmatterHelper(meNoteBare), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
assert.strictEqual(extractYouTubeUrlFromFrontmatterHelper('---\nmedia: https://youtu.be/dQw4w9WgXcQ\n---\n'), 'https://youtu.be/dQw4w9WgXcQ');
assert.strictEqual(extractYouTubeUrlFromFrontmatterHelper('---\nvideo: "[[local.mp4]]"\n---\n'), null);
assert.strictEqual(extractYouTubeUrlFromFrontmatterHelper('---\nvideo_url: https://www.youtube.com/watch?v=abc123XYZ00\nvideo: https://youtu.be/other\n---\n'), 'https://www.youtube.com/watch?v=abc123XYZ00');

// 32.2: Section detection — level-1 only, case-insensitive, ignores frontmatter and code fences
assert.strictEqual(findMarkdownSection(meNoteBare, 'Description'), null);
assert.strictEqual(findMarkdownSection(meNoteBare, 'Transcript'), null);
assert.notStrictEqual(findMarkdownSection(meNoteFull, 'Description'), null);
assert.notStrictEqual(findMarkdownSection(meNoteFull, 'transcript'), null);
assert.strictEqual(findMarkdownSection('## Description\n\nText', 'Description'), null);
assert.strictEqual(findMarkdownSection('```\n# Description\n```\n', 'Description'), null);
assert.strictEqual(findMarkdownSection('---\ntitle: "# Description"\n---\nBody', 'Description'), null);

// 32.3: Insert description before # Transcript / # Related when missing
const descBody = '[0:00](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0#t=00:00.00) Intro';
const withDesc = upsertMarkdownSection(meNoteBare, 'Description', descBody, ['Transcript', 'Related']);
assert.strictEqual(withDesc, `${meFrontmatter}\n\n# Description\n\n${descBody}\n\n# Related\n\n- [[Summary Note]]\n`);

// 32.4: Insert transcript after description, before # Related
const transcriptBody = '- [00:01](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1#t=00:01.00) Hello';
const withBoth = upsertMarkdownSection(withDesc, 'Transcript', transcriptBody, ['Related']);
assert.strictEqual(withBoth, `${meFrontmatter}\n\n# Description\n\n${descBody}\n\n# Transcript\n\n${transcriptBody}\n\n# Related\n\n- [[Summary Note]]\n`);

// 32.5: Replace an existing section in place, keeping other sections
const replacedDesc = upsertMarkdownSection(meNoteFull, 'Description', 'New description', ['Transcript', 'Related']);
assert(replacedDesc.includes('# Description\n\nNew description\n\n# Transcript\n\n'));
assert(!replacedDesc.includes('Old description'));
assert(replacedDesc.includes('# Related\n\n- [[Summary Note]]\n'));
const replacedTranscript = upsertMarkdownSection(meNoteFull, 'Transcript', transcriptBody, ['Related']);
assert(replacedTranscript.includes(`# Transcript\n\n${transcriptBody}\n\n# Related`));
assert(!replacedTranscript.includes(') Hi\n'));
assert.strictEqual((replacedTranscript.match(/^# Transcript$/gm) || []).length, 1);

// 32.6: Appends at the end when no anchors exist; works with frontmatter-only notes and CRLF
assert.strictEqual(upsertMarkdownSection(meFrontmatter, 'Transcript', transcriptBody, ['Related']), `${meFrontmatter}\n\n# Transcript\n\n${transcriptBody}\n`);
assert.strictEqual(upsertMarkdownSection('---\na: 1\n---\r\n\r\nNotes\r\n', 'Description', 'D'), '---\na: 1\n---\n\nNotes\n\n# Description\n\nD\n');

// 32.7: Subheadings inside a section belong to it; replacing removes them
const withSubheading = `${meFrontmatter}\n\n# Description\n\nOld\n\n## Links\n\n- a\n\n# Related\n\n- [[X]]\n`;
const replacedSub = upsertMarkdownSection(withSubheading, 'Description', 'New', ['Transcript', 'Related']);
assert(!replacedSub.includes('## Links'));
assert(replacedSub.includes('# Description\n\nNew\n\n# Related\n\n- [[X]]\n'));

// 32.8a: Description always comes before Transcript

const addSection = (content, heading, body, insertBefore) =>
	ensureSectionOrder(upsertMarkdownSection(content, heading, body, insertBefore), 'Description', 'Transcript');
const expectedOrder = `${meFrontmatter}\n\n# Description\n\n${descBody}\n\n# Transcript\n\n${transcriptBody}\n\n# Related\n\n- [[Summary Note]]\n`;

// Either command order produces Description → Transcript → Related
const transcriptFirst = addSection(meNoteBare, 'Transcript', transcriptBody, ['Related']);
assert.strictEqual(addSection(transcriptFirst, 'Description', descBody, ['Transcript', 'Related']), expectedOrder);
const descriptionFirst = addSection(meNoteBare, 'Description', descBody, ['Transcript', 'Related']);
assert.strictEqual(addSection(descriptionFirst, 'Transcript', transcriptBody, ['Related']), expectedOrder);

// Out-of-order note (Transcript above Description): replacing either section fixes the order
const outOfOrder = `${meFrontmatter}\n\n# Transcript\n\nOld transcript\n\n# Description\n\nOld description\n\n# Related\n\n- [[Summary Note]]\n`;
const fixedByDesc = addSection(outOfOrder, 'Description', descBody, ['Transcript', 'Related']);
assert.strictEqual(fixedByDesc, `${meFrontmatter}\n\n# Description\n\n${descBody}\n\n# Transcript\n\nOld transcript\n\n# Related\n\n- [[Summary Note]]\n`);
const fixedByTranscript = addSection(outOfOrder, 'Transcript', transcriptBody, ['Related']);
assert.strictEqual(fixedByTranscript, `${meFrontmatter}\n\n# Description\n\nOld description\n\n# Transcript\n\n${transcriptBody}\n\n# Related\n\n- [[Summary Note]]\n`);

// # Related above an existing # Description: adding the transcript still lands it after Description
const relatedFirst = `${meFrontmatter}\n\n# Related\n\n- [[Summary Note]]\n\n# Description\n\n${descBody}\n`;
const withTranscriptAfterDesc = addSection(relatedFirst, 'Transcript', transcriptBody, ['Related']);
assert(withTranscriptAfterDesc.indexOf('# Description') < withTranscriptAfterDesc.indexOf('# Transcript'));

// Already ordered or single-section notes are unchanged
assert.strictEqual(ensureSectionOrder(expectedOrder, 'Description', 'Transcript'), expectedOrder);
assert.strictEqual(ensureSectionOrder(meNoteBare, 'Description', 'Transcript'), meNoteBare);

// 32.8: Description source — frontmatter first when enabled and non-empty, else fetch
function resolveDescriptionSourceHelper(useFrontmatter, frontmatterDescription) {
	return useFrontmatter && typeof frontmatterDescription === 'string' && frontmatterDescription.trim()
		? 'frontmatter'
		: 'fetch';
}
assert.strictEqual(resolveDescriptionSourceHelper(true, 'Creator description\n0:00 Intro'), 'frontmatter');
assert.strictEqual(resolveDescriptionSourceHelper(true, ''), 'fetch');
assert.strictEqual(resolveDescriptionSourceHelper(true, '   '), 'fetch');
assert.strictEqual(resolveDescriptionSourceHelper(true, undefined), 'fetch');
assert.strictEqual(resolveDescriptionSourceHelper(true, 123), 'fetch');
assert.strictEqual(resolveDescriptionSourceHelper(false, 'Creator description'), 'fetch');
assert.match(defaultsSource, /DEFAULT_MEDIA_EXTENDED_DESCRIPTION_FROM_FRONTMATTER = true;/);

// Frontmatter description timestamps still become Media Extended links in the body
const fmDescBody = convertDescriptionTimestampsToMediaExtended('Chapters\n0:00 Intro\n01:23 Setup', 'dQw4w9WgXcQ');
assert(fmDescBody.includes('[01:23](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=83#t=01:23.00) Setup'));

console.log('✓ Media Extended note section detection, insertion/replacement, and video detection passed');

// Test 35: Cover embed in Media Extended notes and "Insert video cover at cursor"
console.log('Testing Media Extended cover embed...');

const coverMeta = {
	mxUid: 'test12345678901234567890',
	videoId: 'dQw4w9WgXcQ',
	title: 'Cover Test',
	description: 'Desc\n0:00 Intro',
	creator: 'Rick Astley',
	cover: 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp',
};
const coverTranscript = '- [00:00](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0#t=00:00.00) Hello';

// 35.1: Embed at the top of the body, above # Description, matching the frontmatter cover
const withCover = buildMediaExtendedNote(coverMeta, coverTranscript, 'Summary Note', { embedCover: true });
const coverBody = withCover.slice(withCover.indexOf('\n---\n') + 5);
assert(coverBody.startsWith('\n![Cover](https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp)\n\n# Description\n\n'));
assert(withCover.includes('cover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"'));
assert(withCover.trimEnd().endsWith('# Related\n\n- [[Summary Note]]'));

// 35.2: Off → no embed (and the pure builder defaults to off)
assert(!buildMediaExtendedNote(coverMeta, coverTranscript, 'Summary Note', { embedCover: false }).includes('![Cover]'));
assert(!buildMediaExtendedNote(coverMeta, coverTranscript, 'Summary Note').includes('![Cover]'));

// 35.3: Fallback cover (hqdefault) is used for both frontmatter and embed; default URL when no cover given
const hqCover = buildMediaExtendedNote({ ...coverMeta, cover: 'https://i.ytimg.com/vi_webp/jNQXAC9IVRw/hqdefault.webp', videoId: 'jNQXAC9IVRw' }, '', undefined, { embedCover: true });
assert(hqCover.includes('![Cover](https://i.ytimg.com/vi_webp/jNQXAC9IVRw/hqdefault.webp)'));
assert(hqCover.includes('cover: "https://i.ytimg.com/vi_webp/jNQXAC9IVRw/hqdefault.webp"'));
assert.strictEqual(getMediaExtendedCoverUrl({ videoId: 'abc123XYZ00' }), 'https://i.ytimg.com/vi_webp/abc123XYZ00/maxresdefault.webp');
assert.strictEqual(getMediaExtendedCoverUrl({ videoId: 'x', cover: '"https://example.com/c.webp"' }), 'https://example.com/c.webp');

// 35.4: Embed only, no description/transcript/related → frontmatter + embed
const coverOnly = buildMediaExtendedNote({ ...coverMeta, description: '' }, '', undefined, { embedCover: true });
assert(coverOnly.endsWith('---\n\n![Cover](https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp)\n'));

// 35.5: Adding a description later keeps the embed at the top
const coverThenDesc = upsertMarkdownSection(
	buildMediaExtendedNote({ ...coverMeta, description: '' }, '', 'Summary Note', { embedCover: true }),
	'Description', 'New description', ['Transcript', 'Related']
);
const coverThenDescBody = coverThenDesc.slice(coverThenDesc.indexOf('\n---\n') + 5);
assert(coverThenDescBody.startsWith('\n![Cover](https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp)\n\n# Description\n\nNew description\n\n# Related'));

// 35.6: Insert at cursor — inserts at the captured position with no duplicate check
function insertCoverAtHelper(content, offset, coverUrl) {
	const embed = buildCoverEmbed(coverUrl);
	return content.slice(0, offset) + embed + content.slice(offset);
}
const cursorNote = 'Line one\n\nLine two';
const inserted = insertCoverAtHelper(cursorNote, cursorNote.indexOf('\n\nLine two') + 2, 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp');
assert.strictEqual(inserted, 'Line one\n\n![Cover](https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp)Line two');
const insertedTwice = insertCoverAtHelper(inserted, 0, 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp');
assert.strictEqual((insertedTwice.match(/!\[Cover\]/g) || []).length, 2);

console.log('✓ Media Extended cover embed passed');

// Test 39: Create the companion note in either direction (video matching, folder-scoped lookup, rebuild merges)
console.log('Testing companion note creation in both directions...');

// 39.1: Video IDs from common URL shapes; non-YouTube values don't match
assert.strictEqual(extractVideoIdFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123'), 'dQw4w9WgXcQ');
assert.strictEqual(extractVideoIdFromUrl('https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
assert.strictEqual(extractVideoIdFromUrl('https://youtu.be/dQw4w9WgXcQ?t=42'), 'dQw4w9WgXcQ');
assert.strictEqual(extractVideoIdFromUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
assert.strictEqual(extractVideoIdFromUrl('[[local-video.mp4]]'), null);
assert.strictEqual(extractVideoIdFromUrl('https://vimeo.com/123456789'), null);

// 39.2: Frontmatter matching per note type
assert.strictEqual(frontmatterMatchesVideo({ video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, ['video_url'], 'dQw4w9WgXcQ'), true);
assert.strictEqual(frontmatterMatchesVideo({ video: 'https://youtu.be/dQw4w9WgXcQ' }, ['video', 'media'], 'dQw4w9WgXcQ'), true);
assert.strictEqual(frontmatterMatchesVideo({ media: 'https://youtu.be/dQw4w9WgXcQ' }, ['video', 'media'], 'dQw4w9WgXcQ'), true);
assert.strictEqual(frontmatterMatchesVideo({ video: 'https://youtu.be/jNQXAC9IVRw' }, ['video', 'media'], 'dQw4w9WgXcQ'), false);
assert.strictEqual(frontmatterMatchesVideo({ video_url: 'https://youtu.be/dQw4w9WgXcQ' }, ['video', 'media'], 'dQw4w9WgXcQ'), false);
assert.strictEqual(frontmatterMatchesVideo(undefined, ['video_url'], 'dQw4w9WgXcQ'), false);

// 39.3: Only the target folder (and subfolders) is searched — matching notes elsewhere are ignored
const vaultNotes = [
	{ path: 'Media Library/Never Gonna Give You Up.md', frontmatter: { 'mx-uid': 'a', video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
	{ path: 'Media Library/Archive/Renamed copy.md', frontmatter: { 'mx-uid': 'b', video: 'https://youtu.be/dQw4w9WgXcQ' } },
	{ path: 'Elsewhere/Stray media note.md', frontmatter: { 'mx-uid': 'c', video: 'https://youtu.be/dQw4w9WgXcQ' } },
	{ path: 'Video Summaries/Never Gonna Give You Up.md', frontmatter: { video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
	{ path: 'Inbox/Old summary.md', frontmatter: { video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
	{ path: 'Media Library Extra/Not inside.md', frontmatter: { video: 'https://youtu.be/dQw4w9WgXcQ' } },
];
const findInFolder = (folder, videoId, keys) =>
	filterFilesByFolderPaths(vaultNotes, [folder]).filter((n) => frontmatterMatchesVideo(n.frontmatter, keys, videoId)).map((n) => n.path);
assert.deepStrictEqual(findInFolder('Media Library', 'dQw4w9WgXcQ', ['video', 'media']), ['Media Library/Never Gonna Give You Up.md', 'Media Library/Archive/Renamed copy.md']);
assert.deepStrictEqual(findInFolder('Video Summaries', 'dQw4w9WgXcQ', ['video_url']), ['Video Summaries/Never Gonna Give You Up.md']);
assert.deepStrictEqual(findInFolder('Video Summaries', 'jNQXAC9IVRw', ['video_url']), []);

// 39.4: Rebuilding a Media Extended note keeps user-added frontmatter (and tags), replaces generated keys and body
const userEditedMe = '---\nmx-uid: keepme\nvideo: https://youtu.be/dQw4w9WgXcQ\ntitle: Old\nmy_rating: 5\ntags:\n  - favorite\ncover: "[[old.jpg]]"\n---\n\nOld body with my notes\n';
const freshMe = '---\nmx-uid: keepme\nvideo: https://www.youtube.com/watch?v=dQw4w9WgXcQ\ntitle: New Title\ncover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"\n---\n\n![Cover](https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp)\n\n# Related\n\n- [[Video Summaries/Video]]\n';
const rebuiltMe = keepExtraFrontmatter(userEditedMe, freshMe);
assert(rebuiltMe.includes('title: New Title'));
assert(rebuiltMe.includes('my_rating: 5'));
assert(rebuiltMe.includes('tags:\n  - favorite'));
assert(rebuiltMe.includes('cover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"'));
assert(!rebuiltMe.includes('Old body'));
assert(rebuiltMe.endsWith('\n# Related\n\n- [[Video Summaries/Video]]\n'));
assert.strictEqual(keepExtraFrontmatter('No frontmatter', freshMe), freshMe);

// 39.5: Regenerating a summary note merges new frontmatter into the existing one (keeps added keys, merges tags)
const existingSummaryNote = '---\ntitle: "Old"\nvideo_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"\nmy_status: watched\ntags:\n  - favorite\n---\n\nOld summary\n';
const regenFm = { title: 'New', channel_name: 'C', channel_username: '@c', channel_url: 'u', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 't', thumbnail_text: '', tags: ['music'] };
const existingFmBlock = existingSummaryNote.match(/^---\n[\s\S]*?\n---/)[0];
const regenRaw = `${existingFmBlock}\n\n## Summary\n\nNew summary`;
const regenFmMatch = regenRaw.match(/^---\r?\n([\s\S]*?\r?\n)---(\r?\n)?/);
const regenerated = `---\n${mergeFrontmatter(regenFmMatch[1], regenFm)}\n---\n${regenRaw.slice(regenFmMatch[0].length)}`;
assert(regenerated.includes('title: "New"'));
assert(regenerated.includes('my_status: watched'));
assert(regenerated.includes('  - favorite'));
assert(regenerated.includes('  - music'));
assert(!regenerated.includes('Old summary'));
assert(regenerated.trimEnd().endsWith('## Summary\n\nNew summary'));

console.log('✓ Companion note creation in both directions passed');

// Test 40: Media Extended is optional — plugin detection, default off, and grouped settings
console.log('Testing Media Extended plugin detection, default, and settings grouping...');

const MEDIA_EXTENDED_PLUGIN_ID_HELPER = 'media-extended';
function resolveMediaExtendedPluginStatusHelper(registry) {
	if (!registry || (!registry.manifests && !registry.enabledPlugins && !registry.plugins)) return 'unknown';
	if (registry.plugins?.[MEDIA_EXTENDED_PLUGIN_ID_HELPER] || registry.enabledPlugins?.has(MEDIA_EXTENDED_PLUGIN_ID_HELPER)) return 'enabled';
	if (registry.manifests?.[MEDIA_EXTENDED_PLUGIN_ID_HELPER]) return 'disabled';
	return 'not-installed';
}

// 40.1: Detection from Obsidian's community plugin registry
assert.strictEqual(resolveMediaExtendedPluginStatusHelper({ manifests: { 'media-extended': {} }, enabledPlugins: new Set(['media-extended']), plugins: { 'media-extended': {} } }), 'enabled');
assert.strictEqual(resolveMediaExtendedPluginStatusHelper({ manifests: { 'media-extended': {} }, enabledPlugins: new Set(), plugins: {} }), 'disabled');
assert.strictEqual(resolveMediaExtendedPluginStatusHelper({ manifests: { 'dataview': {} }, enabledPlugins: new Set(['dataview']), plugins: { dataview: {} } }), 'not-installed');
assert.strictEqual(resolveMediaExtendedPluginStatusHelper({ manifests: {}, enabledPlugins: new Set(), plugins: {} }), 'not-installed');
// Registry unavailable → unknown (never prompts or blocks)
assert.strictEqual(resolveMediaExtendedPluginStatusHelper(undefined), 'unknown');
assert.strictEqual(resolveMediaExtendedPluginStatusHelper({}), 'unknown');

// 40.2: Prompt only when turning the setting on and the plugin is missing or disabled
const shouldPromptToInstall = (turnedOn, status) => turnedOn && (status === 'not-installed' || status === 'disabled');
assert.strictEqual(shouldPromptToInstall(true, 'not-installed'), true);
assert.strictEqual(shouldPromptToInstall(true, 'disabled'), true);
assert.strictEqual(shouldPromptToInstall(true, 'enabled'), false);
assert.strictEqual(shouldPromptToInstall(true, 'unknown'), false);
assert.strictEqual(shouldPromptToInstall(false, 'not-installed'), false);

// 40.3: Creating Media Extended notes is off by default; the note-content options keep their defaults
const defaultsNow = readFileSync(new URL('../src/defaults.ts', import.meta.url), 'utf8');
assert.match(defaultsNow, /DEFAULT_CREATE_MEDIA_EXTENDED_NOTES = false;/);
assert.match(defaultsNow, /DEFAULT_MEDIA_EXTENDED_INCLUDE_DESCRIPTION = true;/);
assert.match(defaultsNow, /DEFAULT_MEDIA_EXTENDED_INCLUDE_TRANSCRIPT = true;/);
assert.match(defaultsNow, /DEFAULT_MEDIA_EXTENDED_EMBED_COVER = true;/);

// 40.4: The plugin source never calls into the Media Extended plugin (detection lives in one helper)
const srcFiles = ['main.ts', 'utils/frontmatter.ts', 'services/youtube.ts', 'services/settingsManager.ts'];
for (const file of srcFiles) {
	const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
	assert.doesNotMatch(source, /\.plugins\b|enabledPlugins|getPlugin\(/, `${file} should not touch the plugin registry`);
}

// 40.5: Every Media Extended setting lives in the Media Extended settings tab, and nowhere else
const settingsSource = readFileSync(new URL('../src/ui/settings.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sectionBody = (name) => {
	const start = settingsSource.indexOf(`private ${name}(`);
	assert(start >= 0, `${name} should exist`);
	const next = settingsSource.indexOf('\n    private ', start + 1);
	return settingsSource.slice(start, next < 0 ? undefined : next);
};
const mediaExtendedTab = sectionBody('displayMediaExtendedSection');
const mediaExtendedSettingCalls = [
	'updateCreateMediaExtendedNotes',
	'updateMediaExtendedFolder',
	'updateMediaExtendedIncludeDescription',
	'updateMediaExtendedIncludeTranscript',
	'updateMediaExtendedEmbedCover',
	'promptCreateMediaExtendedNotes',
	'createMediaExtendedInVault',
];
for (const call of mediaExtendedSettingCalls) {
	assert(mediaExtendedTab.includes(call), `${call} should be in the Media Extended tab`);
	assert.strictEqual(settingsSource.split(call).length - 1, 1, `${call} should appear in exactly one place`);
}
for (const other of ['displaySummarySection', 'displayTagsAndMetadataSection', 'displayMaintenanceSection']) {
	assert(!/MediaExtended(Folder|Include|EmbedCover)|CreateMediaExtended/.test(sectionBody(other)), `${other} should have no Media Extended settings`);
}
// Turning the create toggle on triggers the install prompt
assert.match(mediaExtendedTab, /updateCreateMediaExtendedNotes\(value\);\s*if \(value\) \{\s*await this\.promptToInstallMediaExtended\(\);/);
// Five tabs in a sensible order
assert.deepStrictEqual(
	[...settingsSource.matchAll(/\{ name: '([^']+)', id: '[^']+', render:/g)].map((m) => m[1]),
	['AI Providers', 'Summary', 'Media Extended', 'Tags & Metadata', 'Maintenance']
);

console.log('✓ Media Extended plugin detection, default, and settings grouping passed');
