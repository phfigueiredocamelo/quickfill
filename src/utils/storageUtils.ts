/**
 * Chrome Storage utility functions
 */

import { Settings, LogEntry, ContextFormat } from "../types";
import { DEFAULT_SETTINGS, STORAGE_KEYS, MAX_LOG_ENTRIES } from "./constants";

/**
 * Saves settings to Chrome storage
 * @param settings Settings object to save
 */
export const saveSettings = async (settings: Settings): Promise<void> => {
	await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings });
};

/**
 * Gets settings from Chrome storage
 * @returns Settings object or default settings if none found
 */
export const getSettings = async (): Promise<Settings> => {
	const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
	return result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
};

/**
 * Saves context data for a specific format
 * @param format Format of the context data
 * @param data Context data string
 */
export const saveContextData = async (
	format: ContextFormat,
	data: string,
): Promise<void> => {
	const settings = await getSettings();
	settings.contextData[format] = data;
	await saveSettings(settings);
};

/**
 * Gets context data for the currently selected format
 * @returns Context data string for selected format
 */
export const getContextData = async (): Promise<{
	data: string;
	format: ContextFormat;
}> => {
	const settings = await getSettings();
	return {
		data: settings.contextData[settings.selectedFormat],
		format: settings.selectedFormat,
	};
};

/**
 * Clears all context data for all formats
 */
export const clearContextData = async (): Promise<void> => {
	const settings = await getSettings();
	for (const format in settings.contextData) {
		settings.contextData[format as ContextFormat] = "";
	}
	await saveSettings(settings);
};

/**
 * Adds a log entry to storage
 * @param entry Log entry to add
 */
export const addLogEntry = async (
	entry: Omit<LogEntry, "timestamp">,
): Promise<void> => {
	const result = await chrome.storage.local.get(STORAGE_KEYS.LOGS);
	const logs: LogEntry[] = result[STORAGE_KEYS.LOGS] || [];

	// Add new entry with timestamp
	logs.unshift({
		...entry,
		timestamp: Date.now(),
	});

	// Limit the number of entries
	if (logs.length > MAX_LOG_ENTRIES) {
		logs.length = MAX_LOG_ENTRIES;
	}

	await chrome.storage.local.set({ [STORAGE_KEYS.LOGS]: logs });
};

/**
 * Gets all log entries
 * @returns Array of log entries
 */
export const getLogs = async (): Promise<LogEntry[]> => {
	const result = await chrome.storage.local.get(STORAGE_KEYS.LOGS);
	return result[STORAGE_KEYS.LOGS] || [];
};

/**
 * Clears all log entries
 */
export const clearLogs = async (): Promise<void> => {
	await chrome.storage.local.set({ [STORAGE_KEYS.LOGS]: [] });
};
