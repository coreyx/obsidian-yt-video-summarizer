import { StoredProvider } from './types';

// Models retired or shut down by Google
export const RETIRED_GEMINI_MODELS: readonly string[] = [
	'gemini-2.0-flash',
	'gemini-2.0-flash-lite',
	'gemini-2.0-flash-exp',
	'gemini-2.0-flash-thinking-exp',
	'gemini-1.5-pro',
	'gemini-1.5-pro-latest',
	'gemini-1.5-flash',
	'gemini-1.5-flash-latest',
	'gemini-1.5-flash-8b',
	'gemini-1.0-pro',
	'gemini-pro',
	'gemini-pro-vision'
];

// List of supported Gemini models
const DEFAULT_GEMINI_MODELS = [
	// Current Flagship / Recommended
	{
		name: 'gemini-3.8-flash',
		displayName: 'Gemini 3.8 Flash (Recommended)',
		pricing: 'Input $0.75 / Output $3.75 per 1M tokens ($1.50 / $7.50 standard)'
	},
	{
		name: 'gemini-3.5-flash',
		displayName: 'Gemini 3.5 Flash',
		pricing: 'Input $1.50 / Output $9.00 per 1M tokens'
	},
	{
		name: 'gemini-3.5-flash-lite',
		displayName: 'Gemini 3.5 Flash-Lite',
		pricing: 'Input $0.30 / Output $2.50 per 1M tokens'
	},
	{
		name: 'gemini-3.1-pro',
		displayName: 'Gemini 3.1 Pro',
		pricing: 'Input $2.00 / Output $12.00 per 1M tokens'
	},
	{
		name: 'gemini-3.1-flash-lite',
		displayName: 'Gemini 3.1 Flash-Lite',
		pricing: 'Input $0.25 / Output $1.50 per 1M tokens'
	},

	// Previews
	{
		name: 'gemini-3.1-pro-preview',
		displayName: 'Gemini 3.1 Pro Preview',
		pricing: 'Input $2.00 / Output $12.00 per 1M tokens; preview'
	},
	{
		name: 'gemini-3-flash-preview',
		displayName: 'Gemini 3 Flash Preview',
		pricing: 'Check Google pricing page; preview pricing may change'
	},
	{
		name: 'gemini-3-pro-preview',
		displayName: 'Gemini 3 Pro Preview',
		pricing: 'Check Google pricing page; preview pricing may change'
	},
	{
		name: 'gemini-3.1-flash-lite-preview',
		displayName: 'Gemini 3.1 Flash-Lite Preview',
		pricing: 'Check Google pricing page; preview pricing may change'
	},

	// Legacy (2.5 series)
	{
		name: 'gemini-2.5-pro',
		displayName: 'Gemini 2.5 Pro (Legacy)',
		pricing: 'Input $1.25 / Output $10.00 per 1M tokens <=200k; Input $2.50 / Output $15.00 >200k'
	},
	{
		name: 'gemini-2.5-flash',
		displayName: 'Gemini 2.5 Flash (Legacy)',
		pricing: 'Input $0.30 / Output $2.50 per 1M tokens'
	},
	{
		name: 'gemini-2.5-flash-lite',
		displayName: 'Gemini 2.5 Flash-Lite (Legacy)',
		pricing: 'Input $0.10 / Output $0.40 per 1M tokens'
	}
];

// Models retired or shut down by OpenAI
export const RETIRED_OPENAI_MODELS: readonly string[] = [
	'gpt-4-vision-preview',
	'gpt-4-0314',
	'gpt-4-0613',
	'gpt-4-32k-0314',
	'gpt-4-32k-0613',
	'gpt-3.5-turbo-0301',
	'gpt-3.5-turbo-0613',
	'gpt-3.5-turbo-16k-0613',
	'o1-preview'
];

// Models retired or shut down by Anthropic
export const RETIRED_ANTHROPIC_MODELS: readonly string[] = [
	'claude-sonnet-4-20250514',
	'claude-opus-4-20250514',
	'claude-3-5-sonnet-20241022',
	'claude-3-5-sonnet-20240620',
	'claude-3-5-haiku-20241022',
	'claude-3-opus-20240229',
	'claude-3-sonnet-20240229',
	'claude-3-haiku-20240307',
	'claude-2.1',
	'claude-2.0',
	'claude-instant-1.2'
];

