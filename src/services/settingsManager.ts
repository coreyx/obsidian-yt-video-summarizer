import YouTubeSummarizerPlugin from "src/main";
import { Notice } from "obsidian";
import { ModelConfig, PluginSettings, ProviderConfig, StoredModel, StoredProvider, StoredSettings } from "src/types";
import {
    DEFAULT_PROVIDERS,
    DEFAULT_SELECTED_MODEL,
    DEFAULT_PROMPT,
    DEFAULT_MAX_TOKENS,
    DEFAULT_TEMPERATURE,
    DEFAULT_INCLUDE_VIDEO_DESCRIPTION,
    DEFAULT_ADD_TOPICS_AS_TAGS,
    DEFAULT_DETECT_TAGS_IN_DESCRIPTION_AND_TITLE,
    DEFAULT_ADD_TAGS_TO_FRONTMATTER,
    DEFAULT_ADD_INLINE_TAGS,
    DEFAULT_SET_NOTE_TITLE_FROM_VIDEO,
    DEFAULT_INCLUDE_TITLE_IN_BODY,
    DEFAULT_LINK_TECHNICAL_TERMS,
    DEFAULT_DUMP_TRANSCRIPT_IN_SUMMARY,
    DEFAULT_LINK_TRANSCRIPT_TIMESTAMPS,
    DEFAULT_MEDIA_EXTENDED_TIMESTAMPS,
    DEFAULT_EXTRACT_YOUTUBE_DATA_API_TAGS,
    DEFAULT_YOUTUBE_API_KEY,
    DEFAULT_CREATE_MEDIA_EXTENDED_NOTES,
    DEFAULT_MEDIA_EXTENDED_FOLDER,
    DEFAULT_ADD_DESCRIPTION_TO_FRONTMATTER,
    DEFAULT_DISCOVER_PLAYLIST,
    DEFAULT_SCAN_FOLDERS,
    RETIRED_GEMINI_MODELS,
    RETIRED_ANTHROPIC_MODELS,
    RETIRED_OPENAI_MODELS,
} from "src/defaults";
import { parseFolderList } from "src/utils/frontmatter";


/** Manages plugin settings and provides methods to interact with them */
export class SettingsManager implements PluginSettings {
    private plugin: YouTubeSummarizerPlugin;
    private settings: StoredSettings;

    /** Creates a new instance of SettingsManager */
    public constructor(plugin: YouTubeSummarizerPlugin) {
        this.plugin = plugin;
        // loading default settings
        this.settings = {
            providers: this.cloneProviders(DEFAULT_PROVIDERS),
            selectedModelId: DEFAULT_SELECTED_MODEL,
            customPrompt: DEFAULT_PROMPT,
            maxTokens: DEFAULT_MAX_TOKENS,
            temperature: DEFAULT_TEMPERATURE,
            includeVideoDescription: DEFAULT_INCLUDE_VIDEO_DESCRIPTION,
            addTopicsAsTags: DEFAULT_ADD_TOPICS_AS_TAGS,
            detectTagsInDescriptionAndTitle: DEFAULT_DETECT_TAGS_IN_DESCRIPTION_AND_TITLE,
            addTagsToFrontmatter: DEFAULT_ADD_TAGS_TO_FRONTMATTER,
            addInlineTags: DEFAULT_ADD_INLINE_TAGS,
            setNoteTitleFromVideo: DEFAULT_SET_NOTE_TITLE_FROM_VIDEO,
            includeTitleInBody: DEFAULT_INCLUDE_TITLE_IN_BODY,
            linkTechnicalTerms: DEFAULT_LINK_TECHNICAL_TERMS,
            dumpTranscriptInSummary: DEFAULT_DUMP_TRANSCRIPT_IN_SUMMARY,
            linkTranscriptTimestamps: DEFAULT_LINK_TRANSCRIPT_TIMESTAMPS,
            mediaExtendedTimestamps: DEFAULT_MEDIA_EXTENDED_TIMESTAMPS,
            extractYouTubeDataApiTags: DEFAULT_EXTRACT_YOUTUBE_DATA_API_TAGS,
            youtubeApiKey: DEFAULT_YOUTUBE_API_KEY,
            createMediaExtendedNotes: DEFAULT_CREATE_MEDIA_EXTENDED_NOTES,
            mediaExtendedFolder: DEFAULT_MEDIA_EXTENDED_FOLDER,
            addDescriptionToFrontmatter: DEFAULT_ADD_DESCRIPTION_TO_FRONTMATTER,
            discoverPlaylist: DEFAULT_DISCOVER_PLAYLIST,
            scanFolders: DEFAULT_SCAN_FOLDERS,
        };
    }

