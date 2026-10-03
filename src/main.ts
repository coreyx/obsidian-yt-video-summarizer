import { arrayBufferToBase64, Editor, MarkdownView, Notice, Plugin, TFile, TFolder } from 'obsidian';
import { BatchItemResult, BatchOperationReport, MediaExtendedRunOptions, PluginSettings, TranscriptResponse } from './types';

import { SettingsTab } from './ui/settings';
import { YouTubeService } from './services/youtube';
import { YouTubeURLModal } from './ui/modals/youtube-url';
import { CustomPromptModal } from './ui/modals/CustomPromptModal';
import { FolderSuggestModal } from './ui/modals/FolderSuggestModal';
import { BatchReportModal } from './ui/modals/BatchReportModal';
import { BatchProgressTracker } from './utils/BatchProgressTracker';
import { PromptService } from './services/prompt';
import { SettingsManager } from './services/settingsManager';
import { ProvidersFactory } from './services/providers/providersFactory';
import { detectLMStudioServer } from './services/lmStudio';
import { AIModelProvider } from './types';
import {
	addRelatedLink,
	applyFrontmatter,
	buildFrontmatter,
	buildMediaExtendedNote,
	convertTimestampsToLinks,
	deduplicateTags,
	extractPlaylistIdFromFrontmatter,
	extractTagsFromText,
	extractYouTubeUrlFromNote,
	filterFilesByFolder,
	filterFilesByFolderPaths,
	formatTranscript,
	FrontmatterData,
	hasPlaylistTitlePlaceholder,
	hasRelatedMediaExtendedLink,
	isMediaExtendedCompanionNote,
	isNoteMissingDescriptionFrontmatter,
	isNoteMissingFrontmatter,
	isNoteMissingPlaylistFrontmatter,
	MediaExtendedMetadata,
	sanitizeFileName,
	sanitizeTag,
	stripWikilinksFromTechnicalTerms,
	updateNoteContentWithFrontmatter,
} from './utils/frontmatter';
import { buildVaultTagData } from './utils/vaultTags';
import { VaultTagData } from './types';

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
	private cachedVaultTagData: VaultTagData | null = null;
	private lastBatchReport: BatchOperationReport | null = null;

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
						menu.addItem((item) => {
							item
								.setTitle('Create missing Media Extended notes in this folder')
								.setIcon('youtube')
								.onClick(async () => {
									await this.createMediaExtendedInFolder(file);
								});
						});
						menu.addItem((item) => {
							item
								.setTitle('Upgrade video notes with tags and description in this folder')
								.setIcon('youtube')
								.onClick(async () => {
									await this.upgradeNotesWithTagsAndDescriptionInFolder(file);
								});
						});
						menu.addItem((item) => {
							item
								.setTitle('Upgrade video notes with playlist in this folder')
								.setIcon('youtube')
								.onClick(async () => {
									await this.upgradeNotesWithPlaylistInFolder(file);
								});
						});
						menu.addItem((item) => {
							item
								.setTitle('Fix playlist title placeholder in this folder')
								.setIcon('youtube')
								.onClick(async () => {
									await this.fixPlaylistTitlePlaceholderInFolder(file);
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
						new YouTubeURLModal(
							this.app,
							async (url, mediaExtendedOptions) => {
								await this.summarizeVideo(url, editor, view, undefined, mediaExtendedOptions);
							},
							this.getDefaultMediaExtendedRunOptions(),
							true
						).open();
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
						new CustomPromptModal(
							this.app,
							async (customPrompt, mediaExtendedOptions) => {
								await this.summarizeVideo(selectedText, editor, view, customPrompt, mediaExtendedOptions);
							},
							this.getDefaultMediaExtendedRunOptions()
						).open();
					} else if (selectedText) {
						new Notice('Selected text is not a valid YouTube URL');
					} else {
						new YouTubeURLModal(
							this.app,
							async (url, urlMediaExtendedOptions) => {
								new CustomPromptModal(
									this.app,
									async (customPrompt, promptMediaExtendedOptions) => {
										await this.summarizeVideo(url, editor, view, customPrompt, promptMediaExtendedOptions);
									},
									urlMediaExtendedOptions
								).open();
							},
							this.getDefaultMediaExtendedRunOptions(),
							true
						).open();
					}
				} catch (error) {
					new Notice(`Failed to process video: ${error.message}`);
					console.error('Failed to process video:', error);
				}
			},
		});

		// Command to retrieve transcript only
		this.addCommand({
			id: 'get-youtube-video-transcript',
			name: 'Get YouTube video transcript',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				try {
					const selectedText = editor.getSelection().trim();
					if (
						selectedText &&
						YouTubeService.isYouTubeUrl(selectedText)
					) {
						await this.retrieveTranscript(selectedText, editor, view);
					} else if (selectedText) {
						new Notice('Selected text is not a valid YouTube URL');
					} else {
						const noteUrl = extractYouTubeUrlFromNote(editor.getValue());
						if (noteUrl) {
							await this.retrieveTranscript(noteUrl, editor, view);
						} else {
							new YouTubeURLModal(
								this.app,
								async (url, mediaExtendedOptions) => {
									await this.retrieveTranscript(url, editor, view, mediaExtendedOptions);
								},
								this.getDefaultMediaExtendedRunOptions(),
								true
							).open();
						}
					}
				} catch (error) {
					new Notice(`Failed to retrieve transcript: ${error.message}`);
					console.error('Failed to retrieve transcript:', error);
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

		// Command to create Media Extended notes for video summaries in a specific folder
		this.addCommand({
			id: 'create-missing-media-extended-notes-folder',
			name: 'Create Media Extended notes for video summaries in folder...',
			callback: () => {
				this.promptCreateMediaExtendedNotes();
			},
		});

		// Command to create Media Extended notes for video summaries in the entire vault
		this.addCommand({
			id: 'create-missing-media-extended-notes-vault',
			name: 'Create Media Extended notes for video summaries in entire vault',
			callback: async () => {
				await this.createMediaExtendedInVault();
			},
		});

		// Command to create Media Extended notes for video summaries without matching companion note
		this.addCommand({
			id: 'create-missing-media-extended-notes',
			name: 'Create Media Extended notes for video summaries without companion note',
			callback: async () => {
				await this.createMediaExtendedForMissingNotes();
			},
		});

		// Command to upgrade video summary notes with tags and description in a specific folder
		this.addCommand({
			id: 'upgrade-notes-with-tags-and-description-folder',
			name: 'Upgrade video summary notes with tags and description in folder...',
			callback: () => {
				this.promptUpgradeNotesWithTagsAndDescription();
			},
		});

		// Command to upgrade video summary notes with tags and description in the entire vault
		this.addCommand({
			id: 'upgrade-notes-with-tags-and-description-vault',
			name: 'Upgrade video summary notes with tags and description in entire vault',
			callback: async () => {
				await this.upgradeNotesWithTagsAndDescriptionInVault();
			},
		});

		// Command to upgrade video summary notes with tags and description frontmatter
		this.addCommand({
			id: 'upgrade-notes-with-tags-and-description',
			name: 'Upgrade video summary notes with tags and description frontmatter',
			callback: async () => {
				await this.upgradeNotesWithTagsAndDescription();
			},
		});

		// Command to upgrade video summary notes with playlist from YouTube Data API in a specific folder
		this.addCommand({
			id: 'upgrade-notes-with-playlist-folder',
			name: 'Upgrade video summary notes with playlist in folder...',
			callback: () => {
				this.promptUpgradeNotesWithPlaylist();
			},
		});

		// Command to upgrade video summary notes with playlist in the entire vault
		this.addCommand({
			id: 'upgrade-notes-with-playlist-vault',
			name: 'Upgrade video summary notes with playlist in entire vault',
			callback: async () => {
				await this.upgradeNotesWithPlaylistInVault();
			},
		});

		// Command to upgrade video summary notes with playlist from YouTube Data API
		this.addCommand({
			id: 'upgrade-notes-with-playlist',
			name: 'Upgrade video summary notes with playlist from YouTube Data API',
			callback: async () => {
				await this.upgradeNotesWithPlaylist();
			},
		});

		// Command to fix notes where playlist_title is the generic "Playlist" placeholder
		this.addCommand({
			id: 'fix-playlist-title-placeholder',
			name: 'Fix playlist title placeholder in folder...',
			callback: () => {
				this.promptFixPlaylistTitlePlaceholder();
			},
		});

		// Command to auto-detect and connect to a running LM Studio instance
		this.addCommand({
			id: 'detect-connect-lm-studio',
			name: 'Detect and connect local LM Studio instance',
			callback: async () => {
				await this.detectAndConnectLMStudio();
			},
		});

		// Command to view the last batch operation report & logs
		this.addCommand({
			id: 'view-last-batch-report',
			name: 'View last batch operation report & logs',
			callback: () => {
				this.showLastBatchReport();
			},
		});
	}

	/**
	 * Retrieves the report of the most recently executed batch operation, if any.
	 */
	public getLastBatchReport(): BatchOperationReport | null {
		return this.lastBatchReport;
	}

	/**
	 * Stores the report of the most recently executed batch operation.
	 */
	public setLastBatchReport(report: BatchOperationReport): void {
		this.lastBatchReport = report;
	}

	/**
	 * Displays the modal containing the complete logs and statistics of the last batch operation.
	 */
	public showLastBatchReport(): void {
		if (!this.lastBatchReport) {
			new Notice('No batch operation report available yet. Run an upgrade command first.');
			return;
		}
		new BatchReportModal(this.app, this.lastBatchReport).open();
	}

	/**
	 * Builds the per-run Media Extended options from the permanent settings.
	 */
	private getDefaultMediaExtendedRunOptions(): MediaExtendedRunOptions {
		return {
			createNote: this.settings.getCreateMediaExtendedNotes(),
			includeDescription: this.settings.getMediaExtendedIncludeDescription(),
			includeTranscript: this.settings.getMediaExtendedIncludeTranscript(),
		};
	}

	/**
	 * Summarizes the YouTube video for the given URL and updates the markdown view with the summary.
	 * @param url - The URL of the YouTube video to summarize.
	 * @param editor - The editor instance where the content will be inserted.
	 * @param view - The active markdown view.
	 * @param customPrompt - Optional custom prompt instructions.
	 * @param mediaExtendedOptions - Optional per-run Media Extended options (defaults to permanent settings).
	 * @returns {Promise<void>} A promise that resolves when the video is summarized.
	 */
	private async summarizeVideo(
		url: string,
		editor: Editor,
		view?: MarkdownView,
		customPrompt?: string,
		mediaExtendedOptions: MediaExtendedRunOptions = this.getDefaultMediaExtendedRunOptions()
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
				transcript = await this.youtubeService.fetchTranscript(
					url,
					'en',
					this.settings.getYoutubeApiKey()
				);
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

			// Step 4: Extract tags from title & description, YouTube Data API/metadata, and/or generate topic tags
			const detectedTags: string[] = this.settings.getDetectTagsInDescriptionAndTitle()
				? [
						...extractTagsFromText(transcript.title),
						...extractTagsFromText(transcript.description || ''),
				  ]
				: [];

			const ytDataApiTags: string[] = (this.settings.getExtractYouTubeDataApiTags() && transcript.tags)
				? transcript.tags
				: [];

			let topicTags: string[] = [];
			if (this.settings.getAddTopicsAsTags() && this.provider?.generateTopics) {
				try {
					const vaultTagData = await this.rebuildVaultTagCache();
					topicTags = await this.provider.generateTopics(summary, {
						existingTags: [...detectedTags, ...ytDataApiTags],
						vaultTags: vaultTagData.tags,
						groupPrefixes: vaultTagData.groupPrefixes,
						compressedContext: vaultTagData.compressedContext,
						title: transcript.title,
					});
				} catch (e) {
					console.warn('Failed to generate topic tags:', e);
				}
			}

			const allTags = deduplicateTags([...detectedTags, ...ytDataApiTags, ...topicTags]);

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
			let bodyContent = this.generateSummary(
				transcript,
				thumbnailUrl,
				url,
				summary,
				inlineTags,
				this.settings.getIncludeVideoDescription(),
				this.settings.getIncludeTitleInBody(),
				this.settings.getDumpTranscriptInSummary()
			);

			// Step 7.5: Optionally create Media Extended companion note and link bidirectionally
			if (mediaExtendedOptions.createNote) {

				try {
					const mediaNote = await this.createMediaExtendedCompanionNote(transcript, view?.file, mediaExtendedOptions);
					if (mediaNote) {
						const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
						const mediaLink = mediaFolder ? `${mediaFolder}/${mediaNote.basename}` : mediaNote.basename;
						bodyContent = addRelatedLink(bodyContent, mediaLink);
					}
				} catch (e) {
					console.error('Failed to create Media Extended companion note:', e);
				}
			}

			// Step 8: Apply frontmatter and insert body content
			const playlist = this.settings.getDiscoverPlaylist() ? transcript.playlist : undefined;
			const pTitle = playlist?.title && playlist.title.trim().toLowerCase() !== 'playlist'
				? playlist.title.trim()
				: undefined;
			const fmData: FrontmatterData = {
				title: transcript.title,
				channel_name: transcript.author,
				channel_username: transcript.channelUsername || '',
				channel_url: transcript.channelUrl,
				video_url: url,
				thumbnail: thumbnailUrl,
				thumbnail_text: thumbnailText,
				description: this.settings.getAddDescriptionToFrontmatter() ? transcript.description : undefined,
				tags: frontmatterTags,
				playlist_title: pTitle,
				playlist_url: playlist?.url,
				playlist_id: playlist?.id,
				playlist_index: playlist?.index,
				playlist_count: playlist?.count,
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
	 * Rebuilds the compressed cache of all tags across the entire vault.
	 * Only executes if AI topic tagging (addTopicsAsTags) is enabled.
	 */
	public async rebuildVaultTagCache(): Promise<VaultTagData> {
		if (!this.settings.getAddTopicsAsTags()) {
			return { tags: [], groupPrefixes: [], compressedContext: '', totalCount: 0 };
		}

		const tagCounts: Record<string, number> = {};

		// 1. Primary: Query Obsidian MetadataCache getTags()
		try {
			if (typeof (this.app.metadataCache as any)?.getTags === 'function') {
				const appTags = (this.app.metadataCache as any).getTags() || {};
				for (const [tag, count] of Object.entries(appTags)) {
					tagCounts[tag] = typeof count === 'number' ? count : 1;
				}
			}
		} catch (e) {
			console.warn('Failed to read app.metadataCache.getTags():', e);
		}

		// 2. Secondary: Scan cached markdown files to ensure frontmatter and inline tags are captured
		try {
			const markdownFiles = this.app.vault.getMarkdownFiles();
			for (const file of markdownFiles) {
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache) continue;

				if (cache.frontmatter?.tags) {
					const fmTags = cache.frontmatter.tags;
					if (Array.isArray(fmTags)) {
						for (const t of fmTags) {
							if (typeof t === 'string') {
								const clean = t.trim();
								if (clean) tagCounts[clean] = (tagCounts[clean] || 0) + 1;
							}
						}
					} else if (typeof fmTags === 'string') {
						const parts = fmTags.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
						for (const p of parts) {
							tagCounts[p] = (tagCounts[p] || 0) + 1;
						}
					}
				}

				if (cache.tags && Array.isArray(cache.tags)) {
					for (const t of cache.tags) {
						if (t?.tag) {
							tagCounts[t.tag] = (tagCounts[t.tag] || 0) + 1;
						}
					}
				}
			}
		} catch (e) {
			console.warn('Failed to scan file caches for tags:', e);
		}

		const data = buildVaultTagData(tagCounts, 1000);
		this.cachedVaultTagData = data;
		return data;
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
	 * Ensures that a directory path exists in the Obsidian vault, creating nested folders if necessary.
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		const normalized = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
		if (!normalized) return;
		const parts = normalized.split('/');
		let currentPath = '';
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const fileOrFolder = this.app.vault.getAbstractFileByPath(currentPath);
			if (!fileOrFolder) {
				try {
					await this.app.vault.createFolder(currentPath);
				} catch (e) {
					// Ignore folder creation errors if folder was created concurrently
				}
			}
		}
	}

	/**
	 * Creates or updates a separate Media Extended companion note in the configured folder
	 * and links it back to the original summary/transcript note.
	 * Description/transcript inclusion defaults to the permanent settings unless overridden for this run.
	 */
	private async createMediaExtendedCompanionNote(
		transcript: TranscriptResponse,
		originalFile?: TFile | null,
		runOptions?: Pick<MediaExtendedRunOptions, 'includeDescription' | 'includeTranscript'>
	): Promise<TFile | null> {
		const includeDescription = runOptions?.includeDescription ?? this.settings.getMediaExtendedIncludeDescription();
		const includeTranscript = runOptions?.includeTranscript ?? this.settings.getMediaExtendedIncludeTranscript();

		const folderPath = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
		await this.ensureFolderExists(folderPath);

		const sanitizedTitle = sanitizeFileName(transcript.title);
		const targetPath = `${folderPath}/${sanitizedTitle}.md`;

		if (originalFile && originalFile.path === targetPath) {
			return originalFile;
		}

		let existingMxUid: string | undefined;
		const existingAbstract = this.app.vault.getAbstractFileByPath(targetPath);
		let existingFile: TFile | null = null;
		if (existingAbstract instanceof TFile) {
			existingFile = existingAbstract;
			try {
				const existingContent = await this.app.vault.read(existingFile);
				const uidMatch = existingContent.match(/^mx-uid:\s*([a-z0-9]+)/m);
				if (uidMatch) {
					existingMxUid = uidMatch[1];
				}
			} catch (e) {
				console.warn('Could not read existing Media Extended file content:', e);
			}
		}

		const metadata: MediaExtendedMetadata = {
			mxUid: existingMxUid,
			videoId: transcript.videoId,
			title: transcript.title,
			description: transcript.description,
			duration: transcript.duration,
			creator: transcript.author,
			publishedAt: transcript.publishedAt,
			viewCount: transcript.viewCount,
			likeCount: transcript.likeCount,
		};

		let formattedTranscript = '';
		if (includeTranscript && transcript.lines && transcript.lines.length > 0) {
			formattedTranscript = formatTranscript(transcript.lines, transcript.videoId, {
				format: 'mediaExtended',
			});
		}

		let originalNoteLink: string | undefined;
		if (originalFile) {
			originalNoteLink = originalFile.parent && originalFile.parent.path !== '/' && originalFile.parent.path !== ''
				? `${originalFile.parent.path}/${originalFile.basename}`
				: originalFile.basename;
		}

		const noteContent = buildMediaExtendedNote(metadata, formattedTranscript, originalNoteLink, {
			includeDescription,
		});

		try {
			if (existingFile) {
				await this.app.vault.modify(existingFile, noteContent);
				return existingFile;
			} else {
				return await this.app.vault.create(targetPath, noteContent);
			}
		} catch (e) {
			console.error('Failed to create or update Media Extended companion note:', e);
			return null;
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

			const metadata = await this.youtubeService.fetchVideoMetadata(
				url,
				this.settings.getYoutubeApiKey()
			);
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

			// Extract tags from title & description and/or YouTube Data API if enabled
			const detectedTags: string[] = this.settings.getDetectTagsInDescriptionAndTitle()
				? [
						...extractTagsFromText(metadata.title),
						...extractTagsFromText(metadata.description || ''),
				  ]
				: [];

			const ytDataApiTags: string[] = (this.settings.getExtractYouTubeDataApiTags() && metadata.tags)
				? metadata.tags
				: [];

			const newTags = deduplicateTags([...detectedTags, ...ytDataApiTags]);

			const playlist = this.settings.getDiscoverPlaylist() ? metadata.playlist : undefined;
			const pTitle = playlist?.title && playlist.title.trim().toLowerCase() !== 'playlist'
				? playlist.title.trim()
				: undefined;
			const fmData: FrontmatterData = {
				title: metadata.title,
				channel_name: metadata.author,
				channel_username: metadata.channelUsername || '',
				channel_url: metadata.channelUrl,
				video_url: metadata.url,
				thumbnail: thumbnailUrl,
				thumbnail_text: thumbnailText,
				description: this.settings.getAddDescriptionToFrontmatter() ? metadata.description : undefined,
				tags: this.settings.getAddTagsToFrontmatter() ? newTags : undefined,
				playlist_title: pTitle,
				playlist_url: playlist?.url,
				playlist_id: playlist?.id,
				playlist_index: playlist?.index,
				playlist_count: playlist?.count,
			};

			applyFrontmatter(editor, fmData);
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
				BatchProgressTracker.finishEmpty(
					this,
					'Upgrade previous notes',
					scopeDescription,
					`All YouTube notes in ${scopeDescription} already have up-to-date frontmatter!`
				);
				return;
			}

			const tracker = new BatchProgressTracker(
				this,
				'Upgrade previous notes',
				scopeDescription,
				candidates.length
			);

			for (let i = 0; i < candidates.length; i++) {
				const { file, url } = candidates[i];
				try {
					const metadata = await this.youtubeService.fetchVideoMetadata(
						url,
						this.settings.getYoutubeApiKey()
					);
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

					// Extract tags from title & description and/or YouTube Data API if enabled
					const detectedTags: string[] = this.settings.getDetectTagsInDescriptionAndTitle()
						? [
								...extractTagsFromText(metadata.title),
								...extractTagsFromText(metadata.description || ''),
						  ]
						: [];

					const ytDataApiTags: string[] = (this.settings.getExtractYouTubeDataApiTags() && metadata.tags)
						? metadata.tags
						: [];

					const newTags = deduplicateTags([...detectedTags, ...ytDataApiTags]);

					const playlist = this.settings.getDiscoverPlaylist() ? metadata.playlist : undefined;
					const pTitle = playlist?.title && playlist.title.trim().toLowerCase() !== 'playlist'
						? playlist.title.trim()
						: undefined;
					const fmData: FrontmatterData = {
						title: metadata.title,
						channel_name: metadata.author,
						channel_username: metadata.channelUsername || '',
						channel_url: metadata.channelUrl,
						video_url: metadata.url,
						thumbnail: thumbnailUrl,
						thumbnail_text: thumbnailText,
						description: this.settings.getAddDescriptionToFrontmatter() ? metadata.description : undefined,
						tags: this.settings.getAddTagsToFrontmatter() ? newTags : undefined,
						playlist_title: pTitle,
						playlist_url: playlist?.url,
						playlist_id: playlist?.id,
						playlist_index: playlist?.index,
						playlist_count: playlist?.count,
					};

					const currentContent = await this.app.vault.read(file);
					const updatedContent = updateNoteContentWithFrontmatter(currentContent, fmData);
					await this.app.vault.modify(file, updatedContent);

					tracker.recordItem({
						filePath: file.path,
						fileName: file.basename,
						url,
						status: 'success',
						message: `Upgraded frontmatter (${metadata.title})${thumbnailText ? ' with OCR text' : ''}`
					});
				} catch (error) {
					tracker.recordItem({
						filePath: file.path,
						fileName: file.basename,
						url,
						status: 'error',
						message: error.message || String(error)
					});
				}

				if (i < candidates.length - 1) {
					await new Promise((res) => setTimeout(res, 300));
				}
			}

			tracker.finish();
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
		const files = filterFilesByFolder(this.app.vault.getMarkdownFiles(), folder);
		const scopeDescription = folder.isRoot() ? 'vault root' : `folder "${folder.path}"`;
		await this.upgradeNotes(files, scopeDescription);
	}

	/**
	 * Scans notes within user-configured folders for YouTube videos missing new frontmatter.
	 */
	public async upgradeNotesInConfiguredFolders(): Promise<void> {
		const configuredFolders = this.settings.getScanFolderList();
		if (configuredFolders.length === 0) {
			this.promptFolderUpgrade();
			return;
		}
		const files = filterFilesByFolderPaths(this.app.vault.getMarkdownFiles(), configuredFolders);
		const scopeDescription = `folders (${configuredFolders.join(', ')})`;
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

	/**
	 * Processes a list of markdown files, creating Media Extended companion notes for any
	 * that lack one, and adds the bidirectional link.
	 * @param files The files to scan.
	 * @param scopeDescription Human-readable label for progress notifications.
	 */
	public async processMediaExtendedNotes(files: TFile[], scopeDescription: string): Promise<void> {
		if (this.isProcessing) {
			new Notice('Already processing a video or upgrading notes, please wait...');
			return;
		}

		try {
			this.isProcessing = true;
			const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
			new Notice(`Scanning ${scopeDescription} for video summary notes without Media Extended companion notes...`);

			const candidates: { file: TFile; url: string; title: string }[] = [];

			for (const file of files) {
				const content = await this.app.vault.read(file);

				// Skip companion notes themselves
				if (isMediaExtendedCompanionNote(content, file.path, mediaFolder)) {
					continue;
				}

				const url = extractYouTubeUrlFromNote(content);
				if (!url) {
					continue;
				}

				// Determine title from frontmatter or filename
				const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
				let title = file.basename;
				if (fmMatch) {
					const titleMatch = fmMatch[1].match(/^title:\s*["']?([^"'\r\n]+)["']?/m);
					if (titleMatch && titleMatch[1].trim()) {
						title = titleMatch[1].trim();
					}
				}

				const expectedBasename = sanitizeFileName(title);
				if (hasRelatedMediaExtendedLink(content, mediaFolder, expectedBasename)) {
					continue;
				}

				candidates.push({ file, url, title });
			}

			if (candidates.length === 0) {
				BatchProgressTracker.finishEmpty(
					this,
					'Create Media Extended companion notes',
					scopeDescription,
					`All video summary notes in ${scopeDescription} already have matching Media Extended companion notes!`
				);
				return;
			}

			const tracker = new BatchProgressTracker(
				this,
				'Create Media Extended companion notes',
				scopeDescription,
				candidates.length
			);

			for (let i = 0; i < candidates.length; i++) {
				const { file, url } = candidates[i];
				try {
					const transcript = await this.youtubeService.fetchTranscript(
						url,
						'en',
						this.settings.getYoutubeApiKey()
					);

					const mediaNote = await this.createMediaExtendedCompanionNote(transcript, file);
					if (mediaNote) {
						const mediaLink = mediaFolder ? `${mediaFolder}/${mediaNote.basename}` : mediaNote.basename;
						const currentContent = await this.app.vault.read(file);
						const updatedContent = addRelatedLink(currentContent, mediaLink);
						await this.app.vault.modify(file, updatedContent);

						tracker.recordItem({
							filePath: file.path,
							fileName: file.basename,
							url,
							status: 'success',
							message: `Created companion note "${mediaNote.basename}" with ${transcript.lines.length} transcript line(s)`
						});
					} else {
						tracker.recordItem({
							filePath: file.path,
							fileName: file.basename,
							url,
							status: 'error',
							message: 'Failed to create Media Extended companion note'
						});
					}
				} catch (error) {
					tracker.recordItem({
						filePath: file.path,
						fileName: file.basename,
						url,
						status: 'error',
						message: error.message || String(error)
					});
				}

				if (i < candidates.length - 1) {
					await new Promise((res) => setTimeout(res, 300));
				}
			}

			tracker.finish();
		} catch (error) {
			new Notice(`Failed to process Media Extended notes: ${error.message}`);
			console.error('Failed to create missing Media Extended notes:', error);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Scans all notes in the vault for video summary notes without companion notes.
	 */
	public async createMediaExtendedInVault(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles();
		await this.processMediaExtendedNotes(files, 'vault');
	}

	/**
	 * Scans notes within a specific folder (and its subfolders) for video summary notes without companion notes.
	 */
	public async createMediaExtendedInFolder(folder: TFolder): Promise<void> {
		const files = filterFilesByFolder(this.app.vault.getMarkdownFiles(), folder);
		const scopeDescription = folder.isRoot() ? 'vault root' : `folder "${folder.path}"`;
		await this.processMediaExtendedNotes(files, scopeDescription);
	}

	/**
	 * Scans notes within user-configured folders for video summary notes without companion notes.
	 */
	public async createMediaExtendedInConfiguredFolders(): Promise<void> {
		const configuredFolders = this.settings.getScanFolderList();
		if (configuredFolders.length === 0) {
			this.promptCreateMediaExtendedNotes();
			return;
		}
		const files = filterFilesByFolderPaths(this.app.vault.getMarkdownFiles(), configuredFolders);
		const scopeDescription = `folders (${configuredFolders.join(', ')})`;
		await this.processMediaExtendedNotes(files, scopeDescription);
	}

	/**
	 * Opens a folder selection modal to create companion notes in the chosen folder.
	 */
	public promptCreateMediaExtendedNotes(): void {
		new FolderSuggestModal(this.app, async (folder) => {
			await this.createMediaExtendedInFolder(folder);
		}).open();
	}

	/**
	 * Entry point for creating missing Media Extended notes.
	 * If folder is specified, runs on that folder.
	 * If scanFolders setting is configured, runs on configured folders.
	 * Otherwise prompts folder selection modal to prevent unintended vault-wide scans.
	 */
	public async createMediaExtendedForMissingNotes(folder?: TFolder): Promise<void> {
		if (folder) {
			await this.createMediaExtendedInFolder(folder);
			return;
		}
		const configuredFolders = this.settings.getScanFolderList();
		if (configuredFolders.length > 0) {
			await this.createMediaExtendedInConfiguredFolders();
			return;
		}
		this.promptCreateMediaExtendedNotes();
	}

	/**
	 * Processes a list of markdown files, upgrading video summary notes that lack description frontmatter.
	 * @param files The files to scan.
	 * @param scopeDescription Human-readable label for progress notifications.
	 */
	public async processNotesWithTagsAndDescription(files: TFile[], scopeDescription: string): Promise<void> {
		if (this.isProcessing) {
			new Notice('Already processing a video or upgrading notes, please wait...');
			return;
		}

		try {
			this.isProcessing = true;
			const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
			new Notice(`Scanning ${scopeDescription} for video summary notes missing description frontmatter...`);

			const candidates: { file: TFile; url: string }[] = [];

			for (const file of files) {
				const content = await this.app.vault.read(file);

				// Skip companion notes
				if (isMediaExtendedCompanionNote(content, file.path, mediaFolder)) {
					continue;
				}

				const url = extractYouTubeUrlFromNote(content);
				if (!url) {
					continue;
				}

				if (isNoteMissingDescriptionFrontmatter(content)) {
					candidates.push({ file, url });
				}
			}

			if (candidates.length === 0) {
				BatchProgressTracker.finishEmpty(
					this,
					'Upgrade tags & description frontmatter',
					scopeDescription,
					`All video summary notes in ${scopeDescription} already have description frontmatter!`
				);
				return;
			}

			const tracker = new BatchProgressTracker(
				this,
				'Upgrade tags & description frontmatter',
				scopeDescription,
				candidates.length
			);

			for (let i = 0; i < candidates.length; i++) {
				const { file, url } = candidates[i];
				try {
					const metadata = await this.youtubeService.fetchVideoMetadata(
						url,
						this.settings.getYoutubeApiKey()
					);
					const thumbnailUrl = YouTubeService.getThumbnailUrl(metadata.videoId);

					const currentContent = await this.app.vault.read(file);
					const fmMatch = currentContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
					let thumbnailText = '';
					if (fmMatch) {
						const tMatch = fmMatch[1].match(/^thumbnail_text:\s*["']?([^"'\r\n]*)["']?/m);
						if (tMatch) thumbnailText = tMatch[1].trim();
					}

					// Extract tags from title & description and/or YouTube Data API
					const detectedTags: string[] = this.settings.getDetectTagsInDescriptionAndTitle()
						? [
								...extractTagsFromText(metadata.title),
								...extractTagsFromText(metadata.description || ''),
						  ]
						: [];

					const ytDataApiTags: string[] = (this.settings.getExtractYouTubeDataApiTags() && metadata.tags)
						? metadata.tags
						: [];

					const newTags = deduplicateTags([...detectedTags, ...ytDataApiTags]);
					const playlist = this.settings.getDiscoverPlaylist() ? metadata.playlist : undefined;
					const pTitle = playlist?.title && playlist.title.trim().toLowerCase() !== 'playlist'
						? playlist.title.trim()
						: undefined;

					const fmData: FrontmatterData = {
						title: metadata.title,
						channel_name: metadata.author,
						channel_username: metadata.channelUsername || '',
						channel_url: metadata.channelUrl,
						video_url: metadata.url,
						thumbnail: thumbnailUrl,
						thumbnail_text: thumbnailText,
						description: metadata.description,
						tags: this.settings.getAddTagsToFrontmatter() ? newTags : undefined,
						playlist_title: pTitle,
						playlist_url: playlist?.url,
						playlist_id: playlist?.id,
						playlist_index: playlist?.index,
						playlist_count: playlist?.count,
					};

					const updatedContent = updateNoteContentWithFrontmatter(currentContent, fmData);
					await this.app.vault.modify(file, updatedContent);

					tracker.recordItem({
						filePath: file.path,
						fileName: file.basename,
						url,
						status: 'success',
						message: `Added description (${(metadata.description || '').length} chars) and ${newTags.length} tag(s)`
					});
				} catch (error) {
					tracker.recordItem({
						filePath: file.path,
						fileName: file.basename,
						url,
						status: 'error',
						message: error.message || String(error)
					});
				}

				if (i < candidates.length - 1) {
					await new Promise((res) => setTimeout(res, 300));
				}
			}

			tracker.finish();
		} catch (error) {
			new Notice(`Failed to upgrade notes: ${error.message}`);
			console.error('Failed to upgrade notes with tags and description:', error);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Scans all notes in the vault for video summary notes missing description frontmatter and upgrades them.
	 */
	public async upgradeNotesWithTagsAndDescriptionInVault(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles();
		await this.processNotesWithTagsAndDescription(files, 'vault');
	}

	/**
	 * Scans notes within a specific folder (and its subfolders) for video summary notes missing description frontmatter.
	 */
	public async upgradeNotesWithTagsAndDescriptionInFolder(folder: TFolder): Promise<void> {
		const files = filterFilesByFolder(this.app.vault.getMarkdownFiles(), folder);
		const scopeDescription = folder.isRoot() ? 'vault root' : `folder "${folder.path}"`;
		await this.processNotesWithTagsAndDescription(files, scopeDescription);
	}

	/**
	 * Scans notes within user-configured folders for video summary notes missing description frontmatter.
	 */
	public async upgradeNotesWithTagsAndDescriptionInConfiguredFolders(): Promise<void> {
		const configuredFolders = this.settings.getScanFolderList();
		if (configuredFolders.length === 0) {
			this.promptUpgradeNotesWithTagsAndDescription();
			return;
		}
		const files = filterFilesByFolderPaths(this.app.vault.getMarkdownFiles(), configuredFolders);
		const scopeDescription = `folders (${configuredFolders.join(', ')})`;
		await this.processNotesWithTagsAndDescription(files, scopeDescription);
	}

	/**
	 * Opens a folder selection modal to upgrade notes missing description frontmatter in the chosen folder.
	 */
	public promptUpgradeNotesWithTagsAndDescription(): void {
		new FolderSuggestModal(this.app, async (folder) => {
			await this.upgradeNotesWithTagsAndDescriptionInFolder(folder);
		}).open();
	}

	/**
	 * Entry point for upgrading notes with tags & description frontmatter.
	 * If folder is specified, runs on that folder.
	 * If scanFolders setting is configured, runs on configured folders.
	 * Otherwise prompts folder selection modal to prevent unintended vault-wide scans.
	 */
	public async upgradeNotesWithTagsAndDescription(folder?: TFolder): Promise<void> {
		if (folder) {
			await this.upgradeNotesWithTagsAndDescriptionInFolder(folder);
			return;
		}
		const configuredFolders = this.settings.getScanFolderList();
		if (configuredFolders.length > 0) {
			await this.upgradeNotesWithTagsAndDescriptionInConfiguredFolders();
			return;
		}
		this.promptUpgradeNotesWithTagsAndDescription();
	}

	/**
	 * Processes a list of markdown files, checking each for YouTube video summary notes
	 * that lack playlist properties in their frontmatter, querying YouTube Data API for playlist membership,
	 * and merging playlist metadata into the frontmatter.
	 */
	public async processNotesWithPlaylist(files: TFile[], scopeDescription: string): Promise<void> {
		if (this.isProcessing) {
			new Notice('Already processing a video or upgrading notes, please wait...');
			return;
		}

		try {
			this.isProcessing = true;
			const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
			new Notice(`Scanning ${scopeDescription} for video summary notes missing playlist frontmatter...`);

			const candidates: { file: TFile; url: string }[] = [];

			for (const file of files) {
				const content = await this.app.vault.read(file);

				// Skip companion notes
				if (isMediaExtendedCompanionNote(content, file.path, mediaFolder)) {
					continue;
				}

				const url = extractYouTubeUrlFromNote(content);
				if (!url) {
					continue;
				}

				if (isNoteMissingPlaylistFrontmatter(content)) {
					candidates.push({ file, url });
				}
			}

			if (candidates.length === 0) {
				BatchProgressTracker.finishEmpty(
					this,
					'Upgrade playlist frontmatter',
					scopeDescription,
					`All video summary notes in ${scopeDescription} already have playlist frontmatter!`
				);
				return;
			}

			const tracker = new BatchProgressTracker(
				this,
				'Upgrade playlist frontmatter',
				scopeDescription,
				candidates.length
			);

			for (let i = 0; i < candidates.length; i++) {
				const { file, url } = candidates[i];
				try {
					const metadata = await this.youtubeService.fetchVideoMetadata(
						url,
						this.settings.getYoutubeApiKey()
					);

					if (metadata.playlist) {
						const currentContent = await this.app.vault.read(file);
						const fmMatch = currentContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
						let thumbnailText = '';
						if (fmMatch) {
							const tMatch = fmMatch[1].match(/^thumbnail_text:\s*["']?([^"'\r\n]*)["']?/m);
							if (tMatch) thumbnailText = tMatch[1].trim();
						}

						const pTitle = metadata.playlist.title && metadata.playlist.title.trim().toLowerCase() !== 'playlist'
							? metadata.playlist.title.trim()
							: undefined;

						const fmData: FrontmatterData = {
							title: metadata.title,
							channel_name: metadata.author,
							channel_username: metadata.channelUsername || '',
							channel_url: metadata.channelUrl,
							video_url: metadata.url,
							thumbnail: YouTubeService.getThumbnailUrl(metadata.videoId),
							thumbnail_text: thumbnailText,
							description: this.settings.getAddDescriptionToFrontmatter() ? metadata.description : undefined,
							playlist_title: pTitle,
							playlist_url: metadata.playlist.url,
							playlist_id: metadata.playlist.id,
							playlist_index: metadata.playlist.index,
							playlist_count: metadata.playlist.count,
						};

						let updatedContent = updateNoteContentWithFrontmatter(currentContent, fmData, { excludeTags: true });
						if (pTitle) {
							// Update any legacy "Playlist: Playlist" links in the note body
							updatedContent = updatedContent.replace(
								/\[Playlist:\s*Playlist(\s*\([^)]*\))?\]/gi,
								`[Playlist: ${pTitle}$1]`
							);
						}
						await this.app.vault.modify(file, updatedContent);

						tracker.recordItem({
							filePath: file.path,
							fileName: file.basename,
							url,
							status: 'success',
							message: pTitle
								? `Added playlist: "${pTitle}" (Index ${metadata.playlist.index || '?'}/${metadata.playlist.count || '?'})`
								: `Added playlist: ${metadata.playlist.id} (Index ${metadata.playlist.index || '?'}/${metadata.playlist.count || '?'})`
						});
					} else {
						tracker.recordItem({
							filePath: file.path,
							fileName: file.basename,
							url,
							status: 'skipped',
							message: 'Video is not part of a playlist on YouTube'
						});
					}
				} catch (error) {
					tracker.recordItem({
						filePath: file.path,
						fileName: file.basename,
						url,
						status: 'error',
						message: error.message || String(error)
					});
				}

				if (i < candidates.length - 1) {
					await new Promise((res) => setTimeout(res, 300));
				}
			}

			tracker.finish();
		} catch (error) {
			new Notice(`Failed to upgrade notes with playlist: ${error.message}`);
			console.error('Failed to upgrade notes with playlist:', error);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Scans all notes in the vault for video summary notes missing playlist frontmatter and upgrades them.
	 */
	public async upgradeNotesWithPlaylistInVault(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles();
		await this.processNotesWithPlaylist(files, 'vault');
	}

	/**
	 * Scans notes within a specific folder (and its subfolders) for video summary notes missing playlist frontmatter.
	 */
	public async upgradeNotesWithPlaylistInFolder(folder: TFolder): Promise<void> {
		const files = filterFilesByFolder(this.app.vault.getMarkdownFiles(), folder);
		const scopeDescription = folder.isRoot() ? 'vault root' : `folder "${folder.path}"`;
		await this.processNotesWithPlaylist(files, scopeDescription);
	}

	/**
	 * Scans notes within user-configured folders for video summary notes missing playlist frontmatter.
	 */
	public async upgradeNotesWithPlaylistInConfiguredFolders(): Promise<void> {
		const configuredFolders = this.settings.getScanFolderList();
		if (configuredFolders.length === 0) {
			this.promptUpgradeNotesWithPlaylist();
			return;
		}
		const files = filterFilesByFolderPaths(this.app.vault.getMarkdownFiles(), configuredFolders);
		const scopeDescription = `folders (${configuredFolders.join(', ')})`;
		await this.processNotesWithPlaylist(files, scopeDescription);
	}

	/**
	 * Opens a folder selection modal to upgrade notes missing playlist frontmatter in the chosen folder.
	 */
	public promptUpgradeNotesWithPlaylist(): void {
		new FolderSuggestModal(this.app, async (folder) => {
			await this.upgradeNotesWithPlaylistInFolder(folder);
		}).open();
	}

	/**
	 * Entry point for upgrading notes with playlist frontmatter from YouTube Data API.
	 * If folder is specified, runs on that folder.
	 * If scanFolders setting is configured, runs on configured folders.
	 * Otherwise prompts folder selection modal to prevent unintended vault-wide scans.
	 */
	public async upgradeNotesWithPlaylist(folder?: TFolder): Promise<void> {
		if (folder) {
			await this.upgradeNotesWithPlaylistInFolder(folder);
			return;
		}
		const configuredFolders = this.settings.getScanFolderList();
		if (configuredFolders.length > 0) {
			await this.upgradeNotesWithPlaylistInConfiguredFolders();
			return;
		}
		this.promptUpgradeNotesWithPlaylist();
	}

	/**
	 * Processes a list of markdown files, finding those where playlist_title is the generic "Playlist"
	 * placeholder and re-fetching the real playlist title (using the stored playlist_id — no full
	 * video metadata fetch required). Updates both frontmatter and body link text.
	 */
	public async processFixPlaylistTitlePlaceholder(files: TFile[], scopeDescription: string): Promise<void> {
		if (this.isProcessing) {
			new Notice('Already processing a video or upgrading notes, please wait...');
			return;
		}

		try {
			this.isProcessing = true;
			const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
			new Notice(`Scanning ${scopeDescription} for notes with placeholder playlist titles...`);

			const candidates: { file: TFile; playlistId: string }[] = [];

			for (const file of files) {
				const content = await this.app.vault.read(file);

				// Skip companion notes
				if (isMediaExtendedCompanionNote(content, file.path, mediaFolder)) {
					continue;
				}

				if (hasPlaylistTitlePlaceholder(content)) {
					const playlistId = extractPlaylistIdFromFrontmatter(content);
					if (playlistId) {
						candidates.push({ file, playlistId });
					}
				}
			}

			if (candidates.length === 0) {
				BatchProgressTracker.finishEmpty(
					this,
					'Fix playlist title placeholder',
					scopeDescription,
					`No notes with a placeholder playlist title found in ${scopeDescription}.`
				);
				return;
			}

			const tracker = new BatchProgressTracker(
				this,
				'Fix playlist title placeholder',
				scopeDescription,
				candidates.length
			);

			for (let i = 0; i < candidates.length; i++) {
				const { file, playlistId } = candidates[i];
				try {
					// Fetch the real title directly — no full video metadata fetch needed
					const details = await YouTubeService.fetchPlaylistDetails(
						playlistId,
						this.settings.getYoutubeApiKey() || undefined
					);

					const pTitle = details.title && details.title.trim().toLowerCase() !== 'playlist'
						? details.title.trim()
						: undefined;

					if (pTitle) {
						const currentContent = await this.app.vault.read(file);

						// Replace only the playlist_title line — leave all other frontmatter untouched
						let updatedContent = currentContent.replace(
							/^(playlist_title:\s*)["']?Playlist["']?\s*$/im,
							`playlist_title: ${JSON.stringify(pTitle)}`
						);

						// Also fix any legacy "Playlist: Playlist" body link text
						updatedContent = updatedContent.replace(
							/\[Playlist:\s*Playlist(\s*\([^)]*\))?\]/gi,
							`[Playlist: ${pTitle}$1]`
						);

						await this.app.vault.modify(file, updatedContent);

						tracker.recordItem({
							filePath: file.path,
							fileName: file.basename,
							url: `https://www.youtube.com/playlist?list=${playlistId}`,
							status: 'success',
							message: `Playlist title fixed → "${pTitle}"`,
						});
					} else {
						tracker.recordItem({
							filePath: file.path,
							fileName: file.basename,
							url: `https://www.youtube.com/playlist?list=${playlistId}`,
							status: 'skipped',
							message: 'Could not determine real playlist title from YouTube',
						});
					}
				} catch (error) {
					tracker.recordItem({
						filePath: file.path,
						fileName: file.basename,
						url: `https://www.youtube.com/playlist?list=${playlistId}`,
						status: 'error',
						message: error.message || String(error),
					});
				}

				if (i < candidates.length - 1) {
					await new Promise((res) => setTimeout(res, 300));
				}
			}

			tracker.finish();
		} catch (error) {
			new Notice(`Failed to fix playlist title placeholders: ${error.message}`);
			console.error('Failed to fix playlist title placeholders:', error);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Fixes playlist_title placeholders within a specific folder (and its subfolders).
	 */
	public async fixPlaylistTitlePlaceholderInFolder(folder: TFolder): Promise<void> {
		const files = filterFilesByFolder(this.app.vault.getMarkdownFiles(), folder);
		const scopeDescription = folder.isRoot() ? 'vault root' : `folder "${folder.path}"`;
		await this.processFixPlaylistTitlePlaceholder(files, scopeDescription);
	}

	/**
	 * Opens a folder selection modal for the fix-playlist-title-placeholder command.
	 */
	public promptFixPlaylistTitlePlaceholder(): void {
		new FolderSuggestModal(this.app, async (folder) => {
			await this.fixPlaylistTitlePlaceholderInFolder(folder);
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
	 * Retrieves the transcript for a YouTube video without generating an AI summary.
	 * Transcript and description timestamps are linked to the video in standard YouTube format.
	 */
	public async retrieveTranscript(
		url: string,
		editor: Editor,
		view?: MarkdownView,
		mediaExtendedOptions: MediaExtendedRunOptions = this.getDefaultMediaExtendedRunOptions()
	): Promise<void> {

		if (this.isProcessing) {
			new Notice('Already processing a video, please wait...');
			return;
		}

		try {
			this.isProcessing = true;
			new Notice('Fetching video transcript...');

			let transcript: TranscriptResponse;
			try {
				transcript = await this.youtubeService.fetchTranscript(
					url,
					'en',
					this.settings.getYoutubeApiKey()
				);
			} catch (error) {
				new Notice(`Error: ${error.message}`);
				return;
			}

			const thumbnailUrl = YouTubeService.getThumbnailUrl(transcript.videoId);

			// Extract tags from title & description and/or YouTube Data API metadata if enabled
			const detectedTags: string[] = this.settings.getDetectTagsInDescriptionAndTitle()
				? [
						...extractTagsFromText(transcript.title),
						...extractTagsFromText(transcript.description || ''),
				  ]
				: [];

			const ytDataApiTags: string[] = (this.settings.getExtractYouTubeDataApiTags() && transcript.tags)
				? transcript.tags
				: [];

			const allTags = deduplicateTags([...detectedTags, ...ytDataApiTags]);

			// Optionally rename note based on video title
			if (this.settings.getSetNoteTitleFromVideo() && view?.file) {
				await this.setNoteTitle(view.file, transcript.title);
			}

			const addInlineTags = this.settings.getAddInlineTags();
			const addTagsToFrontmatter = this.settings.getAddTagsToFrontmatter();
			const inlineTags = addInlineTags ? allTags : undefined;
			const frontmatterTags = addTagsToFrontmatter ? allTags : undefined;

			// Format transcript
			const formattedTranscript = formatTranscript(transcript.lines, transcript.videoId, {
				format: 'youtube',
			});

			let metaLine = `👤 [${transcript.author}](${transcript.channelUrl})  🔗 [Watch video](${url})`;
			if (this.settings.getDiscoverPlaylist() && transcript.playlist) {
				const p = transcript.playlist;
				let pLabel = p.title ?? 'Playlist';
				if (typeof p.index === 'number' && typeof p.count === 'number') {
					pLabel += ` (${p.index}/${p.count})`;
				} else if (typeof p.index === 'number') {
					pLabel += ` (#${p.index})`;
				}
				metaLine += `  📋 [Playlist: ${pLabel}](${p.url})`;
			}
			const metaLines = [metaLine];
			if (inlineTags && inlineTags.length > 0) {
				metaLines.push(`**Tags:** ${inlineTags.map((t) => `#${t}`).join(' ')}`);
			}

			const bodyParts: string[] = [];
			if (this.settings.getIncludeTitleInBody() && transcript.title) {
				bodyParts.push(`# ${transcript.title}`);
			}
			bodyParts.push(
				`![Thumbnail](${thumbnailUrl})`,
				metaLines.join('\n\n'),
				`## Transcript\n\n${formattedTranscript}`
			);

			if (this.settings.getIncludeVideoDescription() && transcript.description && transcript.description.trim()) {
				const formattedDescription = convertTimestampsToLinks(transcript.description.trim(), transcript.videoId, 'youtube');
				bodyParts.push(`## Description\n\n${formattedDescription}`);
			}

			let bodyContent = bodyParts.join('\n\n');

			if (mediaExtendedOptions.createNote) {

				try {
					const mediaNote = await this.createMediaExtendedCompanionNote(transcript, view?.file, mediaExtendedOptions);
					if (mediaNote) {
						const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
						const mediaLink = mediaFolder ? `${mediaFolder}/${mediaNote.basename}` : mediaNote.basename;
						bodyContent = addRelatedLink(bodyContent, mediaLink);
					}
				} catch (e) {
					console.error('Failed to create Media Extended companion note:', e);
				}
			}

			const playlist = this.settings.getDiscoverPlaylist() ? transcript.playlist : undefined;
			const fmData: FrontmatterData = {
				title: transcript.title,
				channel_name: transcript.author,
				channel_username: transcript.channelUsername || '',
				channel_url: transcript.channelUrl,
				video_url: url,
				thumbnail: thumbnailUrl,
				thumbnail_text: '',
				description: this.settings.getAddDescriptionToFrontmatter() ? transcript.description : undefined,
				tags: frontmatterTags,
				playlist_title: playlist?.title,
				playlist_url: playlist?.url,
				playlist_id: playlist?.id,
				playlist_index: playlist?.index,
				playlist_count: playlist?.count,
			};

			const isEditorEmpty = editor.getValue().trim() === '';
			if (isEditorEmpty) {
				const frontmatterString = buildFrontmatter(fmData);
				editor.setValue(`${frontmatterString}\n\n${bodyContent}`);
			} else {
				editor.replaceSelection(bodyContent);
				applyFrontmatter(editor, fmData);
			}

			new Notice('Transcript retrieved successfully!');
		} catch (error) {
			new Notice(`Failed to retrieve transcript: ${error.message}`);
			console.error('Failed to retrieve transcript:', error);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Generates a summary string based on the provided transcript, thumbnail URL, video URL, summary,
	 * optional inline tags, optional video description, optional title heading, and optional transcript dump.
	 */
	private generateSummary(
		transcript: TranscriptResponse,
		thumbnailUrl: string,
		url: string,
		summaryText: string,
		inlineTags?: string[],
		includeDescription = true,
		includeTitle = false,
		dumpTranscript = false
	): string {
		let metaLine = `👤 [${transcript.author}](${transcript.channelUrl})  🔗 [Watch video](${url})`;
		if (this.settings.getDiscoverPlaylist() && transcript.playlist) {
			const p = transcript.playlist;
			let pLabel = p.title ?? 'Playlist';
			if (typeof p.index === 'number' && typeof p.count === 'number') {
				pLabel += ` (${p.index}/${p.count})`;
			} else if (typeof p.index === 'number') {
				pLabel += ` (#${p.index})`;
			}
			metaLine += `  📋 [Playlist: ${pLabel}](${p.url})`;
		}
		const metaLines = [metaLine];

		if (inlineTags && inlineTags.length > 0) {
			metaLines.push(`**Tags:** ${inlineTags.map((t) => `#${t}`).join(' ')}`);
		}

		const summaryParts: string[] = [];
		if (includeTitle && transcript.title) {
			summaryParts.push(`# ${transcript.title}`);
		}

		// Link any timestamps the AI included to the video in standard YouTube format
		summaryParts.push(
			`![Thumbnail](${thumbnailUrl})`,
			metaLines.join('\n\n'),
			convertTimestampsToLinks(summaryText, transcript.videoId, 'youtube')
		);

		if (dumpTranscript && transcript.lines && transcript.lines.length > 0) {
			const formattedTranscript = formatTranscript(transcript.lines, transcript.videoId, {
				format: 'youtube',
			});
			summaryParts.push(`## Transcript\n\n${formattedTranscript}`);
		}

		if (includeDescription && transcript.description && transcript.description.trim()) {
			const formattedDescription = convertTimestampsToLinks(transcript.description.trim(), transcript.videoId, 'youtube');
			summaryParts.push(`## Description\n\n${formattedDescription}`);
		}

		return summaryParts.join('\n\n');
	}

	/**
	 * Automatically detects a running LM Studio instance and connects to it,
	 * discovering loaded models and updating the active model.
	 */
	public async detectAndConnectLMStudio(customUrl?: string, silent = false): Promise<boolean> {
		try {
			const targetUrl = customUrl || this.settings.getLmStudioUrl();
			const result = await detectLMStudioServer(targetUrl);

			if (!result.success) {
				if (!silent) {
					new Notice(`Could not connect to LM Studio at ${result.url}. Ensure LM Studio is open and the local server is started in the Developer tab.`);
				}
				return false;
			}

			// Save detected URL back to settings if different
			if (result.url !== this.settings.getLmStudioUrl()) {
				await this.settings.updateLmStudioUrl(result.url);
			}

			const { modelCount, activeModelId } = await this.settings.syncLMStudioProvider(result.url, result.models);
			await this.initializeServices();

			if (!silent) {
				if (modelCount === 0) {
					new Notice(`Connected to LM Studio at ${result.url}, but no models are loaded. Please load a model in LM Studio and try again.`);
				} else {
					const modelName = activeModelId ? activeModelId.split(':')[1] : (result.models[0]?.id || 'LM Studio');
					new Notice(`Connected to LM Studio at ${result.url}! Discovered ${modelCount} model(s). Active model set to "${modelName}".`);
				}
			}

			return true;
		} catch (error: any) {
			console.error('Failed to detect/connect LM Studio:', error);
			if (!silent) {
				new Notice(`Error connecting to LM Studio: ${error?.message || error}`);
			}
			return false;
		}
	}
}

export default YouTubeSummarizerPlugin;
