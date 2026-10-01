import { arrayBufferToBase64, Editor, MarkdownView, Notice, Plugin, TFile, TFolder } from 'obsidian';
import { PluginSettings, TranscriptResponse } from './types';

import { SettingsTab } from './ui/settings';
import { YouTubeService } from './services/youtube';
import { YouTubeURLModal } from './ui/modals/youtube-url';
import { CustomPromptModal } from './ui/modals/CustomPromptModal';
import { FolderSuggestModal } from './ui/modals/FolderSuggestModal';
import { PromptService } from './services/prompt';
import { SettingsManager } from './services/settingsManager';
import { ProvidersFactory } from './services/providers/providersFactory';
import { AIModelProvider } from './types';
import {
	applyFrontmatter,
	buildFrontmatter,
	extractTagsFromText,
	extractYouTubeUrlFromNote,
	FrontmatterData,
	isNoteMissingFrontmatter,
	sanitizeFileName,
	sanitizeTag,
	stripWikilinksFromTechnicalTerms,
	updateNoteContentWithFrontmatter,
} from './utils/frontmatter';

/**
 * Represents the YouTube Summarizer Plugin.
 * This class extends the Plugin class and provides the main functionality
 * for the YouTube Summarizer Plugin.
 */
export class YouTubeSummarizerPlugin extends Plugin {
	settings: PluginSettings;
	private youtubeService: YouTubeService;
	private promptService: PromptService;
	private provider: AIModelProvider | null = null;
	private isProcessing = false;

	/**
	 * Called when the plugin is loaded.
	 */
	async onload() {
		try {
			// Initialize services
			await this.initializeServices();

			// Add settings tab
			this.addSettingTab(new SettingsTab(this.app, this));

			// Register commands
			this.registerCommands();

			// Register context menu item for folders in File Explorer
			this.registerEvent(
				this.app.workspace.on('file-menu', (menu, file) => {
					if (file instanceof TFolder) {
						menu.addItem((item) => {
							item
								.setTitle('Upgrade YouTube notes in this folder')
								.setIcon('youtube')
								.onClick(async () => {
									await this.upgradeNotesInFolder(file);
								});
						});
					}
				})
			);
		} catch (error) {
			new Notice(`Error: ${error.message}`);
		}
	}

	public async saveData(data: any): Promise<void> {
		await super.saveData(data);
		await this.initializeServices();
	}

	/**
	 * Initializes the plugin services.
	 * This method creates instances of the required services and loads the plugin settings.
	 * @returns {Promise<void>} A promise that resolves when the services are initialized.
	 * @throws {Error} Throws an error if the services cannot be initialized.
	 */
	public async initializeServices(): Promise<void> {
		// Initialize settings manager if not already created
		if (!this.settings) {
			this.settings = new SettingsManager(this);
			await this.settings.loadSettings();
		}
		// Initialize youtube service
		if (!this.youtubeService) {
			this.youtubeService = new YouTubeService();
		}

		// Initialize prompt service
		this.promptService = new PromptService(this.settings.getCustomPrompt());

		// Initialize AI provider
		const selectedModel = this.settings.getSelectedModel();
		if (selectedModel) {
			this.provider = ProvidersFactory.createProvider(selectedModel, this.settings.getMaxTokens(), this.settings.getTemperature());
		} else {
			this.provider = null;
		}
	}

	/**
	 * Registers the plugin commands.
	 * This method adds the commands to the Obsidian app.
	 * @returns {void}
	 */
	private registerCommands(): void {
		// Register the summarize command
		// Command to summarize a YouTube video from URL
		this.addCommand({
			id: 'summarize-youtube-video',
			name: 'Summarize youtube video',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				try {
					const selectedText = editor.getSelection().trim();
					if (
						selectedText &&
						YouTubeService.isYouTubeUrl(selectedText)
					) {
						await this.summarizeVideo(selectedText, editor, view);
					} else if (selectedText) {
						new Notice('Selected text is not a valid YouTube URL');
					} else {
						new YouTubeURLModal(this.app, async (url) => {
							await this.summarizeVideo(url, editor, view);
						}).open();
					}
				} catch (error) {
					new Notice(`Failed to process video: ${error.message}`);
					console.error('Failed to process video:', error);
				}
			},
		});