    public async loadSettings(): Promise<void> {
        const loaded = await this.plugin.loadData();
        if (!loaded) {
            return;
        }

        // Support both wrapped { settings: { ... } } and direct/flat { ... } format
        const rawSettings = (loaded.settings && typeof loaded.settings === 'object') ? loaded.settings : loaded;

        // Check for any legacy or manually entered top-level API key
        const legacyKey = rawSettings.geminiApiKey || loaded.geminiApiKey || rawSettings.apiKey || loaded.apiKey;

        if (Array.isArray(rawSettings.providers)) {
            // Settings are in new format with providers array
            this.settings = {
                providers: rawSettings.providers,
                selectedModelId: rawSettings.selectedModelId ?? this.settings.selectedModelId,
                customPrompt: rawSettings.customPrompt ?? this.settings.customPrompt,
                maxTokens: rawSettings.maxTokens ?? this.settings.maxTokens,
                temperature: rawSettings.temperature ?? this.settings.temperature,
                includeVideoDescription: rawSettings.includeVideoDescription ?? this.settings.includeVideoDescription,
                addTopicsAsTags: rawSettings.addTopicsAsTags ?? this.settings.addTopicsAsTags,
                detectTagsInDescriptionAndTitle: rawSettings.detectTagsInDescriptionAndTitle ?? this.settings.detectTagsInDescriptionAndTitle,
                addTagsToFrontmatter: rawSettings.addTagsToFrontmatter ?? this.settings.addTagsToFrontmatter,
                addInlineTags: rawSettings.addInlineTags ?? this.settings.addInlineTags,
                setNoteTitleFromVideo: rawSettings.setNoteTitleFromVideo ?? this.settings.setNoteTitleFromVideo,
                includeTitleInBody: rawSettings.includeTitleInBody ?? this.settings.includeTitleInBody,
                linkTechnicalTerms: rawSettings.linkTechnicalTerms ?? this.settings.linkTechnicalTerms,
                dumpTranscriptInSummary: rawSettings.dumpTranscriptInSummary ?? this.settings.dumpTranscriptInSummary,
                linkTranscriptTimestamps: rawSettings.linkTranscriptTimestamps ?? this.settings.linkTranscriptTimestamps,
                mediaExtendedTimestamps: rawSettings.mediaExtendedTimestamps ?? this.settings.mediaExtendedTimestamps,
                extractYouTubeDataApiTags: rawSettings.extractYouTubeDataApiTags ?? this.settings.extractYouTubeDataApiTags,
                youtubeApiKey: rawSettings.youtubeApiKey ?? this.settings.youtubeApiKey,
                createMediaExtendedNotes: rawSettings.createMediaExtendedNotes ?? this.settings.createMediaExtendedNotes,
                mediaExtendedFolder: rawSettings.mediaExtendedFolder ?? this.settings.mediaExtendedFolder,
                addDescriptionToFrontmatter: rawSettings.addDescriptionToFrontmatter ?? this.settings.addDescriptionToFrontmatter,
                discoverPlaylist: rawSettings.discoverPlaylist ?? this.settings.discoverPlaylist,
                scanFolders: rawSettings.scanFolders ?? this.settings.scanFolders,
            };

            // If a top-level/legacy key was supplied and Gemini provider has no key yet, populate it
            if (legacyKey) {
                const geminiProvider = this.settings.providers.find(p => p.name.toLowerCase() === 'gemini' || p.type === 'gemini');
                if (geminiProvider && !geminiProvider.apiKey) {
                    geminiProvider.apiKey = legacyKey;
                }
            }
        } else {
            // Migrating from old format (e.g. { geminiApiKey: "..." }) or manual config without providers array
            const providers = this.cloneProviders(DEFAULT_PROVIDERS);
            if (legacyKey) {
                const geminiProvider = providers.find(p => p.name === 'Gemini');
                if (geminiProvider) {
                    geminiProvider.apiKey = legacyKey;
                }
            }

            this.settings = {
                providers,
                selectedModelId: rawSettings.selectedModelId ?? rawSettings.selectedModel ?? this.settings.selectedModelId,
                customPrompt: rawSettings.customPrompt ?? this.settings.customPrompt,
                maxTokens: rawSettings.maxTokens ?? this.settings.maxTokens,
                temperature: rawSettings.temperature ?? this.settings.temperature,
                includeVideoDescription: rawSettings.includeVideoDescription ?? this.settings.includeVideoDescription,
                addTopicsAsTags: rawSettings.addTopicsAsTags ?? this.settings.addTopicsAsTags,
                detectTagsInDescriptionAndTitle: rawSettings.detectTagsInDescriptionAndTitle ?? this.settings.detectTagsInDescriptionAndTitle,
                addTagsToFrontmatter: rawSettings.addTagsToFrontmatter ?? this.settings.addTagsToFrontmatter,
                addInlineTags: rawSettings.addInlineTags ?? this.settings.addInlineTags,
                setNoteTitleFromVideo: rawSettings.setNoteTitleFromVideo ?? this.settings.setNoteTitleFromVideo,
                includeTitleInBody: rawSettings.includeTitleInBody ?? this.settings.includeTitleInBody,
                linkTechnicalTerms: rawSettings.linkTechnicalTerms ?? this.settings.linkTechnicalTerms,
                dumpTranscriptInSummary: rawSettings.dumpTranscriptInSummary ?? this.settings.dumpTranscriptInSummary,
                linkTranscriptTimestamps: rawSettings.linkTranscriptTimestamps ?? this.settings.linkTranscriptTimestamps,
                mediaExtendedTimestamps: rawSettings.mediaExtendedTimestamps ?? this.settings.mediaExtendedTimestamps,
                extractYouTubeDataApiTags: rawSettings.extractYouTubeDataApiTags ?? this.settings.extractYouTubeDataApiTags,
                youtubeApiKey: rawSettings.youtubeApiKey ?? this.settings.youtubeApiKey,
                createMediaExtendedNotes: rawSettings.createMediaExtendedNotes ?? this.settings.createMediaExtendedNotes,
                mediaExtendedFolder: rawSettings.mediaExtendedFolder ?? this.settings.mediaExtendedFolder,
                addDescriptionToFrontmatter: rawSettings.addDescriptionToFrontmatter ?? this.settings.addDescriptionToFrontmatter,
                discoverPlaylist: rawSettings.discoverPlaylist ?? this.settings.discoverPlaylist,
                scanFolders: rawSettings.scanFolders ?? this.settings.scanFolders,
            };

            await this.saveData();
        }

        const syncedBuiltIns = this.syncBuiltInProviders();
        if (syncedBuiltIns) {
            await this.saveData();
        }
    }

