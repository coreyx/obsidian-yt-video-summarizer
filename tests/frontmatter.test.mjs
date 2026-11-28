// Building and merging frontmatter, frontmatter tags, sanitizing, video stats, YAML block merging, blank-note detection, and the topic property.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { loadSource } from './helpers/loadSource.mjs';

const { YouTubeService } = await loadSource('src/services/youtube.ts');
const {
	buildFrontmatter,
	deduplicateTags,
	extractTagsFromText,
	extractYouTubeUrlFromNote,
	getVideoNoteKind,
	isBlankNoteForSummary,
	mergeFrontmatter,
	mergeYamlBlocks,
	refreshMediaExtendedNoteContent,
	sanitizeFileName,
	sanitizeTag,
	videoStatsFrontmatter,
} = await loadSource('src/utils/frontmatter.ts');
const realFrontmatter = await loadSource('src/utils/frontmatter.ts');
const videoTopics = await loadSource('src/utils/videoTopics.ts');
const videoPlatformModule = await loadSource('src/utils/videoPlatform.ts');
const { formatLocalDate, formatLocalDateTime, hasTimeOfDay, isFrontmatterDateValue, noteCreatedDateTime } = await loadSource('src/utils/dateTime.ts');
const { buildMediaExtendedFrontmatter } = realFrontmatter;

// Test 1: sanitizeFileName

console.log('Testing sanitizeFileName...');
assert.strictEqual(
	sanitizeFileName('How to Build AI Agents? (2026 Tutorial) #1 [Full] / <Live>'),
	'How to Build AI Agents (2026 Tutorial) 1 Full Live'
);
assert.strictEqual(sanitizeFileName('con'), 'con-video');
assert.strictEqual(sanitizeFileName('aux.md'), 'aux.md-video');
assert.strictEqual(sanitizeFileName('   ...---   '), 'YouTube Summary');
assert.strictEqual(sanitizeFileName(''), 'YouTube Summary');
const longName = 'A'.repeat(150);
assert.strictEqual(sanitizeFileName(longName).length, 100);
console.log('✓ sanitizeFileName passed');

// Test 2: sanitizeTag

console.log('Testing sanitizeTag...');
assert.strictEqual(sanitizeTag('#Artificial Intelligence!'), 'artificial-intelligence');
assert.strictEqual(sanitizeTag(' machine learning '), 'machine-learning');
assert.strictEqual(sanitizeTag('C++ / Python'), 'c/python');
assert.strictEqual(sanitizeTag('---tag---'), 'tag');
assert.strictEqual(sanitizeTag('foo--bar'), 'foo-bar');
console.log('✓ sanitizeTag passed');

// Test 3: buildFrontmatter

console.log('Testing buildFrontmatter...');
const testData = {
	title: 'Never Gonna Give You Up: 4K Remaster "Special"',
	channel_name: 'Rick Astley',
	channel_username: '@RickAstleyYT',
	channel_url: 'https://www.youtube.com/@RickAstleyYT',
	video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
	thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
	thumbnail_text: 'RICK ASTLEY OFFICIAL MUSIC VIDEO',
	tags: ['music', 'pop-culture', '80s-music']
};

const built = buildFrontmatter(testData);
assert(built.startsWith('---\n'));
assert(built.endsWith('\n---'));
assert(built.includes('title: "Never Gonna Give You Up: 4K Remaster \\"Special\\""'));
assert(built.includes('channel_name: "Rick Astley"'));
assert(built.includes('channel_username: "@RickAstleyYT"'));
assert(built.includes('channel_url: "https://www.youtube.com/@RickAstleyYT"'));
assert(built.includes('video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"'));
assert(built.includes('thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"'));
assert(built.includes('thumbnail_text: "RICK ASTLEY OFFICIAL MUSIC VIDEO"'));
assert(built.includes('tags:\n  - music\n  - pop-culture\n  - 80s-music'));
console.log('✓ buildFrontmatter passed');

// Test 4: mergeFrontmatter

console.log('Testing mergeFrontmatter...');
const existingYaml = `aliases:
  - Rick Roll
date_created: 2026-01-01
tags:
  - existing-tag
  - music
custom_prop: "preserved"`;

const merged = mergeFrontmatter(existingYaml, testData);
assert(merged.includes('aliases:\n  - Rick Roll'));
assert(merged.includes('date_created: 2026-01-01'));
assert(merged.includes('custom_prop: "preserved"'));
assert(merged.includes('title: "Never Gonna Give You Up: 4K Remaster \\"Special\\""'));
assert(merged.includes('channel_username: "@RickAstleyYT"'));
assert(merged.includes('tags:\n  - existing-tag\n  - music\n  - pop-culture\n  - 80s-music'));
console.log('✓ mergeFrontmatter passed');

// Test 7: extractTagsFromText

console.log('Testing extractTagsFromText...');
const titleWithTags = 'Next.js 15 Full Course #NextJS #React #web_dev #123';
const titleTags = extractTagsFromText(titleWithTags);
assert.deepStrictEqual(titleTags, ['nextjs', 'react', 'web-dev']);

const descWithTags = `In this video we cover:
- React Server Components #ServerComponents
- AI SDKs #ArtificialIntelligence #AI
Don't forget to like and subscribe! ## NotATag #123`;
const descTags = extractTagsFromText(descWithTags);
assert.deepStrictEqual(descTags, ['servercomponents', 'artificialintelligence', 'ai']);
console.log('✓ extractTagsFromText passed');

// Test 8: extractYouTubeUrlFromNote

console.log('Testing extractYouTubeUrlFromNote...');
const noteWithFm = `---
title: "Old Video"
video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
---
# Content`;
assert.strictEqual(
	extractYouTubeUrlFromNote(noteWithFm),
	'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
);

const noteWithMdLink = `# My Video
👤 [Author](https://youtube.com/@channel)  🔗 [Watch video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
Summary text...`;
assert.strictEqual(
	extractYouTubeUrlFromNote(noteWithMdLink),
	'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
);

const noteWithShorts = `Check this out: https://youtu.be/dQw4w9WgXcQ nice!`;
assert.strictEqual(
	extractYouTubeUrlFromNote(noteWithShorts),
	'https://youtu.be/dQw4w9WgXcQ'
);

