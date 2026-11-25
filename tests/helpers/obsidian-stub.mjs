/**
 * A minimal stand-in for the `obsidian` module, so plugin source can run under Node in tests.
 *
 * `loadSource()` points every `obsidian` import in a bundled `src/` module at this file, and keeps it
 * external so that all bundles and the tests share this one module instance: a test that sets a
 * `requestUrl` handler or reads `notices` sees exactly what the code under test did.
 *
 * Only what the plugin imports is provided. Classes the plugin only extends or uses for types are empty.
 */

/** Every Notice the code under test has shown, oldest first */
export const notices = [];

/** Clears the recorded notices between tests. */
export function resetNotices() {
	notices.length = 0;
}

/**
 * Records a notice instead of showing it. Keeps the message, duration and hidden state so tests can
 * check what a user would have seen.
 */
export class Notice {
	/**
	 * @param {string} message - The notice text.
	 * @param {number} [duration] - How long Obsidian would show it, in ms (0 = until hidden).
	 */
	constructor(message, duration) {
		this.message = message;
		this.duration = duration;
		this.hidden = false;
		notices.push(this);
	}

	/** Replaces the notice text, as Obsidian's `Notice.setMessage()` does. */
	setMessage(message) {
		this.message = message;
		return this;
	}

	/** Marks the notice as dismissed. */
	hide() {
		this.hidden = true;
	}
}

let requestUrlHandler = null;

/**
 * Sets the function that answers `requestUrl()` calls, or `null` to remove it.
 * @param {((params: string | {url: string, method?: string, headers?: object, body?: string}) => object | Promise<object>) | null} handler
 */
export function setRequestUrlHandler(handler) {
	requestUrlHandler = handler;
}

/**
 * Stands in for Obsidian's `requestUrl()`. Answers with the handler a test set, and throws when none is
 * set so that no test reaches the network by accident.
 */
export async function requestUrl(params) {
	if (!requestUrlHandler) {
		const url = typeof params === 'string' ? params : params?.url;
		throw new Error(`requestUrl(${url}) was called with no handler set; call setRequestUrlHandler() in the test`);
	}
	return await requestUrlHandler(params);
}

/**
 * Normalizes a vault path the way Obsidian's `normalizePath()` does: forward slashes, no leading or
 * trailing slash, and no repeated slashes.
 */
export function normalizePath(path) {
	const normalized = String(path)
		.replace(/\\/g, '/')
		.replace(/\/+/g, '/')
		.replace(/^\/+|\/+$/g, '');
	return normalized === '' ? '/' : normalized;
}

/** Converts an ArrayBuffer to base64, like Obsidian's helper of the same name. */
export function arrayBufferToBase64(buffer) {
	return Buffer.from(buffer).toString('base64');
}

/** Does nothing: icons are UI only. */
export function setIcon() {}

// Classes the plugin extends or only refers to; tests that need behavior from them use their own fakes.
export class App {}
export class Plugin {
	constructor(app, manifest) {
		this.app = app;
		this.manifest = manifest;
	}
}
export class Modal {
	constructor(app) {
		this.app = app;
	}
}
export class FuzzySuggestModal extends Modal {}
export class PluginSettingTab {
	constructor(app, plugin) {
		this.app = app;
		this.plugin = plugin;
	}
}
export class Setting {}
export class ButtonComponent {}
export class Editor {}
export class MarkdownView {}
export class TFile {}
export class TFolder {}