    /** Gets the currently selected model */
    getSelectedModel(): ModelConfig | null {
        if (!this.settings.selectedModelId) return null;

        const found = this.findModelAndProvider(this.settings.selectedModelId);
        if (!found) return null;

        return this.convertToModelConfig(found.model, found.provider);
    }

    /** Gets all available providers */
    getProviders(): ProviderConfig[] {
        return this.settings.providers.map(provider => ({
            name: provider.name,
            type: provider.type,
            isBuiltIn: provider.isBuiltIn,
            apiKey: provider.apiKey,
            url: provider.url,
            models: provider.models.map(model => this.convertToModelConfig(model, provider))
        }));
    }

    /** Gets all available models across all providers */
    getModels(): ModelConfig[] {
        return this.settings.providers.flatMap(provider =>
            provider.models.map(model => this.convertToModelConfig(model, provider))
        );
    }

    /** Gets the custom prompt template */
    getCustomPrompt(): string {
        return this.settings.customPrompt;
    }

    /** Gets the maximum number of tokens for API requests */
    getMaxTokens(): number {
        return this.settings.maxTokens;
    }

    /** Gets the temperature setting for API requests */
    getTemperature(): number {
        return this.settings.temperature;
    }

    /** Adds a new provider */
    addProvider(provider: ProviderConfig): void {
        const storedProvider: StoredProvider = {
            ...provider,
            models: []
        };

        if (!this.validateProvider(storedProvider)) {
            throw new Error('Invalid provider configuration');
        }

        this.settings.providers.push(storedProvider);
        this.saveData();
    }

