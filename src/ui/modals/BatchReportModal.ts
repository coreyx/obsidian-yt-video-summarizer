import { App, Modal, Notice } from 'obsidian';
import { BatchItemResult, BatchOperationReport } from '../../types';
import { formatBatchReportAsMarkdown } from '../../utils/BatchProgressTracker';

type FilterType = 'all' | 'success' | 'skipped' | 'error';

/**
 * Interactive modal that displays the complete activity and error logs of the last batch operation,
 * with metric pills, status filtering, direct note links, and clipboard export.
 */
export class BatchReportModal extends Modal {
	private currentFilter: FilterType = 'all';

	constructor(app: App, private report: BatchOperationReport) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('yt-summarizer-batch-modal');

		// Header
		const headerEl = contentEl.createDiv({ cls: 'yt-summarizer-batch-modal__header' });
		headerEl.createEl('h2', {
			text: `Batch Report: ${this.report.operationName}`,
			cls: 'yt-summarizer-modal__title'
		});

		// Metadata Subtitle
		const durationSec = this.report.endTime
			? ((this.report.endTime - this.report.startTime) / 1000).toFixed(1)
			: '0.0';
		const dateStr = new Date(this.report.startTime).toLocaleString();
		const metaEl = contentEl.createDiv({ cls: 'yt-summarizer-batch-modal__meta' });
		metaEl.createEl('span', { text: `Target Scope: ${this.report.scope}` });
		metaEl.createEl('span', { text: `•` });
		metaEl.createEl('span', { text: `Started: ${dateStr}` });
		metaEl.createEl('span', { text: `•` });
		metaEl.createEl('span', { text: `Duration: ${durationSec}s` });

		// Metrics Overview Cards
		const metricsContainer = contentEl.createDiv({ cls: 'yt-summarizer-batch-metrics' });

		this.createMetricCard(metricsContainer, 'Total', this.report.total, 'total');
		this.createMetricCard(metricsContainer, 'Succeeded', this.report.succeeded, 'success');
		this.createMetricCard(metricsContainer, 'Skipped', this.report.skipped, 'skipped');
		this.createMetricCard(metricsContainer, 'Failed', this.report.failed, 'error');

		// Filter Controls
		const filterBar = contentEl.createDiv({ cls: 'yt-summarizer-batch-filter-bar' });
		filterBar.createSpan({ text: 'Filter: ', cls: 'yt-summarizer-batch-filter-label' });

		const filters: { id: FilterType; label: string; count: number }[] = [
			{ id: 'all', label: 'All', count: this.report.items.length },
			{ id: 'success', label: 'Succeeded', count: this.report.succeeded },
			{ id: 'skipped', label: 'Skipped', count: this.report.skipped },
			{ id: 'error', label: 'Failed', count: this.report.failed }
		];

		const itemsListContainer = contentEl.createDiv({ cls: 'yt-summarizer-batch-items-container' });

		const filterButtons: HTMLButtonElement[] = [];

		filters.forEach((f) => {
			const btn = filterBar.createEl('button', {
				text: `${f.label} (${f.count})`,
				cls: `yt-summarizer-batch-filter-btn ${this.currentFilter === f.id ? 'is-active' : ''}`
			});
			filterButtons.push(btn);

			btn.addEventListener('click', () => {
				this.currentFilter = f.id;
				filterButtons.forEach((b) => b.removeClass('is-active'));
				btn.addClass('is-active');
				this.renderItemsList(itemsListContainer);
			});
		});

		// Render initial items list
		this.renderItemsList(itemsListContainer);

		// Action Buttons Footer
		const actionsEl = contentEl.createDiv({ cls: 'yt-summarizer-modal__actions yt-summarizer-mt-4' });

		const copyBtn = actionsEl.createEl('button', {
			text: 'Copy Log to Clipboard',
			cls: 'yt-summarizer-modal__button'
		});
		copyBtn.addEventListener('click', async () => {
			try {
				const md = formatBatchReportAsMarkdown(this.report);
				await navigator.clipboard.writeText(md);
				new Notice('Batch report copied to clipboard!');
			} catch (e) {
				console.error('Failed to copy report to clipboard:', e);
				new Notice('Failed to copy report to clipboard.');
			}
		});

		const closeBtn = actionsEl.createEl('button', {
			text: 'Close',
			cls: 'yt-summarizer-modal__button yt-summarizer-modal__button--primary'
		});
		closeBtn.addEventListener('click', () => {
			this.close();
		});
	}

	private createMetricCard(
		container: HTMLElement,
		label: string,
		count: number,
		variant: 'total' | 'success' | 'skipped' | 'error'
	): void {
		const card = container.createDiv({
			cls: `yt-summarizer-batch-metric-card yt-summarizer-batch-metric--${variant}`
		});
		card.createDiv({ text: count.toString(), cls: 'yt-summarizer-batch-metric-number' });
		card.createDiv({ text: label, cls: 'yt-summarizer-batch-metric-label' });
	}

	private renderItemsList(container: HTMLElement): void {
		container.empty();

		const filtered = this.report.items.filter((item) => {
			if (this.currentFilter === 'all') return true;
			return item.status === this.currentFilter;
		});

		if (filtered.length === 0) {
			const emptyEl = container.createDiv({ cls: 'yt-summarizer-batch-items-empty' });
			emptyEl.createEl('p', {
				text:
					this.report.items.length === 0
						? 'No individual notes were processed (all up-to-date or no matching notes found).'
						: `No items matching filter "${this.currentFilter}".`
			});
			return;
		}

		for (const item of filtered) {
			this.renderItemRow(container, item);
		}
	}

	private renderItemRow(container: HTMLElement, item: BatchItemResult): void {
		const row = container.createDiv({
			cls: `yt-summarizer-batch-item-row yt-summarizer-batch-item--${item.status}`
		});

		// Status Badge
		const badge = row.createSpan({
			cls: `yt-summarizer-batch-badge yt-summarizer-batch-badge--${item.status}`
		});
		if (item.status === 'success') {
			badge.setText('✓ Success');
		} else if (item.status === 'skipped') {
			badge.setText('⊘ Skipped');
		} else {
			badge.setText('✕ Error');
		}

		// Content Details
		const contentCol = row.createDiv({ cls: 'yt-summarizer-batch-item-content' });

		// Clickable Note Link
		const titleRow = contentCol.createDiv({ cls: 'yt-summarizer-batch-item-title-row' });
		const noteLink = titleRow.createEl('a', {
			text: item.fileName,
			cls: 'yt-summarizer-batch-item-link',
			href: '#'
		});
		noteLink.addEventListener('click', (e) => {
			e.preventDefault();
			this.app.workspace.openLinkText(item.filePath, '', false);
			this.close();
		});

		if (item.url) {
			titleRow.createEl('a', {
				text: 'YouTube',
				href: item.url,
				cls: 'yt-summarizer-batch-item-external-link'
			});
		}

		// Message
		contentCol.createDiv({
			text: item.message,
			cls: `yt-summarizer-batch-item-message ${item.status === 'error' ? 'is-error' : ''}`
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
