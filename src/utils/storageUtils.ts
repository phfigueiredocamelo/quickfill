/**
 * Chrome Storage utility functions
 */

import type { Settings } from "../types";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "./constants";
import * as cryptoUtils from "./cryptoUtils";
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
 * Saves API key with encryption
 * @param apiKey OpenAI API key to save
 * @param password Password for encryption
 */
export const saveApiKey = async (
  apiKey: string,
  password: string,
): Promise<void> => {
  const settings = await getSettings();
  const { encryptText, hashPassword } = cryptoUtils;
  settings.apiKey = encryptText(apiKey, password);

  // Store password hash if it doesn't exist
  if (!settings.contextPasswordHash) {
    settings.contextPasswordHash = hashPassword(password);
  }

  await saveSettings(settings);
};

/**
 * Gets decrypted API key
 * @param password Password for decryption
 * @returns Decrypted API key or empty string if decryption fails
 */
export const getApiKey = async (password: string): Promise<string> => {
  const settings = await getSettings();
  const { decryptText } = cryptoUtils;
  return decryptText(settings.apiKey, password);
};

/**
 * Saves context data for a specific format
 * @param format Format of the context data
 * @param data Context data string
 * @param password Password for encryption
 */
export const saveContextData = async (
  data: string,
  password: string,
): Promise<void> => {
  const settings = await getSettings();
  const { encryptText, hashPassword } = cryptoUtils;
  settings.contextData = encryptText(data, password);

  // Store password hash if it doesn't exist
  if (!settings.contextPasswordHash) {
    settings.contextPasswordHash = hashPassword(password);
  }

  await saveSettings(settings);
};

/**
 * Gets context data for the currently selected format
 * @param password Password for decryption
 * @returns Context data string for selected format
 */
export const getContextData = async (
  password: string,
): Promise<{
  data: string;
  success: boolean;
}> => {
  const settings = await getSettings();
  const { decryptText } = cryptoUtils;
  const decryptedData = decryptText(settings.contextData, password);

  return {
    data: decryptedData,
    success: decryptedData !== "",
  };
};

/**
 * Verifies if the stored password hash matches the provided password
 * @param password Password to verify
 * @returns True if password is valid, false otherwise
 */
export const verifyPassword = async (password: string): Promise<boolean> => {
  const settings = await getSettings();
  if (!settings.contextPasswordHash) return false;

  const { verifyPassword: verify } = cryptoUtils;
  return verify(password, settings.contextPasswordHash);
};

/**
 * Clears all context data for all formats
 */
export const clearContextData = async (): Promise<void> => {
  const settings = await getSettings();
  settings.contextData = "";
  settings.contextPasswordHash = "";
  await saveSettings(settings);
};