		// Command to summarize a YouTube video with custom prompt
		this.addCommand({
			id: 'summarize-youtube-video-prompt',
			name: 'Summarize youtube video (with prompt)',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				try {
					const selectedText = editor.getSelection().trim();
					if (
						selectedText &&
						YouTubeService.isYouTubeUrl(selectedText)
					) {
						new CustomPromptModal(this.app, async (customPrompt) => {
							await this.summarizeVideo(selectedText, editor, view, customPrompt);
						}).open();
					} else if (selectedText) {
						new Notice('Selected text is not a valid YouTube URL');
					} else {
						new YouTubeURLModal(this.app, async (url) => {
							new CustomPromptModal(this.app, async (customPrompt) => {
								await this.summarizeVideo(url, editor, view, customPrompt);
							}).open();
						}).open();
					}
				} catch (error) {
					new Notice(`Failed to process video: ${error.message}`);
					console.error('Failed to process video:', error);
				}
			},
		});

		// Command to upgrade the current note's frontmatter
		this.addCommand({
			id: 'upgrade-youtube-note',
			name: 'Upgrade current note with YouTube frontmatter',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await this.upgradeCurrentNote(editor, view);
			},
		});

		// Command to upgrade YouTube notes in a specific folder
		this.addCommand({
			id: 'upgrade-folder-youtube-notes',
			name: 'Upgrade YouTube notes in folder...',
			callback: () => {
				this.promptFolderUpgrade();
			},
		});

		// Command to upgrade all YouTube notes in the vault
		this.addCommand({
			id: 'upgrade-all-youtube-notes',
			name: 'Upgrade all YouTube notes in vault',
			callback: async () => {
				await this.upgradeVaultNotes();
			},
		});
	}

	/**
	 * Summarizes the YouTube video for the given URL and updates the markdown view with the summary.
	 * @param url - The URL of the YouTube video to summarize.
	 * @param editor - The editor instance where the content will be inserted.
	 * @param view - The active markdown view.
	 * @param customPrompt - Optional custom prompt instructions.
	 * @returns {Promise<void>} A promise that resolves when the video is summarized.
	 */
	private async summarizeVideo(
		url: string,
		editor: Editor,
		view?: MarkdownView,
		customPrompt?: string
	): Promise<void> {
		// Check if a video is already being processed
		if (this.isProcessing) {
			new Notice('Already processing a video, please wait...');
			return;
		}

		try {
			this.isProcessing = true;
			// Get the selected model
			const selectedModel = this.settings.getSelectedModel();

			if (!selectedModel) {
				new Notice('No AI model selected. Please select a model in the plugin settings.');
				return;
			}

			// Check if the selected model's provider has an API key
			if (!selectedModel.provider.apiKey) {
				new Notice(
					`${selectedModel.provider.name} API key is missing. Please set it in the plugin settings.`
				);
				return;
			}

			if (!this.provider) {
				new Notice('AI provider not initialized. Please check your settings.');
				return;
			}

			// Step 1: Fetch the video transcript & metadata
			new Notice('Fetching video transcript...');
			let transcript: TranscriptResponse;
			try {
				transcript = await this.youtubeService.fetchTranscript(url);
			} catch (error) {
				new Notice(`Error: ${error.message}`);
				return;
			}
			const thumbnailUrl = YouTubeService.getThumbnailUrl(
				transcript.videoId
			);

			// Step 2: Build the prompt for LLM
			const prompt = this.buildPrompt(transcript.lines.map((line) => line.text).join(' '), customPrompt);

			// Step 3: Run summary generation and thumbnail text recognition concurrently
			new Notice('Generating summary...');
			const summaryPromise = this.provider.summarizeVideo(transcript.videoId, prompt);

			const thumbnailTextPromise = (async (): Promise<string> => {
				try {
					if (this.provider?.extractThumbnailText) {
						const buffer = await YouTubeService.fetchThumbnailBuffer(transcript.videoId);
						if (buffer) {
							const base64 = arrayBufferToBase64(buffer);
							return await this.provider.extractThumbnailText(base64, 'image/jpeg');
						}
					}
				} catch (e) {
					console.warn('Failed to extract thumbnail text:', e);
				}
				return '';
			})();

			let summary: string;
			let thumbnailText = '';
			try {
				[summary, thumbnailText] = await Promise.all([summaryPromise, thumbnailTextPromise]);
			} catch (error) {
				new Notice(`Error: ${error.message}`);
				console.error('Failed to generate summary:', error);
				return;
			}

			if (!this.settings.getLinkTechnicalTerms()) {
				summary = stripWikilinksFromTechnicalTerms(summary);
			}

			// Step 4: Extract tags from title & description and/or generate topic tags
			const detectedTags: string[] = this.settings.getDetectTagsInDescriptionAndTitle()
				? Array.from(new Set([
						...extractTagsFromText(transcript.title),
						...extractTagsFromText(transcript.description || ''),
				  ]))
				: [];

			let topicTags: string[] = [];
			if (this.settings.getAddTopicsAsTags() && this.provider?.generateTopics) {
				try {
					topicTags = await this.provider.generateTopics(summary);
				} catch (e) {
					console.warn('Failed to generate topic tags:', e);
				}
			}

			const allTags = Array.from(new Set([...detectedTags, ...topicTags]))
				.map(sanitizeTag)
				.filter(Boolean);

			// Step 5: Optionally rename the note based on the sanitized video title
			if (this.settings.getSetNoteTitleFromVideo() && view?.file) {
				await this.setNoteTitle(view.file, transcript.title);
			}

			// Step 6: Prepare tags for body and frontmatter
			const addInlineTags = this.settings.getAddInlineTags();
			const addTagsToFrontmatter = this.settings.getAddTagsToFrontmatter();
			const inlineTags = addInlineTags ? allTags : undefined;
			const frontmatterTags = addTagsToFrontmatter ? allTags : undefined;

			// Step 7: Create the summary content for the body
			const bodyContent = this.generateSummary(
				transcript,
				thumbnailUrl,
				url,
				summary,
				inlineTags,
				this.settings.getIncludeVideoDescription(),
				this.settings.getIncludeTitleInBody()
			);

			// Step 8: Apply frontmatter and insert body content
			const fmData: FrontmatterData = {
				title: transcript.title,
				channel_name: transcript.author,
				channel_username: transcript.channelUsername || '',
				channel_url: transcript.channelUrl,
				video_url: url,
				thumbnail: thumbnailUrl,
				thumbnail_text: thumbnailText,
				tags: frontmatterTags,
			};

			const isEditorEmpty = editor.getValue().trim() === '';
			if (isEditorEmpty) {
				const frontmatterString = buildFrontmatter(fmData);
				editor.setValue(`${frontmatterString}\n\n${bodyContent}`);
			} else {
				editor.replaceSelection(bodyContent);
				applyFrontmatter(editor, fmData);
			}

			new Notice('Summary generated successfully!');
		} catch (error) {
			new Notice(`Error: ${error.message}`);
			console.error('Summary generation failed:', error);
		} finally {
			// Reset the processing flag
			this.isProcessing = false;
		}
	}

	/**
	 * Renames the given note file based on the sanitized video title.
	 * Avoids collisions by appending a counter if a file with that name already exists.
	 */
	private async setNoteTitle(file: TFile, title: string): Promise<void> {
		const sanitizedTitle = sanitizeFileName(title);
		if (!sanitizedTitle || file.basename === sanitizedTitle) {
			return;
		}

		const parentDir = file.parent?.path && file.parent.path !== '/' ? `${file.parent.path}/` : '';
		const extension = file.extension || 'md';
		let targetPath = `${parentDir}${sanitizedTitle}.${extension}`;
		let counter = 1;

		while (this.app.vault.getAbstractFileByPath(targetPath) && targetPath !== file.path) {
			targetPath = `${parentDir}${sanitizedTitle} (${counter}).${extension}`;
			counter++;
		}

		if (targetPath !== file.path) {
			try {
				await this.app.fileManager.renameFile(file, targetPath);
			} catch (error) {
				console.error('Failed to rename note:', error);
			}
		}
	}

	/**
	 * Upgrades the currently active note by fetching missing YouTube metadata
	 * and updating frontmatter without re-running summary inference or generating tags.
	 */
	public async upgradeCurrentNote(editor: Editor, view: MarkdownView): Promise<void> {
		if (this.isProcessing) {
			new Notice('Already processing a video or upgrading notes, please wait...');
			return;
		}

		const content = editor.getValue();
		const url = extractYouTubeUrlFromNote(content);

		if (!url) {
			new Notice('No YouTube video URL found in this note.');
			return;
		}

		try {
			this.isProcessing = true;
			new Notice('Upgrading note with YouTube metadata...');

			const metadata = await this.youtubeService.fetchVideoMetadata(url);
			const thumbnailUrl = YouTubeService.getThumbnailUrl(metadata.videoId);

			let thumbnailText = '';
			if (this.provider?.extractThumbnailText) {
				try {
					const buffer = await YouTubeService.fetchThumbnailBuffer(metadata.videoId);
					if (buffer) {
						thumbnailText = await this.provider.extractThumbnailText(
							arrayBufferToBase64(buffer),
							'image/jpeg'
						);
					}
				} catch (e) {
					console.warn('Thumbnail text extraction skipped during upgrade:', e);
				}
			}

			const fmData: FrontmatterData = {
				title: metadata.title,
				channel_name: metadata.author,
				channel_username: metadata.channelUsername || '',
				channel_url: metadata.channelUrl,
				video_url: metadata.url,
				thumbnail: thumbnailUrl,
				thumbnail_text: thumbnailText,
			};

			applyFrontmatter(editor, fmData, { excludeTags: true });
			new Notice('Note frontmatter upgraded successfully!');
		} catch (error) {
			new Notice(`Failed to upgrade note: ${error.message}`);
			console.error('Failed to upgrade note:', error);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Upgrades a collection of markdown files containing YouTube videos by adding
	 * missing frontmatter metadata without re-generating summaries or tags.
	 * @param files The markdown files to inspect and upgrade.
	 * @param scopeDescription A human-readable description of the target scope.
	 */
	private async upgradeNotes(files: TFile[], scopeDescription: string): Promise<void> {
		if (this.isProcessing) {
			new Notice('Already processing a video or upgrading notes, please wait...');
			return;
		}

		try {
			this.isProcessing = true;
			new Notice(`Scanning ${scopeDescription} for YouTube notes to upgrade...`);

			const candidates: { file: TFile; url: string }[] = [];

			for (const file of files) {
				const content = await this.app.vault.read(file);
				if (isNoteMissingFrontmatter(content)) {
					const url = extractYouTubeUrlFromNote(content);
					if (url) {
						candidates.push({ file, url });
					}
				}
			}

			if (candidates.length === 0) {
				new Notice(`All YouTube notes in ${scopeDescription} already have up-to-date frontmatter!`);
				return;
			}

			new Notice(`Found ${candidates.length} note(s) to upgrade in ${scopeDescription}. Starting upgrade...`);

			let successCount = 0;
			let failCount = 0;

			for (let i = 0; i < candidates.length; i++) {
				const { file, url } = candidates[i];
				try {
					const metadata = await this.youtubeService.fetchVideoMetadata(url);
					const thumbnailUrl = YouTubeService.getThumbnailUrl(metadata.videoId);

					let thumbnailText = '';
					if (this.provider?.extractThumbnailText) {
						try {
							const buffer = await YouTubeService.fetchThumbnailBuffer(metadata.videoId);
							if (buffer) {
								thumbnailText = await this.provider.extractThumbnailText(
									arrayBufferToBase64(buffer),
									'image/jpeg'
								);
							}
						} catch (e) {
							console.warn(`Thumbnail OCR skipped for ${file.path}:`, e);
						}
					}

					const fmData: FrontmatterData = {
						title: metadata.title,
						channel_name: metadata.author,
						channel_username: metadata.channelUsername || '',
						channel_url: metadata.channelUrl,
						video_url: metadata.url,
						thumbnail: thumbnailUrl,
						thumbnail_text: thumbnailText,
					};

					const currentContent = await this.app.vault.read(file);
					const updatedContent = updateNoteContentWithFrontmatter(currentContent, fmData, {
						excludeTags: true,
					});
					await this.app.vault.modify(file, updatedContent);
					successCount++;
				} catch (error) {
					console.error(`Failed to upgrade note ${file.path}:`, error);
					failCount++;
				}

				if (i < candidates.length - 1) {
					await new Promise((res) => setTimeout(res, 300));
				}
			}

			new Notice(
				`Upgrade complete! Successfully upgraded ${successCount} note(s) in ${scopeDescription}${failCount > 0 ? ` (${failCount} failed)` : ''}.`
			);
		} catch (error) {
			new Notice(`Upgrade failed: ${error.message}`);
			console.error(`Upgrade notes in ${scopeDescription} failed:`, error);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Scans all notes in the vault for YouTube videos missing new frontmatter and upgrades them.
	 */
	public async upgradeVaultNotes(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles();
		await this.upgradeNotes(files, 'vault');
	}

	/**
	 * Scans notes within a specific folder (and its subfolders) for YouTube videos missing
	 * new frontmatter and upgrades them.
	 * @param folder The folder to scan.
	 */
	public async upgradeNotesInFolder(folder: TFolder): Promise<void> {
		const isRoot = folder.isRoot();
		const files = isRoot
			? this.app.vault.getMarkdownFiles()
			: this.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(folder.path + '/'));
		const scopeDescription = isRoot ? 'vault root' : `folder "${folder.path}"`;
		await this.upgradeNotes(files, scopeDescription);
	}

	/**
	 * Opens a folder selection modal and triggers an upgrade for the selected folder.
	 */
	public promptFolderUpgrade(): void {
		new FolderSuggestModal(this.app, async (folder) => {
			await this.upgradeNotesInFolder(folder);
		}).open();
	}

	private buildPrompt(transcriptText: string, customPrompt?: string): string {
		let basePrompt = customPrompt && customPrompt.trim()
			? `${this.settings.getCustomPrompt()}\n\nAdditional instructions:\n${customPrompt.trim()}`
			: this.settings.getCustomPrompt();

		if (!this.settings.getLinkTechnicalTerms()) {
			basePrompt = basePrompt
				.replace(/\*\*\[\[Term 1\]\]\*\*/g, '**Term 1**')
				.replace(/\*\*\[\[Term 2\]\]\*\*/g, '**Term 2**')
				.replace(/\[\[Term (\d+)\]\]/g, 'Term $1');
			basePrompt += '\n\nImportant formatting rule: In the "Technical terms" section, do NOT use wikilinks (do NOT enclose terms in [[ ]]). Format terms as bold text only (e.g. - **Term**: explanation).';
		}

		const promptService = new PromptService(basePrompt);
		return promptService.buildPrompt(transcriptText);
	}

	/**
	 * Generates a summary string based on the provided transcript, thumbnail URL, video URL, summary,
	 * optional inline tags, optional video description, and optional title heading.
	 */
	private generateSummary(
		transcript: TranscriptResponse,
		thumbnailUrl: string,
		url: string,
		summaryText: string,
		inlineTags?: string[],
		includeDescription = true,
		includeTitle = false
	): string {
		const metaLines = [
			`👤 [${transcript.author}](${transcript.channelUrl})  🔗 [Watch video](${url})`
		];

		if (inlineTags && inlineTags.length > 0) {
			metaLines.push(`**Tags:** ${inlineTags.map((t) => `#${t}`).join(' ')}`);
		}

		const summaryParts: string[] = [];
		if (includeTitle && transcript.title) {
			summaryParts.push(`# ${transcript.title}`);
		}

		summaryParts.push(
			`![Thumbnail](${thumbnailUrl})`,
			metaLines.join('\n\n'),
			summaryText
		);

		if (includeDescription && transcript.description && transcript.description.trim()) {
			summaryParts.push(`## Description\n\n${transcript.description.trim()}`);
		}

		return summaryParts.join('\n\n');
	}
}

export default YouTubeSummarizerPlugin;
