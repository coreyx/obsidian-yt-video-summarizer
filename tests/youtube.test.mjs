// YouTube parsing: HTML decoding, tags from YouTube metadata, and playlist discovery.
import assert from 'node:assert';
import { loadSource } from './helpers/loadSource.mjs';
import { setRequestUrlHandler } from './helpers/obsidian-stub.mjs';

const { buildSummaryBody, buildVideoMetaLine } = await loadSource('src/utils/summaryNote.ts');
const { YouTubeService } = await loadSource('src/services/youtube.ts');
const {
	collectVideoTags,
	findPlaylistIdInDescription,
	normalizePublishedAt,
	publishedAtFromDataApiItem,
	publishedAtFromPlayerData,
	publishedAtFromWatchPageHtml,
	tagsFromDataApiItem,
	tagsFromPlayerDataKeywords,
	tagsFromWatchPageHtml,
} = await loadSource('src/utils/youtubeMetadata.ts');
const { buildFrontmatter, mergeFrontmatter } = await loadSource('src/utils/frontmatter.ts');

// Test 5: decodeHTML with preserveNewlines

console.log('Testing decodeHTML...');
const descWithNewlines = 'Line 1 &amp; info\\nLine 2 with links: https://example.com\\n\\nLine 3 &#39;end&#39;';
const decodedPreserved = YouTubeService.decodeHTML(descWithNewlines, true);
assert.strictEqual(
	decodedPreserved,
	"Line 1 & info\nLine 2 with links: https://example.com\n\nLine 3 'end'"
);
const decodedCollapsed = YouTubeService.decodeHTML(descWithNewlines, false);
assert.strictEqual(
	decodedCollapsed,
	"Line 1 & info Line 2 with links: https://example.com Line 3 'end'"
);
console.log('✓ decodeHTML passed');

// Test 18: YouTube Data API and metadata tags extraction
console.log('Testing YouTube Data API and metadata tags extraction...');

// Case 1: Parsing Data API v3 JSON response
const mockDataApiResponse = JSON.stringify({
	items: [{
		id: 'dQw4w9WgXcQ',
		snippet: {
			title: 'Never Gonna Give You Up',
			tags: ['Rick Astley', 'Never Gonna Give You Up', '80s Music', 'Rickroll']
		}
	}]
});
const parsedApiTags = tagsFromDataApiItem(JSON.parse(mockDataApiResponse).items[0]);
assert.deepStrictEqual(parsedApiTags, ['Rick Astley', 'Never Gonna Give You Up', '80s Music', 'Rickroll']);

// Case 2: Parsing InnerTube player data keywords
const mockPlayerData = {
	videoDetails: {
		keywords: ['Obsidian', 'Note Taking', 'PKM', 'Productivity Tools']
	}
};
const parsedKeywords = tagsFromPlayerDataKeywords(mockPlayerData);
assert.deepStrictEqual(parsedKeywords, ['Obsidian', 'Note Taking', 'PKM', 'Productivity Tools']);

// Case 3: Parsing HTML fallback (JSON or meta tag)
const mockHtmlWithJson = '<html><head><script>var ytInitialPlayerResponse = {"videoDetails":{"keywords":["Markdown","Knowledge Base"]}};</script></head></html>';
assert.deepStrictEqual(tagsFromWatchPageHtml(mockHtmlWithJson), ['Markdown', 'Knowledge Base']);

const mockHtmlWithMeta = '<html><head><meta name="keywords" content="Zettelkasten, Second Brain, Workflow"></head></html>';
assert.deepStrictEqual(tagsFromWatchPageHtml(mockHtmlWithMeta), ['Zettelkasten', 'Second Brain', 'Workflow']);

// The cases below pass the sources positionally; collectVideoTags takes them as named options
const mergeAllVideoTags = (title, description, youtubeTags, topicTags, includeYouTubeTags, detectHashtags) =>
	collectVideoTags({ title, description, youtubeTags, topicTags, includeYouTubeTags, detectHashtags });