    /** Adds a new model to a provider */
    addModel(model: ModelConfig): void {
        const provider = this.settings.providers.find(p => p.name === model.provider.name);
        if (!provider) {
            throw new Error('Provider not found');
        }

        const storedModel: StoredModel = {
            name: model.name,
            displayName: model.displayName || model.name,
            pricing: model.pricing
        };

        if (!this.validateModel(storedModel, provider)) {
            throw new Error('Invalid model configuration');
        }

        provider.models.push(storedModel);
        this.saveData();
    }

    /** Updates an existing provider */
    updateProvider(provider: ProviderConfig, originalName: string): void {
        const storedProvider = this.settings.providers.find(p => p.name === originalName);
        if (!storedProvider) {
            throw new Error('Provider not found');
        }

        const updatedProvider: StoredProvider = {
            ...provider,
            models: storedProvider.models
        };

        if (!this.validateProvider(updatedProvider, originalName)) {
            throw new Error('Invalid provider configuration');
        }

        const index = this.settings.providers.indexOf(storedProvider);
        this.settings.providers[index] = updatedProvider;
        this.saveData();
    }

    /** Updates an existing model */
    updateModel(modelName: string, modelDisplayName: string, providerName: string): void {
        const provider = this.settings.providers.find(p => p.name === providerName);
        if (!provider) {
            throw new Error('Provider not found');
        }

        const model = provider.models.find(m => m.name === modelName);
        if (!model) {
            throw new Error('Model not found');
        }

        const storedModel: StoredModel = {
            name: modelName,
            displayName: modelDisplayName,
            pricing: model.pricing
        };

        if (!this.validateModel(storedModel, provider, modelName)) {
            throw new Error('Invalid model configuration');
        }

        // Update the model
        model.displayName = modelDisplayName;
        this.saveData();
    }

    /** Deletes a provider */
    deleteProvider(provider: ProviderConfig): void {
        const storedProvider = this.settings.providers.find(p => p.name === provider.name);
        if (!storedProvider) {
            throw new Error('Provider not found');
        }

        if (storedProvider.models.length > 0) {
            // remove all models associated with this provider
            storedProvider.models.forEach(model => {
                this.deleteModel(storedProvider.name, model.name);
            });
        }

        const index = this.settings.providers.indexOf(storedProvider);
        this.settings.providers.splice(index, 1);
        this.saveData();
    }

    /** Deletes a model */
    deleteModel(providerName: string, modelName: string): void {
        // Найдем провайдера по имени
        const provider = this.settings.providers.find(p => p.name === providerName);

        if (!provider) {
            throw new Error(`Provider not found: ${providerName}`);
        }

        // Найдем модель по имени (которое раньше было id)
        const index = provider.models.findIndex(m => m.name === modelName);

        if (index === -1) {
            throw new Error(`Model not found: ${modelName}`);
        }

        // Если это была активная модель, сбросим выбор
        if (this.settings.selectedModelId === this.makeModelId(providerName, modelName)) {
            this.settings.selectedModelId = null;
        }

        // Удалим модель из списка
        provider.models.splice(index, 1);
        this.saveData();
    }

    /** Updates the custom prompt template */
    updateCustomPrompt(prompt: string): void {
        this.settings.customPrompt = prompt;
        this.saveData();
    }

    /** Updates the maximum number of tokens */
    updateMaxTokens(tokens: number): void {
        this.settings.maxTokens = tokens;
        this.saveData();
    }

    /** Updates the temperature setting */
    updateTemperature(temperature: number): void {
        this.settings.temperature = temperature;
        this.saveData();
    }


    async updateActiveModel(modelId: string): Promise<void> {
        this.settings.selectedModelId = modelId;
        await this.saveData();
    }

    /** Saves the API key for a provider without validation */
    async saveProviderKey(providerName: string, key: string): Promise<void> {
        const provider = this.settings.providers.find(p => p.name === providerName);
        if (!provider) {
            throw new Error('Provider not found');
        }

        provider.apiKey = key;
        await this.saveData();
    }

    getIncludeVideoDescription(): boolean {
        return this.settings.includeVideoDescription ?? DEFAULT_INCLUDE_VIDEO_DESCRIPTION;
    }

    updateIncludeVideoDescription(value: boolean): void {
        this.settings.includeVideoDescription = value;
        this.saveData();
    }