const noteWithNoUrl = `# Just a regular note with no links`;
assert.strictEqual(extractYouTubeUrlFromNote(noteWithNoUrl), null);
console.log('✓ extractYouTubeUrlFromNote passed');

// Test 10: mergeFrontmatter with excludeTags (for metadata refresh)

console.log('Testing mergeFrontmatter with excludeTags...');
const oldYamlWithTags = `tags:
  - my-custom-tag
title: "Old Title"`;

const upgraded = mergeFrontmatter(oldYamlWithTags, testData, { excludeTags: true });
// Should preserve existing tag
assert(upgraded.includes('tags:\n  - my-custom-tag'));
// Should NOT include new testData tags (pop-culture, 80s-music)
assert(!upgraded.includes('80s-music'));
// Should add new fields
assert(upgraded.includes('channel_username: "@RickAstleyYT"'));
assert(upgraded.includes('thumbnail_text: "RICK ASTLEY OFFICIAL MUSIC VIDEO"'));
console.log('✓ mergeFrontmatter with excludeTags passed');

// Test 20: YouTube description in frontmatter, Data API tags injection, and tag deduplication
console.log('Testing YouTube description in frontmatter and tag deduplication...');

// Case 1: Deduplication of tags between title, description, and Data API
const test20TitleTags = extractTagsFromText('Deep Dive: #Obsidian & #Productivity for Developers #AI');
const test20DescTags = extractTagsFromText('Check out #productivity, #Obsidian, and #machine-learning in 2026!');
const test20DataApiTags = ['Obsidian', 'AI', 'Machine Learning', 'Productivity', 'Note Taking', 'obsidian'];

const test20CombinedRawTags = [...test20TitleTags, ...test20DescTags, ...test20DataApiTags];
const test20Deduplicated = deduplicateTags(test20CombinedRawTags);

// Ensure no duplicate 'obsidian', 'productivity', 'ai', 'machine-learning'
assert.strictEqual(test20Deduplicated.filter(t => t === 'obsidian').length, 1);
assert.strictEqual(test20Deduplicated.filter(t => t === 'productivity').length, 1);
assert.strictEqual(test20Deduplicated.filter(t => t === 'ai').length, 1);
assert.strictEqual(test20Deduplicated.filter(t => t === 'machine-learning').length, 1);
assert.strictEqual(test20Deduplicated.includes('note-taking'), true);

// Case 2: Deduplication collapsing run-together hashtag vs hyphenated Data API tag
// e.g. #RickAstley in title/desc vs "Rick Astley" in Data API
const hashtagAndApi = deduplicateTags(['#RickAstley', 'Rick Astley', '#NeverGonnaGiveYouUp', 'Never Gonna Give You Up']);
assert.strictEqual(hashtagAndApi.includes('rick-astley'), true);
assert.strictEqual(hashtagAndApi.includes('rickastley'), false);
assert.strictEqual(hashtagAndApi.includes('never-gonna-give-you-up'), true);
assert.strictEqual(hashtagAndApi.includes('nevergonnagiveyouup'), false);

// Case 3: buildFrontmatter with description (multi-line)
const dataWithDesc = {
	title: 'Test Title',
	channel_name: 'Test Channel',
	channel_username: '@test',
	channel_url: 'https://youtube.com/@test',
	video_url: 'https://youtube.com/watch?v=123',
	thumbnail: 'https://img.youtube.com/thumb.jpg',
	thumbnail_text: 'OCR text',
	video_description: 'Line 1 of description\nLine 2 of description with https://link.com\n\nEnjoy the video!',
	tags: ['#AI', 'ai', 'Obsidian', '#Obsidian']
};

const builtWithDesc = buildFrontmatter(dataWithDesc);
assert(builtWithDesc.includes('video_description: |-\n  Line 1 of description\n  Line 2 of description with https://link.com\n\n  Enjoy the video!'));
// Tags should be deduplicated inside frontmatter
assert(builtWithDesc.includes('tags:\n  - ai\n  - obsidian'));
assert(!builtWithDesc.includes('- ai\n  - ai'));

// Case 4: buildFrontmatter without description (undefined)
const dataWithoutDesc = { ...dataWithDesc, video_description: undefined };
const builtWithoutDesc = buildFrontmatter(dataWithoutDesc);
assert(!builtWithoutDesc.includes('description:'));

// Case 5: mergeFrontmatter adding description and Data API tags to note without them
const oldNoteYaml = `aliases:
  - My Note
tags:
  - personal-notes
title: "Old Title"`;

const mergedWithDescAndTags = mergeFrontmatter(oldNoteYaml, dataWithDesc);
assert(mergedWithDescAndTags.includes('video_description: |-\n  Line 1 of description'));
assert(mergedWithDescAndTags.includes('tags:\n  - personal-notes\n  - ai\n  - obsidian'));

// Case 6: mergeFrontmatter replacing existing multi-line description
const noteWithOldDesc = `title: "Old"
video_description: |-
  Old line 1
  Old line 2
tags:
  - old-tag`;

const mergedReplacedDesc = mergeFrontmatter(noteWithOldDesc, dataWithDesc);
assert(mergedReplacedDesc.includes('Line 1 of description'));
assert(!mergedReplacedDesc.includes('Old line 1'));
assert(!mergedReplacedDesc.includes('Old line 2'));
assert(mergedReplacedDesc.includes('tags:\n  - old-tag\n  - ai\n  - obsidian'));

console.log('✓ YouTube description in frontmatter and tag deduplication passed');

// Test 33: Video stats frontmatter (duration, published_at, view_count, like_count, aspect_ratio)
console.log('Testing video stats frontmatter and aspect ratio detection...');

// 33.1: Aspect ratio reduction and detection (largest format wins; dimensions from real player responses)
assert.strictEqual(YouTubeService.formatAspectRatio(3840, 2160), '16 / 9');
assert.strictEqual(YouTubeService.formatAspectRatio(320, 240), '4 / 3');
assert.strictEqual(YouTubeService.formatAspectRatio(1080, 1920), '9 / 16');
assert.strictEqual(YouTubeService.formatAspectRatio(1280, 534), '640 / 267');
assert.strictEqual(
	YouTubeService.getAspectRatioFromPlayerData({
		streamingData: {
			formats: [{ width: 640, height: 360 }],
			adaptiveFormats: [{ width: 3840, height: 2160 }, { mimeType: 'audio/mp4' }, { width: 1280, height: 720 }],
		},
	}),
	'16 / 9'
);
assert.strictEqual(YouTubeService.getAspectRatioFromPlayerData({ streamingData: { adaptiveFormats: [{ width: 1080, height: 1920 }] } }), '9 / 16');
assert.strictEqual(YouTubeService.getAspectRatioFromPlayerData({}), undefined);
assert.strictEqual(YouTubeService.getAspectRatioFromPlayerData({ streamingData: { formats: [{ mimeType: 'audio/webm' }] } }), undefined);

