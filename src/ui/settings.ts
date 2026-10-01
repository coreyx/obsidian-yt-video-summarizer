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
            .setDesc('Select which model to use for generating summaries')
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

        // Include video description
        new Setting(containerEl)
            .setName('Include video description')
            .setDesc('Include the YouTube video description and links in the note body')
            .addToggle(toggle =>
                toggle
                    .setValue(this.settings.getIncludeVideoDescription())
                    .onChange(async (value) => {
                        await this.settings.updateIncludeVideoDescription(value);
                    })
            );

        // Topic tags
        new Setting(containerEl)
            .setName('Generate topic tags')
            .setDesc('Use semantic analysis of the summary to generate relevant topic tags')
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

        // Upgrade previous notes
        new Setting(containerEl)
            .setName('Upgrade previous notes')
            .setDesc('Re-process notes from YouTube videos to add all new frontmatter metadata (title, channel, handle, thumbnail, and vision OCR) without re-generating summaries or topic tags.')
            .addButton(button =>
                button
                    .setButtonText('Upgrade Notes in Vault')
                    .setCta()
                    .onClick(async () => {
                        await (this.plugin as any).upgradeVaultNotes();
                    })
            );
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