// Case 4: Merging with title/description hashtags and topic tags (on by default)
const sampleTitle = 'Mastering Obsidian in 2026 #Obsidian #Productivity';
const sampleDesc = 'Here are my top tips! Check out #SecondBrain and #PKM.\nSubscribe!';
const sampleYtTags = ['Obsidian App', 'Note Taking', 'Second Brain', 'PKM', 'Knowledge Management'];
const sampleTopics = ['digital-notes', 'productivity'];

const mergedEnabled = mergeAllVideoTags(sampleTitle, sampleDesc, sampleYtTags, sampleTopics, true, true);
// Should contain hashtags from title/desc
assert.strictEqual(mergedEnabled.includes('obsidian'), true);
assert.strictEqual(mergedEnabled.includes('productivity'), true);
assert.strictEqual(mergedEnabled.includes('pkm'), true);
// Should contain YouTube Data API tags sanitized
assert.strictEqual(mergedEnabled.includes('obsidian-app'), true);
assert.strictEqual(mergedEnabled.includes('note-taking'), true);
// The #SecondBrain hashtag and the "Second Brain" YouTube tag collapse into one tag, keeping the hyphenated form
assert.strictEqual(mergedEnabled.includes('second-brain'), true);
assert.strictEqual(mergedEnabled.includes('secondbrain'), false);
assert.strictEqual(mergedEnabled.includes('knowledge-management'), true);
// Should contain topic tags
assert.strictEqual(mergedEnabled.includes('digital-notes'), true);

// Case 5: When YouTube Data API tags toggle is disabled
const mergedDisabled = mergeAllVideoTags(sampleTitle, sampleDesc, sampleYtTags, sampleTopics, false, true);
// Title/desc and topic tags should be present
assert.strictEqual(mergedDisabled.includes('obsidian'), true);
assert.strictEqual(mergedDisabled.includes('secondbrain'), true);
assert.strictEqual(mergedDisabled.includes('digital-notes'), true);
// YouTube Data API tags should NOT be present
assert.strictEqual(mergedDisabled.includes('obsidian-app'), false);
assert.strictEqual(mergedDisabled.includes('note-taking'), false);
assert.strictEqual(mergedDisabled.includes('knowledge-management'), false);

// Case 6: De-duplication test
const tagsWithDuplicates = mergeAllVideoTags('Video #AI', 'More #machine-learning', ['AI', 'Machine Learning', 'ai'], ['AI'], true, true);
assert.deepStrictEqual(tagsWithDuplicates, ['ai', 'machine-learning']);

console.log('✓ YouTube Data API and metadata tags extraction passed');

// Test 21: Creator playlist discovery, frontmatter serialization, and body formatting
console.log('Testing creator playlist discovery, frontmatter, and body formatting...');

// Case 1: Extract playlist ID & index from video URL
const urlWithPlaylist = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLlaN88a7xkmq7R8d1b1R5U0x9O_tC9_1s&index=4';
assert.strictEqual(YouTubeService.extractPlaylistId(urlWithPlaylist), 'PLlaN88a7xkmq7R8d1b1R5U0x9O_tC9_1s');
assert.strictEqual(YouTubeService.extractPlaylistIndex(urlWithPlaylist), 4);

