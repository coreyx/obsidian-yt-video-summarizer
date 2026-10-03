import { App, PluginSettingTab, Setting } from 'obsidian';
import { ModelConfig, PluginSettings } from '../types';
import { SettingsEventHandlers, UICallbacks } from './handlers/SettingsEventHandlers';

import { SettingsModalsFactory } from './modals/SettingsModalsFactory';
import { SettingsUIComponents } from './components/SettingsUIComponents';
import { YouTubeSummarizerPlugin } from '../main';

/**
 * Represents the settings tab for the YouTube Summarizer Plugin.
 * This class extends the PluginSettingTab and provides a user interface
 * for configuring the plugin's settings.
 */
export class SettingsTab extends PluginSettingTab {
    private currentTab = 'ai-providers';
    private openedProviderName: string | null = null;
    private uiComponents: SettingsUIComponents;
    private eventHandlers: SettingsEventHandlers;
    private modals: SettingsModalsFactory;

    private get settings(): PluginSettings {
        return this.plugin.settings;
    }

    constructor(app: App, private plugin: YouTubeSummarizerPlugin) {
        super(app, plugin);
        this.uiComponents = new SettingsUIComponents(app);

        // Create callbacks for UI update
        const callbacks: UICallbacks = {
            onModelAdded: (model) => {
                this.reload();
            },
            onModelDeleted: (model) => {
                this.reload();
            },
            onModelUpdated: (model) => {
                this.reload();
            },
            onProviderAdded: (provider) => {
                this.openedProviderName = provider.name;
                this.reload();
            },
            onProviderDeleted: () => {
                this.reload();
            },
            onProviderUpdated: (provider, originalName) => {
                if (this.openedProviderName === originalName) {
                    this.openedProviderName = provider.name;
                }
                const oldAccordion = this.containerEl.querySelector(`[data-provider-name="${originalName}"]`);
                if (oldAccordion) {
                    oldAccordion.setAttribute('data-provider-name', provider.name);
                    if (oldAccordion.hasClass('is-expanded')) {
                        this.openedProviderName = provider.name;
                    }
                }
                this.reload();
            },
            onActiveModelChanged: () => {
                const selectedModel = this.settings.getSelectedModel();
                this.uiComponents.updateModelDropdown(
                    this.containerEl,
                    this.getAvailableModels(),
                    selectedModel ? this.buildModelId(selectedModel) : null
                );
                if (selectedModel?.provider?.name) {
                    this.expandProviderAccordion(selectedModel.provider.name);
                }
            }
        };

        this.modals = new SettingsModalsFactory(app);
        this.eventHandlers = new SettingsEventHandlers(plugin, this.modals, callbacks);
    }

    getAvailableModels(): ModelConfig[] {
        return this.settings.getModels();
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        const tabs = containerEl.createEl('div', { cls: 'yt-summarizer-settings__tab-group' });
        const tabList = tabs.createEl('nav', { cls: 'yt-summarizer-settings__tab-list' });
        const tabContent = tabs.createEl('div', { cls: 'yt-summarizer-settings__tab-content' });

        const aiProvidersContent = tabContent.createDiv({ cls: 'yt-summarizer-settings__content' });
        const summarySettingsContent = tabContent.createDiv({ cls: 'yt-summarizer-settings__content' });

        // Hide inactive tab content
        aiProvidersContent.style.display = this.currentTab === 'ai-providers' ? 'block' : 'none';
        summarySettingsContent.style.display = this.currentTab === 'summary-settings' ? 'block' : 'none';

        // Create tab buttons
        this.createTabButtons(tabList);

        // Display sections
        this.displayAIProvidersSection(aiProvidersContent);
        this.displaySummarySettingsSection(summarySettingsContent);
        this.displaySponsorSection(containerEl);
    }

    private createTabButtons(tabList: HTMLElement): void {
        const tabs = [
            { name: 'AI Providers', id: 'ai-providers' },
            { name: 'Summary Settings', id: 'summary-settings' }
        ];

        tabs.forEach(({ name, id }) => {
            const tab = this.uiComponents.createTabButton(name, id, this.currentTab === id);
            tab.addEventListener('click', () => {
                this.currentTab = id;
                this.display();
            });
            tabList.appendChild(tab);
        });
    }

    private buildModelId(model: ModelConfig): string {
        if (!model.provider || !model.name) {
            return '';
        }
        return `${model.provider.name}:${model.name}`;
    }

