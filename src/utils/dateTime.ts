/**
 * Date and time values for note frontmatter, in the forms Obsidian's "Date" and "Date & time" property types read.
 */

/** Pads a number to two digits. */
function pad2(value: number): string {
	return String(value).padStart(2, '0');
}

/**
 * Formats a moment as a local date (`YYYY-MM-DD`) in the computer's time zone.
 */
export function formatLocalDate(date: Date): string {
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Formats a moment as a local date and time without a UTC offset (`YYYY-MM-DDTHH:mm:ss`), in the computer's
 * time zone. Obsidian's "Date & time" property type stores values in this form, so an offset (`Z`, `-07:00`)
 * would stop Obsidian from showing the value as a date and time.
 */
export function formatLocalDateTime(date: Date): string {
	return `${formatLocalDate(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/**
 * Whether a frontmatter date value carries a time of day (`YYYY-MM-DDTHH:mm...`) rather than a bare date.
 */
export function hasTimeOfDay(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);
}

/**
 * Whether a string is a frontmatter date (`YYYY-MM-DD`) or local date and time (`YYYY-MM-DDTHH:mm` or
 * `YYYY-MM-DDTHH:mm:ss`), the forms this plugin writes.
 */
export function isFrontmatterDateValue(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/.test(value);
}
