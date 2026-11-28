/**
 * Inferring the `topic` frontmatter property: the broad subject areas a video is about, as readable
 * Title Case phrases (unlike tags, which are kebab-case and reuse the vault's tag taxonomy).
 */

/** The most topics a note's `topic` property gets */
export const MAX_VIDEO_TOPICS = 3;

/**
 * How much transcript text goes into the topic prompt. Topics only need the gist of the video,
 * so long transcripts are sampled instead of sent whole, keeping this extra AI call cheap.
 */
const MAX_TRANSCRIPT_CHARS = 15000;

/** Words kept lowercase inside a Title Case topic (unless they start it) */
const MINOR_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with']);

/**
 * Shortens a transcript for the topic prompt. A transcript over the limit is sampled from its
 * start, middle, and end, so a topic the video only reaches later still shows up.
 */
export function sampleTranscriptForTopics(transcriptText: string, maxChars = MAX_TRANSCRIPT_CHARS): string {
	const text = transcriptText.replace(/\s+/g, ' ').trim();
	if (text.length <= maxChars) {
		return text;
	}
	const part = Math.floor(maxChars / 3);
	const middleStart = Math.floor((text.length - part) / 2);
	return [
		text.slice(0, part),
		text.slice(middleStart, middleStart + part),
		text.slice(text.length - part),
	].join(' […] ');
}

/**
 * Builds the prompt that asks the AI model for up to three topics a video is about, from its transcript.
 */
export function buildVideoTopicsPrompt(transcriptText: string, title?: string): string {
	const titleStr = title ? `Video title: ${title}\n\n` : '';
	return `You are categorizing a YouTube video for a note in Obsidian.

Read the transcript and name the broad subject areas the video is about, most central first. Give between 1 and ${MAX_VIDEO_TOPICS} topics.

Rules:
- Each topic is a short noun phrase of 1 to 3 words in Title Case (e.g. Machine Learning, Personal Finance, Home Automation).
- Prefer subject areas over the names of specific people, channels, or products.
- Prefer fewer, broader topics over many narrow ones, and don't list two topics that mean the same thing.
- Return ONLY the topics, one per line, with no numbering, bullets, quotes, or explanation.

${titleStr}Transcript:
${sampleTranscriptForTopics(transcriptText)}`;
}

/**
 * Converts a phrase to Title Case. Only words written entirely in lowercase are changed, so
 * acronyms and brand spellings the model returns (AI, iOS, JavaScript) are kept as-is.
 */
export function toTitleCase(phrase: string): string {
	return phrase
		.split(' ')
		.map((word, index) => {
			if (word !== word.toLowerCase() || word.length === 0) {
				return word;
			}
			if (index > 0 && MINOR_WORDS.has(word)) {
				return word;
			}
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join(' ');
}

/**
 * Cleans the pieces of a model's reply into at most `max` Title Case topics: strips list markers, quotes,
 * hashtags and wikilink brackets, and drops duplicates (case-insensitive) and anything too long to be a topic.
 */
function cleanTopics(pieces: string[], max: number): string[] {
	const topics: string[] = [];
	const seen = new Set<string>();
	for (const raw of pieces) {
		const topic = raw
			.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
			.replace(/\[\[|\]\]/g, '')
			.replace(/^#+/, '')
			.replace(/^["'`]+|["'`]+$/g, '')
			.replace(/\.$/, '')
			.replace(/\s+/g, ' ')
			.trim();
		// A "topic" longer than this is a sentence of explanation, not a topic
		if (!topic || topic.length > 50 || /^\d+$/.test(topic) || /:$/.test(topic)) {
			continue;
		}
		const key = topic.toLowerCase();
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		topics.push(toTitleCase(topic));
		if (topics.length >= max) {
			break;
		}
	}
	return topics;
}

/**
 * Parses the model's reply into at most `max` Title Case topics. Accepts one topic per line or a
 * comma-separated list, strips list markers, quotes, hashtags and wikilink brackets, and drops
 * duplicates (case-insensitive) and anything too long to be a topic.
 */
export function parseVideoTopics(text: string, max = MAX_VIDEO_TOPICS): string[] {
	if (!text) return [];
	return cleanTopics(text.split(/[,\n]/), max);
}

/** One note in a batched topic request: a number to answer by, and what the model reads */
export interface BatchTopicNote {
	id: number;
	title: string;
	summary: string;
}

/**
 * Builds one prompt that asks for the topics of several videos at once, from each note's title and
 * summary instead of its transcript, so adding topics to many existing notes takes a few small requests.
 * `knownTopics` are names already in use; the model is asked to reuse them so the vault keeps one
 * consistent set of topics instead of near-duplicates.
 */
export function buildBatchVideoTopicsPrompt(notes: BatchTopicNote[], knownTopics: string[]): string {
	const known = [...new Set(knownTopics.map((topic) => topic.trim()).filter(Boolean))];
	const knownSection = known.length > 0
		? `Topics already in use (reuse one whenever it fits; add a new topic only when none does):
${known.join('; ')}

`
		: '';
	const videos = notes
		.map((note) => `[${note.id}] ${note.title.replace(/\s+/g, ' ').trim()}
${note.summary.replace(/\s+/g, ' ').trim()}`)
		.join('\n\n');
	return `You are categorizing YouTube videos for notes in Obsidian.

For each video below, read its title and summary and name the broad subject areas it is about, most central first. Give between 1 and ${MAX_VIDEO_TOPICS} topics per video.

Rules:
- Each topic is a short noun phrase of 1 to 3 words in Title Case (e.g. Machine Learning, Personal Finance, Home Automation).
- Prefer subject areas over the names of specific people, channels, or products.
- Prefer fewer, broader topics over many narrow ones, and don't list two topics that mean the same thing.
- Answer with exactly one line per video, in the same order, in the form: <number>: Topic; Topic
- Return ONLY those lines, with no other text.

${knownSection}Videos:

${videos}`;
}

/**
 * Parses the reply to a batched topic prompt into each video's topics, keyed by its number. Only the
 * numbers that were asked for are kept, each with at most `max` cleaned Title Case topics; a video
 * with no usable answer is left out, so the caller can tell which videos to ask about again. A topic
 * that matches one of `knownTopics` apart from letter case takes the known spelling (`AI Video`, not
 * `Ai Video`), so reused topics stay identical.
 */
export function parseBatchVideoTopics(
	text: string,
	ids: number[],
	knownTopics: string[] = [],
	max = MAX_VIDEO_TOPICS
): Map<number, string[]> {
	const wanted = new Set(ids);
	const knownSpelling = new Map(knownTopics.map((topic) => [topic.trim().toLowerCase(), topic.trim()]));
	const result = new Map<number, string[]>();
	for (const line of (text || '').split(/\r?\n/)) {
		// "12: Topic; Topic", also tolerating "[12] Topic", "12. Topic" and a leading list marker
		const match = line.match(/^\s*(?:[-*•]\s*)?(?:\[(\d+)\]\s*[:.)\-–]?|(\d+)\s*[:.)\-–])\s*(.+)$/);
		if (!match) continue;
		const id = Number(match[1] ?? match[2]);
		if (!wanted.has(id) || result.has(id)) continue;
		const topics = [...new Set(cleanTopics(match[3].split(/[;,]/), max)
			.map((topic) => knownSpelling.get(topic.toLowerCase()) ?? topic))];
		if (topics.length > 0) {
			result.set(id, topics);
		}
	}
	return result;
}
