import { formatLocalDate, formatLocalDateTime } from './dateTime';
import { deduplicateTags, extractTagsFromText } from './frontmatter';

/**
 * Parsing for video metadata YouTube returns (Data API items, player data, the watch page), kept free of
 * network calls so it can be tested directly. `YouTubeService` fetches; these functions read the results.
 */

/** Keeps the non-empty strings from a list YouTube returned, dropping anything else it may contain. */
function nonEmptyStrings(values: unknown[]): string[] {
	return values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

/**
 * Returns the creator's tags from a YouTube Data API v3 `videos` item (`item.snippet.tags`),
 * or `undefined` when the item has no tag list.
 */
export function tagsFromDataApiItem(item: { snippet?: { tags?: unknown } } | undefined | null): string[] | undefined {
	const tags = item?.snippet?.tags;
	return Array.isArray(tags) ? nonEmptyStrings(tags) : undefined;
}

/**
 * Returns the creator's tags from InnerTube player data (`videoDetails.keywords`), or an empty list.
 */
export function tagsFromPlayerDataKeywords(playerData: { videoDetails?: { keywords?: unknown } } | undefined | null): string[] {
	const keywords = playerData?.videoDetails?.keywords;
	return Array.isArray(keywords) ? nonEmptyStrings(keywords) : [];
}

/**
 * Returns the creator's tags from a video's watch page HTML: the `"keywords"` list embedded in the page's
 * player JSON, or else the `<meta name="keywords">` tag. Used when neither the Data API nor the player data
 * provided tags.
 */
export function tagsFromWatchPageHtml(html: string): string[] {
	const jsonMatch = html.match(/"keywords":\s*(\[[^\]]+\])/);
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[1]);
			if (Array.isArray(parsed)) {
				const tags = nonEmptyStrings(parsed);
				if (tags.length > 0) {
					return tags;
				}
			}
		} catch {
			// Malformed JSON in the page: fall through to the meta tag
		}
	}
	const metaMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]+)"/i);
	if (metaMatch) {
		return metaMatch[1].split(',').map((tag) => tag.trim()).filter(Boolean);
	}
	return [];
}

/**
 * Finds a creator playlist linked in a video description (a `playlist?list=` or `watch?...list=` link) and
 * returns its ID. Mixes (`RD...`), Watch Later (`WL`) and Liked videos (`LL`) aren't creator playlists, so a
 * link to one of those is ignored.
 */
export function findPlaylistIdInDescription(description: string | undefined | null): string | null {
	if (!description) return null;
	const match = description.match(/https?:\/\/(?:www\.)?youtube\.com\/(?:playlist\?list=|watch\?[^\s"')<>]*list=)([a-zA-Z0-9_-]+)/i);
	if (!match) return null;
	const id = match[1];
	return id.startsWith('RD') || id === 'WL' || id === 'LL' ? null : id;
}

/**
 * Turns a publish date YouTube returned into the `published_at` value: a local date and time
 * (`YYYY-MM-DDTHH:mm:ss`) when YouTube gave a time, or a date (`YYYY-MM-DD`) when it gave only a date.
 * YouTube gives times with a UTC offset (`2009-10-24T23:57:33-07:00` in player data and the watch page,
 * `2009-10-25T06:57:33Z` from the Data API); converting to the computer's time zone means the date matches
 * the one YouTube shows the viewer, rather than the date in UTC. Returns `undefined` for anything unreadable.
 */
export function normalizePublishedAt(raw: unknown): string | undefined {
	if (typeof raw !== 'string' || !raw.trim()) return undefined;
	const value = raw.trim();
	// A bare date has no time zone to convert from, so it's kept as written
	const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}$/);
	if (dateOnly) return dateOnly[0];
	const parsed = new Date(value);
	if (isNaN(parsed.getTime())) {
		return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
	}
	return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? formatLocalDateTime(parsed) : formatLocalDate(parsed);
}

/**
 * Returns the publish date from a YouTube Data API v3 `videos` item (`item.snippet.publishedAt`), normalized
 * by {@link normalizePublishedAt}.
 */
export function publishedAtFromDataApiItem(item: { snippet?: { publishedAt?: unknown } } | undefined | null): string | undefined {
	return normalizePublishedAt(item?.snippet?.publishedAt);
}

/**
 * Returns the publish date from InnerTube player data (`microformat.playerMicroformatRenderer.publishDate`,
 * or `uploadDate` when there is none), normalized by {@link normalizePublishedAt}.
 */
export function publishedAtFromPlayerData(
	playerData: { microformat?: { playerMicroformatRenderer?: { publishDate?: unknown; uploadDate?: unknown } } } | undefined | null
): string | undefined {
	const microformat = playerData?.microformat?.playerMicroformatRenderer;
	return normalizePublishedAt(microformat?.publishDate || microformat?.uploadDate);
}

/**
 * Returns the publish date from a video's watch page HTML (the player JSON's `publishDate` or `uploadDate`,
 * or the `datePublished` meta tag), normalized by {@link normalizePublishedAt}.
 */
export function publishedAtFromWatchPageHtml(html: string): string | undefined {
	const match = html.match(/"publishDate":"([^"]+)"/) ||
		html.match(/"uploadDate":"([^"]+)"/) ||
		html.match(/itemprop="datePublished" content="([^"]+)"/);
	return match ? normalizePublishedAt(match[1]) : undefined;
}

/** Inputs to {@link collectVideoTags}. */
export interface CollectVideoTagsOptions {
	title: string;
	description?: string;
	/** The creator's YouTube tags, if fetched */
	youtubeTags?: string[];
	/** Topic tags the AI model suggested, if any */
	topicTags?: string[];
	/** The *Detect tags in video title and description* setting: include creator hashtags */
	detectHashtags: boolean;
	/** The *Extract tags from YouTube Data API* setting: include the creator's YouTube tags */
	includeYouTubeTags: boolean;
}

/**
 * Collects a video summary note's tags from every enabled source (hashtags in the title and description,
 * the creator's YouTube tags, AI topic tags) and deduplicates them the way every tag in the plugin is.
 */
export function collectVideoTags(options: CollectVideoTagsOptions): string[] {
	const hashtags = options.detectHashtags
		? [...extractTagsFromText(options.title), ...extractTagsFromText(options.description || '')]
		: [];
	const youtubeTags = options.includeYouTubeTags && options.youtubeTags ? options.youtubeTags : [];
	return deduplicateTags([...hashtags, ...youtubeTags, ...(options.topicTags || [])]);
}
