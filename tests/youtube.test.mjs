// YouTube parsing: HTML decoding, tags from YouTube metadata, and playlist discovery.
import assert from 'node:assert';
import { loadSource } from './helpers/loadSource.mjs';

const { YouTubeService } = await loadSource('src/services/youtube.ts');
const { buildFrontmatter, deduplicateTags, extractTagsFromText, mergeFrontmatter, sanitizeTag } = await loadSource('src/utils/frontmatter.ts');

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

function extractTagsFromDataApiResponse(jsonText) {
	try {
		const data = JSON.parse(jsonText);
		const tags = data.items?.[0]?.snippet?.tags;
		if (Array.isArray(tags)) {
			return tags.filter((t) => typeof t === 'string' && t.trim().length > 0);
		}
	} catch {
		// ignore
	}
	return [];
}

function extractTagsFromPlayerDataKeywords(playerData) {
	if (Array.isArray(playerData?.videoDetails?.keywords)) {
		return playerData.videoDetails.keywords.filter(
			(k) => typeof k === 'string' && k.trim().length > 0
		);
	}
	return [];
}

function extractTagsFromHtmlFallback(html) {
	const jsonMatch = html.match(/"keywords":\s*(\[[^\]]+\])/);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[1]);
			if (Array.isArray(parsed)) {
				return parsed.filter((k) => typeof k === 'string' && k.trim().length > 0);
			}
		} catch {
			// ignore
		}
	}
	const metaMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]+)"/i);
	if (metaMatch) {
		return metaMatch[1].split(',').map((t) => t.trim()).filter(Boolean);
	}
	return [];
}

function mergeAllVideoTags(transcriptTitle, transcriptDesc, transcriptTags, topicTags, extractYtTags, detectHashtags) {
	const detectedTags = detectHashtags
		? Array.from(new Set([
				...extractTagsFromText(transcriptTitle),
				...extractTagsFromText(transcriptDesc || ''),
		  ]))
		: [];

	const ytDataApiTags = (extractYtTags && transcriptTags)
		? transcriptTags
		: [];

	return Array.from(
		new Set(
			[...detectedTags, ...ytDataApiTags, ...(topicTags || [])]
				.map(sanitizeTag)
				.filter(Boolean)
		)
	);
}

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
const parsedApiTags = extractTagsFromDataApiResponse(mockDataApiResponse);
assert.deepStrictEqual(parsedApiTags, ['Rick Astley', 'Never Gonna Give You Up', '80s Music', 'Rickroll']);

// Case 2: Parsing InnerTube player data keywords
const mockPlayerData = {
	videoDetails: {
		keywords: ['Obsidian', 'Note Taking', 'PKM', 'Productivity Tools']
	}
};
const parsedKeywords = extractTagsFromPlayerDataKeywords(mockPlayerData);
assert.deepStrictEqual(parsedKeywords, ['Obsidian', 'Note Taking', 'PKM', 'Productivity Tools']);

// Case 3: Parsing HTML fallback (JSON or meta tag)
const mockHtmlWithJson = '<html><head><script>var ytInitialPlayerResponse = {"videoDetails":{"keywords":["Markdown","Knowledge Base"]}};</script></head></html>';
assert.deepStrictEqual(extractTagsFromHtmlFallback(mockHtmlWithJson), ['Markdown', 'Knowledge Base']);

const mockHtmlWithMeta = '<html><head><meta name="keywords" content="Zettelkasten, Second Brain, Workflow"></head></html>';
assert.deepStrictEqual(extractTagsFromHtmlFallback(mockHtmlWithMeta), ['Zettelkasten', 'Second Brain', 'Workflow']);

// Case 4: Merging with title/description hashtags and topic tags (on by default)
const sampleTitle = 'Mastering Obsidian in 2026 #Obsidian #Productivity';
const sampleDesc = 'Here are my top tips! Check out #SecondBrain and #PKM.\nSubscribe!';
const sampleYtTags = ['Obsidian App', 'Note Taking', 'Second Brain', 'PKM', 'Knowledge Management'];
const sampleTopics = ['digital-notes', 'productivity'];

const mergedEnabled = mergeAllVideoTags(sampleTitle, sampleDesc, sampleYtTags, sampleTopics, true, true);
// Should contain hashtags from title/desc
assert.strictEqual(mergedEnabled.includes('obsidian'), true);
assert.strictEqual(mergedEnabled.includes('productivity'), true);
assert.strictEqual(mergedEnabled.includes('secondbrain'), true);
assert.strictEqual(mergedEnabled.includes('pkm'), true);
// Should contain YouTube Data API tags sanitized
assert.strictEqual(mergedEnabled.includes('obsidian-app'), true);
assert.strictEqual(mergedEnabled.includes('note-taking'), true);
assert.strictEqual(mergedEnabled.includes('second-brain'), true);
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

// Helper functions mirroring YouTubeService and frontmatter methods
function extractPlaylistFromDescHelper(desc) {
	if (!desc) return null;
	const match = desc.match(/https?:\/\/(?:www\.)?youtube\.com\/(?:playlist\?list=|watch\?[^\s"'\)<>]*list=)([a-zA-Z0-9_-]+)/i);
	if (match) {
		const id = match[1];
		if (!id.startsWith('RD') && id !== 'WL' && id !== 'LL') {
			return id;
		}
	}
	return null;
}

function formatMetaLine(author, channelUrl, videoUrl, playlist, discoverPlaylist = true) {
	let line = `👤 [${author}](${channelUrl})  🔗 [Watch video](${videoUrl})`;
	if (discoverPlaylist && playlist) {
		let pLabel = playlist.title || 'Playlist';
		if (typeof playlist.index === 'number' && typeof playlist.count === 'number') {
			pLabel += ` (${playlist.index}/${playlist.count})`;
		} else if (typeof playlist.index === 'number') {
			pLabel += ` (#${playlist.index})`;
		}
		line += `  📋 [Playlist: ${pLabel}](${playlist.url})`;
	}
	return line;
}

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
assert.strictEqual(extractPlaylistFromDescHelper(descWithPlaylist), 'PLabc1234567890xyz');

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
const formattedLineWithCount = formatMetaLine('DevChannel', 'https://youtube.com/@devchannel', 'https://youtube.com/watch?v=123', playlistObj, true);
assert.strictEqual(
	formattedLineWithCount,
	'👤 [DevChannel](https://youtube.com/@devchannel)  🔗 [Watch video](https://youtube.com/watch?v=123)  📋 [Playlist: Obsidian Plugin Tutorial Series (3/12)](https://www.youtube.com/playlist?list=PLabc1234567890xyz)'
);

// Without count:
const formattedLineWithoutCount = formatMetaLine('DevChannel', 'https://youtube.com/@devchannel', 'https://youtube.com/watch?v=123', { ...playlistObj, count: undefined }, true);
assert.strictEqual(
	formattedLineWithoutCount,
	'👤 [DevChannel](https://youtube.com/@devchannel)  🔗 [Watch video](https://youtube.com/watch?v=123)  📋 [Playlist: Obsidian Plugin Tutorial Series (#3)](https://www.youtube.com/playlist?list=PLabc1234567890xyz)'
);

// When feature is disabled:
const formattedLineDisabled = formatMetaLine('DevChannel', 'https://youtube.com/@devchannel', 'https://youtube.com/watch?v=123', playlistObj, false);
assert.strictEqual(
	formattedLineDisabled,
	'👤 [DevChannel](https://youtube.com/@devchannel)  🔗 [Watch video](https://youtube.com/watch?v=123)'
);

console.log('✓ Creator playlist discovery, frontmatter, and body formatting passed');