    getAddTopicsAsTags(): boolean {
        return this.settings.addTopicsAsTags ?? DEFAULT_ADD_TOPICS_AS_TAGS;
    }

    updateAddTopicsAsTags(value: boolean): void {
        this.settings.addTopicsAsTags = value;
        this.saveData();
    }

    getDetectTagsInDescriptionAndTitle(): boolean {
        return this.settings.detectTagsInDescriptionAndTitle ?? DEFAULT_DETECT_TAGS_IN_DESCRIPTION_AND_TITLE;
    }

    updateDetectTagsInDescriptionAndTitle(value: boolean): void {
        this.settings.detectTagsInDescriptionAndTitle = value;
        this.saveData();
    }

    getAddTagsToFrontmatter(): boolean {
        return this.settings.addTagsToFrontmatter ?? DEFAULT_ADD_TAGS_TO_FRONTMATTER;
    }

    updateAddTagsToFrontmatter(value: boolean): void {
        this.settings.addTagsToFrontmatter = value;
        this.saveData();
    }

    getAddInlineTags(): boolean {
        return this.settings.addInlineTags ?? DEFAULT_ADD_INLINE_TAGS;
    }

    updateAddInlineTags(value: boolean): void {
        this.settings.addInlineTags = value;
        this.saveData();
    }

    getSetNoteTitleFromVideo(): boolean {
        return this.settings.setNoteTitleFromVideo ?? DEFAULT_SET_NOTE_TITLE_FROM_VIDEO;
    }

    updateSetNoteTitleFromVideo(value: boolean): void {
        this.settings.setNoteTitleFromVideo = value;
        this.saveData();
    }

    getIncludeTitleInBody(): boolean {
        return this.settings.includeTitleInBody ?? DEFAULT_INCLUDE_TITLE_IN_BODY;
    }

    updateIncludeTitleInBody(value: boolean): void {
        this.settings.includeTitleInBody = value;
        this.saveData();
    }

    getLinkTechnicalTerms(): boolean {
        return this.settings.linkTechnicalTerms ?? DEFAULT_LINK_TECHNICAL_TERMS;
    }

    updateLinkTechnicalTerms(value: boolean): void {
        this.settings.linkTechnicalTerms = value;
        this.saveData();
    }

    getDumpTranscriptInSummary(): boolean {
        return this.settings.dumpTranscriptInSummary ?? DEFAULT_DUMP_TRANSCRIPT_IN_SUMMARY;
    }

    updateDumpTranscriptInSummary(value: boolean): void {
        this.settings.dumpTranscriptInSummary = value;
        this.saveData();
    }

    getLinkTranscriptTimestamps(): boolean {
        return this.settings.linkTranscriptTimestamps ?? DEFAULT_LINK_TRANSCRIPT_TIMESTAMPS;
    }

    updateLinkTranscriptTimestamps(value: boolean): void {
        this.settings.linkTranscriptTimestamps = value;
        this.saveData();
    }

    getMediaExtendedTimestamps(): boolean {
        return this.settings.mediaExtendedTimestamps ?? DEFAULT_MEDIA_EXTENDED_TIMESTAMPS;
    }

    updateMediaExtendedTimestamps(value: boolean): void {
        this.settings.mediaExtendedTimestamps = value;
        this.saveData();
    }

    getExtractYouTubeDataApiTags(): boolean {
        return this.settings.extractYouTubeDataApiTags ?? DEFAULT_EXTRACT_YOUTUBE_DATA_API_TAGS;
    }

    updateExtractYouTubeDataApiTags(value: boolean): void {
        this.settings.extractYouTubeDataApiTags = value;
        this.saveData();
    }

    getYoutubeApiKey(): string {
        return this.settings.youtubeApiKey ?? DEFAULT_YOUTUBE_API_KEY;
    }

    updateYoutubeApiKey(value: string): void {
        this.settings.youtubeApiKey = value;
        this.saveData();
    }

    getCreateMediaExtendedNotes(): boolean {
        return this.settings.createMediaExtendedNotes ?? DEFAULT_CREATE_MEDIA_EXTENDED_NOTES;
    }

    updateCreateMediaExtendedNotes(value: boolean): void {
        this.settings.createMediaExtendedNotes = value;
        this.saveData();
    }

