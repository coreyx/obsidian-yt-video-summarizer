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
	addMissingUserFlags,
	addRelatedLink,
	addTagsToNoteContent,
	applyFrontmatter,
	buildFrontmatter,
	buildCoverEmbed,
	buildMediaExtendedNote,
	convertDescriptionTimestampsToMediaExtended,
	convertTimestampsToLinks,
	deduplicateTags,
	ensureSectionOrder,
	extractFrontmatterTags,
	extractVideoIdFromUrl,
	extractTagsFromText,
	extractYouTubeUrlFromNote,
	filterFilesByFolder,
	filterFilesByFolderPaths,
	formatTranscript,
	FrontmatterData,
	frontmatterMatchesVideo,
	getVideoNoteKind,
	hasMarkdownSection,
	isBlankNoteForSummary,
	hasRelatedMediaExtendedLink,
	isMediaExtendedCompanionNote,
	keepExtraFrontmatter,
	MediaExtendedMetadata,
	refreshMediaExtendedNoteContent,
	sanitizeFileName,
	stripWikilinksFromTechnicalTerms,
	updateNoteContentWithFrontmatter,
	upsertMarkdownSection,
	USER_FLAG_KEYS,
	videoStatsFrontmatter,
} from './utils/frontmatter';
import { ConfirmModal } from './ui/modals/ConfirmModal';
import { buildVaultTagData } from './utils/vaultTags';
import { VaultTagData } from './types';
import { VIDEO_ID_REGEX } from './constants';

