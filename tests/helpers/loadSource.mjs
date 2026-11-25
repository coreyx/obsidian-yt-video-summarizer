/**
 * Loads the plugin's real TypeScript source in Node, so tests exercise `src/` rather than copies of it.
 *
 * Each entry point is bundled with esbuild (the same compiler the plugin build uses). Every `obsidian`
 * import is redirected to `obsidian-stub.mjs` and left external, so all bundles share one stub instance
 * and a test can steer it (e.g. `setRequestUrlHandler()`) or inspect it (e.g. `notices`).
 */
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const helpersDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(helpersDir, '..', '..');
const stubUrl = pathToFileURL(join(helpersDir, 'obsidian-stub.mjs')).href;
// Inside node_modules so it is already ignored by git and by the plugin build
const bundleDir = join(repoRoot, 'node_modules', '.cache', 'test-src');

/** Bundled modules by entry point, so each `src/` file is compiled once per test process */
const cache = new Map();

/** Sends `obsidian` imports to the shared stub instead of bundling (or failing on) the real package. */
const obsidianStubPlugin = {
	name: 'obsidian-stub',
	setup(pluginBuild) {
		pluginBuild.onResolve({ filter: /^obsidian$/ }, () => ({ path: stubUrl, external: true }));
	},
};

/**
 * Compiles a plugin source file (and everything it imports) and returns its exports.
 * @param {string} srcPath - Path relative to the repository root, e.g. `src/utils/frontmatter.ts`.
 * @returns {Promise<Record<string, any>>} The module's exports.
 */
export async function loadSource(srcPath) {
	const entry = resolve(repoRoot, srcPath);
	if (!cache.has(entry)) {
		cache.set(entry, bundleAndImport(entry));
	}
	return cache.get(entry);
}

/**
 * Bundles one entry point to a temporary file and imports it. The file name includes the process id
 * because `node --test` runs test files in parallel processes that may load the same entry point.
 */
async function bundleAndImport(entry) {
	const result = await build({
		entryPoints: [entry],
		absWorkingDir: repoRoot,
		bundle: true,
		platform: 'node',
		format: 'esm',
		target: 'node18',
		write: false,
		sourcemap: 'inline',
		logLevel: 'silent',
		plugins: [obsidianStubPlugin],
		// Bundled CommonJS dependencies (the AI SDKs) call require() for Node built-ins
		banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
	});

	mkdirSync(bundleDir, { recursive: true });
	const name = createHash('sha1').update(entry).digest('hex').slice(0, 12);
	const file = join(bundleDir, `${name}-${process.pid}.mjs`);
	writeFileSync(file, result.outputFiles[0].text);
	try {
		return await import(pathToFileURL(file).href);
	} finally {
		// Node has read the file once the import settles, so it can go
		rmSync(file, { force: true });
	}
}