// 33.2: Metadata mapping and frontmatter lines in Media Extended-compatible formats (through buildFrontmatter)
const statsBase = { title: 'T', channel_name: 'C', channel_username: '', channel_url: 'https://www.youtube.com/@c', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 'thumb', thumbnail_text: '' };
const STATS_KEY = /^(duration|published_at|view_count|like_count|aspect_ratio):/;
const statsLinesOf = (data) => buildFrontmatter({ ...statsBase, ...data }).split('\n').filter((line) => STATS_KEY.test(line));
const statsData = videoStatsFrontmatter({ duration: 213.4, publishedAt: '2009-10-25', viewCount: 1822608029, likeCount: 19404514, aspectRatio: '16 / 9' });
assert.deepStrictEqual(statsLinesOf(statsData), [
	'duration: 213',
	'published_at: 2009-10-25',
	'view_count: 1822608029',
	'like_count: 19404514',
	'aspect_ratio: 16 / 9',
]);
// Zero counts are kept (a real value); missing or malformed values are omitted
assert.deepStrictEqual(statsLinesOf({ view_count: 0, like_count: 0 }), ['view_count: 0', 'like_count: 0']);
assert.deepStrictEqual(statsLinesOf(videoStatsFrontmatter({})), []);
assert.deepStrictEqual(statsLinesOf({ duration: 0, published_at: 'Oct 25, 2009', aspect_ratio: '16:9', view_count: NaN }), []);

// 33.3: Merging into existing frontmatter replaces stale stats in place and appends missing ones
const mergedStats = mergeFrontmatter('title: "T"\nview_count: 5\ncustom: keep', { ...statsBase, ...statsData }).split('\n');
assert.deepStrictEqual(mergedStats.slice(0, 3), ['title: "T"', 'view_count: 1822608029', 'custom: keep']);
assert.deepStrictEqual(mergedStats.slice(3).filter((line) => STATS_KEY.test(line)), [
	'duration: 213',
	'published_at: 2009-10-25',
	'like_count: 19404514',
	'aspect_ratio: 16 / 9',
]);

console.log('✓ Video stats frontmatter and aspect ratio detection passed');

// Test 34: Refresh video metadata (note classification, YAML block merge, Media Extended frontmatter refresh)
console.log('Testing refresh video metadata classification and frontmatter merging...');

// 34.1: Classification
assert.strictEqual(getVideoNoteKind('---\nmx-uid: abc\n---\n', 'Notes/x.md', 'Media Library'), 'mediaExtended');
assert.strictEqual(getVideoNoteKind('---\ntitle: x\n---\n', 'Media Library/x.md', 'Media Library'), 'mediaExtended');
assert.strictEqual(getVideoNoteKind('---\nvideo_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"\n---\n', 'Video Summaries/x.md', 'Media Library'), 'summary');
assert.strictEqual(getVideoNoteKind('Just a link https://youtu.be/dQw4w9WgXcQ in a note', 'Notes/x.md', 'Media Library'), null);
assert.strictEqual(getVideoNoteKind('---\ntitle: x\n---\n', 'Notes/x.md', 'Media Library'), null);

// 34.2: YAML block merge — replaces in place (incl. multi-line blocks), appends new keys, keeps others and comments
const refreshExistingYaml = 'mx-uid: keepme\ntitle: Old\n# my comment\ndescription: |-\n  Old line 1\n\n  Old line 2\ncustom: value\ncover: "[[mx-cover-youtube_dQw4w9WgXcQ.jpg]]"';
const refreshUpdatesYaml = 'title: New\ndescription: |-\n  New desc\ncover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"\naspect_ratio: 16 / 9';
assert.strictEqual(
	mergeYamlBlocks(refreshExistingYaml, refreshUpdatesYaml),
	'mx-uid: keepme\ntitle: New\n# my comment\ndescription: |-\n  New desc\ncustom: value\ncover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"\naspect_ratio: 16 / 9'
);

// 34.3: Media Extended refresh — fixes the old wikilink cover, keeps mx-uid, custom keys, and the body
const oldMeNote = '---\nmx-uid: vcxchy79gecb4s69v25oxq9s\nvideo: https://www.youtube.com/watch?v=dQw4w9WgXcQ\ntitle: Old Title\ndescription: ""\nduration: 200\ncreator: Rick Astley\nmy_rating: 5\ncover: "[[mx-cover-youtube_dQw4w9WgXcQ.jpg]]"\naspect_ratio: 427 / 240\n---\n\n# Description\n\nBody text\n\n# Related\n\n- [[Summary]]\n';
const refreshedMe = refreshMediaExtendedNoteContent(oldMeNote, {
	videoId: 'dQw4w9WgXcQ',
	title: 'Rick Astley - Never Gonna Give You Up',
	description: 'Fresh description',
	duration: 213,
	creator: 'Rick Astley',
	publishedAt: '2009-10-25',
	viewCount: 1822608029,
	likeCount: 19404514,
	cover: 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp',
	aspectRatio: '16 / 9',
});
assert(refreshedMe.startsWith('---\nmx-uid: vcxchy79gecb4s69v25oxq9s\n'));
assert(refreshedMe.includes('title: Rick Astley - Never Gonna Give You Up'));
assert(refreshedMe.includes('description: |-\n  Fresh description'));
assert(refreshedMe.includes('duration: 213'));
assert(refreshedMe.includes('my_rating: 5'));
assert(refreshedMe.includes('cover: "https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/maxresdefault.webp"'));
assert(!refreshedMe.includes('mx-cover-youtube'));
assert(refreshedMe.includes('aspect_ratio: 16 / 9'));
assert(refreshedMe.includes('published_at: 2009-10-25'));
assert(refreshedMe.endsWith('---\n\n# Description\n\nBody text\n\n# Related\n\n- [[Summary]]\n'));
assert.strictEqual((refreshedMe.match(/^mx-uid:/gm) || []).length, 1);
assert.strictEqual((refreshedMe.match(/^cover:/gm) || []).length, 1);

