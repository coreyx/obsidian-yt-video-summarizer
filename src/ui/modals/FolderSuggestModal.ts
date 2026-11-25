import { App, FuzzySuggestModal, TFolder } from 'obsidian';

/**
 * Orders folders for the picker: the vault root first, then alphabetically by path. Sorts in place and
 * returns the same array.
 */
export function sortFolders<T extends Pick<TFolder, 'path' | 'isRoot'>>(folders: T[]): T[] {
	return folders.sort((a, b) => {
		if (a.isRoot()) return -1;
		if (b.isRoot()) return 1;
		return a.path.localeCompare(b.path);
	});
}

/**
 * Fuzzy suggestion modal allowing the user to select a vault folder.
 */
export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	private onChoose: (folder: TFolder) => void;

	constructor(app: App, onChoose: (folder: TFolder) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder('Type to search for a folder...');
	}

	getItems(): TFolder[] {
		let folders: TFolder[];
		if (typeof this.app.vault.getAllFolders === 'function') {
			folders = this.app.vault.getAllFolders(true);
		} else {
			folders = this.app.vault
				.getAllLoadedFiles()
				.filter((f): f is TFolder => f instanceof TFolder);
		}

		return sortFolders(folders);
	}

	getItemText(folder: TFolder): string {
		return folder.isRoot() ? '/ (Vault root)' : folder.path;
	}

	onChooseItem(folder: TFolder, _evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(folder);
	}
}
