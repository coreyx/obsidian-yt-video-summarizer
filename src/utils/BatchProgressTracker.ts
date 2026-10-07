import { Notice } from 'obsidian';
import { BatchItemResult, BatchOperationReport } from '../types';
import { ERROR_NOTICE_MS, LiveStatus } from './OperationProgress';

/**
 * Formats a BatchOperationReport as human-readable Markdown for clipboard copying or inspection.
 */
export function formatBatchReportAsMarkdown(report: BatchOperationReport): string {
	const startTimeStr = new Date(report.startTime).toLocaleString();
	const durationSec = report.endTime
		? ((report.endTime - report.startTime) / 1000).toFixed(1)
		: '0.0';

	const lines: string[] = [
		`# Batch Operation Report: ${report.operationName}`,
		`- **Scope:** ${report.scope}`,
		`- **Started:** ${startTimeStr}`,
		`- **Duration:** ${durationSec}s`,
		`- **Total Notes:** ${report.total}`,
		`- **Succeeded:** ${report.succeeded}`,
		`- **Skipped:** ${report.skipped}`,
		`- **Failed:** ${report.failed}`,
		'',
		'## Processed Notes',
		'| Status | File | Message | URL |',
		'| :--- | :--- | :--- | :--- |'
	];

	if (report.items.length === 0) {
		lines.push('| - | None | No notes were processed. | - |');
	} else {
		for (const item of report.items) {
			const statusLabel =
				item.status === 'success'
					? '✓ Success'
					: item.status === 'skipped'
					? '⊘ Skipped'
					: '✕ Error';
			const sanitizedMsg = (item.message || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
			const urlCol = item.url ? item.url : '-';
			lines.push(`| ${statusLabel} | [[${item.fileName}]] | ${sanitizedMsg} | ${urlCol} |`);
		}
	}

	return lines.join('\n');
}

/**
 * Interface representing the minimal plugin interface needed by BatchProgressTracker.
 */
export interface BatchPluginHost {
	addStatusBarItem?: () => HTMLElement;
	setLastBatchReport: (report: BatchOperationReport) => void;
}

/**
 * Manages live progress tracking, updating in-place notices, status bar metrics,
 * detailed item logging, and final reports for batch operations.
 */
export class BatchProgressTracker {
	private report: BatchOperationReport;
	private status: LiveStatus;

	constructor(
		private host: BatchPluginHost,
		operationName: string,
		scope: string,
		total: number
	) {
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

		this.status = new LiveStatus(
			this.host,
			`[0/${total}] Starting ${operationName} in ${scope}...`,
			`YT: [0/${total}] Starting...`
		);
	}

	/** One line for telling the user what is still running */
	public describe(): string {
		return `${this.report.operationName} in ${this.report.scope} (${this.report.items.length}/${this.report.total} notes)`;
	}

	/**
	 * Updates the live notification and status bar indicator with current progress.
	 */
	public update(current: number, fileName: string, detail?: string): void {
		const pct = this.report.total > 0 ? Math.round((current / this.report.total) * 100) : 100;
		const noticeText = `[${current}/${this.report.total}] (${pct}%) ${this.report.operationName}: ${fileName}${
			detail ? ` - ${detail}` : ''
		}`;

		this.status.set(noticeText, `YT: [${current}/${this.report.total}] ${pct}%`);
	}

	/**
	 * Records an individual item result, updates tallies, and adjusts live progress displays.
	 */
	public recordItem(item: BatchItemResult): void {
		item.timestamp = item.timestamp || Date.now();
		this.report.items.push(item);

		if (item.status === 'success') {
			this.report.succeeded++;
		} else if (item.status === 'skipped') {
			this.report.skipped++;
		} else if (item.status === 'error') {
			this.report.failed++;
		}

		const tag = item.status === 'success' ? 'SUCCESS' : item.status === 'skipped' ? 'SKIPPED' : 'ERROR';
		if (item.status === 'error') {
			console.error(`[YouTube Summarizer] [${tag}] ${item.fileName} (${item.filePath}): ${item.message}`);
		} else {
			console.log(`[YouTube Summarizer] [${tag}] ${item.fileName} (${item.filePath}): ${item.message}`);
		}

		this.update(this.report.items.length, item.fileName, item.status.toUpperCase());
	}

	/**
	 * Concludes the batch run, cleans up ongoing indicators, notifies user of final tally,
	 * registers the report with the plugin, and returns the finished report.
	 */
	public finish(): BatchOperationReport {
		this.report.endTime = Date.now();
		this.status.end(`YT: Done (${this.report.succeeded}/${this.report.total})`);
		this.host.setLastBatchReport(this.report);

		const summaryMsg = `${this.report.operationName} complete! ${this.report.succeeded} succeeded${
			this.report.skipped > 0 ? `, ${this.report.skipped} skipped` : ''
		}${this.report.failed > 0 ? `, ${this.report.failed} failed` : ''}. View logs via command or settings.`;

		try {
			new Notice(summaryMsg, 8000);
		} catch {
			// Ignore in environments where Notice is unavailable
		}

		return this.report;
	}

	/**
	 * Handles unexpected fatal failures during the batch run.
	 */
	public fail(error: Error | string): BatchOperationReport {
		this.report.endTime = Date.now();
		const errMsg = typeof error === 'string' ? error : error.message;
		this.status.end('YT: Failed');
		this.host.setLastBatchReport(this.report);

		try {
			new Notice(`${this.report.operationName} failed: ${errMsg}`, ERROR_NOTICE_MS);
		} catch {
			// Ignore
		}

		return this.report;
	}

	/**
	 * Convenience helper when a batch scan finds 0 candidates.
	 */
	public static finishEmpty(
		host: BatchPluginHost,
		operationName: string,
		scope: string,
		noticeMessage: string
	): BatchOperationReport {
		const report: BatchOperationReport = {
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
		try {
			new Notice(noticeMessage);
		} catch {
			// Ignore
		}
		return report;
	}
}