    private displayAIProvidersSection(containerEl: HTMLElement): void {
        // Active Model Selection
        const availableModels = this.getAvailableModels();
        const selectedModel = this.settings.getSelectedModel();

        new Setting(containerEl)
            .setName('Active Model')
            .setDesc('Select which model to use for generating summaries. Built-in models (Gemini, OpenAI, Anthropic) and OpenAI-compatible local/remote servers (LM Studio, Ollama, OpenRouter, vLLM) appear here.')
            .addExtraButton(button => {
                button
                    .setIcon('help-circle')
                    .setTooltip('To use an OpenAI-compatible server (e.g. LM Studio, Ollama, OpenRouter, vLLM), click "Detect & Connect" under LM Studio below, or click "Add Provider" at the bottom with Provider Type set to OpenAI. Once configured, your models will appear in this dropdown.');
            })
            .addDropdown(dropdown => {
                const options: Record<string, string> = {};
                availableModels.forEach(model => {
                    const displayText = model.displayName || model.name;
                    const modelId = this.buildModelId(model);
                    options[modelId] = `${model.provider.name} / ${displayText}`;
                });

                dropdown
                    .addOptions(options)
                    .setValue(selectedModel ? this.buildModelId(selectedModel) : '')
                    .onChange(async (value) => {
                        await this.eventHandlers.handleModelSelection(value);
                    });

            });

        // LM Studio One-Click Detection Setting
        new Setting(containerEl)
            .setName('LM Studio (Local LLM)')
            .setDesc('Auto-detect and connect to a running local LM Studio server (default: http://localhost:1234/v1). Automatically discovers loaded models and sets active model.')
            .addText(text =>
                text
                    .setPlaceholder('http://localhost:1234/v1')
                    .setValue(this.settings.getLmStudioUrl())
                    .onChange(async (value) => {
                        await this.settings.updateLmStudioUrl(value.trim());
                    })
            )
            .addButton(button =>
                button
                    .setButtonText('Detect & Connect')
                    .setCta()
                    .onClick(async () => {
                        button.setDisabled(true);
                        button.setButtonText('Detecting...');
                        try {
                            const success = await this.plugin.detectAndConnectLMStudio(this.settings.getLmStudioUrl());
                            if (success) {
                                this.openedProviderName = 'LM Studio';
                                this.reload();
                            }
                        } finally {
                            button.setDisabled(false);
                            button.setButtonText('Detect & Connect');
                        }
                    })
            );

        // Provider Accordions Container
        const accordionsContainer = containerEl.createDiv({ cls: 'yt-summarizer-settings__provider-accordions' });

        // Expand the active model's provider by default (or previously opened provider, or first provider)
        const activeProviderName = selectedModel?.provider?.name || availableModels[0]?.provider?.name;
        const providerToExpand = this.openedProviderName || activeProviderName;

        // Create accordions for each provider
        this.settings.getProviders().forEach(provider => {
            const isExpanded = provider.name === providerToExpand;
            this.uiComponents.addProviderAccordion(accordionsContainer, provider, this.eventHandlers, isExpanded);
        });

        // Add Provider button at the bottom
        const addProviderButton = new Setting(containerEl)
            .setName('Add New Provider')
            .setDesc('Add a custom AI provider')
            .addButton(button =>
                button
                    .setButtonText('Add Provider')
                    .setCta()
                    .onClick(() => {
                        const modal = this.modals.createAddProviderModal(this.eventHandlers);
                        modal.open();
                    })
            );
        addProviderButton.settingEl.addClass('yt-summarizer-settings__add-provider-button');
    }

    public expandProviderAccordion(providerName: string): void {
        const accordions = this.containerEl.querySelectorAll('.yt-summarizer-settings__provider-accordion');
        accordions.forEach(accordion => {
            if (accordion.getAttribute('data-provider-name') === providerName) {
                accordion.addClass('is-expanded');
            } else {
                accordion.removeClass('is-expanded');
            }
        });
        this.openedProviderName = providerName;
    }