const DEFAULT_OPENAI_MODELS = [
	// GPT-6 & GPT-5.6 Series
	{
		name: 'gpt-6',
		displayName: 'GPT-6 (Astra)',
		pricing: 'Input $10.00 / Output $50.00 per 1M tokens; cached input $1.00'
	},
	{
		name: 'gpt-5.6',
		displayName: 'GPT-5.6 (Sol)',
		pricing: 'Input $4.00 / Output $20.00 per 1M tokens'
	},
	{
		name: 'gpt-5.6-terra',
		displayName: 'GPT-5.6 Terra',
		pricing: 'Input $2.00 / Output $12.00 per 1M tokens'
	},
	{
		name: 'gpt-5.6-luna',
		displayName: 'GPT-5.6 Luna',
		pricing: 'Input $0.20 / Output $1.20 per 1M tokens'
	},

	// GPT-5.5 Series
	{
		name: 'gpt-5.5',
		displayName: 'GPT-5.5',
		pricing: 'Input $5.00 / Cached input $0.50 / Output $30.00 per 1M tokens; long context $10.00/$1.00/$45.00'
	},
	{
		name: 'gpt-5.5-pro',
		displayName: 'GPT-5.5 Pro',
		pricing: 'Input $30.00 / Output $180.00 per 1M tokens; long context $60.00/$270.00'
	},

	// GPT-5.4 Series
	{
		name: 'gpt-5.4',
		displayName: 'GPT-5.4',
		pricing: 'Input $2.50 / Cached input $0.25 / Output $15.00 per 1M tokens; long context $5.00/$0.50/$22.50'
	},
	{
		name: 'gpt-5.4-mini',
		displayName: 'GPT-5.4 Mini',
		pricing: 'Input $0.75 / Cached input $0.075 / Output $4.50 per 1M tokens'
	},
	{
		name: 'gpt-5.4-nano',
		displayName: 'GPT-5.4 Nano',
		pricing: 'Input $0.20 / Cached input $0.02 / Output $1.25 per 1M tokens'
	},
	{
		name: 'gpt-5.4-pro',
		displayName: 'GPT-5.4 Pro',
		pricing: 'Input $30.00 / Output $180.00 per 1M tokens; long context $60.00/$270.00'
	},

	// GPT-5.3 Series
	{
		name: 'gpt-5.3-chat-latest',
		displayName: 'GPT-5.3 Chat Latest',
		pricing: 'Input $1.75 / Cached input $0.175 / Output $14.00 per 1M tokens'
	},
	{
		name: 'gpt-5.3-codex',
		displayName: 'GPT-5.3 Codex',
		pricing: 'Input $1.75 / Cached input $0.175 / Output $14.00 per 1M tokens'
	},

	// GPT-4.1 Series
	{
		name: 'gpt-4.1',
		displayName: 'GPT-4.1',
		pricing: 'Input $2.00 / Output $8.00 per 1M tokens'
	},
	{
		name: 'gpt-4.1-mini',
		displayName: 'GPT-4.1 Mini',
		pricing: 'Input $0.40 / Output $1.60 per 1M tokens'
	},
	{
		name: 'gpt-4.1-nano',
		displayName: 'GPT-4.1 Nano',
		pricing: 'Input $0.10 / Output $0.40 per 1M tokens'
	},

	// Core Multimodal Workhorses
	{
		name: 'gpt-4o',
		displayName: 'GPT-4o',
		pricing: 'Input $2.50 / Output $10.00 per 1M tokens'
	},
	{
		name: 'gpt-4o-mini',
		displayName: 'GPT-4o Mini',
		pricing: 'Input $0.15 / Output $0.60 per 1M tokens'
	},

	// Reasoning Models
	{
		name: 'o3-mini',
		displayName: 'o3-mini',
		pricing: 'Input $1.10 / Output $4.40 per 1M tokens'
	},
	{
		name: 'o4-mini',
		displayName: 'o4-mini',
		pricing: 'Input $1.10 / Output $4.40 per 1M tokens'
	},
	{
		name: 'o1',
		displayName: 'o1',
		pricing: 'Input $15.00 / Output $60.00 per 1M tokens'
	},
	{
		name: 'o1-mini',
		displayName: 'o1-mini',
		pricing: 'Input $1.10 / Output $4.40 per 1M tokens'
	}
];

