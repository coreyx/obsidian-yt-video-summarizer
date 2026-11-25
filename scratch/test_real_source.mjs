/**
 * Verification for spec/test-real-source: proves the test suite exercises the plugin's real source.
 *
 * 1. No copies: no test file defines a function or class named like a function `src/` exports.
 * 2. Baseline: the suite passes on an unmodified copy of the repository.
 * 3. Mutations: for each target function, a copy of the repository is made where only that function throws
 *    as soon as it is called; the suite must fail. The real `src/` is never modified.
 *
 * Run from the repository root: `node scratch/test_real_source.mjs`
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { transformSync } from 'esbuild';

const require = createRequire(join(process.cwd(), 'package.json'));
const acorn = require('acorn');
const root = process.cwd();
let failures = 0;
const check = (ok, label) => {
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
	if (!ok) failures++;
};

/** Every .ts file under a directory */
const tsFiles = (dir) => readdirSync(dir).flatMap((name) => {
	const path = join(dir, name);
	return statSync(path).isDirectory() ? tsFiles(path) : path.endsWith('.ts') ? [path] : [];
});

// --- 1. No copies -----------------------------------------------------------------------------------------
const exported = new Set();
for (const file of tsFiles(join(root, 'src'))) {
	const source = readFileSync(file, 'utf8');
	for (const m of source.matchAll(/export\s+(?:async\s+)?(?:function|class|const)\s+([A-Za-z_]\w*)/g)) exported.add(m[1].toLowerCase());
	// Public static methods are part of a module's surface too (e.g. YouTubeService.decodeHTML)
	for (const m of source.matchAll(/^\s+(?:public\s+)?static\s+(?:async\s+)?([A-Za-z_]\w*)\s*[<(]/gm)) exported.add(m[1].toLowerCase());
}
const normalize = (name) => name
	.replace(/^test(?=[A-Z])/, '')
	.replace(/(Helper|WithDesc|WithExclude|WithPlaylist|Updated|Mock)$/g, '')
	.replace(/^Mock/, '')
	.toLowerCase();
const copies = [];
const testFiles = readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.mjs')).map((f) => join(root, 'tests', f));
for (const file of [...testFiles, ...readdirSync(join(root, 'tests', 'helpers')).map((f) => join(root, 'tests', 'helpers', f))]) {
	const ast = acorn.parse(readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
	for (const st of ast.body) {
		const decl = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
		const names = [];
		if (decl?.type === 'FunctionDeclaration' || decl?.type === 'ClassDeclaration') names.push(decl.id.name);
		if (decl?.type === 'VariableDeclaration') {
			for (const d of decl.declarations) {
				if (d.id.type === 'Identifier' && /Function|ArrowFunction/.test(d.init?.type ?? '')) names.push(d.id.name);
			}
		}
		for (const name of names) if (exported.has(normalize(name))) copies.push(`${relative(root, file)}: ${name}`);
	}
}
check(copies.length === 0, `no test file defines a copy of an exported src function${copies.length ? ` (${copies.join('; ')})` : ''}`);

// --- Workspace: a copy of the repository that mutations are applied to ------------------------------------
const work = mkdtempSync(join(tmpdir(), 'yt-real-source-'));
for (const item of ['src', 'tests', 'tsconfig.json', 'package.json']) cpSync(join(root, item), join(work, item), { recursive: true });
// Share node_modules (esbuild, acorn, the AI SDKs) instead of copying it; a junction needs no admin rights on Windows
symlinkSync(join(root, 'node_modules'), join(work, 'node_modules'), 'junction');
const runSuite = () => spawnSync(process.execPath, ['--test', 'tests/'], { cwd: work, encoding: 'utf8', timeout: 120_000 });

try {
	// --- 2. Baseline -------------------------------------------------------------------------------------
	const baseline = runSuite();
	check(baseline.status === 0, 'the suite passes on the unmodified source');

	// --- 3. Mutations ------------------------------------------------------------------------------------
	/** [src file, function or method name] — at least one per test area */
	const targets = [
		['src/utils/frontmatter.ts', 'sanitizeFileName'],
		['src/utils/frontmatter.ts', 'sanitizeTag'],
		['src/utils/frontmatter.ts', 'buildFrontmatter'],
		['src/utils/frontmatter.ts', 'mergeFrontmatter'],
		['src/utils/frontmatter.ts', 'extractTagsFromText'],
		['src/utils/frontmatter.ts', 'extractYouTubeUrlFromNote'],
		['src/utils/frontmatter.ts', 'deduplicateTags'],
		['src/utils/frontmatter.ts', 'formatTimestampParts'],
		['src/utils/frontmatter.ts', 'formatTranscript'],
		['src/utils/frontmatter.ts', 'convertTimestampsToLinks'],
		['src/utils/frontmatter.ts', 'generateMxUid'],
		['src/utils/frontmatter.ts', 'buildMediaExtendedNote'],
		['src/utils/frontmatter.ts', 'addRelatedLink'],
		['src/utils/frontmatter.ts', 'buildCoverEmbed'],
		['src/utils/frontmatter.ts', 'stripWikilinksFromTechnicalTerms'],
		['src/utils/frontmatter.ts', 'isMediaExtendedCompanionNote'],
		['src/utils/frontmatter.ts', 'hasRelatedMediaExtendedLink'],
		['src/utils/frontmatter.ts', 'filterFilesByFolder'],
		['src/utils/frontmatter.ts', 'filterFilesByFolderPaths'],
		['src/utils/frontmatter.ts', 'upsertMarkdownSection'],
		['src/utils/frontmatter.ts', 'ensureSectionOrder'],
		['src/utils/frontmatter.ts', 'upsertMediaExtendedSection'],
		['src/utils/frontmatter.ts', 'findNotesForVideo'],
		['src/utils/frontmatter.ts', 'videoStatsFrontmatter'],
		['src/utils/frontmatter.ts', 'mergeYamlBlocks'],
		['src/utils/frontmatter.ts', 'getVideoNoteKind'],
		['src/utils/frontmatter.ts', 'refreshMediaExtendedNoteContent'],
		['src/utils/frontmatter.ts', 'keepExtraFrontmatter'],
		['src/utils/frontmatter.ts', 'isBlankNoteForSummary'],
		['src/utils/frontmatter.ts', 'extractFrontmatterTags'],
		['src/utils/frontmatter.ts', 'addTagsToNoteContent'],
		['src/utils/videoTopics.ts', 'parseVideoTopics'],
		['src/utils/videoTopics.ts', 'buildVideoTopicsPrompt'],
		['src/utils/vaultTags.ts', 'extractGroupPrefixes'],
		['src/utils/vaultTags.ts', 'buildVaultTagData'],
		['src/utils/vaultTags.ts', 'buildTopicGenerationPrompt'],
		['src/utils/vaultTags.ts', 'parseTopicTags'],
		['src/utils/vaultTags.ts', 'collectVaultTagCounts'],
		['src/services/lmStudio.ts', 'normalizeOpenAIBaseUrl'],
		['src/services/lmStudio.ts', 'parseLMStudioModels'],
		['src/services/youtube.ts', 'decodeHTML'],
		['src/services/youtube.ts', 'getCoverUrl'],
		['src/services/youtube.ts', 'getAvailableThumbnailUrl'],
		['src/services/youtube.ts', 'extractPlaylistId'],
		['src/services/youtube.ts', 'formatAspectRatio'],
		['src/services/youtube.ts', 'getAspectRatioFromPlayerData'],
		['src/utils/youtubeMetadata.ts', 'tagsFromDataApiItem'],
		['src/utils/youtubeMetadata.ts', 'tagsFromPlayerDataKeywords'],
		['src/utils/youtubeMetadata.ts', 'tagsFromWatchPageHtml'],
		['src/utils/youtubeMetadata.ts', 'findPlaylistIdInDescription'],
		['src/utils/youtubeMetadata.ts', 'collectVideoTags'],
		['src/services/providers/openai.ts', 'buildChatCompletionParams'],
		['src/services/providers/openai.ts', 'toLegacyMaxTokensParams'],
		['src/services/settingsManager.ts', 'syncLMStudioProvider'],
		['src/services/settingsManager.ts', 'syncBuiltInProviders'],
		['src/utils/mediaExtendedOptions.ts', 'defaultMediaExtendedRunOptions'],
		['src/utils/mediaExtendedOptions.ts', 'resolveCompanionNoteOptions'],
		['src/utils/mediaExtendedPlugin.ts', 'resolveMediaExtendedPluginStatus'],
		['src/utils/mediaExtendedPlugin.ts', 'shouldPromptToInstallMediaExtended'],
		['src/utils/summaryNote.ts', 'buildVideoMetaLine'],
		['src/utils/summaryNote.ts', 'buildSummaryBody'],
		['src/utils/summaryNote.ts', 'normalizeFolderSetting'],
		['src/utils/summaryNote.ts', 'chooseSummaryTarget'],
		['src/utils/summaryNote.ts', 'findAvailableNotePath'],
		['src/utils/summaryNote.ts', 'composeSummaryNoteContent'],
		['src/utils/summaryNote.ts', 'insertTextAt'],
		['src/utils/summaryNote.ts', 'insertLinkAtCursor'],
		['src/utils/summaryNote.ts', 'frontmatterDescriptionToUse'],
		['src/utils/summaryNote.ts', 'replaceInNote'],
		['src/services/prompt.ts', 'adaptPromptForWikilinks'],
		['src/ui/modals/FolderSuggestModal.ts', 'sortFolders'],
		['src/utils/BatchProgressTracker.ts', 'formatBatchReportAsMarkdown'],
		['src/utils/BatchProgressTracker.ts', 'recordItem'],
		['src/utils/BatchProgressTracker.ts', 'finishEmpty'],
		['src/utils/OperationProgress.ts', 'formatElapsed'],
		['src/defaults.ts', 'upgradeSavedPrompt'],
		['src/main.ts', 'rebuildVaultTagCache'],
	];

	/**
	 * Returns `source` with `throw new Error('[mutation] name')` as the first statement of the named function or
	 * method, or null when it can't be found. The body's opening brace is the first `{` after the parameter list
	 * that ends a line, is outside any brackets, and doesn't start a type (a `{` right after `:`, `|`, `&` or `,`
	 * opens an object type in a return type annotation).
	 */
	const mutate = (source, name) => {
		const decl = new RegExp(`(?:function\\s+${name}|^\\s*(?:(?:public|private|protected|static|async)\\s+)*${name})\\s*(?:<[^()]*?>)?\\(`, 'm');
		const match = decl.exec(source);
		if (!match) return null;
		let i = match.index + match[0].length;
		for (let depth = 1; depth > 0 && i < source.length; i++) {
			if (source[i] === '(') depth++;
			else if (source[i] === ')') depth--;
		}
		let depth = 0;
		for (; i < source.length; i++) {
			const c = source[i];
			if ('([<'.includes(c)) depth++;
			else if (')]>'.includes(c) && source[i - 1] !== '=') depth--;
			else if (c === '{') {
				const opensType = /[:|&,]\s*$/.test(source.slice(Math.max(0, i - 40), i));
				if (depth === 0 && !opensType && /^[ \t]*\r?\n/.test(source.slice(i + 1))) {
					return `${source.slice(0, i + 1)} throw new Error('[mutation] ${name}');${source.slice(i + 1)}`;
				}
				depth++;
			} else if (c === '}') depth--;
		}
		return null;
	};

	const untested = [];
	for (const [file, name] of targets) {
		const path = join(work, file);
		const original = readFileSync(path, 'utf8');
		const mutated = mutate(original, name);
		if (!mutated) {
			check(false, `mutation: ${name} found in ${file}`);
			continue;
		}
		try {
			// A mutation that doesn't compile would fail the suite for the wrong reason
			transformSync(mutated, { loader: 'ts' });
		} catch {
			check(false, `mutation: ${name} in ${file} still compiles`);
			continue;
		}
		writeFileSync(path, mutated);
		const result = runSuite();
		writeFileSync(path, original);
		if (result.status === 0) untested.push(`${name} (${file})`);
	}
	check(untested.length === 0, `the suite fails when any of ${targets.length} functions is broken${untested.length ? `; still passing with: ${untested.join(', ')}` : ''}`);
} finally {
	rmSync(join(work, 'node_modules'));
	rmSync(work, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