// Case 2: Ignore YouTube Mixes and system playlists
assert.strictEqual(YouTubeService.extractPlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ'), null);
assert.strictEqual(YouTubeService.extractPlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=WL'), null);
assert.strictEqual(YouTubeService.extractPlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=LL'), null);

// Case 3: Extract playlist link from description
const descWithPlaylist = 'Check out the complete series here:\nhttps://www.youtube.com/playlist?list=PLabc1234567890xyz\nSubscribe!';
assert.strictEqual(findPlaylistIdInDescription(descWithPlaylist), 'PLabc1234567890xyz');

// Case 4: buildFrontmatter with playlist fields
const dataWithPlaylist = {
	title: 'Building Modern Obsidian Plugins',
	channel_name: 'DevChannel',
	channel_username: '@devchannel',
	channel_url: 'https://youtube.com/@devchannel',
	video_url: 'https://youtube.com/watch?v=123',
	thumbnail: 'https://img.youtube.com/vi/123/maxresdefault.jpg',
	thumbnail_text: 'EPISODE 3',
	playlist_title: 'Obsidian Plugin Tutorial Series',
	playlist_url: 'https://www.youtube.com/playlist?list=PLabc1234567890xyz',
	playlist_id: 'PLabc1234567890xyz',
	playlist_index: 3,
	playlist_count: 12,
	tags: ['obsidian', 'plugins']
};

const builtPlaylistYaml = buildFrontmatter(dataWithPlaylist);
assert(builtPlaylistYaml.includes('playlist_title: "Obsidian Plugin Tutorial Series"'));
assert(builtPlaylistYaml.includes('playlist_url: "https://www.youtube.com/playlist?list=PLabc1234567890xyz"'));
assert(builtPlaylistYaml.includes('playlist_id: "PLabc1234567890xyz"'));
assert(builtPlaylistYaml.includes('playlist_index: 3'));
assert(builtPlaylistYaml.includes('playlist_count: 12'));

// Case 5: mergeFrontmatter adds playlist fields to existing note
const existingNoteNoPlaylist = `title: "Building Modern Obsidian Plugins"
channel_name: "DevChannel"
video_url: "https://youtube.com/watch?v=123"`;

const mergedPlaylistYaml = mergeFrontmatter(existingNoteNoPlaylist, dataWithPlaylist);
assert(mergedPlaylistYaml.includes('playlist_title: "Obsidian Plugin Tutorial Series"'));
assert(mergedPlaylistYaml.includes('playlist_url: "https://www.youtube.com/playlist?list=PLabc1234567890xyz"'));
assert(mergedPlaylistYaml.includes('playlist_id: "PLabc1234567890xyz"'));
assert(mergedPlaylistYaml.includes('playlist_index: 3'));
assert(mergedPlaylistYaml.includes('playlist_count: 12'));

// Case 6: Note body metadata line formatting with playlist
const playlistObj = {
	title: 'Obsidian Plugin Tutorial Series',
	url: 'https://www.youtube.com/playlist?list=PLabc1234567890xyz',
	index: 3,
	count: 12,
};
const formattedLineWithCount = buildVideoMetaLine('DevChannel', 'https://youtube.com/@devchannel', 'https://youtube.com/watch?v=123', playlistObj);
assert.strictEqual(
	formattedLineWithCount,
	'👤 [DevChannel](https://youtube.com/@devchannel)  🔗 [Watch video](https://youtube.com/watch?v=123)  📋 [Playlist: Obsidian Plugin Tutorial Series (3/12)](https://www.youtube.com/playlist?list=PLabc1234567890xyz)'
);

// Without count:
const formattedLineWithoutCount = buildVideoMetaLine('DevChannel', 'https://youtube.com/@devchannel', 'https://youtube.com/watch?v=123', { ...playlistObj, count: undefined });
assert.strictEqual(
	formattedLineWithoutCount,
	'👤 [DevChannel](https://youtube.com/@devchannel)  🔗 [Watch video](https://youtube.com/watch?v=123)  📋 [Playlist: Obsidian Plugin Tutorial Series (#3)](https://www.youtube.com/playlist?list=PLabc1234567890xyz)'
);

// When *Discover playlist from creator* is off, the note body's meta line has no playlist link:
const formattedLineDisabled = buildSummaryBody({
	transcript: { title: 'T', author: 'DevChannel', channelUrl: 'https://youtube.com/@devchannel', videoId: '123', lines: [], playlist: playlistObj },
	thumbnailUrl: 'thumb.jpg',
	videoUrl: 'https://youtube.com/watch?v=123',
	summary: 'S',
	showPlaylist: false,
}).split('\n\n')[1];
assert.strictEqual(
	formattedLineDisabled,
	'👤 [DevChannel](https://youtube.com/@devchannel)  🔗 [Watch video](https://youtube.com/watch?v=123)'
);

console.log('✓ Creator playlist discovery, frontmatter, and body formatting passed');

// Test 47: Publish date and time from YouTube
console.log('Testing publish date and time parsing...');

const originalTz = process.env.TZ;
try {
	// 47.1: A time with an offset becomes the computer's local date and time, with no offset
	process.env.TZ = 'America/Los_Angeles';
	assert.strictEqual(normalizePublishedAt('2009-10-24T23:57:33-07:00'), '2009-10-24T23:57:33');
	// The Data API's UTC time lands on the same local date (the old code wrote the UTC date, 2009-10-25)
	assert.strictEqual(normalizePublishedAt('2009-10-25T06:57:33Z'), '2009-10-24T23:57:33');
	process.env.TZ = 'Asia/Tokyo';
	assert.strictEqual(normalizePublishedAt('2009-10-24T23:57:33-07:00'), '2009-10-25T15:57:33');

	// 47.2: A bare date has no time to convert, so it is kept as written in every time zone
	assert.strictEqual(normalizePublishedAt('2009-10-25'), '2009-10-25');
	process.env.TZ = 'America/Los_Angeles';
	assert.strictEqual(normalizePublishedAt(' 2009-10-25 '), '2009-10-25');
	assert.strictEqual(normalizePublishedAt('Oct 25, 2009'), '2009-10-25');

	// 47.3: Anything unreadable is left out
	for (const bad of [undefined, null, '', '   ', 'not a date', 1256453853000, {}]) {
		assert.strictEqual(normalizePublishedAt(bad), undefined, `rejects ${JSON.stringify(bad)}`);
	}

	// 47.4: Each YouTube source (shapes from a real watch page and Data API response)
	assert.strictEqual(publishedAtFromDataApiItem({ snippet: { publishedAt: '2009-10-25T06:57:33Z' } }), '2009-10-24T23:57:33');
	assert.strictEqual(publishedAtFromDataApiItem({ snippet: {} }), undefined);
	assert.strictEqual(publishedAtFromDataApiItem(undefined), undefined);
	assert.strictEqual(
		publishedAtFromPlayerData({ microformat: { playerMicroformatRenderer: { publishDate: '2009-10-24T23:57:33-07:00', uploadDate: '2009-10-01' } } }),
		'2009-10-24T23:57:33'
	);
	assert.strictEqual(publishedAtFromPlayerData({ microformat: { playerMicroformatRenderer: { uploadDate: '2009-10-24' } } }), '2009-10-24');
	assert.strictEqual(publishedAtFromPlayerData({}), undefined);
	assert.strictEqual(publishedAtFromWatchPageHtml('x,"publishDate":"2009-10-24T23:57:33-07:00",y'), '2009-10-24T23:57:33');
	assert.strictEqual(publishedAtFromWatchPageHtml('x,"uploadDate":"2009-10-24T23:57:33-07:00",y'), '2009-10-24T23:57:33');
	assert.strictEqual(publishedAtFromWatchPageHtml('<meta itemprop="datePublished" content="2009-10-24T23:57:33-07:00">'), '2009-10-24T23:57:33');
	assert.strictEqual(publishedAtFromWatchPageHtml('<html></html>'), undefined);

	// 47.5: The metadata fetch prefers a date with a time, so a player-data date without one gives way to the Data API's
	const dataApiVideo = { items: [{ snippet: { publishedAt: '2009-10-25T06:57:33Z' }, statistics: { likeCount: '5' } }] };
	setRequestUrlHandler(async ({ url }) => url.startsWith('https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&')
		? { status: 200, text: JSON.stringify(dataApiVideo) }
		: { status: 404, text: '' });
	const playerDataFor = (publishDate) => ({
		videoDetails: { title: 'T', author: 'A', keywords: ['k'] },
		microformat: { playerMicroformatRenderer: { publishDate, ownerProfileUrl: 'http://www.youtube.com/@a' } },
	});
	const metadataFor = (publishDate, apiKey) => new YouTubeService()
		.extractMetadataFromPlayerData(playerDataFor(publishDate), 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', apiKey);
	assert.strictEqual((await metadataFor('2009-10-24', 'KEY')).publishedAt, '2009-10-24T23:57:33');
	// Player data with a time is used as is; without an API key, a date-only value is kept
	assert.strictEqual((await metadataFor('2009-10-24T22:00:00-07:00', 'KEY')).publishedAt, '2009-10-24T22:00:00');
	assert.strictEqual((await metadataFor('2009-10-24', '')).publishedAt, '2009-10-24');
} finally {
	setRequestUrlHandler(null);
	if (originalTz === undefined) delete process.env.TZ;
	else process.env.TZ = originalTz;
}

console.log('✓ Publish date and time parsing passed');
