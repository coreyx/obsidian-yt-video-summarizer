import {
	VIDEO_ID_REGEX,
} from 'src/constants';
import {
	PlaylistInfo,
	ThumbnailQuality,
	TranscriptLine,
	TranscriptResponse,
	VideoMetadata,
} from 'src/types';
import { requestUrl } from 'obsidian';

/**
 * Service class for interacting with YouTube videos.
 * Provides methods to fetch video thumbnails and transcripts.
 * Uses the same approach as youtube-transcript-api (Python library).
 */
export class YouTubeService {
	/**
	 * YouTube's public InnerTube API key.
	 *
	 * IMPORTANT:
	 * - This is a *public* key used by YouTube's own web/Android clients and by
	 *   tools such as `youtube-transcript-api`. It is *not* tied to this
	 *   project’s Google Cloud account and does not grant any additional
	 *   privileges beyond what an anonymous YouTube client can do.
	 * - Because this key is public and broadly distributed, it is expected to
	 *   appear in source code and does **not** need to be treated as a secret,
	 *   managed via environment variables, or rotated by this project.
	 *
	 * Rate limiting / usage:
	 * - Requests made with this key are subject to YouTube's own internal
	 *   throttling and abuse detection for anonymous clients. Very high
	 *   volumes of requests may be rate limited or temporarily blocked by
	 *   YouTube, outside the control of this plugin.
	 * - If YouTube invalidates or changes this key in the future (e.g. 400/403
	 *   responses that cannot be explained otherwise), the value here may need
	 *   to be updated to a current public InnerTube key (for example by
	 *   inspecting network traffic from the YouTube web/Android client or by
	 *   checking updates in `youtube-transcript-api`).
	 */
	private static readonly INNERTUBE_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
	private static readonly INNERTUBE_PLAYER_URL = `https://www.youtube.com/youtubei/v1/player?key=${YouTubeService.INNERTUBE_API_KEY}`;

	/**
	 * Default InnerTube client configuration.
	 *
	 * These values were last verified against YouTube's API on 2026-01-12.
	 *
	 * If requests start failing with 400/403 errors or unexpected behavior,
	 * try updating to a newer Android client version / SDK level that the
	 * official YouTube Android app currently uses, then:
	 *  - Update DEFAULT_CLIENT_VERSION / DEFAULT_ANDROID_SDK_VERSION below, or
	 *  - Call YouTubeService.configureClient(...) from your plugin settings.
	 */
	private static readonly DEFAULT_CLIENT_VERSION = "20.10.38";
	private static readonly DEFAULT_ANDROID_SDK_VERSION = 34;

	// Mutable copies that can be overridden at runtime if needed.
	private static clientVersion: string = YouTubeService.DEFAULT_CLIENT_VERSION;
	private static androidSdkVersion: number = YouTubeService.DEFAULT_ANDROID_SDK_VERSION;

	/**
	 * Configure the InnerTube client version and Android SDK version used for
	 * YouTube API requests. This allows updating these values without changing
	 * the source code if YouTube deprecates the pinned defaults.
	 */
	public static configureClient(options: {
		clientVersion?: string;
		androidSdkVersion?: number;
	}): void {
		if (typeof options.clientVersion === "string" && options.clientVersion.trim().length > 0) {
			YouTubeService.clientVersion = options.clientVersion.trim();
		}
		if (typeof options.androidSdkVersion === "number" && Number.isInteger(options.androidSdkVersion)) {
			YouTubeService.androidSdkVersion = options.androidSdkVersion;
		}
	}

	// Use ANDROID client like youtube-transcript-api does - it's less restricted
	private static get INNERTUBE_CONTEXT() {
		return {
			client: {
				clientName: "ANDROID",
				clientVersion: YouTubeService.clientVersion,
				androidSdkVersion: YouTubeService.androidSdkVersion,
				hl: "en",
				gl: "US",
			},
		};
	}

