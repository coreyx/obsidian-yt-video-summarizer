import { App } from 'obsidian';

/** Community plugin ID of the Media Extended plugin (https://github.com/aidenlx/media-extended) */
export const MEDIA_EXTENDED_PLUGIN_ID = 'media-extended';

export type MediaExtendedPluginStatus = 'enabled' | 'disabled' | 'not-installed' | 'unknown';

/** The parts of Obsidian's (non-public) community plugin registry used for detection */
interface CommunityPluginRegistry {
	manifests?: Record<string, unknown>;
	enabledPlugins?: Set<string>;
	plugins?: Record<string, unknown>;
}

/**
 * Resolves the Media Extended plugin status from Obsidian's community plugin registry.
 * Returns 'unknown' when the registry isn't available, so callers never block on it.
 */
export function resolveMediaExtendedPluginStatus(registry: CommunityPluginRegistry | undefined | null): MediaExtendedPluginStatus {
	if (!registry || (!registry.manifests && !registry.enabledPlugins && !registry.plugins)) {
		return 'unknown';
	}
	if (registry.plugins?.[MEDIA_EXTENDED_PLUGIN_ID] || registry.enabledPlugins?.has(MEDIA_EXTENDED_PLUGIN_ID)) {
		return 'enabled';
	}
	if (registry.manifests?.[MEDIA_EXTENDED_PLUGIN_ID]) {
		return 'disabled';
	}
	return 'not-installed';
}

/**
 * Detects whether the Media Extended plugin is installed and enabled. This plugin never calls
 * Media Extended; its notes are plain markdown, so detection is only used to guide the user.
 */
export function getMediaExtendedPluginStatus(app: App): MediaExtendedPluginStatus {
	return resolveMediaExtendedPluginStatus((app as unknown as { plugins?: CommunityPluginRegistry }).plugins);
}

/**
 * Opens the Media Extended page in Obsidian's community plugin browser.
 */
export function openMediaExtendedPluginPage(): void {
	window.open(`obsidian://show-plugin?id=${MEDIA_EXTENDED_PLUGIN_ID}`);
}