// Refreshing twice is stable (idempotent)
const refreshMeta = { videoId: 'dQw4w9WgXcQ', title: 'T', creator: 'C', cover: 'https://i.ytimg.com/vi_webp/dQw4w9WgXcQ/hqdefault.webp' };
const refreshedOnce = refreshMediaExtendedNoteContent(oldMeNote, refreshMeta);
assert.strictEqual(refreshMediaExtendedNoteContent(refreshedOnce, refreshMeta), refreshedOnce);

// 34.4: Notes that use `media:` don't get a duplicate `video:` key
const mediaKeyNote = '---\nmx-uid: abc\nmedia: https://www.youtube.com/watch?v=dQw4w9WgXcQ\n---\nBody\n';
const refreshedMediaKey = refreshMediaExtendedNoteContent(mediaKeyNote, refreshMeta);
assert(!/^video:/m.test(refreshedMediaKey));
assert(refreshedMediaKey.includes('media: https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
assert(refreshedMediaKey.endsWith('---\nBody\n'));

console.log('✓ Refresh video metadata classification and frontmatter merging passed');

// Test 36: Blank-note detection for the summarizer ("Untitled" notes with tags-only frontmatter)
console.log('Testing blank-note detection for Untitled notes with tags-only frontmatter...');

const tagsOnlyList = '---\ntags:\n  - inbox\n  - video\n---\n';
const tagsOnlyInline = '---\ntags: [inbox, video]\n---';

// 36.1: Empty notes are blank regardless of name
assert.strictEqual(isBlankNoteForSummary('', 'My Note'), true);
assert.strictEqual(isBlankNoteForSummary('  \n\n', 'Anything'), true);

// 36.2: Untitled + tags-only frontmatter + no body → blank (list, inline, CRLF, trailing whitespace, numbered Untitled)
assert.strictEqual(isBlankNoteForSummary(tagsOnlyList, 'Untitled'), true);
assert.strictEqual(isBlankNoteForSummary(tagsOnlyInline, 'Untitled 3'), true);
assert.strictEqual(isBlankNoteForSummary('---\r\ntags:\r\n  - inbox\r\n---\r\n\r\n', 'Untitled'), true);
assert.strictEqual(isBlankNoteForSummary(`${tagsOnlyList}\n   \n`, 'untitled 2'), true);
assert.strictEqual(isBlankNoteForSummary('---\n---\n', 'Untitled'), true);

// 36.3: Any condition failing → not blank
assert.strictEqual(isBlankNoteForSummary(tagsOnlyList, 'Meeting notes'), false); // name
assert.strictEqual(isBlankNoteForSummary(`${tagsOnlyList}\nSome text`, 'Untitled'), false); // body
assert.strictEqual(isBlankNoteForSummary('---\ntags:\n  - a\ncreated: 2026-10-02\n---\n', 'Untitled'), false); // other key
assert.strictEqual(isBlankNoteForSummary('---\naliases: [x]\n---\n', 'Untitled'), false); // non-tags key only
assert.strictEqual(isBlankNoteForSummary('Just text', 'Untitled'), false); // body, no frontmatter

// 36.4: Writing the summary into a tags-only note keeps the user's tags and adds the summary frontmatter + body
const blankFmData = {
	title: 'Video', channel_name: 'C', channel_username: '@c', channel_url: 'https://www.youtube.com/@c',
	video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 't.jpg', thumbnail_text: '', tags: ['music'],
};
const tagsOnlyCurrent = `${tagsOnlyList.trimEnd()}\n\n## Summary\n\nText`;
const tagsOnlyFm = tagsOnlyCurrent.match(/^---\r?\n([\s\S]*?\r?\n)---(\r?\n)?/);
const mergedTagsOnly = `---\n${mergeFrontmatter(tagsOnlyFm[1], blankFmData)}\n---\n${tagsOnlyCurrent.slice(tagsOnlyFm[0].length)}`;
assert(mergedTagsOnly.includes('  - inbox'));
assert(mergedTagsOnly.includes('  - video'));
assert(mergedTagsOnly.includes('  - music'));
assert(mergedTagsOnly.includes('title: "Video"'));
assert(mergedTagsOnly.trimEnd().endsWith('## Summary\n\nText'));
assert.strictEqual((mergedTagsOnly.match(/^tags:/gm) || []).length, 1);

console.log('✓ Blank-note detection for Untitled notes with tags-only frontmatter passed');

// Test 42: watch_later / favorite checkbox properties in video summary frontmatter
console.log('Testing watch_later and favorite frontmatter properties...');

// Runs against the real src/utils/frontmatter.ts

const flagData = {
	title: 'Flag Test',
	channel_name: 'Channel',
	channel_username: '@channel',
	channel_url: 'https://www.youtube.com/@channel',
	video_url: 'https://www.youtube.com/watch?v=MdxaU0l3FzI',
	thumbnail: 'https://img.youtube.com/vi/MdxaU0l3FzI/maxresdefault.jpg',
	thumbnail_text: '',
	video_description: 'Line one\nwatch_later: true',
	tags: ['topic'],
};

// 42.1: New notes get both properties as unquoted YAML booleans, before description and tags
const flagLines = realFrontmatter.buildFrontmatter(flagData).split('\n');
assert(flagLines.includes('watch_later: false'));
assert(flagLines.includes('favorite: false'));
assert.strictEqual(flagLines.indexOf('favorite: false'), flagLines.indexOf('watch_later: false') + 1);
assert(flagLines.indexOf('favorite: false') < flagLines.indexOf('video_description: |-'));
assert(flagLines.indexOf('favorite: false') < flagLines.indexOf('tags:'));
assert.strictEqual(flagLines[0], '---');
assert.strictEqual(flagLines[flagLines.length - 1], '---');

// 42.2: Merging into a note without them adds both once
const mergedMissing = realFrontmatter.mergeFrontmatter('title: "Old"\nrating: 5\ntags:\n  - mine\n', flagData).split('\n');
assert.strictEqual(mergedMissing.filter((l) => l === 'watch_later: false').length, 1);
assert.strictEqual(mergedMissing.filter((l) => l === 'favorite: false').length, 1);
assert(mergedMissing.includes('rating: 5'));
assert(!mergedMissing.includes(''), 'appended properties should not be preceded by a blank line');
assert(mergedMissing.indexOf('favorite: false') < mergedMissing.indexOf('tags:'));

// 42.3: Values the user set are never overwritten or duplicated (refresh, regenerate)
const mergedSet = realFrontmatter.mergeFrontmatter('title: "Old"\nwatch_later: true\nfavorite: true\n', flagData);
assert(mergedSet.includes('watch_later: true'));
assert(mergedSet.includes('favorite: true'));
assert(!mergedSet.includes('watch_later: false'));
assert(!mergedSet.includes('favorite: false'));
const mergedPartial = realFrontmatter.mergeFrontmatter('favorite: true\n', flagData, { excludeTags: true });
assert(mergedPartial.includes('favorite: true'));
assert(mergedPartial.includes('watch_later: false'));
assert(!mergedPartial.includes('favorite: false'));

// 42.4: A second merge is stable, and text inside the description doesn't count as the property
const mergedOnce = realFrontmatter.mergeFrontmatter('title: "Old"\n', flagData);
assert.strictEqual(mergedOnce.split('\n').filter((l) => l === 'watch_later: false').length, 1);
assert(mergedOnce.includes('  watch_later: true')); // the indented description line
assert.strictEqual(realFrontmatter.mergeFrontmatter(`${mergedOnce}\n`, flagData), mergedOnce);

// 42.5: Whole-note update keeps a ticked box and the body
const flaggedNote = '---\ntitle: "Old"\nwatch_later: true\n---\n\nBody text\n';
const updatedFlaggedNote = realFrontmatter.updateNoteContentWithFrontmatter(flaggedNote, flagData);
assert(updatedFlaggedNote.includes('\nwatch_later: true\n'));
assert(updatedFlaggedNote.includes('\nfavorite: false\n'));
assert(updatedFlaggedNote.endsWith('\nBody text\n'));

console.log('✓ watch_later and favorite frontmatter properties passed');

// Test 46: video_url follows title, and the AI-inferred `topic` list property (real frontmatter.ts / videoTopics.ts)
console.log('Testing video_url order and the topic frontmatter property...');

const topicData = {
	title: 'Topic Test',
	channel_name: 'Channel',
	channel_username: '@channel',
	channel_url: 'https://www.youtube.com/@channel',
	video_url: 'https://www.youtube.com/watch?v=MdxaU0l3FzI',
	thumbnail: 'https://img.youtube.com/vi/MdxaU0l3FzI/maxresdefault.jpg',
	thumbnail_text: '',
	video_description: 'A description',
	topic: ['Machine Learning', 'Personal Finance', 'machine learning'],
	tags: ['ai'],
};
const keysOf = (yaml) => yaml.split('\n').map((line) => line.match(/^([A-Za-z0-9_-]+):/)?.[1]).filter(Boolean);

// 46.1: New notes: video_url sits between title and channel_name; topic is a list just before tags
const topicBuilt = realFrontmatter.buildFrontmatter(topicData);
const builtKeys = keysOf(topicBuilt);
assert.deepStrictEqual(builtKeys.slice(0, 3), ['title', 'video_url', 'channel_name']);
assert.strictEqual(builtKeys.indexOf('topic'), builtKeys.indexOf('tags') - 1);
assert(topicBuilt.includes('topic:\n  - Machine Learning\n  - Personal Finance\ntags:'), 'topic list is deduplicated, case-insensitively');

// 46.2: No topics, no topic property
assert(!realFrontmatter.buildFrontmatter({ ...topicData, topic: undefined }).includes('topic:'));
assert(!realFrontmatter.buildFrontmatter({ ...topicData, topic: [] }).includes('topic:'));

// 46.3: Topics YAML would misread are quoted
const quotedBuilt = realFrontmatter.buildFrontmatter({ ...topicData, topic: ['C++: Basics', 'True', '2024'] });
assert(quotedBuilt.includes('  - "C++: Basics"\n  - "True"\n  - "2024"'));

// 46.4: Merging: new topics replace the existing list in place; other keys are kept
const existingTopicYaml = 'title: "Old"\ntopic:\n  - Old Topic\n  - Another\nmy_key: kept\ntags:\n  - old-tag\n';
const mergedTopics = realFrontmatter.mergeFrontmatter(existingTopicYaml, topicData);
assert(mergedTopics.includes('topic:\n  - Machine Learning\n  - Personal Finance\nmy_key: kept'));
assert(!mergedTopics.includes('Old Topic'));
assert.strictEqual(keysOf(mergedTopics).filter((k) => k === 'topic').length, 1);

// 46.5: Merging without topics (inference off or failed, or a metadata refresh) keeps the existing list
const keptTopics = realFrontmatter.mergeFrontmatter(existingTopicYaml, { ...topicData, topic: undefined }, { excludeTags: true });
assert(keptTopics.includes('topic:\n  - Old Topic\n  - Another\n'));

// 46.6: Merging into a note without topic adds it before tags
const addedTopics = realFrontmatter.mergeFrontmatter('title: "Old"\ntags:\n  - old-tag\n', topicData);
const addedKeys = keysOf(addedTopics);
assert.strictEqual(addedKeys.indexOf('topic'), addedKeys.indexOf('tags') - 1);

// 46.7: Merging replaces an inline topic value and a list with unindented items
assert(realFrontmatter.mergeFrontmatter('topic: Old\n', topicData).startsWith('topic:\n  - Machine Learning'));
const unindented = realFrontmatter.mergeFrontmatter('topic:\n- Old\n- Older\nfavorite: true\n', topicData);
assert(!unindented.includes('Old'));
assert(unindented.includes('favorite: true'));

// 46.8: Parsing the model's reply: at most 3, Title Case, cleaned of list markers / quotes / wikilinks, deduplicated
assert.deepStrictEqual(
	videoTopics.parseVideoTopics('1. machine learning\n- "Personal Finance"\n* [[home automation]]\nCooking'),
	['Machine Learning', 'Personal Finance', 'Home Automation']
);
assert.deepStrictEqual(videoTopics.parseVideoTopics('AI Safety, ai safety, history of science'), ['AI Safety', 'History of Science']);
assert.deepStrictEqual(videoTopics.parseVideoTopics('Topics:\n#iOS Development.'), ['iOS Development']);
assert.deepStrictEqual(videoTopics.parseVideoTopics(''), []);
assert.deepStrictEqual(videoTopics.parseVideoTopics(`${'word '.repeat(20)}\n42`), []);

// 46.9: The prompt carries the title and transcript; long transcripts are sampled from start, middle, and end
const topicPrompt = videoTopics.buildVideoTopicsPrompt('short transcript text', 'My Video');
assert(topicPrompt.includes('Video title: My Video') && topicPrompt.includes('short transcript text'));
assert(topicPrompt.includes('between 1 and 3 topics'));
const longTranscript = `START ${'a '.repeat(20000)}MIDDLE ${'b '.repeat(20000)}END`;
const sampled = videoTopics.sampleTranscriptForTopics(longTranscript, 3000);
assert(sampled.length <= 3000 + 20);
assert(sampled.startsWith('START') && sampled.endsWith('END') && sampled.includes('MIDDLE'));

// 46.10: Every provider implements inference, and the summary pipeline writes it behind the setting
for (const name of ['anthropic', 'gemini', 'openai']) {
	const source = readFileSync(new URL(`../src/services/providers/${name}.ts`, import.meta.url), 'utf8');
	assert(source.includes('async inferVideoTopics('), `${name} provider infers topics`);
}
const mainSourceForTopics = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
assert(mainSourceForTopics.includes('this.settings.getInferTopics() && this.provider?.inferVideoTopics'));
assert(mainSourceForTopics.includes('topic: topics.length > 0 ? topics : undefined'));

console.log('✓ video_url order and topic frontmatter property passed');

// Test 48: published_at as a date and time, and the created property
console.log('Testing published_at date and time and the created property...');

// 48.1: Local date and time formatting (zero-padded, no UTC offset), and the forms frontmatter accepts
assert.strictEqual(formatLocalDateTime(new Date(2026, 0, 5, 7, 8, 9)), '2026-01-05T07:08:09');
assert.strictEqual(formatLocalDateTime(new Date(2026, 10, 24, 23, 59, 0)), '2026-11-24T23:59:00');
assert.strictEqual(formatLocalDate(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
assert(hasTimeOfDay('2009-10-24T23:57:33') && hasTimeOfDay('2009-10-24T23:57'));
assert(!hasTimeOfDay('2009-10-24'));
for (const ok of ['2009-10-24', '2009-10-24T23:57', '2009-10-24T23:57:33']) {
	assert(isFrontmatterDateValue(ok), ok);
}
for (const bad of ['Oct 25, 2009', '2009-10-24T23:57:33-07:00', '2009-10-24T23:57:33Z', '2009-10-24 23:57', '']) {
	assert(!isFrontmatterDateValue(bad), bad);
}

// 48.2: published_at keeps its time in summary notes and Media Extended notes; a value with an offset is left out
assert.deepStrictEqual(statsLinesOf({ published_at: '2009-10-24T23:57:33' }), ['published_at: 2009-10-24T23:57:33']);
assert.deepStrictEqual(statsLinesOf({ published_at: '2009-10-24T23:57:33-07:00' }), []);
assert.deepStrictEqual(
	mergeFrontmatter('title: "T"\npublished_at: 2009-10-25', { ...statsBase, published_at: '2009-10-24T23:57:33' }).split('\n').slice(0, 2),
	['title: "T"', 'published_at: 2009-10-24T23:57:33']
);
assert(buildMediaExtendedFrontmatter({ videoId: 'dQw4w9WgXcQ', title: 'T', creator: 'C', publishedAt: '2009-10-24T23:57:33' })
	.includes('\npublished_at: 2009-10-24T23:57:33\n'));

// 48.3: created is written into new notes, after the playlist properties and before the checkboxes
const createdNote = buildFrontmatter({ ...statsBase, playlist_count: 3, created: '2026-11-24T18:45:12' }).split('\n');
const createdAt = createdNote.indexOf('created: 2026-11-24T18:45:12');
assert(createdAt > createdNote.indexOf('playlist_count: 3') && createdAt < createdNote.indexOf('watch_later: false'));
assert(!buildFrontmatter(statsBase).includes('created:'));
assert(!buildFrontmatter({ ...statsBase, created: 'yesterday' }).includes('created:'));

// 48.4: Merging adds created only when the note has none; a note's own value is never replaced
const mergedCreated = mergeFrontmatter('title: "Old"\nwatch_later: true', { ...statsBase, created: '2026-11-24T18:45:12' }).split('\n');
assert.strictEqual(mergedCreated.filter((line) => line.startsWith('created:')).length, 1);
assert(mergedCreated.indexOf('created: 2026-11-24T18:45:12') < mergedCreated.indexOf('favorite: false'));
const keptCreated = mergeFrontmatter('created: 2020-01-02T03:04:05\ntitle: "Old"', { ...statsBase, created: '2026-11-24T18:45:12' });
assert(keptCreated.startsWith('created: 2020-01-02T03:04:05\n'));
assert(!keptCreated.includes('2026-11-24T18:45:12'));
// A metadata refresh passes no created, so a note without one doesn't gain one
assert(!mergeFrontmatter('title: "Old"', statsBase).includes('created:'));

// 48.5: created is the note file's creation time, in local time; with no creation time it falls back to now
const fileBorn = new Date(2026, 10, 25, 19, 29, 47, 900);
assert.strictEqual(noteCreatedDateTime(fileBorn.getTime(), new Date(2026, 10, 26, 8, 0, 0)), '2026-11-25T19:29:47');
assert.strictEqual(noteCreatedDateTime(0, new Date(2026, 10, 26, 8, 0, 0)), '2026-11-26T08:00:00');
assert.strictEqual(noteCreatedDateTime(undefined, new Date(2026, 10, 26, 8, 0, 0)), '2026-11-26T08:00:00');

// 48.6: Every summary path and the transcript command take created from the note's file; nothing stamps "now".
// The metadata refresh passes no created at all.
const mainSourceForCreated = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
assert(!mainSourceForCreated.includes('formatLocalDateTime(new Date())'));
assert.deepStrictEqual(
	[...mainSourceForCreated.matchAll(/noteCreatedDateTime\(([^)]*)\)/g)].map((match) => match[1]),
	['targetFile.stat.ctime', 'existing.stat.ctime', 'summaryFile.stat.ctime', 'view?.file?.stat.ctime']
);

console.log('✓ published_at date and time and the created property passed');

// Test 49: host and platform, and leaving other sites' summary notes alone
console.log('Testing host and platform...');

// 49.1: host is the lowercased hostname without the port or a leading www.; every YouTube host is platform youtube
const hostCases = [
	['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube.com', 'youtube'],
	['https://youtube.com/watch?v=dQw4w9WgXcQ', 'youtube.com', 'youtube'],
	['https://youtu.be/dQw4w9WgXcQ?t=42', 'youtu.be', 'youtube'],
	['https://M.YouTube.com/watch?v=dQw4w9WgXcQ', 'm.youtube.com', 'youtube'],
	['https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'music.youtube.com', 'youtube'],
	['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'youtube-nocookie.com', 'youtube'],
	['https://www.youtube.com:443/watch?v=dQw4w9WgXcQ', 'youtube.com', 'youtube'],
	['http://localhost:8080/videos/1', 'localhost', null],
	['http://192.0.2.10:8080/v/1', '192.0.2.10', null],
	['https://vimeo.com/76979871', 'vimeo.com', null],
	['https://www.tiktok.com/@creator/video/7234567890123456789', 'tiktok.com', null],
	['https://notyoutube.com/watch?v=dQw4w9WgXcQ', 'notyoutube.com', null],
	['  https://youtu.be/dQw4w9WgXcQ  ', 'youtu.be', 'youtube'],
	['ftp://youtube.com/video', null, null],
	['not a url', null, null],
];
for (const [url, host, platform] of hostCases) {
	assert.strictEqual(videoPlatformModule.videoHost(url), host, url);
	assert.strictEqual(videoPlatformModule.videoPlatform(videoPlatformModule.videoHost(url)), platform, url);
	assert.strictEqual(videoPlatformModule.isYouTubeVideoUrl(url), platform === 'youtube', url);
}
assert.strictEqual(videoPlatformModule.videoPlatform(null), null);
assert.deepStrictEqual(realFrontmatter.videoSourceFrontmatter('https://youtu.be/dQw4w9WgXcQ'), { host: 'youtu.be', platform: 'youtube' });
assert.deepStrictEqual(realFrontmatter.videoSourceFrontmatter('https://vimeo.com/76979871'), { host: 'vimeo.com' });
assert.deepStrictEqual(realFrontmatter.videoSourceFrontmatter('not a url'), {});

// 49.2: New notes have host and platform right after video_url; they're left out when unset
const sourceData = { ...statsBase, video_url: 'https://youtu.be/dQw4w9WgXcQ', host: 'youtu.be', platform: 'youtube' };
const sourceNote = buildFrontmatter(sourceData).split('\n');
const videoUrlAt = sourceNote.indexOf('video_url: "https://youtu.be/dQw4w9WgXcQ"');
assert.deepStrictEqual(sourceNote.slice(videoUrlAt, videoUrlAt + 3), [
	'video_url: "https://youtu.be/dQw4w9WgXcQ"',
	'host: "youtu.be"',
	'platform: "youtube"',
]);
assert(!/^(host|platform):/m.test(buildFrontmatter(statsBase)));

// 49.3: A note without them gets them right after its video_url; wrong values are corrected in place
const mergedSource = mergeFrontmatter('title: "T"\nvideo_url: "https://youtu.be/dQw4w9WgXcQ"\nchannel_name: "C"\nfavorite: true', sourceData).split('\n');
assert.deepStrictEqual(mergedSource.slice(0, 5), [
	`title: ${JSON.stringify(statsBase.title)}`,
	'video_url: "https://youtu.be/dQw4w9WgXcQ"',
	'host: "youtu.be"',
	'platform: "youtube"',
	`channel_name: ${JSON.stringify(statsBase.channel_name)}`,
]);
assert.strictEqual(mergedSource.filter((line) => /^(host|platform):/.test(line)).length, 2);
const correctedSource = mergeFrontmatter('title: "T"\nvideo_url: "https://youtu.be/dQw4w9WgXcQ"\nplatform: "other"\nhost: "example.com"', sourceData).split('\n');
assert(correctedSource.includes('host: "youtu.be"') && correctedSource.includes('platform: "youtube"'));
assert.strictEqual(correctedSource.filter((line) => /^(host|platform):/.test(line)).length, 2);

// 49.4: A note whose video_url is on another site has no YouTube video, even with a YouTube link in its body
const tiktokNote = '---\nvideo_url: "https://www.tiktok.com/@creator/video/7234567890123456789"\n---\nMentioned: https://www.youtube.com/watch?v=dQw4w9WgXcQ';
assert.strictEqual(extractYouTubeUrlFromNote(tiktokNote), null);
assert.strictEqual(realFrontmatter.otherPlatformVideoHost(tiktokNote), 'tiktok.com');
const youtubeNote = '---\nvideo_url: "https://youtu.be/dQw4w9WgXcQ"\n---\n';
assert.strictEqual(extractYouTubeUrlFromNote(youtubeNote), 'https://youtu.be/dQw4w9WgXcQ');
assert.strictEqual(realFrontmatter.otherPlatformVideoHost(youtubeNote), null);
assert.strictEqual(realFrontmatter.otherPlatformVideoHost('No frontmatter'), null);
// Media Extended notes and notes with only a body link still work as before
assert.strictEqual(extractYouTubeUrlFromNote('---\nvideo: https://www.youtube.com/watch?v=dQw4w9WgXcQ\n---\n'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
assert.strictEqual(extractYouTubeUrlFromNote('See https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

// 49.5: Finding a video's note only matches YouTube URLs, not another site's URL that looks like it holds a video ID
assert(!realFrontmatter.frontmatterMatchesVideo({ video_url: 'https://notyoutube.com/watch?v=dQw4w9WgXcQ' }, ['video_url'], 'dQw4w9WgXcQ'));
assert(realFrontmatter.frontmatterMatchesVideo({ video_url: 'https://youtu.be/dQw4w9WgXcQ' }, ['video_url'], 'dQw4w9WgXcQ'));

// 49.6: The skip message names the other site
const vimeoNote = '---\nvideo_url: "https://vimeo.com/76979871"\n---\n';
assert.strictEqual(realFrontmatter.missingYouTubeVideoMessage(vimeoNote, '"Clip"'), '"Clip" is a video from vimeo.com, not YouTube.');
assert.strictEqual(realFrontmatter.missingYouTubeVideoMessage(vimeoNote, 'this note'), 'This note is a video from vimeo.com, not YouTube.');
assert.strictEqual(realFrontmatter.missingYouTubeVideoMessage('No video here', 'the note'), 'No YouTube video found in the note.');

// 49.7: Every summary path, the refresh and the transcript command set host and platform from the note's URL,
// commands report other sites' notes with the message above, and the file menu only offers a companion note for YouTube
const mainSourceForPlatform = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
assert.strictEqual([...mainSourceForPlatform.matchAll(/video_url: url,\s*\.\.\.videoSourceFrontmatter\(url\),/g)].length, 3);
assert(!mainSourceForPlatform.includes('No YouTube video found'));
assert.strictEqual([...mainSourceForPlatform.matchAll(/missingYouTubeVideoMessage\(/g)].length, 7);
assert(/typeof frontmatter\?\.video_url === 'string' && isYouTubeVideoUrl\(frontmatter\.video_url\)/.test(mainSourceForPlatform));

console.log('✓ host and platform passed');

// Test 51: video_description in summary notes (renamed from description)
console.log('Testing the video_description property...');
const { frontmatterVideoDescription } = await loadSource('src/utils/summaryNote.ts');
const descData = {
	title: 'Desc Test',
	video_url: 'https://www.youtube.com/watch?v=MdxaU0l3FzI',
	channel_name: 'Channel',
	channel_username: '@channel',
	channel_url: 'https://www.youtube.com/@channel',
	thumbnail: '',
	thumbnail_text: '',
	video_description: 'Fresh line 1\n\nFresh line 2',
};
const { video_description: _unused, ...descDataWithout } = descData;
const descKeys = (yaml) => yaml.split('\n').map((line) => line.match(/^([A-Za-z0-9_-]+):/)?.[1]).filter(Boolean);
const freshBlock = 'video_description: |-\n  Fresh line 1\n\n  Fresh line 2';

// 51.1: New notes write video_description, never description; a blank one is ""
const builtDesc = realFrontmatter.buildFrontmatter(descData);
assert(builtDesc.includes(freshBlock));
assert(!descKeys(builtDesc).includes('description'));
assert(realFrontmatter.buildFrontmatter({ ...descData, video_description: '  ' }).includes('video_description: ""'));
assert(!descKeys(realFrontmatter.buildFrontmatter(descDataWithout)).includes('video_description'));

// 51.2: An existing video_description is replaced where it sits
const withNew = 'title: "Old"\nvideo_description: |-\n  Old 1\n  Old 2\ncustom: kept\ntags:\n  - a';
const mergedNew = realFrontmatter.mergeFrontmatter(withNew, descData, { excludeTags: true });
assert(mergedNew.includes(`${freshBlock}\ncustom: kept`));
assert(!mergedNew.includes('Old 1'));

// 51.3: An older description is renamed in place when there's a new value, and left alone without one
const withLegacy = 'title: "Old"\ndescription: |-\n  Legacy 1\n\n  Legacy 2\ncustom: kept';
const migrated = realFrontmatter.mergeFrontmatter(withLegacy, descData, { excludeTags: true });
assert(migrated.includes(`${freshBlock}\ncustom: kept`));
assert(!descKeys(migrated).includes('description'));
assert(!migrated.includes('Legacy'));
const untouched = realFrontmatter.mergeFrontmatter(withLegacy, descDataWithout, { excludeTags: true });
assert(untouched.includes('description: |-\n  Legacy 1\n\n  Legacy 2\ncustom: kept'));
assert(!descKeys(untouched).includes('video_description'));

// 51.4: A note with both properties ends up with only the new one, wherever the old one sat
for (const both of [
	'description: |-\n  Legacy\nvideo_description: |-\n  Old\ncustom: kept',
	'video_description: |-\n  Old\ndescription: |-\n  Legacy\ncustom: kept',
]) {
	const merged = realFrontmatter.mergeFrontmatter(both, descData, { excludeTags: true });
	const keys = descKeys(merged);
	assert.strictEqual(keys.filter((key) => key === 'video_description').length, 1);
	assert(!keys.includes('description'));
	assert(!merged.includes('Legacy') && !merged.includes('Old'));
}

// 51.5: A note with neither gets video_description added
const added = realFrontmatter.mergeFrontmatter('title: "Old"\ncustom: kept', descData, { excludeTags: true });
assert(added.includes(freshBlock));
assert(!descKeys(added).includes('description'));

// 51.6: Reading prefers video_description, falls back to description, and ignores non-strings
assert.strictEqual(frontmatterVideoDescription({ video_description: 'new', description: 'old' }), 'new');
assert.strictEqual(frontmatterVideoDescription({ video_description: '', description: 'old' }), '');
assert.strictEqual(frontmatterVideoDescription({ description: 'old' }), 'old');
assert.strictEqual(frontmatterVideoDescription({ video_description: 5, description: 'old' }), 'old');
assert.strictEqual(frontmatterVideoDescription({ description: ['x'] }), undefined);
assert.strictEqual(frontmatterVideoDescription(undefined), undefined);

// 51.7: Media Extended notes keep description
const meDescFm = realFrontmatter.buildMediaExtendedFrontmatter({ videoId: 'dQw4w9WgXcQ', title: 'T', creator: 'C', description: 'Me desc' });
assert(meDescFm.includes('description: |-\n  Me desc'));
assert(!meDescFm.includes('video_description'));

// 51.8: Wiring: summary builders set video_description, and both readers go through the helper
const mainSourceForDesc = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
assert.strictEqual((mainSourceForDesc.match(/video_description: this\.settings\.getAddDescriptionToFrontmatter\(\)/g) || []).length, 3);
assert(!/^\s*description: this\.settings\.getAddDescriptionToFrontmatter\(\)/m.test(mainSourceForDesc));
assert.strictEqual((mainSourceForDesc.match(/frontmatterVideoDescription\(/g) || []).length, 2);
assert(!/frontmatter\?\.description\b/.test(mainSourceForDesc));

console.log('✓ video_description passed');

console.log('\nAll tests passed successfully!');
