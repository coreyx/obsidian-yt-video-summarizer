// Batch operation reports and the live operation status.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { loadSource } from './helpers/loadSource.mjs';
import { notices, resetNotices } from './helpers/obsidian-stub.mjs';

const { formatBatchReportAsMarkdown } = await loadSource('src/utils/BatchProgressTracker.ts');
const progressModule = await loadSource('src/utils/OperationProgress.ts');

// Test 29: Batch operation progress tracking, item logging, and markdown reporting

console.log('Testing batch operation progress tracking, item logging, and markdown reporting...');

class MockBatchProgressTracker {
	constructor(host, operationName, scope, total) {
		this.host = host;
		this.report = {
			operationName,
			scope,
			startTime: Date.now(),
			total,
			succeeded: 0,
			skipped: 0,
			failed: 0,
			items: []
		};
		this.updates = [];
	}

	update(current, fileName, detail) {
		const pct = this.report.total > 0 ? Math.round((current / this.report.total) * 100) : 100;
		this.updates.push({ current, fileName, detail, pct });
	}

	recordItem(item) {
		item.timestamp = item.timestamp || Date.now();
		this.report.items.push(item);
		if (item.status === 'success') this.report.succeeded++;
		else if (item.status === 'skipped') this.report.skipped++;
		else if (item.status === 'error') this.report.failed++;
		this.update(this.report.items.length, item.fileName, item.status.toUpperCase());
	}

	finish() {
		this.report.endTime = Date.now();
		this.host.setLastBatchReport(this.report);
		return this.report;
	}

	static finishEmpty(host, operationName, scope, message) {
		const report = {
			operationName,
			scope,
			startTime: Date.now(),
			endTime: Date.now(),
			total: 0,
			succeeded: 0,
			skipped: 0,
			failed: 0,
			items: []
		};
		host.setLastBatchReport(report);
		return report;
	}
}

class MockHost {
	constructor() {
		this.lastReport = null;
	}
	setLastBatchReport(report) {
		this.lastReport = report;
	}
}

// 29.1: Basic recording and tallies
const host1 = new MockHost();
const tracker1 = new MockBatchProgressTracker(host1, 'Refresh video metadata', 'vault', 3);

tracker1.recordItem({
	filePath: 'Notes/Video 1.md',
	fileName: 'Video 1',
	url: 'https://www.youtube.com/watch?v=vid1',
	status: 'success',
	message: 'Added playlist: "AI Tutorials" (Index 1/10)'
});

tracker1.recordItem({
	filePath: 'Notes/Video 2.md',
	fileName: 'Video 2',
	url: 'https://www.youtube.com/watch?v=vid2',
	status: 'skipped',
	message: 'Video is not part of a playlist on YouTube'
});

tracker1.recordItem({
	filePath: 'Notes/Video 3.md',
	fileName: 'Video 3',
	url: 'https://www.youtube.com/watch?v=vid3',
	status: 'error',
	message: 'HTTP 403: Quota exceeded'
});

const report1 = tracker1.finish();
assert.strictEqual(report1.total, 3);
assert.strictEqual(report1.succeeded, 1);
assert.strictEqual(report1.skipped, 1);
assert.strictEqual(report1.failed, 1);
assert.strictEqual(report1.items.length, 3);
assert.strictEqual(host1.lastReport, report1);
assert(report1.endTime >= report1.startTime);

// 29.2: Progress update percentages
assert.deepStrictEqual(tracker1.updates, [
	{ current: 1, fileName: 'Video 1', detail: 'SUCCESS', pct: 33 },
	{ current: 2, fileName: 'Video 2', detail: 'SKIPPED', pct: 67 },
	{ current: 3, fileName: 'Video 3', detail: 'ERROR', pct: 100 }
]);

// 29.3: finishEmpty handling
const host2 = new MockHost();
const emptyReport = MockBatchProgressTracker.finishEmpty(
	host2,
	'Refresh video metadata',
	'folder "Podcasts"',
	'All notes already up-to-date!'
);
assert.strictEqual(emptyReport.total, 0);
assert.strictEqual(emptyReport.succeeded, 0);
assert.strictEqual(emptyReport.skipped, 0);
assert.strictEqual(emptyReport.failed, 0);
assert.strictEqual(emptyReport.items.length, 0);
assert.strictEqual(host2.lastReport, emptyReport);

const emptyMarkdown = formatBatchReportAsMarkdown(emptyReport);
assert(emptyMarkdown.includes('# Batch Operation Report: Refresh video metadata'));
assert(emptyMarkdown.includes('- **Total Notes:** 0'));
assert(emptyMarkdown.includes('No notes were processed.'));

