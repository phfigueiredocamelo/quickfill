/**
 * Background script for QuickFill V2
 * Handles extension logic and communication between popup and content script
 */

import { FormElement, Settings, GPTResponse, LogEntry } from "../types";
import { ACTIONS, DEFAULT_SETTINGS } from "../utils/constants";
import {
	getSettings,
	saveSettings,
	getContextData,
	addLogEntry,
	clearLogs,
	getLogs,
} from "../utils/storageUtils";
import { processFormWithGPT } from "../utils/gptUtils";

/**
 * Initialize the background script
 */
const initialize = (): void => {
	// Set up message listener for communication with popup and content scripts
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		// Handle messages based on action
		switch (message.action) {
			case ACTIONS.UPDATE_SETTINGS:
				handleUpdateSettings(message.settings, sendResponse);
				break;

			case ACTIONS.FILL_FORMS:
				// ONLY handle fill forms when explicitly requested
				handleFillForms(sendResponse);
				break;

			case ACTIONS.CLEAR_CONTEXT:
				handleClearContext(sendResponse);
				break;

			case ACTIONS.CLEAR_LOGS:
				handleClearLogs(sendResponse);
				break;

			case ACTIONS.GET_LOGS:
				handleGetLogs(sendResponse);
				break;

			default:
				sendResponse({ success: false, error: "Unknown action" });
		}

		// Return true to indicate we'll respond asynchronously
		return true;
	});

	// Initialize settings if they don't exist
	getSettings().then((settings) => {
		if (!settings) {
			saveSettings(DEFAULT_SETTINGS);
		}
	});
};

/**
 * Handle updating extension settings
 * @param settings New settings to save
 * @param sendResponse Function to send response back
 */
const handleUpdateSettings = async (
	settings: Settings,
	sendResponse: (response: any) => void,
): Promise<void> => {
	try {
		await saveSettings(settings);
		sendResponse({ success: true });

		// Log the action
		await addLogEntry({
			action: "update_settings",
			details: "Settings updated",
			success: true,
		});
	} catch (error) {
		console.error("Error updating settings:", error);
		sendResponse({
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};

/**
 * Handle form filling request - ONLY called when explicitly triggered
 * @param tabId ID of the tab to fill forms in
 * @param sendResponse Function to send response back
 */
const handleFillForms = async (
	sendResponse: (response: any) => void,
): Promise<void> => {
	let tabId: number;
	try {
		const tabs = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});
		if (tabs && tabs.length > 0 && tabs[0].id) {
			tabId = tabs[0].id;
		} else {
			throw new Error(
				"No active tab found. Please make sure you're on a web page.",
			);
		}

		const settings = await getSettings();

		if (!settings.enabled) {
			throw new Error("QuickFill is disabled. Enable it from the popup.");
		}

		if (!settings.apiKey) {
			throw new Error("API key is not set. Add it in the settings.");
		}

		// Get form data from content script
		const formData = await requestFormData(tabId);

		if (
			!formData.success ||
			!formData.elements ||
			formData.elements.length === 0
		) {
			throw new Error("No form elements found on the page");
		}

		// Log the extracted form elements
		await addLogEntry({
			action: "debug_input_data",
			details: `Found ${formData.elements.length} form elements on ${formData.url}`,
			success: true,
			data: {
				elements: formData.elements,
				url: formData.url,
			},
		});

		// Get user context data
		const contextData = await getContextData();

		if (!contextData?.data) {
			await addLogEntry({
				action: "debug_input_data",
				details: "No context data found",
				success: false,
				data: {
					elements: formData.elements,
					url: formData.url,
				},
			});
		}

		// Process form with GPT
		const response = await processFormWithGPT(
			formData.elements,
			contextData.format,
			contextData.data,
			settings,
		);

		// Log the GPT processing
		await addLogEntry({
			action: "debug_gpt_process",
			details: `GPT model ${settings.selectedModel} processed form data`,
			success: response.success,
			data: {
				contextBuilt: contextData,
				gptResponse: response,
			},
		});

		if (!response.success || response.mappings.length === 0) {
			throw new Error("No fields could be filled");
		}

		// Send mappings to content script to fill the form
		const fillResult = await fillFormFields(tabId, response.mappings);

		// Log the action
		await addLogEntry({
			action: "fill_forms",
			details: `Filled ${fillResult.results.successful} fields on ${formData.url}`,
			success: true,
			data: {
				url: formData.url,
				totalFields: fillResult.results.total,
				filledFields: fillResult.results.successful,
				failedFields: fillResult.results.failed,
			},
		});

		sendResponse({
			success: true,
			result: fillResult.results,
		});
	} catch (error) {
		console.error("Error filling forms:", error);

		// Log the error
		await addLogEntry({
			action: "fill_forms",
			details: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			success: false,
		});

		sendResponse({
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};

/**
 * Request form data from content script
 * @param tabId Tab ID to request data from
 * @returns Form data response
 */
const requestFormData = async (
	tabId: number,
): Promise<{
	success: boolean;
	elements?: FormElement[];
	url?: string;
	error?: string;
}> => {
	return new Promise((resolve) => {
		chrome.tabs.sendMessage(
			tabId,
			{ action: ACTIONS.GET_FORM_DATA },
			(response) => {
				if (chrome.runtime.lastError) {
					resolve({
						success: false,
						error: chrome.runtime.lastError.message,
					});
				} else {
					resolve(response);
				}
			},
		);
	});
};

/**
 * Send field mappings to content script to fill form
 * @param tabId Tab ID to fill form in
 * @param mappings Field mappings from GPT
 * @returns Fill result
 */
const fillFormFields = async (
	tabId: number,
	mappings: GPTResponse["mappings"],
): Promise<{
	success: boolean;
	results?: {
		total: number;
		successful: number;
		failed: number;
	};
	error?: string;
}> => {
	return new Promise((resolve) => {
		chrome.tabs.sendMessage(
			tabId,
			{ action: ACTIONS.FILL_FORMS, mappings },
			(response) => {
				if (chrome.runtime.lastError) {
					resolve({
						success: false,
						error: chrome.runtime.lastError.message,
					});
				} else {
					resolve(response);
				}
			},
		);
	});
};

/**
 * Handle clearing context data
 * @param sendResponse Function to send response back
 */
const handleClearContext = async (
	sendResponse: (response: any) => void,
): Promise<void> => {
	try {
		// Get current settings
		const settings = await getSettings();

		// Clear context data for all formats
		for (const format in settings.contextData) {
			settings.contextData[format as keyof typeof settings.contextData] = "";
		}

		// Save updated settings
		await saveSettings(settings);

		// Log the action
		await addLogEntry({
			action: "clear_context",
			details: "Context data cleared",
			success: true,
		});

		sendResponse({ success: true });
	} catch (error) {
		console.error("Error clearing context:", error);
		sendResponse({
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};

/**
 * Handle clearing log entries
 * @param sendResponse Function to send response back
 */
const handleClearLogs = async (
	sendResponse: (response: any) => void,
): Promise<void> => {
	try {
		// Clear logs from storage using the utility function
		await clearLogs();

		sendResponse({ success: true });
	} catch (error) {
		console.error("Error clearing logs:", error);
		sendResponse({
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};

/**
 * Handle getting log entries
 * @param sendResponse Function to send response back
 */
const handleGetLogs = async (
	sendResponse: (response: any) => void,
): Promise<void> => {
	try {
		// Get logs from storage using the utility function
		const logs = await getLogs();

		sendResponse({ success: true, logs });
	} catch (error) {
		console.error("Error getting logs:", error);
		sendResponse({
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};

// Initialize when the background script loads
initialize();
