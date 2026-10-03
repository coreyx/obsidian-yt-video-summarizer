/** The type of AI provider */
export type ProviderType = "openai" | "anthropic" | "gemini";

interface BaseProvider {
	name: string;
	type: ProviderType;
	isBuiltIn: boolean;
	apiKey: string;
	url?: string;
}
/** Configuration for an AI provider */
export interface ProviderConfig extends BaseProvider {
	models?: ModelConfig[];
}

/** Configuration for an AI model */
export interface ModelConfig {
	name: string; // unique
	displayName?: string;
	pricing?: string;
	provider: ProviderConfig;
}

/** Stored model configuration without provider reference */
export interface StoredModel {
	name: string;
	displayName: string;
	pricing?: string;
}

/** Stored provider configuration with associated models */
export interface StoredProvider extends BaseProvider {
	models: StoredModel[];
}

/** Stored settings configuration */
export interface StoredSettings {
	providers: StoredProvider[];
	selectedModelId: string | null; // "Provider:Model"
	customPrompt: string;
	maxTokens: number;
	temperature: number;
	includeVideoDescription?: boolean;
	addTopicsAsTags?: boolean;
	detectTagsInDescriptionAndTitle?: boolean;
	addTagsToFrontmatter?: boolean;
	addInlineTags?: boolean;
	setNoteTitleFromVideo?: boolean;
	videoSummaryFolder?: string;
	includeTitleInBody?: boolean;
	linkTechnicalTerms?: boolean;
	dumpTranscriptInSummary?: boolean;
	extractYouTubeDataApiTags?: boolean;
	youtubeApiKey?: string;
	createMediaExtendedNotes?: boolean;
	mediaExtendedFolder?: string;
	mediaExtendedIncludeDescription?: boolean;
	mediaExtendedIncludeTranscript?: boolean;
	mediaExtendedDescriptionFromFrontmatter?: boolean;
	addDescriptionToFrontmatter?: boolean;
	discoverPlaylist?: boolean;
	scanFolders?: string;
	lmStudioUrl?: string;
}

/** Per-run Media Extended companion note options chosen in the URL / prompt modals (do not change permanent settings) */
export interface MediaExtendedRunOptions {
	createNote: boolean;
	includeDescription: boolean;
	includeTranscript: boolean;
}


/** Represents the plugin settings and provides methods to manage them */
export interface PluginSettings {
	/** Loads the settings from the plugin */
	loadSettings(): Promise<void>;
	/** Gets the currently selected model */
	getSelectedModel(): ModelConfig | null;

	/** Gets all available providers */
	getProviders(): ProviderConfig[];

	/** Gets all available models across all providers */
	getModels(): ModelConfig[];

	/** Gets the custom prompt template */
	getCustomPrompt(): string;

	/** Gets the maximum number of tokens for API requests */
	getMaxTokens(): number;

	/** Gets the temperature setting for API requests */
	getTemperature(): number;

	/** Adds a new provider */
	addProvider(provider: ProviderConfig): void;

	/** Adds a new model to a provider */
	addModel(model: ModelConfig): void;

	/** Updates an existing provider */
	updateProvider(provider: ProviderConfig, originalName: string): void;

	/** Updates an existing model */
	updateModel(modelName: string, modelDisplayName: string, providerName: string): void;

	/** Deletes a provider if it has no associated models */
	deleteProvider(provider: ProviderConfig): void;

	/** Deletes a model */
	deleteModel(providerName: string, modelName: string): void;

	/** Updates the selected model */
	updateActiveModel(modelId: string): Promise<void>;

	/** Updates the custom prompt template */
	updateCustomPrompt(prompt: string): void;

	/** Updates the maximum number of tokens */
	updateMaxTokens(tokens: number): void;

	/** Updates the temperature setting */
	updateTemperature(temperature: number): void;

	/** Saves the API key for a provider without validation */
	saveProviderKey(providerName: string, key: string): Promise<void>;

	getIncludeVideoDescription(): boolean;
	updateIncludeVideoDescription(value: boolean): void;

	getAddTopicsAsTags(): boolean;
	updateAddTopicsAsTags(value: boolean): void;

	getDetectTagsInDescriptionAndTitle(): boolean;
	updateDetectTagsInDescriptionAndTitle(value: boolean): void;

	getAddTagsToFrontmatter(): boolean;
	updateAddTagsToFrontmatter(value: boolean): void;

	getAddInlineTags(): boolean;
	updateAddInlineTags(value: boolean): void;

	getSetNoteTitleFromVideo(): boolean;
	updateSetNoteTitleFromVideo(value: boolean): void;

	getVideoSummaryFolder(): string;
	updateVideoSummaryFolder(value: string): void;

	getIncludeTitleInBody(): boolean;
	updateIncludeTitleInBody(value: boolean): void;

	getLinkTechnicalTerms(): boolean;
	updateLinkTechnicalTerms(value: boolean): void;