// 29.4: formatBatchReportAsMarkdown output verification
const markdownOutput = formatBatchReportAsMarkdown(report1);
assert(markdownOutput.includes('# Batch Operation Report: Refresh video metadata'));
assert(markdownOutput.includes('- **Scope:** vault'));
assert(markdownOutput.includes('- **Total Notes:** 3'));
assert(markdownOutput.includes('- **Succeeded:** 1'));
assert(markdownOutput.includes('- **Skipped:** 1'));
assert(markdownOutput.includes('- **Failed:** 1'));
assert(markdownOutput.includes('| ✓ Success | [[Video 1]] | Added playlist: "AI Tutorials" (Index 1/10) | https://www.youtube.com/watch?v=vid1 |'));
assert(markdownOutput.includes('| ⊘ Skipped | [[Video 2]] | Video is not part of a playlist on YouTube | https://www.youtube.com/watch?v=vid2 |'));
assert(markdownOutput.includes('| ✕ Error | [[Video 3]] | HTTP 403: Quota exceeded | https://www.youtube.com/watch?v=vid3 |'));

// Verify pipe escaping in messages
const pipeItemReport = {
	operationName: 'Test',
	scope: 'vault',
	startTime: Date.now(),
	endTime: Date.now(),
	total: 1,
	succeeded: 1,
	skipped: 0,
	failed: 0,
	items: [
		{
			filePath: 'test.md',
			fileName: 'test',
			status: 'success',
			message: 'Param A | Param B | Param C'
		}
	]
};
const pipeMarkdown = formatBatchReportAsMarkdown(pipeItemReport);
assert(pipeMarkdown.includes('Param A \\| Param B \\| Param C'));

console.log('✓ Batch operation progress tracking, item logging, and markdown reporting passed');

// Test 44: Live operation status — persistent notice, status bar, stages, and outcomes (real OperationProgress.ts)
console.log('Testing live operation status...');

// The real module, with Notice recorded by the shared obsidian stand-in
const { OperationProgress, LiveStatus, formatElapsed, shortenTitle, formatOperationStatus, describeFailedStage, ERROR_NOTICE_MS } = progressModule;

// 44.1: Elapsed time and title formatting
assert.strictEqual(formatElapsed(0), '0:00');
assert.strictEqual(formatElapsed(999), '0:00');
assert.strictEqual(formatElapsed(72_000), '1:12');
assert.strictEqual(formatElapsed(600_000), '10:00');
assert.strictEqual(formatElapsed(3_725_000), '1:02:05');
assert.strictEqual(formatElapsed(-5), '0:00');
assert.strictEqual(shortenTitle('  Short title  '), 'Short title');
assert.strictEqual(shortenTitle('x'.repeat(80)).length, 60);
assert(shortenTitle('x'.repeat(80)).endsWith('…'));
assert.deepStrictEqual(formatOperationStatus('Summarizing "Video"', 'Generating summary with qwen', 72_000), {
	notice: 'Summarizing "Video" · Generating summary with qwen… 1:12',
	statusBar: 'YT: Generating summary with qwen… 1:12',
});
assert.strictEqual(describeFailedStage('Fetching transcript'), ' (while fetching transcript)');
assert.strictEqual(describeFailedStage(''), '');

// Fakes for the status bar and timers
const realSetTimeout = globalThis.setTimeout;
const realWindow = globalThis.window;
const lingerCallbacks = [];
const intervals = [];
const clearedIntervals = [];
globalThis.setTimeout = (fn) => { lingerCallbacks.push(fn); return 0; };
globalThis.window = {
	setInterval: (fn) => { intervals.push(fn); return intervals.length; },
	clearInterval: (id) => { clearedIntervals.push(id); },
};
const makeStatusHost = () => {
	const items = [];
	return {
		items,
		addStatusBarItem: () => {
			const el = { text: '', removed: false, setText(t) { this.text = t; }, remove() { this.removed = true; } };
			items.push(el);
			return el;
		},
	};
};