/** A new summary note created when summarizing from a non-blank note, and the link inserted for it */
interface PendingSummaryNote {
	file: TFile;
	sourceFile: TFile | null;
	link?: string;
	linkPrefix?: string;
}

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
								.setTitle('Create missing Media Extended notes in this folder')
								.setIcon('youtube')
								.onClick(async () => {
									await this.createMediaExtendedInFolder(file);
								});
						});
						menu.addItem((item) => {
							item
								.setTitle('Refresh video metadata in this folder')
								.setIcon('youtube')
								.onClick(async () => {
									await this.refreshVideoMetadataInFolder(file);
								});
						});
					} else if (file instanceof TFile && file.extension === 'md') {
						menu.addItem((item) => {
							item
								.setTitle('Refresh video metadata')
								.setIcon('youtube')
								.onClick(async () => {
									await this.refreshVideoMetadataInNote(file);
								});
						});

						// Offer the companion note in the other direction, based on the note's frontmatter
						const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
						const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
						const isMediaExtended = frontmatter?.['mx-uid'] != null || isMediaExtendedCompanionNote('', file.path, mediaFolder);
						if (!isMediaExtended && typeof frontmatter?.video_url === 'string') {
							menu.addItem((item) => {
								item
									.setTitle('Create Media Extended note')
									.setIcon('youtube')
									.onClick(async () => {
										await this.createMediaExtendedNoteForSummaryNote(file);
									});
							});
						} else if (isMediaExtended && [frontmatter?.video, frontmatter?.media].some((v) => typeof v === 'string' && extractVideoIdFromUrl(v))) {
							menu.addItem((item) => {
								item
									.setTitle('Create video summary note')
									.setIcon('youtube')
									.onClick(async () => {
										await this.createSummaryNoteForMediaExtendedNote(file);
									});
							});
						}
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

		// Commands to add the video description / transcript to the active Media Extended note
		this.addCommand({
			id: 'add-description-to-media-extended-note',
			name: 'Add description to Media Extended note',
			editorCallback: async (_editor: Editor, view: MarkdownView) => {
				await this.addSectionToMediaExtendedNote(view.file, 'description');
			},
		});

		this.addCommand({
			id: 'add-description-to-video-summary-note',
			name: 'Add description to video summary note',
			editorCallback: async (_editor: Editor, view: MarkdownView) => {
				await this.addDescriptionToVideoSummaryNote(view.file);
			},
		});

		this.addCommand({
			id: 'add-transcript-to-media-extended-note',
			name: 'Add transcript to Media Extended note',
			editorCallback: async (_editor: Editor, view: MarkdownView) => {
				await this.addSectionToMediaExtendedNote(view.file, 'transcript');
			},
		});

		// Commands to create the companion note in the other direction for the current note
		this.addCommand({
			id: 'create-media-extended-note-for-current-note',
			name: 'Create Media Extended note for current note',
			editorCallback: async (_editor: Editor, view: MarkdownView) => {
				await this.createMediaExtendedNoteForSummaryNote(view.file);
			},
		});

		this.addCommand({
			id: 'create-video-summary-note-for-current-note',
			name: 'Create video summary note for current note',
			editorCallback: async (_editor: Editor, view: MarkdownView) => {
				await this.createSummaryNoteForMediaExtendedNote(view.file);
			},
		});

		// Commands to add tags to the current note's frontmatter
		this.addCommand({
			id: 'tag-with-ai',
			name: 'Tag with AI',
			editorCallback: async (_editor: Editor, view: MarkdownView) => {
				await this.tagNote(view.file, 'ai');
			},
		});

		this.addCommand({
			id: 'tag-with-youtube',
			name: 'Tag with YouTube',
			editorCallback: async (_editor: Editor, view: MarkdownView) => {
				await this.tagNote(view.file, 'youtube');
			},
		});

		// Command to insert the video cover as an inline image at the cursor
		this.addCommand({
			id: 'insert-video-cover-at-cursor',
			name: 'Insert video cover at cursor',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await this.insertVideoCoverAtCursor(editor, view);
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

		// Commands to refresh video metadata (frontmatter) in video summary and Media Extended notes
		this.addCommand({
			id: 'refresh-video-metadata-current-note',
			name: 'Refresh video metadata in current note',
			editorCallback: async (_editor: Editor, view: MarkdownView) => {
				if (view.file) {
					await this.refreshVideoMetadataInNote(view.file);
				}
			},
		});

		this.addCommand({
			id: 'refresh-video-metadata-folder',
			name: 'Refresh video metadata in folder...',
			callback: () => {
				this.promptRefreshVideoMetadata();
			},
		});

		// Command to add frontmatter properties introduced by newer plugin versions, without fetching anything
		this.addCommand({
			id: 'upgrade-video-summary-frontmatter-folder',
			name: 'Upgrade video summary frontmatter in folder...',
			callback: () => {
				new FolderSuggestModal(this.app, async (folder) => {
					await this.upgradeVideoSummaryFrontmatterInFolder(folder);
				}).open();
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
	 *
	 * When triggered from a blank note, the summary is written into that note. Otherwise a new note is
	 * created in the video summaries folder, linked at the cursor, and filled in when the summary is done.
	 * All writes go through the vault, so the user can switch notes while the summary is generated.
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

		let pendingNote: PendingSummaryNote | null = null;
		let succeeded = false;

		try {
			this.isProcessing = true;
			if (!this.ensureAIReady()) {
				return;
			}

			// Step 0: Decide where the summary goes. A blank note (including an "Untitled" note with only
			// tags in its frontmatter) receives it directly; any other note gets a link at the cursor to a
			// new note in the video summaries folder.
			const sourceFile = view?.file ?? null;
			let targetFile: TFile;
			if (sourceFile && isBlankNoteForSummary(editor.getValue(), sourceFile.basename)) {
				targetFile = sourceFile;
			} else {
				pendingNote = await this.createPendingSummaryNote(url, editor, sourceFile);
				targetFile = pendingNote.file;
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
			const thumbnailUrl = await YouTubeService.getAvailableThumbnailUrl(transcript.videoId);

			// Step 1.5: New notes are always named after the video as soon as the title is known
			if (pendingNote) {
				await this.renamePendingSummaryNote(pendingNote, transcript.title);
			}

			// Steps 2–4, 6–7: AI summary, thumbnail text, tags, body, and frontmatter
			const parts = await this.buildSummaryNoteParts(transcript, url, thumbnailUrl, customPrompt);
			let bodyContent = parts.bodyContent;
			const fmData = parts.fmData;

			// Step 5: Optionally rename the blank note the user started from based on the sanitized video title
			if (!pendingNote && this.settings.getSetNoteTitleFromVideo()) {
				await this.setNoteTitle(targetFile, transcript.title);
			}

			// Step 7.5: Optionally create Media Extended companion note and link bidirectionally
			if (mediaExtendedOptions.createNote) {

				try {
					const mediaNote = await this.createMediaExtendedCompanionNote(transcript, targetFile, mediaExtendedOptions);
					if (mediaNote) {
						const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
						const mediaLink = mediaFolder ? `${mediaFolder}/${mediaNote.basename}` : mediaNote.basename;
						bodyContent = addRelatedLink(bodyContent, mediaLink);
					}
				} catch (e) {
					console.error('Failed to create Media Extended companion note:', e);
				}
			}

			// Step 8: Write the frontmatter and body to the target note.
			// Written through the vault (not the editor) so it lands in the right note regardless of focus.
			// If the blank note has tags-only frontmatter (or the user typed into it meanwhile), append and
			// merge frontmatter instead, so existing tags are kept alongside any new ones.
			await this.app.vault.process(targetFile, (current) =>
				pendingNote || current.trim() === ''
					? `${buildFrontmatter(fmData)}\n\n${bodyContent}`
					: updateNoteContentWithFrontmatter(`${current.trimEnd()}\n\n${bodyContent}`, fmData)
			);
			succeeded = true;

			new Notice(pendingNote
				? `Summary saved to "${targetFile.basename}"`
				: 'Summary generated successfully!');
		} catch (error) {
			new Notice(`Error: ${error.message}`);
			console.error('Summary generation failed:', error);
		} finally {
			if (pendingNote && !succeeded) {
				await this.discardPendingSummaryNote(pendingNote);
			}
			// Reset the processing flag
			this.isProcessing = false;
		}
	}

	/**
	 * Checks that an AI model is selected, has an API key, and its provider is initialized,
	 * showing a Notice and returning false otherwise.
	 */
	private ensureAIReady(): boolean {
		const selectedModel = this.settings.getSelectedModel();
		if (!selectedModel) {
			new Notice('No AI model selected. Please select a model in the plugin settings.');
			return false;
		}
		if (!selectedModel.provider.apiKey) {
			new Notice(`${selectedModel.provider.name} API key is missing. Please set it in the plugin settings.`);
			return false;
		}
		if (!this.provider) {
			new Notice('AI provider not initialized. Please check your settings.');
			return false;
		}
		return true;
	}

	/**
	 * Finds notes for a video in a folder (and its subfolders) by the video URL in their frontmatter
	 * `keys`. Only that folder is searched, never the whole vault.
	 */
	private findVideoNotesInFolder(folderPath: string, videoId: string, keys: string[]): TFile[] {
		return filterFilesByFolderPaths(this.app.vault.getMarkdownFiles(), [folderPath]).filter((file) =>
			frontmatterMatchesVideo(this.app.metadataCache.getFileCache(file)?.frontmatter, keys, videoId)
		);
	}

	/**
	 * Creates (or, after confirmation, rebuilds) the Media Extended companion note for a video summary note,
	 * and links the two notes under # Related. Only the Media Extended notes folder is checked for an existing one.
	 */
	public async createMediaExtendedNoteForSummaryNote(file: TFile | null): Promise<void> {
		if (!file) {
			new Notice('Open a video summary note first.');
			return;
		}
		if (this.isProcessing) {
			new Notice('Already processing a video or upgrading notes, please wait...');
			return;
		}

		const content = await this.app.vault.read(file);
		const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
		if (getVideoNoteKind(content, file.path, mediaFolder) !== 'summary') {
			new Notice(`"${file.basename}" isn't a video summary note (expected video_url frontmatter).`);
			return;
		}
		const url = extractYouTubeUrlFromNote(content);
		const videoId = url ? extractVideoIdFromUrl(url) : null;
		if (!url || !videoId) {
			new Notice(`No YouTube video found in "${file.basename}".`);
			return;
		}

		const existing = this.findVideoNotesInFolder(mediaFolder, videoId, ['video', 'media'])[0] ?? null;
		if (existing) {
			const rebuild = await ConfirmModal.confirm(
				this.app,
				'Rebuild Media Extended note?',
				`"${existing.basename}" in "${mediaFolder}" is already the Media Extended note for this video. Rebuild it? Its body (cover, description, transcript) is regenerated; frontmatter properties you added are kept.`,
				'Rebuild'
			);
			if (!rebuild) {
				return;
			}
		}

		try {
			this.isProcessing = true;
			new Notice('Fetching video transcript...');
			const transcript = await this.youtubeService.fetchTranscript(url, 'en', this.settings.getYoutubeApiKey());
			const mediaNote = await this.createMediaExtendedCompanionNote(transcript, file, undefined, existing);
			if (!mediaNote) {
				throw new Error('Could not write the Media Extended note');
			}
			await this.app.vault.process(file, (current) => addRelatedLink(current, mediaNote.path.replace(/\.md$/, '')));
			new Notice(`${existing ? 'Rebuilt' : 'Created'} Media Extended note "${mediaNote.basename}"`);
		} catch (error) {
			new Notice(`Failed to create Media Extended note: ${error.message}`);
			console.error('Failed to create Media Extended note for summary note:', error);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Creates (or, after confirmation, regenerates) the AI video summary note for a Media Extended note
	 * whose video is on YouTube, in the video summaries folder, and links the two notes under # Related.
	 * Only the video summaries folder is checked for an existing one.
	 */
	public async createSummaryNoteForMediaExtendedNote(file: TFile | null): Promise<void> {
		if (!file) {
			new Notice('Open a Media Extended note first.');
			return;
		}
		if (this.isProcessing) {
			new Notice('Already processing a video, please wait...');
			return;
		}

		const content = await this.app.vault.read(file);
		const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
		if (getVideoNoteKind(content, file.path, mediaFolder) !== 'mediaExtended') {
			new Notice(`"${file.basename}" isn't a Media Extended note (expected it in "${mediaFolder}" or with mx-uid frontmatter).`);
			return;
		}

		// Only Media Extended notes whose media is a YouTube video (not local files or other sites)
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		const url = [frontmatter?.video, frontmatter?.media].find(
			(value): value is string => typeof value === 'string' && extractVideoIdFromUrl(value) !== null
		);
		const videoId = url ? extractVideoIdFromUrl(url) : null;
		if (!url || !videoId) {
			new Notice(`"${file.basename}" isn't for a YouTube video, so it can't be summarized.`);
			return;
		}

		if (!this.ensureAIReady()) {
			return;
		}

		const summaryFolder = this.getVideoSummaryFolderPath();
		const existing = this.findVideoNotesInFolder(summaryFolder, videoId, ['video_url'])[0] ?? null;
		if (existing) {
			const regenerate = await ConfirmModal.confirm(
				this.app,
				'Regenerate video summary?',
				`"${existing.basename}" in "${summaryFolder}" is already the summary note for this video. Regenerate it? Its body is replaced with a new AI summary; frontmatter properties and tags you added are kept.`,
				'Regenerate'
			);
			if (!regenerate) {
				return;
			}
		}

		try {
			this.isProcessing = true;
			new Notice('Fetching video transcript...');
			const transcript = await this.youtubeService.fetchTranscript(url, 'en', this.settings.getYoutubeApiKey());
			const thumbnailUrl = await YouTubeService.getAvailableThumbnailUrl(transcript.videoId);
			const { bodyContent, fmData } = await this.buildSummaryNoteParts(transcript, url, thumbnailUrl);
			const body = addRelatedLink(bodyContent, file.path.replace(/\.md$/, ''));

			let summaryFile: TFile;
			if (existing) {
				// Replace the body, merging the new frontmatter into the existing one (keeps added keys, merges tags)
				await this.app.vault.process(existing, (current) => {
					const existingFrontmatter = current.replace(/\r\n/g, '\n').match(/^---\n[\s\S]*?\n---/)?.[0];
					return existingFrontmatter
						? updateNoteContentWithFrontmatter(`${existingFrontmatter}\n\n${body}`, fmData)
						: `${buildFrontmatter(fmData)}\n\n${body}`;
				});
				summaryFile = existing;
			} else {
				await this.ensureFolderExists(summaryFolder);
				const path = this.getAvailableNotePath(summaryFolder, sanitizeFileName(transcript.title));
				summaryFile = await this.app.vault.create(path, `${buildFrontmatter(fmData)}\n\n${body}`);
			}

			await this.app.vault.process(file, (current) => addRelatedLink(current, summaryFile.path.replace(/\.md$/, '')));
			new Notice(`${existing ? 'Regenerated' : 'Created'} video summary note "${summaryFile.basename}"`);
		} catch (error) {
			new Notice(`Failed to create video summary note: ${error.message}`);
			console.error('Failed to create video summary note for Media Extended note:', error);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Builds a video summary note's body and frontmatter from a fetched transcript: runs the AI summary and
	 * thumbnail text extraction, collects tags (title/description hashtags, YouTube tags, AI topic tags,
	 * deduplicated), and renders the body. Throws if the AI summary fails.
	 */
	private async buildSummaryNoteParts(
		transcript: TranscriptResponse,
		url: string,
		thumbnailUrl: string,
		customPrompt?: string
	): Promise<{ bodyContent: string; fmData: FrontmatterData }> {
		if (!this.provider) {
			throw new Error('AI provider not initialized. Please check your settings.');
		}

		// Build the prompt, then run summary generation and thumbnail text recognition concurrently
		const prompt = this.buildPrompt(transcript.lines.map((line) => line.text).join(' '), customPrompt);
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

		const [rawSummary, thumbnailText] = await Promise.all([summaryPromise, thumbnailTextPromise]);
		const summary = this.settings.getLinkTechnicalTerms()
			? rawSummary
			: stripWikilinksFromTechnicalTerms(rawSummary);

		// Extract tags from title & description, YouTube Data API/metadata, and/or generate topic tags
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
		const inlineTags = this.settings.getAddInlineTags() ? allTags : undefined;
		const frontmatterTags = this.settings.getAddTagsToFrontmatter() ? allTags : undefined;

		const bodyContent = this.generateSummary(
			transcript,
			thumbnailUrl,
			url,
			summary,
			inlineTags,
			this.settings.getIncludeTitleInBody(),
			this.settings.getDumpTranscriptInSummary()
		);

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
			...videoStatsFrontmatter(transcript),
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

		return { bodyContent, fmData };
	}

	/**
	 * Returns the normalized default / fallback folder for new video summary notes.
	 */
	private getVideoSummaryFolderPath(): string {
		return this.settings.getVideoSummaryFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Video Summaries';
	}

	/**
	 * Returns a vault path for `baseName` in `folderPath` that doesn't collide with an existing file,
	 * appending " (1)", " (2)", ... as needed. `currentPath` is treated as free (for renames).
	 */
	private getAvailableNotePath(folderPath: string, baseName: string, currentPath?: string, extension = 'md'): string {
		const parentDir = folderPath && folderPath !== '/' ? `${folderPath}/` : '';
		let targetPath = `${parentDir}${baseName}.${extension}`;
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(targetPath) && targetPath !== currentPath) {
			targetPath = `${parentDir}${baseName} (${counter}).${extension}`;
			counter++;
		}
		return targetPath;
	}

	/**
	 * Creates a placeholder note in the video summaries folder and, when started from a note,
	 * inserts a link to it at the cursor of that note.
	 */
	private async createPendingSummaryNote(url: string, editor: Editor, sourceFile: TFile | null): Promise<PendingSummaryNote> {
		const folderPath = this.getVideoSummaryFolderPath();
		await this.ensureFolderExists(folderPath);

		const videoId = url.match(VIDEO_ID_REGEX)?.[1] ?? 'video';
		const path = this.getAvailableNotePath(folderPath, `YouTube Summary ${videoId}`);
		const file = await this.app.vault.create(path, `Summarizing ${url}…\n`);

		const pending: PendingSummaryNote = { file, sourceFile };
		if (sourceFile) {
			const link = this.app.fileManager.generateMarkdownLink(file, sourceFile.path);
			// Keep a selected URL intact and put the link after it
			const linkPrefix = editor.somethingSelected() ? ' ' : '';
			const insertAt = editor.getCursor('to');
			editor.replaceRange(`${linkPrefix}${link}`, insertAt);
			editor.setCursor(editor.offsetToPos(editor.posToOffset(insertAt) + linkPrefix.length + link.length));
			pending.link = link;
			pending.linkPrefix = linkPrefix;
		}
		return pending;
	}

	/**
	 * Replaces the first occurrence of `search` in a note and returns whether it was found.
	 * A note that is open in an editor is changed through that editor: its latest edits may not be saved
	 * yet, and vault.process() only sees what is on disk.
	 */
	private async replaceInNote(file: TFile, search: string, replacement: string): Promise<boolean> {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView) || view.file?.path !== file.path) {
				continue;
			}
			const editor = view.editor;
			const index = editor.getValue().indexOf(search);
			if (index !== -1) {
				editor.replaceRange(replacement, editor.offsetToPos(index), editor.offsetToPos(index + search.length));
				return true;
			}
		}

		let found = false;
		await this.app.vault.process(file, (content) => {
			found = content.includes(search);
			return content.replace(search, () => replacement);
		});
		return found;
	}

	/**
	 * Renames a pending summary note to the sanitized video title and updates the link in the source note.
	 * The link is updated directly so it doesn't depend on the "Automatically update internal links" preference.
	 */
	private async renamePendingSummaryNote(pending: PendingSummaryNote, title: string): Promise<void> {
		const sanitizedTitle = sanitizeFileName(title);
		const folderPath = pending.file.parent?.path ?? this.getVideoSummaryFolderPath();
		const targetPath = this.getAvailableNotePath(folderPath, sanitizedTitle, pending.file.path);
		if (targetPath === pending.file.path) {
			return;
		}

		try {
			await this.app.fileManager.renameFile(pending.file, targetPath);
		} catch (error) {
			console.error('Failed to rename new summary note:', error);
			return;
		}

		const { sourceFile, link: oldLink } = pending;
		if (sourceFile && oldLink) {
			const newLink = this.app.fileManager.generateMarkdownLink(pending.file, sourceFile.path);
			if (newLink !== oldLink) {
				await this.replaceInNote(sourceFile, oldLink, newLink);
			}
			pending.link = newLink;
		}
	}

	/**
	 * Removes a pending summary note (to the trash) and its link in the source note after a failed run.
	 */
	private async discardPendingSummaryNote(pending: PendingSummaryNote): Promise<void> {
		try {
			const { sourceFile, link, linkPrefix = '' } = pending;
			if (sourceFile && link) {
				await this.replaceInNote(sourceFile, `${linkPrefix}${link}`, '');
			}
			await this.app.fileManager.trashFile(pending.file);
		} catch (error) {
			console.error('Failed to clean up new summary note after error:', error);
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

		const targetPath = this.getAvailableNotePath(file.parent?.path ?? '', sanitizedTitle, file.path, file.extension || 'md');

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
		runOptions?: Pick<MediaExtendedRunOptions, 'includeDescription' | 'includeTranscript'>,
		existingCompanion?: TFile | null
	): Promise<TFile | null> {
		const includeDescription = runOptions?.includeDescription ?? this.settings.getMediaExtendedIncludeDescription();
		const includeTranscript = runOptions?.includeTranscript ?? this.settings.getMediaExtendedIncludeTranscript();

		const folderPath = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
		await this.ensureFolderExists(folderPath);

		// Rebuild a known companion in place (even if renamed); otherwise target the title-based path
		const sanitizedTitle = sanitizeFileName(transcript.title);
		const targetPath = existingCompanion?.path ?? `${folderPath}/${sanitizedTitle}.md`;

		if (originalFile && originalFile.path === targetPath) {
			return originalFile;
		}

		let existingMxUid: string | undefined;
		let existingContent: string | undefined;
		const existingAbstract = this.app.vault.getAbstractFileByPath(targetPath);
		let existingFile: TFile | null = null;
		if (existingAbstract instanceof TFile) {
			existingFile = existingAbstract;
			try {
				existingContent = await this.app.vault.read(existingFile);
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
			aspectRatio: transcript.aspectRatio,
			cover: await YouTubeService.getCoverUrl(transcript.videoId),
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
			embedCover: this.settings.getMediaExtendedEmbedCover(),
		});

		try {
			if (existingFile) {
				// Keep frontmatter properties the user added to the existing note
				await this.app.vault.modify(existingFile, existingContent ? keepExtraFrontmatter(existingContent, noteContent) : noteContent);
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
	 * Adds the video description or transcript to a Media Extended note as a `# Description` /
	 * `# Transcript` section, detecting the video from the note. If the section already exists,
	 * asks before replacing it. Timestamps are formatted as Media Extended playback links.
	 */
	public async addSectionToMediaExtendedNote(file: TFile | null, section: 'description' | 'transcript'): Promise<void> {
		if (!file) {
			new Notice('Open a Media Extended note first.');
			return;
		}

		const heading = section === 'description' ? 'Description' : 'Transcript';
		const content = await this.app.vault.read(file);
		const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
		if (!isMediaExtendedCompanionNote(content, file.path, mediaFolder)) {
			new Notice(`"${file.basename}" isn't a Media Extended note (expected it in "${mediaFolder}" or with mx-uid frontmatter).`);
			return;
		}

		const url = extractYouTubeUrlFromNote(content);
		const videoId = url?.match(VIDEO_ID_REGEX)?.[1];
		if (!url || !videoId) {
			new Notice(`No YouTube video found in "${file.basename}".`);
			return;
		}

		if (hasMarkdownSection(content, heading)) {
			const replace = await ConfirmModal.confirm(
				this.app,
				`Replace # ${heading}?`,
				`"${file.basename}" already has a "# ${heading}" section. Continue and replace it with the ${section} from YouTube?`,
				'Replace'
			);
			if (!replace) {
				return;
			}
		}

		try {
			let body: string;
			let source = '';
			if (section === 'description') {
				const result = await this.getDescriptionForNote(file, url, videoId);
				if (!result.description.trim()) {
					new Notice('This video has no description.');
					return;
				}
				source = result.source;
				body = convertDescriptionTimestampsToMediaExtended(result.description.replace(/\r\n/g, '\n').trim(), videoId);
			} else {
				new Notice('Fetching video transcript...');
				const transcript = await this.youtubeService.fetchTranscript(url, 'en', this.settings.getYoutubeApiKey());
				if (!transcript.lines || transcript.lines.length === 0) {
					new Notice('No transcript lines found for this video.');
					return;
				}
				body = formatTranscript(transcript.lines, videoId, { format: 'mediaExtended' });
			}

			// Keep the companion note order: # Description, # Transcript, # Related
			// (Description is always moved above Transcript, even if the note was out of order)
			const insertBefore = section === 'description' ? ['Transcript', 'Related'] : ['Related'];
			await this.app.vault.process(file, (current) =>
				ensureSectionOrder(upsertMarkdownSection(current, heading, body, insertBefore), 'Description', 'Transcript')
			);
			new Notice(`Added ${section} to "${file.basename}"${source}`);
		} catch (error) {
			new Notice(`Failed to add ${section}: ${error.message}`);
			console.error(`Failed to add ${section} to Media Extended note:`, error);
		}
	}

	/**
	 * Adds the video description to a video summary note body as a `## Description` section (matching the
	 * note's other `##` sections) with timestamps linked to the video in standard YouTube format, so they're
	 * clickable (they aren't in frontmatter). If the section already exists, asks before replacing it.
	 */
	public async addDescriptionToVideoSummaryNote(file: TFile | null): Promise<void> {
		if (!file) {
			new Notice('Open a video summary note first.');
			return;
		}

		const content = await this.app.vault.read(file);
		const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
		if (getVideoNoteKind(content, file.path, mediaFolder) !== 'summary') {
			new Notice(`"${file.basename}" isn't a video summary note (expected video_url frontmatter). For Media Extended notes, use "Add description to Media Extended note".`);
			return;
		}

		const url = extractYouTubeUrlFromNote(content);
		const videoId = url?.match(VIDEO_ID_REGEX)?.[1];
		if (!url || !videoId) {
			new Notice(`No YouTube video found in "${file.basename}".`);
			return;
		}

		if (hasMarkdownSection(content, 'Description', 2)) {
			const replace = await ConfirmModal.confirm(
				this.app,
				'Replace ## Description?',
				`"${file.basename}" already has a "## Description" section. Continue and replace it with the description from YouTube?`,
				'Replace'
			);
			if (!replace) {
				return;
			}
		}

		try {
			const result = await this.getDescriptionForNote(file, url, videoId);
			if (!result.description.trim()) {
				new Notice('This video has no description.');
				return;
			}
			const body = convertTimestampsToLinks(result.description.replace(/\r\n/g, '\n').trim(), videoId, 'youtube');
			// Keep # Related (the link to the Media Extended note) at the end
			await this.app.vault.process(file, (current) => upsertMarkdownSection(current, 'Description', body, ['Related'], 2));
			new Notice(`Added description to "${file.basename}"${result.source}`);
		} catch (error) {
			new Notice(`Failed to add description: ${error.message}`);
			console.error('Failed to add description to video summary note:', error);
		}
	}

	/**
	 * Gets the description to put in a note's body: the note's frontmatter description when
	 * *Use frontmatter description* is on and it's non-empty, otherwise fetched from YouTube.
	 * `source` is a short suffix for the confirmation notice.
	 */
	private async getDescriptionForNote(file: TFile, url: string, videoId: string): Promise<{ description: string; source: string }> {
		const frontmatterDescription = this.app.metadataCache.getFileCache(file)?.frontmatter?.description;
		if (this.settings.getMediaExtendedDescriptionFromFrontmatter() && typeof frontmatterDescription === 'string' && frontmatterDescription.trim()) {
			return { description: frontmatterDescription, source: ' (from frontmatter)' };
		}
		new Notice('Fetching video description...');
		const result = await this.fetchVideoDescription(url, videoId);
		return {
			description: result.description,
			source: result.fromDataApi ? ' (YouTube Data API)' : ' (YouTube player data; set a YouTube Data API key to use the Data API)',
		};
	}

	/**
	 * Adds tags to the current video note's frontmatter, deduplicated with its existing tags the same way
	 * as when summarizing. `ai` generates topic tags from the note's content using the vault tag cache;
	 * `youtube` uses the video's YouTube tags plus creator hashtags from the title and description.
	 */
	public async tagNote(file: TFile | null, source: 'ai' | 'youtube'): Promise<void> {
		if (!file) {
			new Notice('Open a video note first.');
			return;
		}
		if (this.isProcessing) {
			new Notice('Already processing a video or upgrading notes, please wait...');
			return;
		}

		const content = await this.app.vault.read(file);
		const url = extractYouTubeUrlFromNote(content);
		if (!url || !VIDEO_ID_REGEX.test(url)) {
			new Notice(`No YouTube video found in "${file.basename}".`);
			return;
		}

		try {
			this.isProcessing = true;
			const newTags = source === 'ai'
				? await this.generateAITagsForNote(file, content)
				: await this.fetchYouTubeTagsForNote(url);
			if (newTags === null) {
				return;
			}

			let added: string[] = [];
			await this.app.vault.process(file, (current) => {
				const result = addTagsToNoteContent(current, newTags);
				added = result.added;
				return result.content;
			});

			const label = source === 'ai' ? 'AI' : 'YouTube';
			new Notice(added.length > 0
				? `Added ${added.length} tag(s) from ${label} to "${file.basename}": ${added.join(', ')}`
				: `No new tags from ${label} for "${file.basename}".`);
		} catch (error) {
			new Notice(`Failed to tag note: ${error.message}`);
			console.error(`Failed to tag note with ${source}:`, error);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Generates topic tags for a note with the active AI model, using the same prompt and vault tag cache
	 * as summarizing. Uses the note body (the summary), or the frontmatter description when the body is empty.
	 * Returns null (after a Notice) when no AI model can be used.
	 */
	private async generateAITagsForNote(file: TFile, content: string): Promise<string[] | null> {
		const selectedModel = this.settings.getSelectedModel();
		if (!selectedModel) {
			new Notice('No AI model selected. Please select a model in the plugin settings.');
			return null;
		}
		if (!this.provider?.generateTopics) {
			new Notice('AI provider not initialized or does not support tagging. Please check your settings.');
			return null;
		}

		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').trim();
		const description = typeof frontmatter?.description === 'string' ? frontmatter.description.trim() : '';
		const noteText = body || description;
		if (!noteText) {
			new Notice(`"${file.basename}" has no summary or description to tag from.`);
			return null;
		}

		new Notice('Generating tags with AI...');
		const vaultTagData = await this.rebuildVaultTagCache();
		return await this.provider.generateTopics(noteText, {
			existingTags: extractFrontmatterTags(content),
			vaultTags: vaultTagData.tags,
			groupPrefixes: vaultTagData.groupPrefixes,
			compressedContext: vaultTagData.compressedContext,
			title: typeof frontmatter?.title === 'string' && frontmatter.title.trim() ? frontmatter.title : file.basename,
		});
	}

	/**
	 * Fetches a video's YouTube tags (YouTube Data API when a key is set, player metadata otherwise)
	 * plus creator hashtags from the title and description (when *Detect tags in title and description* is on).
	 */
	private async fetchYouTubeTagsForNote(url: string): Promise<string[]> {
		new Notice('Fetching tags from YouTube...');
		const metadata = await this.youtubeService.fetchVideoMetadata(url, this.settings.getYoutubeApiKey());
		const hashtags = this.settings.getDetectTagsInDescriptionAndTitle()
			? [...extractTagsFromText(metadata.title), ...extractTagsFromText(metadata.description || '')]
			: [];
		return [...hashtags, ...(metadata.tags ?? [])];
	}

	/**
	 * Inserts the note's video cover as an inline image (`![Cover](url)`) at the cursor. Uses the note's
	 * `cover` frontmatter when it's a URL, otherwise the YouTube thumbnail (with low-resolution fallback).
	 * Doesn't check whether the note already has a cover embed.
	 */
	public async insertVideoCoverAtCursor(editor: Editor, view: MarkdownView): Promise<void> {
		// Capture the insertion point before any network request
		const insertAt = editor.getCursor('to');
		const url = extractYouTubeUrlFromNote(editor.getValue());
		const videoId = url?.match(VIDEO_ID_REGEX)?.[1];
		if (!videoId) {
			new Notice('No YouTube video found in this note.');
			return;
		}

		const frontmatterCover = view.file ? this.app.metadataCache.getFileCache(view.file)?.frontmatter?.cover : undefined;
		const coverUrl = typeof frontmatterCover === 'string' && /^https?:\/\//i.test(frontmatterCover.trim())
			? frontmatterCover.trim()
			: await YouTubeService.getCoverUrl(videoId);

		const embed = buildCoverEmbed(coverUrl);
		editor.replaceRange(embed, insertAt);
		editor.setCursor(editor.offsetToPos(editor.posToOffset(insertAt) + embed.length));
	}

	/**
	 * Fetches a video's description from the YouTube Data API when an API key is set,
	 * falling back to YouTube player metadata (no key required).
	 */
	private async fetchVideoDescription(url: string, videoId: string): Promise<{ description: string; fromDataApi: boolean }> {
		const apiKey = this.settings.getYoutubeApiKey().trim();
		if (apiKey) {
			const data = await YouTubeService.fetchYouTubeDataApiVideoData(videoId, apiKey);
			if (data.description !== undefined) {
				return { description: data.description, fromDataApi: true };
			}
		}
		const metadata = await this.youtubeService.fetchVideoMetadata(url, apiKey || undefined);
		return { description: metadata.description || '', fromDataApi: false };
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
	 * Opens a folder selection modal to create companion notes in the chosen folder.
	 */
	public promptCreateMediaExtendedNotes(): void {
		new FolderSuggestModal(this.app, async (folder) => {
			await this.createMediaExtendedInFolder(folder);
		}).open();
	}

	/**
	 * Re-fetches a video's metadata and refreshes the frontmatter of one video summary note or
	 * Media Extended note. Never changes the note body, tags, or AI-extracted thumbnail text.
	 */
	private async refreshNoteVideoMetadata(file: TFile): Promise<{ status: 'success' | 'skipped'; message: string; url?: string }> {
		const content = await this.app.vault.read(file);
		const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
		const kind = getVideoNoteKind(content, file.path, mediaFolder);
		if (!kind) {
			return { status: 'skipped', message: 'Not a video summary note or Media Extended note' };
		}

		const url = extractYouTubeUrlFromNote(content);
		if (!url || !VIDEO_ID_REGEX.test(url)) {
			return { status: 'skipped', message: 'No YouTube video found in the note' };
		}

		const metadata = await this.youtubeService.fetchVideoMetadata(url, this.settings.getYoutubeApiKey());

		if (kind === 'mediaExtended') {
			const cover = await YouTubeService.getCoverUrl(metadata.videoId);
			await this.app.vault.process(file, (current) =>
				refreshMediaExtendedNoteContent(current, {
					videoId: metadata.videoId,
					title: metadata.title,
					description: metadata.description,
					duration: metadata.duration,
					creator: metadata.author,
					publishedAt: metadata.publishedAt,
					viewCount: metadata.viewCount,
					likeCount: metadata.likeCount,
					cover,
					aspectRatio: metadata.aspectRatio,
				})
			);
			return { status: 'success', message: 'Refreshed Media Extended note frontmatter', url };
		}

		const thumbnailUrl = await YouTubeService.getAvailableThumbnailUrl(metadata.videoId);
		const existingThumbnailText = this.app.metadataCache.getFileCache(file)?.frontmatter?.thumbnail_text;
		const playlist = this.settings.getDiscoverPlaylist() ? metadata.playlist : undefined;
		const pTitle = playlist?.title && playlist.title.trim().toLowerCase() !== 'playlist'
			? playlist.title.trim()
			: undefined;
		const fmData: FrontmatterData = {
			title: metadata.title,
			channel_name: metadata.author,
			channel_username: metadata.channelUsername || '',
			channel_url: metadata.channelUrl,
			// Keep the note's own URL (it may carry playlist parameters)
			video_url: url,
			...videoStatsFrontmatter(metadata),
			thumbnail: thumbnailUrl,
			thumbnail_text: typeof existingThumbnailText === 'string' ? existingThumbnailText : '',
			description: this.settings.getAddDescriptionToFrontmatter() ? metadata.description : undefined,
			playlist_title: pTitle,
			playlist_url: playlist?.url,
			playlist_id: playlist?.id,
			playlist_index: playlist?.index,
			playlist_count: playlist?.count,
		};
		await this.app.vault.process(file, (current) =>
			updateNoteContentWithFrontmatter(current, fmData, { excludeTags: true })
		);
		return { status: 'success', message: 'Refreshed video summary note frontmatter', url };
	}

	/**
	 * Refreshes video metadata in a single video summary or Media Extended note.
	 */
	public async refreshVideoMetadataInNote(file: TFile): Promise<void> {
		if (this.isProcessing) {
			new Notice('Already processing a video or upgrading notes, please wait...');
			return;
		}

		try {
			this.isProcessing = true;
			new Notice(`Refreshing video metadata in "${file.basename}"...`);
			const result = await this.refreshNoteVideoMetadata(file);
			new Notice(result.status === 'success'
				? `Refreshed video metadata in "${file.basename}"`
				: `Skipped "${file.basename}": ${result.message}`);
		} catch (error) {
			new Notice(`Failed to refresh video metadata: ${error.message}`);
			console.error('Failed to refresh video metadata:', error);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Adds the frontmatter properties that newer plugin versions introduced (`watch_later`, `favorite`)
	 * to every video summary note in a folder (and its subfolders) that doesn't have them yet.
	 * Nothing is fetched, and no existing frontmatter or note content is changed.
	 */
	public async upgradeVideoSummaryFrontmatterInFolder(folder: TFolder): Promise<void> {
		if (this.isProcessing) {
			new Notice('Already processing a video or upgrading notes, please wait...');
			return;
		}

		const scopeDescription = folder.isRoot() ? 'the vault' : `folder "${folder.path}"`;

		try {
			this.isProcessing = true;
			const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';

			let summaryNotes = 0;
			let upgraded = 0;
			for (const file of filterFilesByFolder(this.app.vault.getMarkdownFiles(), folder)) {
				const content = await this.app.vault.read(file);
				if (getVideoNoteKind(content, file.path, mediaFolder) !== 'summary') {
					continue;
				}
				summaryNotes++;
				if (addMissingUserFlags(content) === content) {
					continue;
				}
				// Re-applied to the current content in case the note changed since it was read
				await this.app.vault.process(file, (current) => addMissingUserFlags(current));
				upgraded++;
			}

			if (summaryNotes === 0) {
				new Notice(`No video summary notes found in ${scopeDescription}.`);
			} else if (upgraded === 0) {
				new Notice(`All ${summaryNotes} video summary note(s) in ${scopeDescription} are already up to date.`);
			} else {
				new Notice(`Added ${USER_FLAG_KEYS.join(' / ')} to ${upgraded} of ${summaryNotes} video summary note(s) in ${scopeDescription}.`);
			}
		} catch (error) {
			new Notice(`Failed to upgrade video summary frontmatter: ${error.message}`);
			console.error('Failed to upgrade video summary frontmatter:', error);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Opens a folder selection modal to refresh video metadata in the chosen folder.
	 */
	public promptRefreshVideoMetadata(): void {
		new FolderSuggestModal(this.app, async (folder) => {
			await this.refreshVideoMetadataInFolder(folder);
		}).open();
	}

	/**
	 * Refreshes video metadata in every video summary and Media Extended note in a folder (and its subfolders).
	 */
	public async refreshVideoMetadataInFolder(folder: TFolder): Promise<void> {
		if (this.isProcessing) {
			new Notice('Already processing a video or upgrading notes, please wait...');
			return;
		}

		const operation = 'Refresh video metadata';
		const scopeDescription = folder.isRoot() ? 'vault root' : `folder "${folder.path}"`;

		try {
			this.isProcessing = true;
			const mediaFolder = this.settings.getMediaExtendedFolder().trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || 'Media Library';
			new Notice(`Scanning ${scopeDescription} for video notes...`);

			const candidates: TFile[] = [];
			for (const file of filterFilesByFolder(this.app.vault.getMarkdownFiles(), folder)) {
				const content = await this.app.vault.read(file);
				if (getVideoNoteKind(content, file.path, mediaFolder)) {
					candidates.push(file);
				}
			}

			if (candidates.length === 0) {
				BatchProgressTracker.finishEmpty(this, operation, scopeDescription, `No video summary or Media Extended notes found in ${scopeDescription}.`);
				return;
			}

			const tracker = new BatchProgressTracker(this, operation, scopeDescription, candidates.length);
			for (let i = 0; i < candidates.length; i++) {
				const file = candidates[i];
				try {
					const result = await this.refreshNoteVideoMetadata(file);
					tracker.recordItem({
						filePath: file.path,
						fileName: file.basename,
						url: result.url,
						status: result.status,
						message: result.message,
					});
				} catch (error) {
					tracker.recordItem({
						filePath: file.path,
						fileName: file.basename,
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
			new Notice(`Failed to refresh video metadata: ${error.message}`);
			console.error('Failed to refresh video metadata:', error);
		} finally {
			this.isProcessing = false;
		}
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

			const thumbnailUrl = await YouTubeService.getAvailableThumbnailUrl(transcript.videoId);

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
				...videoStatsFrontmatter(transcript),
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
	 * optional inline tags, optional title heading, and optional transcript dump.
	 * (The description stays in frontmatter; "Add description to video summary note" adds it to the body.)
	 */
	private generateSummary(
		transcript: TranscriptResponse,
		thumbnailUrl: string,
		url: string,
		summaryText: string,
		inlineTags?: string[],
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