	/**
	 * Converts Android SDK API level to Android release string for User-Agent.
	 * InnerTube client context uses SDK level, while User-Agent expects release.
	 */
	private static androidReleaseFromSdk(sdk: number): string {
		switch (sdk) {
		case 30:
			return "11";
		case 31:
		case 32:
			return "12";
		case 33:
			return "13";
		case 34:
			return "14";
		case 35:
			return "15";
		default:
			return String(sdk);
		}
	}
	/**
	 * Gets the thumbnail URL for a YouTube video
	 * @param videoId - The YouTube video identifier
	 * @param quality - Desired thumbnail quality (default: 'maxres')
	 * @returns URL string for the video thumbnail
	 */
	static getThumbnailUrl(
		videoId: string,
		quality: keyof ThumbnailQuality = 'maxres'
	): string {
		const qualities: ThumbnailQuality = {
			default: `https://img.youtube.com/vi/${videoId}/default.jpg`,
			medium: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
			high: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
			standard: `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
			maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
		};
		return qualities[quality];
	}

	/**
	 * Checks if a URL is a valid YouTube URL
	 * @param url - The URL to check
	 * @returns True if the URL is a YouTube URL, false otherwise
	 */
	static isYouTubeUrl(url: string): boolean {
		return (
			url.startsWith('https://www.youtube.com/') ||
			url.startsWith('https://youtu.be/')
		);
	}

	/**
	 * Fetches video metadata (title, author, channel URL, handle, description, tags)
	 * without downloading or parsing transcript captions.
	 *
	 * @param url - Full YouTube video URL
	 * @param youtubeApiKey - Optional Google Cloud YouTube Data API v3 key
	 * @returns Promise containing video metadata
	 */
	async fetchVideoMetadata(url: string, youtubeApiKey?: string): Promise<VideoMetadata> {
		const videoId = this.extractMatch(url, VIDEO_ID_REGEX);
		if (!videoId) throw new Error('Invalid YouTube URL');

		const playerData = await this.fetchPlayerData(videoId);
		return await this.extractMetadataFromPlayerData(playerData, videoId, url, youtubeApiKey);
	}

	/**
	 * Fetches video metadata (tags, published date, views, likes) using the official YouTube Data API v3 if an API key is provided.
	 */
	static async fetchYouTubeDataApiVideoData(videoId: string, apiKey: string): Promise<{
		tags?: string[];
		publishedAt?: string;
		viewCount?: number;
		likeCount?: number;
	}> {
		if (!apiKey || !apiKey.trim()) return {};
		try {
			const response = await requestUrl({
				url: `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${apiKey.trim()}`,
				method: 'GET',
				headers: {
					'Accept': 'application/json',
				},
			});
			if (response.status === 200) {
				const data = JSON.parse(response.text);
				const item = data.items?.[0];
				const tags = Array.isArray(item?.snippet?.tags)
					? item.snippet.tags.filter((t: any) => typeof t === 'string' && t.trim().length > 0)
					: undefined;
				const rawDate = item?.snippet?.publishedAt;
				let publishedAt: string | undefined;
				if (rawDate) {
					try {
						publishedAt = new Date(rawDate).toISOString().split('T')[0];
					} catch {
						const m = String(rawDate).match(/^\d{4}-\d{2}-\d{2}/);
						if (m) publishedAt = m[0];
					}
				}
				const viewCount = item?.statistics?.viewCount ? parseInt(item.statistics.viewCount, 10) : undefined;
				const likeCount = item?.statistics?.likeCount ? parseInt(item.statistics.likeCount, 10) : undefined;
				return { tags, publishedAt, viewCount, likeCount };
			}
		} catch (error) {
			console.warn('YouTube Data API video data request failed:', error);
		}
		return {};
	}

	/**
	 * Fetches video tags using the official YouTube Data API v3 if an API key is provided.
	 */
	static async fetchYouTubeDataApiTags(videoId: string, apiKey: string): Promise<string[]> {
		const data = await YouTubeService.fetchYouTubeDataApiVideoData(videoId, apiKey);
		return data.tags || [];
	}

	/**
	 * Extracts playlist ID from a YouTube URL if present and not a system/radio mix.
	 */
	static extractPlaylistId(url: string): string | null {
		if (!url) return null;
		try {
			const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
			if (match) {
				const id = match[1];
				if (id.startsWith('RD') || id === 'WL' || id === 'LL') {
					return null;
				}
				return id;
			}
		} catch {
			// ignore
		}
		return null;
	}

	/**
	 * Extracts playlist index from a YouTube URL if present.
	 */
	static extractPlaylistIndex(url: string): number | undefined {
		if (!url) return undefined;
		const match = url.match(/[?&]index=(\d+)/);
		if (match) {
			const idx = parseInt(match[1], 10);
			if (!isNaN(idx) && idx > 0) return idx;
		}
		return undefined;
	}

	/**
	/**
	 * Scrapes playlist details directly from YouTube's playlist web page without requiring an API key.
	 */
	static async fetchPlaylistDetailsFromWeb(playlistId: string): Promise<{
		title?: string;
		itemCount?: number;
		channelId?: string;
	}> {
		if (!playlistId) return {};
		const cleanPlaylistId = playlistId.trim();
		try {
			const playlistUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(cleanPlaylistId)}`;
			const response = await requestUrl({
				url: playlistUrl,
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
					'Accept-Language': 'en-US,en;q=0.9',
				},
			});

			if (response.status !== 200) {
				return {};
			}

			const html = response.text;
			let title: string | undefined;

			// 1. Try og:title / title meta tags
			const ogMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
			                html.match(/<meta\s+name="title"\s+content="([^"]+)"/i);
			if (ogMatch && ogMatch[1].trim()) {
				const candidate = ogMatch[1].trim();
				if (candidate !== 'undefined' && candidate.toLowerCase() !== 'youtube') {
					title = candidate;
				}
			}