const DEFAULT_ANTHROPIC_MODELS = [
	// Current Flagships & Recommended Models
	{
		name: 'claude-sonnet-5-5',
		displayName: 'Claude Sonnet 5.5 (Recommended)',
		pricing: 'Input $2.00 / Output $10.00 per 1M tokens'
	},
	{
		name: 'claude-opus-5-5',
		displayName: 'Claude Opus 5.5',
		pricing: 'Input $4.00 / Output $20.00 per 1M tokens'
	},
	{
		name: 'claude-fable-5-1',
		displayName: 'Claude Fable 5.1',
		pricing: 'Input $10.00 / Output $50.00 per 1M tokens'
	},
	{
		name: 'claude-sonnet-5',
		displayName: 'Claude Sonnet 5',
		pricing: 'Input $3.00 / Output $15.00 per 1M tokens'
	},
	{
		name: 'claude-opus-5',
		displayName: 'Claude Opus 5',
		pricing: 'Input $5.00 / Output $25.00 per 1M tokens'
	},
	{
		name: 'claude-haiku-4-5-20251001',
		displayName: 'Claude Haiku 4.5',
		pricing: 'Input $1.00 / Output $5.00 per 1M tokens'
	},

	// Stable 4.x Generation
	{
		name: 'claude-opus-4-7',
		displayName: 'Claude Opus 4.7',
		pricing: 'Input $5.00 / Output $25.00 per 1M tokens'
	},
	{
		name: 'claude-sonnet-4-6',
		displayName: 'Claude Sonnet 4.6',
		pricing: 'Input $3.00 / Output $15.00 per 1M tokens'
	},
	{
		name: 'claude-opus-4-6',
		displayName: 'Claude Opus 4.6 Legacy',
		pricing: 'Input $5.00 / Output $25.00 per 1M tokens'
	},
	{
		name: 'claude-sonnet-4-5-20250929',
		displayName: 'Claude Sonnet 4.5 Legacy',
		pricing: 'Input $3.00 / Output $15.00 per 1M tokens'
	},
	{
		name: 'claude-opus-4-5-20251101',
		displayName: 'Claude Opus 4.5 Legacy',
		pricing: 'Input $5.00 / Output $25.00 per 1M tokens'
	},
	{
		name: 'claude-opus-4-1-20250805',
		displayName: 'Claude Opus 4.1 Legacy',
		pricing: 'Input $15.00 / Output $75.00 per 1M tokens'
	}
];

export const DEFAULT_SELECTED_MODEL = 'Gemini:gemini-3.8-flash';

export const DEFAULT_PROVIDERS: StoredProvider[] = [
	{
		name: 'Gemini',
		type: 'gemini',
		isBuiltIn: true,
		apiKey: '',
		models: DEFAULT_GEMINI_MODELS
	},
	{
		name: 'OpenAI',
		type: 'openai',
		isBuiltIn: true,
		apiKey: '',
		models: DEFAULT_OPENAI_MODELS
	},
	{
		name: 'Anthropic',
		type: 'anthropic',
		isBuiltIn: true,
		apiKey: '',
		models: DEFAULT_ANTHROPIC_MODELS
	}
];

// Default prompt for video analysis
export const DEFAULT_PROMPT = `You are a specialized assistant for creating comprehensive video summaries from subtitles. The subtitles have been automatically generated by YouTube and may contain transcription errors, especially with technical terms, software names, and specialized vocabulary.

## Task

Create a concise yet comprehensive summary of the video based on the provided subtitles.

## Handling Transcription Errors

- Correct obvious transcription errors based on context and your domain knowledge
- Pay special attention to technical terms, software names, programming languages, and IDE plugins which are frequently misrecognized
- If multiple interpretations are possible, choose the most likely one based on the video's context

## Output Structure

` + "```" + `
## Summary
[Write a comprehensive summary of the main topic and key message]

## Key points
- [Key point 1]
- [Key point 2]
- [Additional key points...]

## Technical terms
- **[[Term 1]]**: [Explanation of term 1]
- **[[Term 2]]**: [Explanation of term 2]
- [Additional terms as needed...]

## Conclusion
[Write a brief conclusion]
` + "```" + `

Note: Include all sections. If there are no technical terms, omit that section entirely.`;

export const DEFAULT_MAX_TOKENS = 10000;
export const DEFAULT_TEMPERATURE = 1;

export const DEFAULT_INCLUDE_VIDEO_DESCRIPTION = false;
export const DEFAULT_ADD_TOPICS_AS_TAGS = true;
export const DEFAULT_DETECT_TAGS_IN_DESCRIPTION_AND_TITLE = true;
export const DEFAULT_ADD_TAGS_TO_FRONTMATTER = true;
export const DEFAULT_ADD_INLINE_TAGS = false;
export const DEFAULT_SET_NOTE_TITLE_FROM_VIDEO = true;
export const DEFAULT_INCLUDE_TITLE_IN_BODY = false;
export const DEFAULT_LINK_TECHNICAL_TERMS = true;
export const DEFAULT_DUMP_TRANSCRIPT_IN_SUMMARY = false;
export const DEFAULT_EXTRACT_YOUTUBE_DATA_API_TAGS = true;
export const DEFAULT_YOUTUBE_API_KEY = '';
export const DEFAULT_CREATE_MEDIA_EXTENDED_NOTES = true;
export const DEFAULT_MEDIA_EXTENDED_FOLDER = 'Media Library';
export const DEFAULT_MEDIA_EXTENDED_INCLUDE_DESCRIPTION = true;
export const DEFAULT_MEDIA_EXTENDED_INCLUDE_TRANSCRIPT = true;
export const DEFAULT_ADD_DESCRIPTION_TO_FRONTMATTER = true;
export const DEFAULT_DISCOVER_PLAYLIST = true;
export const DEFAULT_SCAN_FOLDERS = '';
export const DEFAULT_LM_STUDIO_URL = 'http://localhost:1234/v1';