    getMediaExtendedFolder(): string {
        return this.settings.mediaExtendedFolder ?? DEFAULT_MEDIA_EXTENDED_FOLDER;
    }

    updateMediaExtendedFolder(value: string): void {
        this.settings.mediaExtendedFolder = value;
        this.saveData();
    }

    getAddDescriptionToFrontmatter(): boolean {
        return this.settings.addDescriptionToFrontmatter ?? DEFAULT_ADD_DESCRIPTION_TO_FRONTMATTER;
    }

    updateAddDescriptionToFrontmatter(value: boolean): void {
        this.settings.addDescriptionToFrontmatter = value;
        this.saveData();
    }

    getDiscoverPlaylist(): boolean {
        return this.settings.discoverPlaylist ?? DEFAULT_DISCOVER_PLAYLIST;
    }

    updateDiscoverPlaylist(value: boolean): void {
        this.settings.discoverPlaylist = value;
        this.saveData();
    }

    getScanFolders(): string {
        return this.settings.scanFolders ?? DEFAULT_SCAN_FOLDERS;
    }

    getScanFolderList(): string[] {
        return parseFolderList(this.getScanFolders());
    }

    async updateScanFolders(value: string): Promise<void> {
        this.settings.scanFolders = value;
        await this.saveData();
    }


    private async saveData(): Promise<void> {
        try {
            await this.plugin.saveData({
                settings: this.settings
            });
        } catch (error) {
            new Notice('Failed to save settings');
            console.error('Failed to save settings:', error);
        }
    }

    private validateProvider(provider: StoredProvider, originalName?: string): boolean {
        if (!provider.name || !provider.type) {
            return false;
        }

        // Check that provider name doesn't contain semicolon
        if (provider.name.includes(':')) {
            new Notice('Provider validation failed: name contains semicolon');
            console.error('Provider validation failed: name contains semicolon', provider.name);
            return false;
        }

        // Check name uniqueness, but allow the provider to keep its own name during updates
        const existingProvider = this.settings.providers.find(p => p.name === provider.name);
        if (existingProvider && (!originalName || provider.name !== originalName)) {
            new Notice('Provider validation failed: name not unique');
            return false;
        }

        return true;
    }

    private validateModel(model: StoredModel, provider: StoredProvider, originalName?: string): boolean {
        // Check that the model has required fields
        if (!model.name || !model.displayName) {
            new Notice('Model validation failed: missing name or display name');
            console.error('Model validation failed: missing name or display name', model);
            return false;
        }

        const existingModel = provider.models.find(m => m.name === model.name);
        if (existingModel && (!originalName || existingModel.name !== originalName)) {
            new Notice('Model validation failed: name must be unique within provider');
            console.error('Model validation failed: name must be unique within provider', model);
            return false;
        }

        return true;
    }

    private findModelAndProvider(modelId: string): { model: StoredModel, provider: StoredProvider } | null {
        if (!modelId) {
            return null;
        }

        const { providerName: providerName, modelName: modelName } = this.parseModelId(modelId);
        const provider = this.settings.providers.find(p => p.name === providerName);
        if (!provider) return null;
        const model = provider.models.find(m => m.name === modelName);
        if (!model) return null;
        return { model, provider };
    }

    private convertToModelConfig(model: StoredModel, provider: StoredProvider): ModelConfig {
        return {
            name: model.name,
            displayName: model.displayName,
            pricing: model.pricing,
            provider: {
                name: provider.name,
                type: provider.type,
                isBuiltIn: provider.isBuiltIn,
                apiKey: provider.apiKey,
                url: provider.url,
            }
        };
    }

    public parseModelId(modelId: string): { providerName: string, modelName: string } {
        const [provider, ...modelParts] = modelId.split(':');
        const model = modelParts.join(':');
        return { providerName: provider, modelName: model };
    }

    private makeModelId(provider: string, model: string): string {
        return `${provider}:${model}`;
    }

    private cloneProviders(providers: StoredProvider[]): StoredProvider[] {
        return providers.map(provider => ({
            ...provider,
            models: provider.models.map(model => ({ ...model }))
        }));
    }