			// 2. Try playlistMetadataRenderer JSON in page script
			if (!title) {
				const jsonMatch = html.match(/"playlistMetadataRenderer":\{"title":"([^"]+)"/);
				if (jsonMatch && jsonMatch[1].trim()) {
					const candidate = jsonMatch[1].trim();
					if (candidate !== 'undefined' && candidate.toLowerCase() !== 'youtube') {
						title = candidate;
					}
				}
			}

			// 3. Try playlistHeaderRenderer JSON
			if (!title) {
				const headerMatch = html.match(/"playlistHeaderRenderer":\{.*?"title":\{.*?"text":"([^"]+)"/);
				if (headerMatch && headerMatch[1].trim()) {
					const candidate = headerMatch[1].trim();
					if (candidate !== 'undefined' && candidate.toLowerCase() !== 'youtube') {
						title = candidate;
					}
				}
			}

			// 4. Try <title> tag (e.g. "Title - YouTube")
			if (!title) {
				const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
				if (titleTagMatch) {
					const candidate = titleTagMatch[1].replace(/\s*-\s*YouTube$/i, '').trim();
					if (candidate && candidate !== 'undefined' && candidate.toLowerCase() !== 'youtube') {
						title = candidate;
					}
				}
			}

			// Extract item count if available
			let itemCount: number | undefined;
			const totalVideosMatch = html.match(/"totalVideos":([0-9]+)/) ||
			                         html.match(/"videoCount":"([0-9]+)"/);
			if (totalVideosMatch) {
				itemCount = parseInt(totalVideosMatch[1], 10);
			} else {
				const textCountMatch = html.match(/([0-9,]+)\s+videos/i);
				if (textCountMatch) {
					itemCount = parseInt(textCountMatch[1].replace(/,/g, ''), 10);
				}
			}

			// Extract channel ID if available
			let channelId: string | undefined;
			const channelMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
			if (channelMatch) {
				channelId = channelMatch[1];
			}

			return {
				title: title ? YouTubeService.decodeHTML(title) : undefined,
				itemCount: !isNaN(itemCount as number) ? itemCount : undefined,
				channelId,
			};
		} catch (error) {
			console.warn(`Web fallback failed for playlist ${cleanPlaylistId}:`, error);
			return {};
		}
	}

	/**
	 * Fetches playlist details using the YouTube Data API v3 if an API key is available,
	 * with automatic fallback to YouTube web scraping if no API key is provided, if the API call
	 * fails, or if the API returns no items.
	 */
	static async fetchPlaylistDetails(playlistId: string, apiKey?: string): Promise<{
		title?: string;
		itemCount?: number;
		channelId?: string;
	}> {
		if (!playlistId) return {};
		const cleanPlaylistId = playlistId.trim();

		// Priority 1: YouTube Data API v3 (if apiKey is configured)
		if (apiKey && apiKey.trim()) {
			try {
				const response = await requestUrl({
					url: `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${encodeURIComponent(cleanPlaylistId)}&key=${encodeURIComponent(apiKey.trim())}`,
					method: 'GET',
					headers: {
						'Accept': 'application/json',
					},
				});
				if (response.status === 200) {
					const data = JSON.parse(response.text);
					const item = data.items?.[0];
					if (item && item.snippet?.title) {
						const decodedTitle = YouTubeService.decodeHTML(item.snippet.title).trim();
						if (decodedTitle && decodedTitle.toLowerCase() !== 'playlist') {
							return {
								title: decodedTitle,
								itemCount: item.contentDetails?.itemCount !== undefined ? parseInt(item.contentDetails.itemCount, 10) : undefined,
								channelId: item.snippet?.channelId,
							};
						}
					}
				}
			} catch (error) {
				console.warn(`YouTube Data API playlists request failed for ${cleanPlaylistId}:`, error);
			}
		}

		// Priority 2: Web Scraping Fallback
		return await YouTubeService.fetchPlaylistDetailsFromWeb(cleanPlaylistId);
	}

	/**
	 * Checks if a video belongs to a playlist and gets its 1-based position using YouTube Data API.
	 */
	static async fetchVideoPositionInPlaylist(playlistId: string, videoId: string, apiKey: string): Promise<number | undefined> {
		if (!apiKey || !apiKey.trim() || !playlistId || !videoId) return undefined;
		try {
			const response = await requestUrl({
				url: `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${encodeURIComponent(playlistId.trim())}&videoId=${encodeURIComponent(videoId.trim())}&maxResults=1&key=${encodeURIComponent(apiKey.trim())}`,
				method: 'GET',
				headers: {
					'Accept': 'application/json',
				},
			});
			if (response.status === 200) {
				const data = JSON.parse(response.text);
				const item = data.items?.[0];
				if (item && item.snippet?.position !== undefined) {
					return item.snippet.position + 1; // 0-based to 1-based
				}
			}
		} catch (error) {
			console.warn(`YouTube Data API playlistItems request failed for playlist ${playlistId}, video ${videoId}:`, error);
		}
		return undefined;
	}

	/**
	 * Discovers if the video belongs to a creator playlist using:
	 * 1. URL parameters (&list=...)
	 * 2. Links in video description
	 * 3. YouTube Data API queries for the channel's playlists
	 */
	static async discoverPlaylist(options: {
		url: string;
		videoId: string;
		channelId?: string;
		description?: string;
		youtubeApiKey?: string;
	}): Promise<PlaylistInfo | undefined> {
		const apiKey = options.youtubeApiKey?.trim();

		// Strategy 1: Check if input URL includes playlist ID
		const urlPlaylistId = YouTubeService.extractPlaylistId(options.url);
		const urlIndex = YouTubeService.extractPlaylistIndex(options.url);

		if (urlPlaylistId) {
			const details = await YouTubeService.fetchPlaylistDetails(urlPlaylistId, apiKey);
			let position = urlIndex;

			if (position === undefined && apiKey) {
				position = await YouTubeService.fetchVideoPositionInPlaylist(urlPlaylistId, options.videoId, apiKey);
			}

			const title = details.title && details.title.trim().toLowerCase() !== 'playlist'
				? details.title.trim()
				: undefined;

			return {
				id: urlPlaylistId,
				title,
				url: `https://www.youtube.com/playlist?list=${urlPlaylistId}`,
				index: position,
				count: details.itemCount,
			};
		}

		// Strategy 2: Check for playlist links in the video description
		if (options.description) {
			const descMatch = options.description.match(/https?:\/\/(?:www\.)?youtube\.com\/(?:playlist\?list=|watch\?[^\s"'\)<>]*list=)([a-zA-Z0-9_-]+)/i);
			if (descMatch) {
				const descPlaylistId = descMatch[1];
				if (!descPlaylistId.startsWith('RD') && descPlaylistId !== 'WL' && descPlaylistId !== 'LL') {
					const details = await YouTubeService.fetchPlaylistDetails(descPlaylistId, apiKey);
					let position: number | undefined;

					if (apiKey) {
						position = await YouTubeService.fetchVideoPositionInPlaylist(descPlaylistId, options.videoId, apiKey);
					}

					const title = details.title && details.title.trim().toLowerCase() !== 'playlist'
						? details.title.trim()
						: undefined;

					return {
						id: descPlaylistId,
						title,
						url: `https://www.youtube.com/playlist?list=${descPlaylistId}`,
						index: position,
						count: details.itemCount,
					};
				}
			}
		}

		// Strategy 3: Query channel's playlists via YouTube Data API
		if (apiKey && options.channelId) {
			try {
				const response = await requestUrl({
					url: `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${encodeURIComponent(options.channelId)}&maxResults=25&key=${encodeURIComponent(apiKey)}`,
					method: 'GET',
					headers: {
						'Accept': 'application/json',
					},
				});

				if (response.status === 200) {
					const data = JSON.parse(response.text);
					const items: any[] = data.items || [];

					// Check candidate playlists for video membership
					for (const item of items.slice(0, 10)) {
						const pos = await YouTubeService.fetchVideoPositionInPlaylist(item.id, options.videoId, apiKey);
						if (typeof pos === 'number') {
							let rawTitle = item.snippet?.title ? YouTubeService.decodeHTML(item.snippet.title).trim() : undefined;
							if (!rawTitle || rawTitle.toLowerCase() === 'playlist') {
								const fallbackDetails = await YouTubeService.fetchPlaylistDetails(item.id, apiKey);
								rawTitle = fallbackDetails.title;
							}
							const title = rawTitle && rawTitle.toLowerCase() !== 'playlist' ? rawTitle : undefined;

							return {
								id: item.id,
								title,
								url: `https://www.youtube.com/playlist?list=${item.id}`,
								index: pos,
								count: item.contentDetails?.itemCount !== undefined ? parseInt(item.contentDetails.itemCount, 10) : undefined,
							};
						}
					}
				}
			} catch (error) {
				console.warn('YouTube Data API channel playlists lookup failed:', error);
			}
		}

		return undefined;
	}

	/**
	 * Extracts and normalizes metadata from YouTube player data.
	 */
	private async extractMetadataFromPlayerData(
		playerData: any,
		videoId: string,
		url: string,
		youtubeApiKey?: string
	): Promise<VideoMetadata> {
		const title = playerData.videoDetails?.title || 'Unknown';
		const author = playerData.videoDetails?.author || 'Unknown';
		const channelId = playerData.videoDetails?.channelId || '';
		const description = playerData.videoDetails?.shortDescription || '';

		let channelUsername = '';
		let channelUrl = channelId ? `https://www.youtube.com/channel/${channelId}` : '';

		const ownerProfileUrl = playerData.microformat?.playerMicroformatRenderer?.ownerProfileUrl;
		if (ownerProfileUrl) {
			const handleMatch = ownerProfileUrl.match(/@([^/\s"']+)/);
			if (handleMatch) {
				channelUsername = `@${handleMatch[1]}`;
				channelUrl = `https://www.youtube.com/@${handleMatch[1]}`;
			}
		}

		let duration = playerData.videoDetails?.lengthSeconds
			? parseInt(playerData.videoDetails.lengthSeconds, 10)
			: undefined;
		let viewCount = playerData.videoDetails?.viewCount
			? parseInt(playerData.videoDetails.viewCount, 10)
			: undefined;

		let publishedAt: string | undefined;
		const rawDate = playerData.microformat?.playerMicroformatRenderer?.publishDate ||
		                playerData.microformat?.playerMicroformatRenderer?.uploadDate;
		if (rawDate) {
			try {
				publishedAt = new Date(rawDate).toISOString().split('T')[0];
			} catch {
				const m = String(rawDate).match(/^\d{4}-\d{2}-\d{2}/);
				if (m) publishedAt = m[0];
			}
		}

		let likeCount: number | undefined;

		let tags: string[] = [];
		if (Array.isArray(playerData.videoDetails?.keywords)) {
			tags = playerData.videoDetails.keywords.filter(
				(k: any) => typeof k === 'string' && k.trim().length > 0
			);
		}

		if (youtubeApiKey && youtubeApiKey.trim().length > 0) {
			try {
				const apiData = await YouTubeService.fetchYouTubeDataApiVideoData(videoId, youtubeApiKey.trim());
				if (apiData.tags && apiData.tags.length > 0) {
					tags = apiData.tags;
				}
				if (apiData.publishedAt && !publishedAt) {
					publishedAt = apiData.publishedAt;
				}
				if (typeof apiData.viewCount === 'number' && !viewCount) {
					viewCount = apiData.viewCount;
				}
				if (typeof apiData.likeCount === 'number' && !likeCount) {
					likeCount = apiData.likeCount;
				}
			} catch (e) {
				console.warn('Could not fetch data via YouTube Data API:', e);
			}
		}

		if (!channelUsername || tags.length === 0 || !publishedAt || !likeCount) {
			try {
				const pageResponse = await requestUrl({
					url: `https://www.youtube.com/watch?v=${videoId}`,
					headers: {
						"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
						"Accept-Language": "en-US,en;q=0.9",
					}
				});
				if (pageResponse.status === 200) {
					const html = pageResponse.text;
					if (!channelUsername) {
						const match = html.match(/"canonicalBaseUrl":"\/(@[^"\/]+)"/) ||
						              html.match(/"ownerProfileUrl":"https?:\/\/(?:www\.)?youtube\.com\/(@[^"\/]+)"/);
						if (match) {
							channelUsername = match[1];
							channelUrl = `https://www.youtube.com/${match[1]}`;
						}
					}

					if (tags.length === 0) {
						const jsonMatch = html.match(/"keywords":\s*(\[[^\]]+\])/);
						if (jsonMatch) {
							try {
								const parsed = JSON.parse(jsonMatch[1]);
								if (Array.isArray(parsed)) {
									tags = parsed.filter((k: any) => typeof k === 'string' && k.trim().length > 0);
								}
							} catch {
								// ignore json parse error
							}
						}
						if (tags.length === 0) {
							const metaMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]+)"/i);
							if (metaMatch) {
								tags = metaMatch[1]
									.split(',')
									.map((t) => t.trim())
									.filter(Boolean);
							}
						}
					}

					if (!publishedAt) {
						const dateMatch = html.match(/"publishDate":"([^"]+)"/) ||
						                  html.match(/"uploadDate":"([^"]+)"/) ||
						                  html.match(/itemprop="datePublished" content="([^"]+)"/);
						if (dateMatch) {
							try {
								publishedAt = new Date(dateMatch[1]).toISOString().split('T')[0];
							} catch {
								const m = dateMatch[1].match(/^\d{4}-\d{2}-\d{2}/);
								if (m) publishedAt = m[0];
							}
						}
					}

					if (likeCount === undefined) {
						const likeMatch = html.match(/"likeCount":"([^"]+)"/) ||
						                  html.match(/accessibilityData":\{"label":"([0-9,]+)\s+likes"/i);
						if (likeMatch) {
							likeCount = parseInt(likeMatch[1].replace(/,/g, ''), 10);
						}
					}

					if (viewCount === undefined) {
						const viewMatch = html.match(/"viewCount":"([^"]+)"/);
						if (viewMatch) {
							viewCount = parseInt(viewMatch[1], 10);
						}
					}
				}
			} catch (e) {
				console.warn('Could not fetch channel handle or metadata from watch page:', e);
			}
		}

		let playlist: PlaylistInfo | undefined;
		try {
			playlist = await YouTubeService.discoverPlaylist({
				url,
				videoId,
				channelId,
				description,
				youtubeApiKey,
			});
		} catch (e) {
			console.warn('Could not discover playlist:', e);
		}

		return {
			url: `https://www.youtube.com/watch?v=${videoId}`,
			videoId,
			channelId: channelId || undefined,
			title: YouTubeService.decodeHTML(title),
			author: YouTubeService.decodeHTML(author),
			channelUrl,
			channelUsername: channelUsername || undefined,
			description: YouTubeService.decodeHTML(description, true),
			tags: tags.length > 0 ? tags : undefined,
			duration,
			publishedAt,
			viewCount,
			likeCount,
			playlist,
		};
	}

	/**
	 * Fetches and processes a YouTube video transcript using the player API approach
	 * This mimics how youtube-transcript-api (Python) works:
	 * 1. Fetch player data with ANDROID client to get caption tracks
	 * 2. Fetch transcript directly from caption track baseUrl
	 * 
	 * @param url - Full YouTube video URL
	 * @param langCode - Language code for caption track (default: 'en')
	 * @param youtubeApiKey - Optional Google Cloud YouTube Data API v3 key
	 * @returns Promise containing video metadata and transcript
	 * @throws Error if transcript cannot be fetched or processed
	 */
	async fetchTranscript(
		url: string,
		langCode = 'en',
		youtubeApiKey?: string
	): Promise<TranscriptResponse> {
		try {
			// Extract video ID from URL
			const videoId = this.extractMatch(url, VIDEO_ID_REGEX);
			if (!videoId) throw new Error('Invalid YouTube URL');

			console.log(`Fetching transcript for video: ${videoId}`);

			// Step 1: Fetch player data and video metadata
			const playerData = await this.fetchPlayerData(videoId);
			const metadata = await this.extractMetadataFromPlayerData(playerData, videoId, url, youtubeApiKey);

			// Step 2: Get caption tracks
			const captionsData = playerData.captions?.playerCaptionsTracklistRenderer;
			if (!captionsData || !captionsData.captionTracks) {
				throw new Error('No captions available for this video');
			}

			// Step 3: Find the best matching caption track
			const captionTrack = this.findCaptionTrack(captionsData.captionTracks, langCode);
			if (!captionTrack) {
				const availableLangs = captionsData.captionTracks.map((t: any) => t.languageCode).join(', ');
				throw new Error(`No transcript found for language '${langCode}'. Available: ${availableLangs}`);
			}

			console.log(`Found caption track: ${captionTrack.name?.runs?.[0]?.text || captionTrack.languageCode}`);

			// Step 4: Fetch the actual transcript from the caption URL
			const transcriptUrl = captionTrack.baseUrl;
			const lines = await this.fetchTranscriptFromUrl(transcriptUrl);

			return {
				...metadata,
				lines,
			};
		} catch (error: any) {
			throw new Error(`Failed to fetch transcript: ${error.message}`);
		}
	}

	/**
	 * Fetches player data from YouTube's InnerTube API
	 */
	private async fetchPlayerData(videoId: string): Promise<any> {
		const requestBody = {
			context: YouTubeService.INNERTUBE_CONTEXT,
			videoId: videoId,
		};

		const response = await requestUrl({
			url: YouTubeService.INNERTUBE_PLAYER_URL,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent": `com.google.android.youtube/${YouTubeService.clientVersion} (Linux; U; Android ${YouTubeService.androidReleaseFromSdk(YouTubeService.androidSdkVersion)}) gzip`,
			},
			body: JSON.stringify(requestBody),
		});

		if (response.status < 200 || response.status >= 300) {
			if (response.status === 400 || response.status === 403) {
				throw new Error(
					`YouTube API rejected the transcript request (status ${response.status}). Please try again later or update the InnerTube client version.`,
				);
			}
			throw new Error(`YouTube API request failed with status ${response.status}`);
		}

		let data: any;
		try {
			data = JSON.parse(response.text);
		} catch (error) {
			throw new Error(
				`Failed to parse YouTube player data JSON: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}

		// Check playability status
		const playabilityStatus = data.playabilityStatus;
		if (playabilityStatus) {
			if (playabilityStatus.status === 'ERROR') {
				throw new Error(playabilityStatus.reason || 'Video unavailable');
			}
			if (playabilityStatus.status === 'LOGIN_REQUIRED') {
				throw new Error('This video requires login to view');
			}
			if (playabilityStatus.status === 'UNPLAYABLE') {
				throw new Error(playabilityStatus.reason || 'Video is unplayable');
			}
		}

		return data;
	}

	/**
	 * Finds the best matching caption track for the requested language
	 */
	private findCaptionTrack(captionTracks: any[], langCode: string): any {
		// First try exact match
		let track = captionTracks.find((t: any) => t.languageCode === langCode);
		if (track) return track;

		// Try matching language prefix (e.g., 'en' matches 'en-US')
		track = captionTracks.find((t: any) => t.languageCode.startsWith(langCode + '-'));
		if (track) return track;

		// Try finding track where requested lang is a prefix (e.g., 'en-US' when looking for 'en')
		track = captionTracks.find((t: any) => langCode.startsWith(t.languageCode + '-'));
		if (track) return track;

		// Fall back to first available track
		if (captionTracks.length > 0) {
			console.log(`Language '${langCode}' not found, falling back to '${captionTracks[0].languageCode}'`);
			return captionTracks[0];
		}

		return null;
	}

	/**
	 * Fetches transcript XML from the caption track URL
	 */
	private async fetchTranscriptFromUrl(transcriptUrl: string): Promise<TranscriptLine[]> {
		const response = await requestUrl({
			url: transcriptUrl,
			method: "GET",
			headers: {
				"Accept-Language": "en-US,en;q=0.9",
			},
		});

		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Transcript download failed with status ${response.status}`);
		}

		return this.parseTranscriptXml(response.text);
	}

	/**
	 * Parses the transcript XML response into structured format
	 */
	private parseTranscriptXml(xmlContent: string): TranscriptLine[] {
		const lines: TranscriptLine[] = [];

		// Parse XML manually (Obsidian doesn't have DOMParser in all contexts)
		// YouTube uses two different formats:
		// Format 1: <text start="0.0" dur="1.54">Hey there</text>
		// Format 2: <p t="1360" d="1680">Text here</p>
		
		// Try format 2 first (newer format with <p> tags, times in milliseconds)
		// Match entire <p> tag without assuming attribute order
		const pTagRegex = /<p\s+([^>]+)>([\s\S]*?)<\/p>/g;
		let match;
		
		while ((match = pTagRegex.exec(xmlContent)) !== null) {
			const attributes = match[1];
			const content = match[2];
			
			// Extract t and d attributes independently
			const tMatch = attributes.match(/\bt="(\d+)"/);
			const dMatch = attributes.match(/\bd="(\d+)"/);
			
			if (tMatch && dMatch) {
				const start = parseInt(tMatch[1]); // Already in milliseconds
				const duration = parseInt(dMatch[1]);
				const text = YouTubeService.decodeHTML(content.replace(/<[^>]+>/g, ' ')); // Strip any inner tags

				if (text.trim()) {
					lines.push({
						text: text.trim(),
						offset: start,
						duration,
					});
				}
			}
		}

		// If no matches with <p> format, try <text> format (times in seconds)
		if (lines.length === 0) {
			// Match entire <text> tag without assuming attribute order
			const textRegex = /<text\s+([^>]+)>([\s\S]*?)<\/text>/g;
			
			while ((match = textRegex.exec(xmlContent)) !== null) {
				const attributes = match[1];
				const content = match[2];
				
				// Extract start and dur attributes independently
				const startMatch = attributes.match(/\bstart="([^"]+)"/);
				const durMatch = attributes.match(/\bdur="([^"]+)"/);
				
				if (startMatch && durMatch) {
					const start = parseFloat(startMatch[1]) * 1000; // Convert to milliseconds
					const duration = parseFloat(durMatch[1]) * 1000;
					const text = YouTubeService.decodeHTML(content.replace(/<[^>]+>/g, ' '));

					if (text.trim()) {
						lines.push({
							text: text.trim(),
							offset: start,
							duration,
						});
					}
				}
			}
		}

		if (lines.length === 0) {
			throw new Error('Failed to parse transcript XML - no caption segments found');
		}

		return lines;
	}

	/**
	 * Extracts the first match of a regex pattern from a string
	 * @param text - The text to search within
	 * @param regex - The regex pattern to match
	 * @returns The first match or null if not found
	 */
	private extractMatch(text: string, regex: RegExp): string | null {
		const match = text.match(regex);
		return match ? match[1] : null;
	}

	/**
	 * Fetches the thumbnail image buffer for a YouTube video.
	 * Tries maxresdefault first, falling back to hqdefault and mqdefault.
	 *
	 * @param videoId - YouTube video ID
	 * @returns ArrayBuffer containing the image data, or null if fetch fails
	 */
	static async fetchThumbnailBuffer(videoId: string): Promise<ArrayBuffer | null> {
		const urls = [
			YouTubeService.getThumbnailUrl(videoId, 'maxres'),
			YouTubeService.getThumbnailUrl(videoId, 'high'),
			YouTubeService.getThumbnailUrl(videoId, 'medium'),
		];

		for (const url of urls) {
			try {
				const response = await requestUrl({
					url,
					method: 'GET',
				});
				if (response.status === 200 && response.arrayBuffer && response.arrayBuffer.byteLength > 1500) {
					return response.arrayBuffer;
				}
			} catch (e) {
				// Continue to next resolution fallback
			}
		}
		return null;
	}

	/**
	 * Decodes HTML entities in a text string
	 *
	 * @param text - Text string with HTML entities
	 * @param preserveNewlines - If true, preserves line breaks instead of collapsing them
	 * @returns Decoded text string
	 */
	public static decodeHTML(text: string, preserveNewlines = false): string {
		const decoded = text
			.replace(/&#39;/g, "'")
			.replace(/&amp;/g, '&')
			.replace(/&quot;/g, '"')
			.replace(/&apos;/g, "'")
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));

		if (preserveNewlines) {
			return decoded
				.replace(/\\n/g, '\n')
				.replace(/\r\n/g, '\n')
				.replace(/\r/g, '\n')
				.trim();
		}

		return decoded
			.replace(/\\n/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}
}
