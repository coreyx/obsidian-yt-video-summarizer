/**
 * In-memory stand-ins for the Obsidian objects plugin code is handed (an editor, the app's workspace and
 * vault), so tests can run the real code that edits notes and check exactly what it did.
 */
import { MarkdownView } from './obsidian-stub.mjs';

/**
 * Creates an editor holding `text`, with the cursor (or a selection) at the given character offsets.
 * Implements the `Editor` methods the plugin uses: getValue, getCursor, somethingSelected, replaceRange,
 * setCursor, offsetToPos and posToOffset. Positions are `{ line, ch }`, as in Obsidian.
 * @param {string} text
 * @param {{ cursor?: number, selection?: [number, number] }} [options] - Cursor offset (default: end of text),
 *   or a selection's start and end offsets.
 */
export function createFakeEditor(text, options = {}) {
	let value = text;
	let [from, to] = options.selection ?? [options.cursor ?? text.length, options.cursor ?? text.length];

	const offsetToPos = (offset) => {
		const before = value.slice(0, offset).split('\n');
		return { line: before.length - 1, ch: before[before.length - 1].length };
	};
	const posToOffset = (pos) => {
		const lines = value.split('\n');
		let offset = 0;
		for (let i = 0; i < pos.line; i++) offset += lines[i].length + 1;
		return offset + pos.ch;
	};

	return {
		getValue: () => value,
		getCursor: (which = 'head') => offsetToPos(which === 'from' || which === 'anchor' ? from : to),
		somethingSelected: () => from !== to,
		replaceRange(replacement, fromPos, toPos = fromPos) {
			const start = posToOffset(fromPos);
			const end = posToOffset(toPos);
			value = value.slice(0, start) + replacement + value.slice(end);
		},
		setCursor(pos) {
			from = to = posToOffset(pos);
		},
		offsetToPos,
		posToOffset,
		/** Test-only: the cursor's character offset */
		cursorOffset: () => to,
	};
}

/**
 * Creates an app whose vault holds `files` (path → content on disk) and whose workspace has the notes in
 * `openEditors` (path → fake editor) open in Markdown views.
 * @param {{ files?: Record<string, string>, openEditors?: Record<string, ReturnType<typeof createFakeEditor>> }} [options]
 * @returns The app; `app.files` is the on-disk content, changed by `vault.process()`.
 */
export function createFakeApp({ files = {}, openEditors = {} } = {}) {
	const leaves = Object.entries(openEditors).map(([path, editor]) => ({
		view: Object.assign(new MarkdownView(), { file: { path }, editor }),
	}));
	return {
		files,
		workspace: {
			getLeavesOfType: (type) => (type === 'markdown' ? leaves : []),
		},
		vault: {
			async process(file, change) {
				files[file.path] = change(files[file.path]);
				return files[file.path];
			},
		},
	};
}
