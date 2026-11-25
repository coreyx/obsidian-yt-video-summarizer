/**
 * Runs the plugin's real SettingsManager against a fake plugin, so tests check the settings code
 * (start-up migrations, LM Studio sync, per-setting getters) rather than copies of it.
 */
import { loadSource } from './loadSource.mjs';

const { SettingsManager } = await loadSource('src/services/settingsManager.ts');

/**
 * Creates a SettingsManager whose plugin returns `savedData` from `loadData()` (as Obsidian returns the
 * plugin's data.json), and runs `loadSettings()` as the plugin does on start-up.
 * @param {object | null} savedData - What data.json holds: `{ settings: {...} }`, a flat settings object, or `null`.
 * @returns {Promise<{ manager: object, saves: object[], lastSaved: () => object | undefined }>}
 *   The manager, every object passed to `saveData()` in order, and the settings from the latest save.
 */
export async function loadSettingsManager(savedData) {
	const saves = [];
	const plugin = {
		loadData: async () => (savedData == null ? savedData : structuredClone(savedData)),
		saveData: async (data) => {
			saves.push(structuredClone(data));
		},
	};
	const manager = new SettingsManager(plugin);
	await manager.loadSettings();
	return { manager, saves, lastSaved: () => saves.at(-1)?.settings };
}
