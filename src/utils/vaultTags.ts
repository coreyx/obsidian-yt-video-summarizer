import { sanitizeTag, deduplicateTags } from './frontmatter';
import { GenerateTopicsOptions, VaultTagData } from '../types';

/**
 * Detects established group prefixes from a list of tags.
 * For example:
 * - 'ai/music-videos' -> 'ai/'
 * - 'dev/frontend/react' -> 'dev/', 'dev/frontend/'
 */
export function extractGroupPrefixes(tags: string[]): string[] {
	if (!tags || tags.length === 0) return [];
	const prefixSet = new Set<string>();

	for (const tag of tags) {
		if (typeof tag !== 'string') continue;
		const clean = tag.trim().toLowerCase();
		if (clean.includes('/')) {
			const parts = clean.split('/').filter(Boolean);
			if (parts.length > 1) {
				prefixSet.add(`${parts[0]}/`);
			}
			if (parts.length > 2) {
				prefixSet.add(`${parts.slice(0, -1).join('/')}/`);
			}
		}
	}

	return Array.from(prefixSet).sort();
}

/**
 * Builds a compressed string representation of vault tags to minimize token usage
 * while clearly presenting existing tags to the LLM for reuse.
 */
export function compressVaultTags(tags: string[], groupPrefixes?: string[], maxTags = 1000): string {
	if (!tags || tags.length === 0) {
		return '(none yet - feel free to create initial tags)';
	}

	const limitedTags = tags.slice(0, maxTags);
	return limitedTags.join(', ');
}

/**
 * Normalizes and builds vault tag cache data from raw tag occurrences or array.
 * Sorts by occurrence frequency descending, then alphabetically.
 */
export function buildVaultTagData(
	tagInput: Record<string, number> | string[],
	maxTags = 1000
): VaultTagData {
	const countMap = new Map<string, number>();

	if (Array.isArray(tagInput)) {
		for (const raw of tagInput) {
			if (typeof raw !== 'string') continue;
			const sanitized = sanitizeTag(raw);
			if (sanitized && sanitized.length > 1 && !/^\d+$/.test(sanitized)) {
				countMap.set(sanitized, (countMap.get(sanitized) || 0) + 1);
			}
		}
	} else if (tagInput && typeof tagInput === 'object') {
		for (const [rawTag, count] of Object.entries(tagInput)) {
			const sanitized = sanitizeTag(rawTag);
			if (sanitized && sanitized.length > 1 && !/^\d+$/.test(sanitized)) {
				const n = typeof count === 'number' && !isNaN(count) ? count : 1;
				countMap.set(sanitized, (countMap.get(sanitized) || 0) + n);
			}
		}
	}

	// Sort by frequency descending, then alphabetical
	const sortedTags = Array.from(countMap.entries())
		.sort((a, b) => {
			if (b[1] !== a[1]) return b[1] - a[1];
			return a[0].localeCompare(b[0]);
		})
		.map(entry => entry[0]);

	const groupPrefixes = extractGroupPrefixes(sortedTags);
	const compressedContext = compressVaultTags(sortedTags, groupPrefixes, maxTags);

	return {
		tags: sortedTags,
		groupPrefixes,
		compressedContext,
		totalCount: sortedTags.length,
	};
}

/**
 * Builds the comprehensive prompt for AI topic tagging inference.
 * Instructs the model to answer two key questions:
 * 1. What topic(s) does this video belong to?
 * 2. Is there any obvious tag that is missing in the existing set of tags?
 * 
 * Enforces:
 * - Reusing existing tags from the cached vault tag list over creating new ones.
 * - Kebab-case for any new tags.
 * - Grouping under established prefixes (e.g. ai/music-videos instead of ai-music-videos).
 */
export function buildTopicGenerationPrompt(summaryText: string, options?: GenerateTopicsOptions): string {
	const existingTags = (options?.existingTags || []).filter(t => t && typeof t === 'string' && t.trim().length > 0);
	const existingTagsStr = existingTags.length > 0
		? deduplicateTags(existingTags).join(', ')
		: '(none)';

	const vaultContext = options?.compressedContext || (options?.vaultTags && options.vaultTags.length > 0
		? options.vaultTags.join(', ')
		: '(none yet - feel free to create initial tags)');

	const groupPrefixesStr = options?.groupPrefixes && options.groupPrefixes.length > 0
		? `\nEstablished group prefixes in vault:\n${options.groupPrefixes.join(', ')}\n`
		: '';

	const titleStr = options?.title ? `Video Title: ${options.title}\n\n` : '';

	return `You are an expert content categorization assistant for Obsidian notes.

Analyze the video summary and existing metadata to generate 3 to 7 relevant tags.

Questions to answer:
1. What topic(s) does this video belong to?
2. Is there any obvious tag that is missing in the existing set of tags?

Existing tags already identified for this video:
${existingTagsStr}

Existing vault tags (cached tag list from whole vault):
${vaultContext}
${groupPrefixesStr}
Important rules:
- Always prefer to reuse a tag that already exists instead of creating a new one. Only create new tags when necessary if semantic meaning of the desired tag does not already exist in the cached tag list.
- Use kebab case for any new tags you create (lowercase words separated by hyphens).
- Group tags where it makes sense: If you find a large group prefix like ai/ then group the more specific part of the tag under that instead of creating an entirely new tag at the top level (e.g. "ai/music-videos" instead of "ai-music-videos").
- Return ONLY a comma-separated list of tags in lowercase (e.g. ai/music-videos, typescript, productivity). Do not include hashtags (#) or explanation.

${titleStr}Summary:
${summaryText.slice(0, 4000)}`;
}
