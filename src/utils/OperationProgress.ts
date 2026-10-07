import { Notice } from 'obsidian';

/** The part of the plugin the status displays need */
export interface StatusHost {
	addStatusBarItem?: () => HTMLElement;
}

/** How long a failure notice stays on screen */
export const ERROR_NOTICE_MS = 10000;

/** How long the status bar keeps showing the outcome after an operation ends */
const STATUS_BAR_LINGER_MS = 4000;

/**
 * Formats a duration as m:ss, or h:mm:ss from an hour up.
 */
export function formatElapsed(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = String(totalSeconds % 60).padStart(2, '0');
	return hours > 0
		? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
		: `${minutes}:${seconds}`;
}

/**
 * Shortens a video or note title so a status line stays readable.
 */
export function shortenTitle(title: string, maxLength = 60): string {
	const clean = title.trim();
	return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trimEnd()}…` : clean;
}

/**
 * Builds the two status lines for a running operation: the notice text and the shorter status bar text.
 */
export function formatOperationStatus(label: string, stage: string, elapsedMs: number): { notice: string; statusBar: string } {
	const elapsed = formatElapsed(elapsedMs);
	return {
		notice: `${label} · ${stage}… ${elapsed}`,
		statusBar: `YT: ${stage}… ${elapsed}`,
	};
}

/**
 * Describes where a failed operation was when it failed, e.g. "(while fetching transcript)".
 */
export function describeFailedStage(stage: string): string {
	return stage ? ` (while ${stage.charAt(0).toLowerCase()}${stage.slice(1)})` : '';
}

/**
 * A notice that stays on screen plus a status bar item, both updated in place.
 * The status bar doesn't exist on mobile and Notice may be unavailable in tests, so both are optional.
 */
export class LiveStatus {
	private notice: Notice | null = null;
	private statusBarEl: HTMLElement | null = null;

	constructor(host: StatusHost, noticeText: string, statusBarText: string) {
		// Persistent in-place notice (duration = 0)
		try {
			this.notice = new Notice(noticeText, 0);
		} catch {
			this.notice = null;
		}

		try {
			if (typeof host.addStatusBarItem === 'function') {
				this.statusBarEl = host.addStatusBarItem();
				this.statusBarEl.setText(statusBarText);
			}
		} catch {
			this.statusBarEl = null;
		}
	}

	public set(noticeText: string, statusBarText: string): void {
		if (this.notice && typeof this.notice.setMessage === 'function') {
			this.notice.setMessage(noticeText);
		}
		if (this.statusBarEl) {
			this.statusBarEl.setText(statusBarText);
		}
	}

	/**
	 * Hides the notice. The status bar item is removed, after showing `finalStatusBarText` for a
	 * moment when one is given.
	 */
	public end(finalStatusBarText?: string): void {
		if (this.notice && typeof this.notice.hide === 'function') {
			this.notice.hide();
		}
		this.notice = null;

		const statusBarEl = this.statusBarEl;
		this.statusBarEl = null;
		if (!statusBarEl) {
			return;
		}
		if (finalStatusBarText) {
			statusBarEl.setText(finalStatusBarText);
			setTimeout(() => statusBarEl.remove(), STATUS_BAR_LINGER_MS);
		} else {
			statusBarEl.remove();
		}
	}
}

/**
 * Live status for one running operation (summarizing a video, fetching a transcript, ...): what it is
 * doing, which stage it is in, and for how long. Nothing is shown until the first stage is set, so an
 * operation that stops at a validation check never flashes a status.
 */
export class OperationProgress {
	private status: LiveStatus | null = null;
	private timer: number | null = null;
	private startTime = Date.now();
	private stage = '';
	private ended = false;

	constructor(private host: StatusHost, private label: string) {}

	/** Changes what the operation is called, e.g. once the video title is known */
	public setLabel(label: string): void {
		this.label = label;
		this.render();
	}

	/** Moves to a new stage, named as an activity ("Fetching transcript") */
	public setStage(stage: string): void {
		if (this.ended) {
			return;
		}
		this.stage = stage;
		if (!this.status) {
			const text = this.format();
			this.status = new LiveStatus(this.host, text.notice, text.statusBar);
			this.timer = window.setInterval(() => this.render(), 1000);
		} else {
			this.render();
		}
	}

	/** One line for telling the user what is still running */
	public describe(): string {
		const elapsed = formatElapsed(Date.now() - this.startTime);
		return this.stage
			? `${this.label} (${this.stage.charAt(0).toLowerCase()}${this.stage.slice(1)}, ${elapsed})`
			: `${this.label} (${elapsed})`;
	}

	/** Ends the operation with a result notice */
	public done(message: string): void {
		this.end('YT: Done');
		new Notice(message);
	}

	/** Ends the operation with an error notice that says which stage failed and stays up longer */
	public fail(message: string): void {
		const stage = this.stage;
		this.end('YT: Failed');
		new Notice(`${message}${describeFailedStage(stage)}`, ERROR_NOTICE_MS);
	}

	/** Ends the operation without a notice. Does nothing if it has already ended. */
	public stop(): void {
		this.end();
	}

	private format(): { notice: string; statusBar: string } {
		return formatOperationStatus(this.label, this.stage, Date.now() - this.startTime);
	}

	private render(): void {
		if (this.status && !this.ended) {
			const text = this.format();
			this.status.set(text.notice, text.statusBar);
		}
	}

	private end(finalStatusBarText?: string): void {
		if (this.ended) {
			return;
		}
		this.ended = true;
		if (this.timer !== null) {
			window.clearInterval(this.timer);
			this.timer = null;
		}
		this.status?.end(finalStatusBarText);
		this.status = null;
	}
}