    private syncBuiltInProviders(): boolean {
        let changed = false;

        const defaultProviders = this.cloneProviders(DEFAULT_PROVIDERS).filter(provider => provider.isBuiltIn);
        defaultProviders.forEach(defaultProvider => {
            const existingProvider = this.settings.providers.find(
                provider => provider.name.toLowerCase() === defaultProvider.name.toLowerCase() ||
                    (provider.type === defaultProvider.type && (provider.isBuiltIn || provider.name.toLowerCase() === defaultProvider.name.toLowerCase()))
            );

            if (!existingProvider) {
                this.settings.providers.push(defaultProvider);
                changed = true;
                return;
            }

            // Ensure built-in flag, name, and type are standardized
            if (!existingProvider.isBuiltIn) {
                existingProvider.isBuiltIn = true;
                changed = true;
            }
            if (existingProvider.name !== defaultProvider.name) {
                existingProvider.name = defaultProvider.name;
                changed = true;
            }
            if (existingProvider.type !== defaultProvider.type) {
                existingProvider.type = defaultProvider.type;
                changed = true;
            }
            if (!existingProvider.models) {
                existingProvider.models = [];
                changed = true;
            }

            // Prune retired models for built-in providers
            if (existingProvider.type === 'gemini') {
                const initialLen = existingProvider.models.length;
                existingProvider.models = existingProvider.models.filter(
                    model => !RETIRED_GEMINI_MODELS.includes(model.name)
                );
                if (existingProvider.models.length !== initialLen) {
                    changed = true;
                }
            } else if (existingProvider.type === 'anthropic') {
                const initialLen = existingProvider.models.length;
                existingProvider.models = existingProvider.models.filter(
                    model => !RETIRED_ANTHROPIC_MODELS.includes(model.name)
                );
                if (existingProvider.models.length !== initialLen) {
                    changed = true;
                }
            } else if (existingProvider.type === 'openai') {
                const initialLen = existingProvider.models.length;
                existingProvider.models = existingProvider.models.filter(
                    model => !RETIRED_OPENAI_MODELS.includes(model.name)
                );
                if (existingProvider.models.length !== initialLen) {
                    changed = true;
                }
            }

            defaultProvider.models.forEach(defaultModel => {
                const existingModel = existingProvider.models.find(model => model.name === defaultModel.name);
                if (!existingModel) {
                    existingProvider.models.push({ ...defaultModel });
                    changed = true;
                    return;
                }

                if (existingModel.pricing !== defaultModel.pricing) {
                    existingModel.pricing = defaultModel.pricing;
                    changed = true;
                }

                if (!existingModel.displayName || existingModel.displayName !== defaultModel.displayName) {
                    existingModel.displayName = defaultModel.displayName;
                    changed = true;
                }
            });
        });

        // Deduplicate any providers with the same name
        const seenNames = new Set<string>();
        const uniqueProviders: StoredProvider[] = [];
        for (const p of this.settings.providers) {
            const lower = p.name.toLowerCase();
            if (!seenNames.has(lower)) {
                seenNames.add(lower);
                uniqueProviders.push(p);
            } else {
                changed = true;
            }
        }
        this.settings.providers = uniqueProviders;

        // If selectedModelId points to a retired model or is invalid, migrate to DEFAULT_SELECTED_MODEL
        if (this.settings.selectedModelId) {
            const { providerName, modelName } = this.parseModelId(this.settings.selectedModelId);
            const lowerProvider = providerName.toLowerCase();
            const isRetiredGemini = lowerProvider === 'gemini' && RETIRED_GEMINI_MODELS.includes(modelName);
            const isRetiredAnthropic = lowerProvider === 'anthropic' && RETIRED_ANTHROPIC_MODELS.includes(modelName);
            const isRetiredOpenAI = lowerProvider === 'openai' && RETIRED_OPENAI_MODELS.includes(modelName);
            const isInvalid = !this.validateModelId(this.settings.selectedModelId);

            if (isRetiredGemini || isRetiredAnthropic || isRetiredOpenAI || isInvalid) {
                this.settings.selectedModelId = DEFAULT_SELECTED_MODEL;
                changed = true;
            }
        } else {
            this.settings.selectedModelId = DEFAULT_SELECTED_MODEL;
            changed = true;
        }

        return changed;
    }

    public validateModelId(modelId: string): boolean {
        if (!modelId.includes(':')) {
            return false;
        }

        const { providerName, modelName } = this.parseModelId(modelId);
        return this.settings.providers.some(
            p => p.name === providerName && p.models.some(m => m.name === modelName)
        );
    }
}