    private displaySummarySettingsSection(containerEl: HTMLElement): void {
        // Summary Prompt Setting - Heading
        new Setting(containerEl)
            .setName('Summary prompt')
            .setDesc('Customize the prompt for generating summaries')
            .setHeading();

        // Summary Prompt Setting - Textarea
        const textareaSetting = new Setting(containerEl)
            .addTextArea(text =>
                text
                    .setPlaceholder('Enter custom prompt')
                    .setValue(this.settings.getCustomPrompt())
                    .onChange(async (value) => {
                        await this.settings.updateCustomPrompt(value);
                    })
                    .then(textArea => {
                        textArea.inputEl.addClass('yt-summarizer-settings__summary-prompt');
                    })
            );

        textareaSetting.settingEl.addClass('yt-summarizer-settings__setting-item-no-header');

        // Max Tokens Setting
        new Setting(containerEl)
            .setName('Maximum number of tokens to generate')
            .setDesc('More tokens allow for longer summaries, but may exceed provider limits')
            .addText(text =>
                text
                    .setPlaceholder('Enter max tokens')
                    .setValue(String(this.settings.getMaxTokens()))
                    .onChange(async (value) => {
                        await this.settings.updateMaxTokens(Number(value));
                    })
            );

        // Temperature Setting
        new Setting(containerEl)
            .setName('Temperature')
            .setDesc('Controls randomness in generation (0.0 to 1.0, or up to 2.0 for OpenAI)')
            .addExtraButton(button => {
                button
                    .setIcon('help-circle')
                    .setTooltip('Higher temperature values produce more creative and varied results, while lower values make output more deterministic and focused. For manually added providers, refer to provider documentation for supported ranges.');
            })
            .addText(text =>
                text
                    .setPlaceholder('Enter temperature')
                    .setValue(String(this.settings.getTemperature()))
                    .onChange(async (value) => {
                        await this.settings.updateTemperature(Number(value));
                    })
            );

        // Set note title from video title
        new Setting(containerEl)
            .setName('Set note title from video')
            .setDesc('Automatically rename the active note to the sanitized YouTube video title')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getSetNoteTitleFromVideo())
                    .onChange(async (value) => {
                        await this.settings.updateSetNoteTitleFromVideo(value);
                    })
            );

        // Include title in note body
        new Setting(containerEl)
            .setName('Include title in note body')
            .setDesc('Include the video title as a heading (# Title) in the note body (disabled by default since the title is already in the note filename and frontmatter)')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getIncludeTitleInBody())
                    .onChange(async (value) => {
                        await this.settings.updateIncludeTitleInBody(value);
                    })
            );

        // Wikilinks in technical terms
        new Setting(containerEl)
            .setName('Generate wikilinks for technical terms')
            .setDesc('Format extracted technical terms with Obsidian [[wikilinks]] (e.g. **[[Term]]**). When disabled, terms are kept in bold text without wikilinks (**Term**).')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getLinkTechnicalTerms())
                    .onChange(async (value) => {
                        await this.settings.updateLinkTechnicalTerms(value);
                    })
            );

        // Include video description
        new Setting(containerEl)
            .setName('Include video description in summary note')
            .setDesc('Include the YouTube video description in the summary note body under a "## Description" section, with timestamps linked to the video (disabled by default)')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getIncludeVideoDescription())
                    .onChange(async (value) => {
                        await this.settings.updateIncludeVideoDescription(value);
                    })
            );

        // Add description to frontmatter
        new Setting(containerEl)
            .setName('Add description to frontmatter')
            .setDesc('Include the full YouTube video description in the YAML frontmatter (enabled by default)')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getAddDescriptionToFrontmatter())
                    .onChange(async (value) => {
                        await this.settings.updateAddDescriptionToFrontmatter(value);
                    })
            );

        // Include transcript in summary
        new Setting(containerEl)
            .setName('Include transcript in summary note')
            .setDesc('Append the full video transcript under a "## Transcript" section when generating a summary, with each timestamp linked to the video (e.g. [01:05](https://www.youtube.com/watch?v=...&t=65s)) (disabled by default)')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getDumpTranscriptInSummary())
                    .onChange(async (value) => {
                        await this.settings.updateDumpTranscriptInSummary(value);
                    })
            );

        // Create Media Extended notes
        new Setting(containerEl)
            .setName('Create Media Extended notes')
            .setDesc('Automatically create a separate companion note formatted for the Media Extended plugin for each ingested video (enabled by default)')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getCreateMediaExtendedNotes())
                    .onChange(async (value) => {
                        await this.settings.updateCreateMediaExtendedNotes(value);
                    })
            );

        // Include description in Media Extended note
        new Setting(containerEl)
            .setName('Include description in Media Extended note')
            .setDesc('Include the YouTube video description in the Media Extended companion note (enabled by default). Any timestamps in the description are converted into Media Extended playback links.')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getMediaExtendedIncludeDescription())
                    .onChange(async (value) => {
                        await this.settings.updateMediaExtendedIncludeDescription(value);
                    })
            );

        // Include transcript in Media Extended note
        new Setting(containerEl)
            .setName('Include transcript in Media Extended note')
            .setDesc('Include the timestamped transcript in the Media Extended companion note (enabled by default). Timestamps are formatted as Media Extended playback links (e.g. [01:05](https://www.youtube.com/watch?v=...&t=66#t=01:05.61)).')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getMediaExtendedIncludeTranscript())
                    .onChange(async (value) => {
                        await this.settings.updateMediaExtendedIncludeTranscript(value);
                    })
            );

        // Media Extended notes folder
        new Setting(containerEl)
            .setName('Media Extended notes folder')
            .setDesc('Vault folder where separate Media Extended companion notes will be created (defaults to "Media Library" in the vault root)')
            .addText(text =>
                text
                    .setPlaceholder('Media Library')
                    .setValue(this.settings.getMediaExtendedFolder())
                    .onChange(async (value) => {
                        await this.settings.updateMediaExtendedFolder(value.trim() || 'Media Library');
                    })
            );

        // Create missing Media Extended companion notes
        new Setting(containerEl)
            .setName('Create missing Media Extended notes')
            .setDesc('Scan for video summary notes that do not have a matching Media Extended companion note and generate them')
            .addButton(button =>
                button
                    .setButtonText('Create in Folder...')
                    .onClick(() => {
                        this.plugin.promptCreateMediaExtendedNotes();
                    })
            )
            .addButton(button =>
                button
                    .setButtonText('Create All in Vault')
                    .onClick(async () => {
                        await this.plugin.createMediaExtendedInVault();
                    })
            );


        // Semantic Topic tags
        new Setting(containerEl)
            .setName('Generate semantic topic tags')
            .setDesc(
                'Use AI semantic analysis and inference with your configured AI model to infer relevant topic tags and fill in obvious missing tags. Automatically indexes your entire vault\'s existing tag taxonomy into a compressed cache prior to inference to prioritize tag reuse and group under established hierarchies (e.g. ai/machine-learning). Note: This is semantic and inferred, adds your vault\'s tag list to the AI context, and may increase the size of the context window and thus increase token usage.'
            )
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getAddTopicsAsTags())
                    .onChange(async (value) => {
                        await this.settings.updateAddTopicsAsTags(value);
                    })
            );

        // Detect tags in title and description
        new Setting(containerEl)
            .setName('Detect tags in video title and description')
            .setDesc('Extract hashtags from the YouTube video title and description and add them to frontmatter tags')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getDetectTagsInDescriptionAndTitle())
                    .onChange(async (value) => {
                        await this.settings.updateDetectTagsInDescriptionAndTitle(value);
                    })
            );

        // Extract tags from YouTube Data API
        new Setting(containerEl)
            .setName('Extract tags from YouTube Data API')
            .setDesc('Extract the complete set of creator video tags/keywords from YouTube metadata and apply them as Obsidian tags (enabled by default)')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getExtractYouTubeDataApiTags())
                    .onChange(async (value) => {
                        await this.settings.updateExtractYouTubeDataApiTags(value);
                    })
            );

        // YouTube Data API key (optional)
        new Setting(containerEl)
            .setName('YouTube Data API key (optional)')
            .setDesc('Optional Google Cloud YouTube Data API v3 key. If omitted, tags are extracted automatically from YouTube player metadata with no key required.')
            .addText(text =>
                text
                    .setPlaceholder('AIzaSy...')
                    .setValue(this.settings.getYoutubeApiKey())
                    .onChange(async (value) => {
                        await this.settings.updateYoutubeApiKey(value.trim());
                    })
            );

        // Discover playlist from creator
        new Setting(containerEl)
            .setName('Discover playlist from creator')
            .setDesc('Detect if the video is part of a playlist from the creator (via YouTube Data API, URL parameters, or video description) and inject playlist metadata into the frontmatter and note body (enabled by default)')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getDiscoverPlaylist())
                    .onChange(async (value) => {
                        await this.settings.updateDiscoverPlaylist(value);
                    })
            );

        // Tags in frontmatter
        new Setting(containerEl)
            .setName('Add tags to frontmatter')
            .setDesc('Add generated tags to the YAML frontmatter')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getAddTagsToFrontmatter())
                    .onChange(async (value) => {
                        await this.settings.updateAddTagsToFrontmatter(value);
                    })
            );

        // Inline tags
        new Setting(containerEl)
            .setName('Add inline tags')
            .setDesc('Add generated tags inline in the note body (**Tags:** #tag1 #tag2)')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getAddInlineTags())
                    .onChange(async (value) => {
                        await this.settings.updateAddInlineTags(value);
                    })
            );

        // Scan folders setting
        new Setting(containerEl)
            .setName('Video notes folders to scan (optional)')
            .setDesc('Comma-separated list of vault folders where your YouTube video notes are stored (e.g. "YouTube, Notes/Videos"). If specified, batch upgrade and companion note operations will target these folders instead of scanning the entire vault.')
            .addText(text =>
                text
                    .setPlaceholder('e.g. YouTube, Notes/Videos')
                    .setValue(this.settings.getScanFolders())
                    .onChange(async (value) => {
                        await this.settings.updateScanFolders(value.trim());
                    })
            );

        // Upgrade previous notes
        new Setting(containerEl)
            .setName('Upgrade previous notes')
            .setDesc('Re-process notes from YouTube videos to add all new frontmatter metadata (title, channel, handle, thumbnail, and vision OCR) without re-generating summaries or topic tags.')
            .addButton(button =>
                button
                    .setButtonText('Upgrade in Folder...')
                    .onClick(() => {
                        this.plugin.promptFolderUpgrade();
                    })
            )
            .addButton(button =>
                button
                    .setButtonText('Upgrade All in Vault')
                    .onClick(async () => {
                        await this.plugin.upgradeVaultNotes();
                    })
            );

        // Upgrade tags and description frontmatter
        new Setting(containerEl)
            .setName('Upgrade tags & description frontmatter')
            .setDesc('Add YouTube tags and video descriptions to existing notes that lack the description frontmatter property')
            .addButton(button =>
                button
                    .setButtonText('Upgrade in Folder...')
                    .onClick(() => {
                        this.plugin.promptUpgradeNotesWithTagsAndDescription();
                    })
            )
            .addButton(button =>
                button
                    .setButtonText('Upgrade All in Vault')
                    .onClick(async () => {
                        await this.plugin.upgradeNotesWithTagsAndDescriptionInVault();
                    })
            );

        // Upgrade playlist frontmatter
        new Setting(containerEl)
            .setName('Upgrade playlist frontmatter')
            .setDesc('Query YouTube Data API to discover creator playlists for existing notes that lack playlist frontmatter properties')
            .addButton(button =>
                button
                    .setButtonText('Upgrade in Folder...')
                    .onClick(() => {
                        this.plugin.promptUpgradeNotesWithPlaylist();
                    })
            )
            .addButton(button =>
                button
                    .setButtonText('Upgrade All in Vault')
                    .onClick(async () => {
                        await this.plugin.upgradeNotesWithPlaylistInVault();
                    })
            );

        // Last batch operation status & logs
        const lastReport = this.plugin.getLastBatchReport();
        const durationText = lastReport && lastReport.endTime
            ? `${((lastReport.endTime - lastReport.startTime) / 1000).toFixed(1)}s`
            : '0.0s';
        const reportSetting = new Setting(containerEl)
            .setName('Batch operation status & logs')
            .setDesc(
                lastReport
                    ? `${lastReport.operationName} (${lastReport.scope}) • ${lastReport.succeeded} succeeded, ${lastReport.skipped} skipped, ${lastReport.failed} failed (${durationText})`
                    : 'No batch operation has been executed yet in this session.'
            );

        if (lastReport) {
            reportSetting.addButton(button =>
                button
                    .setButtonText('View Last Report & Logs')
                    .setCta()
                    .onClick(() => {
                        this.plugin.showLastBatchReport();
                    })
            );
        } else {
            reportSetting.addButton(button =>
                button
                    .setButtonText('No Report Available')
                    .setDisabled(true)
            );
        }
    }


    private displaySponsorSection(containerEl: HTMLElement): void {
        containerEl.createEl('hr');
        const desc = document.createDocumentFragment();
        desc.append(
            'This plugin is free and maintained in my spare time. If it helps your workflow, consider supporting development.'
        );
        new Setting(containerEl)
            .setName('Enjoying the plugin?')
            .setDesc(desc)
            .addButton(button =>
                button
                    .setButtonText('Sponsor this plugin')
                    .setCta()
                    .onClick(() => {
                        open('https://github.com/sponsors/mbramani');
                    })
            );
    }

    private reload(): void {
        // Find currently opened accordion within this container
        const openedAccordion = this.containerEl.querySelector('.yt-summarizer-settings__provider-accordion.is-expanded');
        if (openedAccordion) {
            this.openedProviderName = openedAccordion.getAttribute('data-provider-name');
        }

        // Refresh the display
        this.display();
    }
}
