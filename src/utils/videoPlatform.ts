/**
 * Where a video note's video is hosted: the `host` and `platform` frontmatter properties, and telling YouTube
 * videos apart from other sites' videos. Summary notes from other tools can share the summary folder, so the
 * plugin checks a note's platform before treating its `video_url` as a YouTube video.
 */

/**
 * The domains YouTube serves videos from. A subdomain of any of them (`m.youtube.com`, `music.youtube.com`)
 * is YouTube too.
 */
export const YOUTUBE_HOSTS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com'];

/**
 * The `host` property for a video URL: its hostname, lowercased, without the port or a leading `www.`.
 * Other subdomains are kept (`m.youtube.com` stays as it is), since `platform` is what groups a site's hosts.
 * Returns `null` for anything that isn't an `http` or `https` URL.
 */
export function videoHost(url: string): string | null {
	let parsed: URL;
	try {
		parsed = new URL(url.trim());
	} catch {
		return null;
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return null;
	}
	// `hostname` has no port, unlike `host`, and the URL parser has already lowercased it
	const hostname = parsed.hostname.replace(/^www\./, '');
	return hostname || null;
}

/**
 * The `platform` property for a host: `youtube` for any YouTube host, or `null` for other sites, which the
 * plugin never writes notes for.
 */
export function videoPlatform(host: string | null): string | null {
	if (!host) {
		return null;
	}
	const isYouTube = YOUTUBE_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
	return isYouTube ? 'youtube' : null;
}

/**
 * Whether a URL is on one of YouTube's hosts.
 */
export function isYouTubeVideoUrl(url: string): boolean {
	return videoPlatform(videoHost(url)) === 'youtube';
}
