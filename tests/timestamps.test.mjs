// Timestamp parsing, timestamp links, and transcript formatting.
import assert from 'node:assert';
import {
	formatTimestampPartsHelper,
	formatTranscriptHelper,
} from './helpers/legacy-copies.mjs';

// Test 17: Transcript formatting and timestamp links
console.log('Testing transcript formatting and timestamp links...');




// Check unit breakdown
const p1 = formatTimestampPartsHelper(65610);
assert.strictEqual(p1.timeStr, '01:05');
assert.strictEqual(p1.roundedSeconds, 66);
assert.strictEqual(p1.meTimeStr, '01:05.61');

const p2 = formatTimestampPartsHelper(122650);
assert.strictEqual(p2.timeStr, '02:02');
assert.strictEqual(p2.roundedSeconds, 123);
assert.strictEqual(p2.meTimeStr, '02:02.65');

const testLines = [
	{ text: 'First segment', offset: 65610, duration: 3000 },
	{ text: 'Second segment with\nnewline', offset: 122650, duration: 4000 },
	{ text: 'Hour segment', offset: 3665610, duration: 2000 }
];

// Media Extended format (companion notes) matching user's exact specification
const meFormatted = formatTranscriptHelper(testLines, 'dQw4w9WgXcQ', { format: 'mediaExtended' });
assert.strictEqual(meFormatted.includes('- [01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=66#t=01:05.61) First segment'), true);
assert.strictEqual(meFormatted.includes('- [02:02](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123#t=02:02.65) Second segment with newline'), true);
assert.strictEqual(meFormatted.includes('- [01:01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3666#t=01:01:05.61) Hour segment'), true);
assert.strictEqual(meFormatted.includes('[[#t='), false);

// Standard YouTube format (default, video summary notes): &t=SECONDSs, floored to the displayed second
const ytFormatted = formatTranscriptHelper(testLines, 'dQw4w9WgXcQ');
assert.strictEqual(ytFormatted.includes('- [01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=65s) First segment'), true);
assert.strictEqual(ytFormatted.includes('- [02:02](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=122s) Second segment with newline'), true);
assert.strictEqual(ytFormatted.includes('- [01:01:05](https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3665s) Hour segment'), true);
assert.strictEqual(ytFormatted.includes('#t='), false);
assert.strictEqual(ytFormatted.includes('[[#t='), false);

// Every transcript line is linked in both formats
for (const formatted of [meFormatted, ytFormatted]) {
	for (const line of formatted.split('\n')) {
		assert.match(line, /^- \[\d{2}:\d{2}(?::\d{2})?\]\(https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ&t=\d+/);
	}
}

// Test summary generation with transcript dump
function generateSummaryDumpHelper(transcript, thumbnailUrl, url, summaryText, dumpTranscript) {
	const summaryParts = [
		`![Thumbnail](${thumbnailUrl})`,
		summaryText
	];
	if (dumpTranscript && transcript.lines && transcript.lines.length > 0) {
		const formatted = formatTranscriptHelper(transcript.lines, transcript.videoId);
		summaryParts.push(`## Transcript\n\n${formatted}`);
	}
	return summaryParts.join('\n\n');
}

const mockTranscriptWithLines = {
	videoId: 'abc123xyz',
	lines: testLines
};

const summaryNoDump = generateSummaryDumpHelper(mockTranscriptWithLines, 'thumb.jpg', 'url', '## Summary\nText', false);
assert.strictEqual(summaryNoDump.includes('## Transcript'), false);

const summaryWithDump = generateSummaryDumpHelper(mockTranscriptWithLines, 'thumb.jpg', 'url', '## Summary\nText', true);
assert.strictEqual(summaryWithDump.includes('## Transcript'), true);
assert.strictEqual(summaryWithDump.includes('- [01:05]('), true);
console.log('✓ Transcript formatting and timestamp links passed');