	getDumpTranscriptInSummary(): boolean;
	updateDumpTranscriptInSummary(value: boolean): void;

	getExtractYouTubeDataApiTags(): boolean;
	updateExtractYouTubeDataApiTags(value: boolean): void;

	getYoutubeApiKey(): string;
	updateYoutubeApiKey(value: string): void;

	getCreateMediaExtendedNotes(): boolean;
	updateCreateMediaExtendedNotes(value: boolean): void;

	getMediaExtendedFolder(): string;
	updateMediaExtendedFolder(value: string): void;

	getMediaExtendedIncludeDescription(): boolean;
	updateMediaExtendedIncludeDescription(value: boolean): void;

	getMediaExtendedIncludeTranscript(): boolean;
	updateMediaExtendedIncludeTranscript(value: boolean): void;

	getMediaExtendedDescriptionFromFrontmatter(): boolean;
	updateMediaExtendedDescriptionFromFrontmatter(value: boolean): void;

	getAddDescriptionToFrontmatter(): boolean;
	updateAddDescriptionToFrontmatter(value: boolean): void;

	getDiscoverPlaylist(): boolean;
	updateDiscoverPlaylist(value: boolean): void;

	getScanFolders(): string;
	updateScanFolders(value: string): Promise<void>;
	getScanFolderList(): string[];

	getLmStudioUrl(): string;
	updateLmStudioUrl(value: string): Promise<void>;
	syncLMStudioProvider(url: string, models: Array<{ id: string; displayName?: string; isLoaded?: boolean }>): Promise<{ provider: StoredProvider; modelCount: number; activeModelId: string | null }>;

	/**
	 * Validates a model ID.
	 * Correct format is "ProviderName:ModelName". Check that provider and model exist.
	 * 
	 * @param modelId - The model ID to validate.
	 * @returns True if the model ID is valid, false otherwise.
	 */
	validateModelId(modelId: string): boolean;
}

/** Playlist metadata */
export interface PlaylistInfo {
	id: string;
	title?: string;
	url: string;
	index?: number;
	count?: number;
}

/** Video metadata without captions or transcripts */
export interface VideoMetadata {
	url: string;
	videoId: string;
	channelId?: string;
	title: string;
	author: string;
	channelUrl: string;
	channelUsername?: string;
	description?: string;
	tags?: string[];
	duration?: number;
	publishedAt?: string;
	viewCount?: number;
	likeCount?: number;
	aspectRatio?: string;
	playlist?: PlaylistInfo;
}

/** Represents a single line of video transcript with timing information */
export interface TranscriptLine {
	text: string;
	duration: number;
	offset: number;
}

/** Response structure for video transcript and metadata */
export interface TranscriptResponse {
	url: string;
	videoId: string;
	channelId?: string;
	title: string;
	author: string;
	channelUrl: string;
	channelUsername?: string;
	description?: string;
	tags?: string[];
	duration?: number;
	publishedAt?: string;
	viewCount?: number;
	likeCount?: number;
	aspectRatio?: string;
	lines: TranscriptLine[];
	playlist?: PlaylistInfo;
}

/** Available thumbnail quality options with dimensions */
export interface ThumbnailQuality {
	default: string; // 120x90
	medium: string; // 320x180
	high: string; // 480x360
	standard: string; // 640x480
	maxres: string; // 1280x720
}

/** Options passed to AI topic generation */
export interface GenerateTopicsOptions {
	existingTags?: string[];
	vaultTags?: string[];
	groupPrefixes?: string[];
	compressedContext?: string;
	title?: string;
}

/** Vault tag cache structure */
export interface VaultTagData {
	tags: string[];
	groupPrefixes: string[];
	compressedContext: string;
	totalCount: number;
}

export interface AIModelProvider {
	testConnection(): Promise<boolean>;
	summarizeVideo(videoId: string, prompt: string): Promise<string>;
	extractThumbnailText?(imageBase64: string, mimeType?: string): Promise<string>;
	generateTopics?(summaryText: string, options?: GenerateTopicsOptions): Promise<string[]>;
}

/** Transcript configuration options */
export interface TranscriptConfig {
	lang?: string;
	country?: string;
}

/** Transcript request structure */
export interface TranscriptRequest {
	url: string;
	headers: Record<string, string>;
	body: string;
}

/** Video data structure with transcript requests */
export interface VideoData {
	title: string;
	transcriptRequests: TranscriptRequest[];
}

/** Result of an individual note processed in a batch operation */
export interface BatchItemResult {
	filePath: string;
	fileName: string;
	url?: string;
	status: 'success' | 'skipped' | 'error';
	message: string;
	timestamp?: number;
}

/** Complete report of a batch operation execution */
export interface BatchOperationReport {
	operationName: string;
	scope: string;
	startTime: number;
	endTime?: number;
	total: number;
	succeeded: number;
	skipped: number;
	failed: number;
	items: BatchItemResult[];
}
