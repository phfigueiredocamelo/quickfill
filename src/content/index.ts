import { addLogEntry } from "@/utils/storageUtils";
import type { FormElement, GPTResponse } from "../types";
import { ACTIONS } from "../utils/constants";
import { indexAllInputs, fillInputByIdx } from "../utils/domUtils";
import { showNotification } from "../utils/notificationUtils";

// Store form elements for reference
let currentElements: FormElement[] = [];

/**
 * Initialize the content script
 */
const initialize = (): void => {
	// Set up message listener for communication with background script
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		switch (message.action) {
			case ACTIONS.GET_FORM_DATA:
				handleGetFormData(sendResponse);
				break;

			case ACTIONS.FILL_FORMS:
				handleFillForms(message.mappings, sendResponse);
				break;

			default:
				sendResponse({ success: false, error: "Unknown action" });
		}

		// Return true to indicate we'll respond asynchronously
		return true;
	});
};

/**
 * Handle request to get form data
 * @param sendResponse Function to send response back
 */
const handleGetFormData = (sendResponse: (response: any) => void): void => {
	try {
		// Index all input elements on the page
		currentElements = indexAllInputs();
		// Send success response with elements
		sendResponse({
			success: true,
			elements: currentElements,
			url: window.location.href,
		});
	} catch (error) {
		console.error("Error collecting form data:", error);
		sendResponse({
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};

/**
 * Handle request to fill forms
 * @param mappings Field mappings from GPT
 * @param sendResponse Function to send response back
 */
const handleFillForms = (
	mappings: GPTResponse["mappings"],
	sendResponse: (response: any) => void,
): void => {
	try {
		if (!mappings || !Array.isArray(mappings)) {
			throw new Error("Invalid mappings data");
		}

		// Track successes and failures
		const results = {
			total: mappings.length,
			successful: 0,
			failed: 0,
		};

		// Fill each field
		for (const mapping of mappings) {
			const success = fillInputByIdx(mapping.idx, mapping.value);
			if (success) {
				results.successful++;
			} else {
				results.failed++;
			}
		}
		// Show notification with results
		if (results.successful > 0) {
			showNotification(
				`Successfully filled ${results.successful} field${results.successful !== 1 ? "s" : ""}`,
				"success",
			);
		}

		if (results.failed > 0) {
			showNotification(
				`Failed to fill ${results.failed} field${results.failed !== 1 ? "s" : ""}`,
				"warning",
			);
		}

		// Send response
		sendResponse({
			success: true,
			results,
		});
	} catch (error) {
		console.error("Error filling forms:", error);
		showNotification("Error filling form fields", "error");
		sendResponse({
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
};

// Initialize when the content script loads
initialize();