try {
	// 44.2: Nothing is shown until the first stage, so a failed validation never flashes a status
	resetNotices();
	const host = makeStatusHost();
	const progress = new OperationProgress(host, 'Summarizing video');
	assert.strictEqual(notices.length, 0);
	assert.strictEqual(host.items.length, 0);
	assert.match(progress.describe(), /^Summarizing video \(\d+:\d\d\)$/);

	// 44.3: The first stage shows one persistent notice and one status bar item
	progress.setStage('Fetching transcript');
	assert.strictEqual(notices.length, 1);
	const liveNotice = notices[0];
	assert.strictEqual(liveNotice.duration, 0, 'the live notice must not time out');
	assert.match(liveNotice.message, /^Summarizing video · Fetching transcript… 0:0\d$/);
	assert.strictEqual(host.items.length, 1);
	assert.match(host.items[0].text, /^YT: Fetching transcript… 0:0\d$/);
	assert.strictEqual(intervals.length, 1, 'a one-second timer keeps the elapsed time current');

	// 44.4: Later stages and the label update the same notice in place
	progress.setLabel('Summarizing "My Video"');
	progress.setStage('Generating summary with qwen');
	assert.strictEqual(notices.length, 1);
	assert.strictEqual(host.items.length, 1);
	assert.match(liveNotice.message, /^Summarizing "My Video" · Generating summary with qwen… 0:0\d$/);
	intervals[0]();
	assert.match(host.items[0].text, /^YT: Generating summary with qwen… 0:0\d$/);
	assert.match(progress.describe(), /^Summarizing "My Video" \(generating summary with qwen, 0:0\d\)$/);

	// 44.5: Success hides the live notice, shows the result, and clears the status bar after a moment
	progress.done('Summary saved to "My Video"');
	assert.strictEqual(liveNotice.hidden, true);
	assert.deepStrictEqual(clearedIntervals, [1]);
	assert.strictEqual(notices.length, 2);
	assert.strictEqual(notices[1].message, 'Summary saved to "My Video"');
	assert.strictEqual(notices[1].duration, undefined);
	assert.strictEqual(host.items[0].text, 'YT: Done');
	assert.strictEqual(host.items[0].removed, false);
	lingerCallbacks.shift()();
	assert.strictEqual(host.items[0].removed, true);

	// 44.6: Ending twice does nothing more (stop() runs in every finally block)
	progress.stop();
	progress.fail('late');
	progress.setStage('Too late');
	assert.strictEqual(notices.length, 3, 'only the explicit fail() adds a notice');
	assert.strictEqual(host.items.length, 1);

	// 44.7: Failure names the stage and stays on screen longer
	resetNotices();
	const failHost = makeStatusHost();
	const failing = new OperationProgress(failHost, 'Summarizing video');
	failing.setStage('Generating summary with qwen');
	failing.fail('Error: Connection error.');
	assert.strictEqual(notices[0].hidden, true);
	assert.strictEqual(notices[1].message, 'Error: Connection error. (while generating summary with qwen)');
	assert.strictEqual(notices[1].duration, ERROR_NOTICE_MS);
	assert(ERROR_NOTICE_MS >= 10000);
	assert.strictEqual(failHost.items[0].text, 'YT: Failed');

	// 44.8: stop() clears everything silently, including the status bar item
	resetNotices();
	const stopHost = makeStatusHost();
	const stopped = new OperationProgress(stopHost, 'Tagging "Note"');
	stopped.setStage('Fetching tags from YouTube');
	stopped.stop();
	assert.strictEqual(notices.length, 1);
	assert.strictEqual(notices[0].hidden, true);
	assert.strictEqual(stopHost.items[0].removed, true);

	// 44.9: Works without a status bar (mobile)
	resetNotices();
	const mobile = new OperationProgress({}, 'Getting transcript');
	mobile.setStage('Fetching transcript');
	mobile.done('Transcript retrieved successfully!');
	assert.strictEqual(notices.length, 2);

	// 44.10: LiveStatus (shared with batch operations) updates both displays in place
	resetNotices();
	const batchHost = makeStatusHost();
	const live = new LiveStatus(batchHost, '[0/3] Starting...', 'YT: [0/3] Starting...');
	live.set('[1/3] (33%) Refresh video metadata: A', 'YT: [1/3] 33%');
	assert.strictEqual(notices.length, 1);
	assert.strictEqual(notices[0].message, '[1/3] (33%) Refresh video metadata: A');
	assert.strictEqual(batchHost.items[0].text, 'YT: [1/3] 33%');
	live.end('YT: Done (3/3)');
	assert.strictEqual(notices[0].hidden, true);
	assert.strictEqual(batchHost.items[0].text, 'YT: Done (3/3)');
} finally {
	globalThis.setTimeout = realSetTimeout;
	globalThis.window = realWindow;
}

// 44.11: Every command that fetches or generates reports through the shared status, and none of the
// short-lived "Fetching…" / "Generating…" notices remain
const statusSource = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
assert(!/new Notice\(['`](Fetching|Generating|Refreshing)/.test(statusSource));
assert(!statusSource.includes('Already processing'));
assert.strictEqual((statusSource.match(/this\.beginOperation\(/g) || []).length, 8);
assert.strictEqual(
	(statusSource.match(/this\.endOperation\(progress\);/g) || []).length,
	8,
	'every operation ends its status in a finally block'
);
const trackerSource = readFileSync(new URL('../src/utils/BatchProgressTracker.ts', import.meta.url), 'utf8');
assert(trackerSource.includes('new LiveStatus('));

console.log('✓ Live operation status passed');
