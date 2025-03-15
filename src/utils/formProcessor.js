import { processFormWithGPT } from "./gptProcessor";
import {
	extractFormElements,
	fillFormWithMappings,
	fillVirtualFormWithMappings,
	createVirtualForm,
	groupInputsByContainer,
} from "./formUtils";
import { INPUT_SELECTORS } from "./constants";
import { showNotification } from "./notification";

/**
 * Class that handles processing of forms and standalone inputs
 */
export class FormProcessor {
	constructor(settings) {
		this.apiKey = settings.apiKey;
		this.contextData = settings.contextData;
		this.customFields = settings.customFields || {};
		this.isEnabled = settings.enabled !== false;
	}

	/**
	 * Update processor settings
	 *
	 * @param {Object} settings - New settings
	 */
	updateSettings(settings) {
		this.apiKey = settings.apiKey;
		this.contextData = settings.contextData;
		this.customFields = settings.customFields || {};
		this.isEnabled = settings.enabled !== false;
	}

	/**
	 * Scan the page for forms and standalone inputs, then fill them
	 *
	 * @returns {Promise<{filledCount: number}>} - Results of the filling operation
	 */
	async scanForForms() {
		console.log(this.isEnabled, this.apiKey, this.contextData);
		if (!this.isEnabled || !this.apiKey || !this.contextData) {
			console.log("iAutoFill: Auto-fill is disabled or missing required data");
			return { filledCount: 0 };
		}

		try {
			// Process each form and standalone inputs
			const results = [];
			let filledCount = 0;

			// Import isElementVisible
			const { isElementVisible } = await import("./formUtils");

			// Find all forms on the page
			const allForms = document.querySelectorAll("form");
			console.log("Total forms found:", allForms.length);
			
			// Filter for only visible forms
			const visibleForms = Array.from(allForms).filter(form => isElementVisible(form));
			console.log("Visible forms found:", visibleForms.length);

			// Process visible regular forms
			for (const form of visibleForms) {
				const result = await this.processForm(form);
				if (result) filledCount++;
				results.push(result);
			}

			// Look for standalone inputs outside of forms
			const standaloneInputsResult = await this.processStandaloneInputs();
			if (standaloneInputsResult) {
				filledCount += standaloneInputsResult;
			}

			// Notify user about the results
			if (filledCount > 0) {
				showNotification(
					`${filledCount} form(s)/input groups have been auto-filled. Please review before submitting.`,
					"success",
				);
			} else {
				showNotification(
					"No forms or inputs could be filled with the available context data.",
					"warning",
				);
			}

			return { filledCount };
		} catch (error) {
			console.error("iAutoFill: Error filling forms:", error);
			showNotification(`Error filling forms: ${error.message}`, "error");
			return { filledCount: 0, error };
		}
	}

	/**
	 * Build hints for form fields from custom field data
	 *
	 * @returns {string} - Formatted field hints
	 */
	buildFieldHints() {
		// If we have custom field data, include it as hints
		if (!this.customFields || Object.keys(this.customFields).length === 0) {
			return "";
		}

		// Format the custom fields as hints
		const hints = [];
		for (const [fieldName, fieldValue] of Object.entries(this.customFields)) {
			hints.push(`${fieldName}: ${fieldValue}`);
		}

		return hints.join("\n");
	}

	/**
	 * Process standalone inputs that aren't within form elements
	 *
	 * @returns {Promise<number>} - Number of input groups successfully filled
	 */
	async processStandaloneInputs() {
		try {
			// Find all inputs that are not within a form
			const allStandaloneInputs = document.querySelectorAll(
				INPUT_SELECTORS.STANDALONE_COMBINED,
			);

			if (allStandaloneInputs.length === 0) {
				console.log("iAutoFill: No standalone inputs found");
				return 0;
			}

			// Filter for only visible standalone inputs
			const { isElementVisible } = await import("./formUtils");
			const visibleStandaloneInputs = Array.from(allStandaloneInputs).filter(
				(input) => isElementVisible(input)
			);

			console.log(
				"iAutoFill: Found",
				visibleStandaloneInputs.length,
				"visible standalone inputs out of",
				allStandaloneInputs.length,
				"total"
			);

			if (visibleStandaloneInputs.length === 0) {
				return 0;
			}

			// Group inputs by their nearest common container
			const inputGroups = groupInputsByContainer(visibleStandaloneInputs);

			// Process each group
			let filledGroups = 0;

			for (const group of inputGroups) {
				if (group.inputs.length === 0) continue;

				// Create a virtual form containing these inputs for processing
				const virtualForm = createVirtualForm(group.inputs);

				// Process the virtual form
				const result = await this.processForm(virtualForm, true);
				if (result) filledGroups++;
			}

			return filledGroups;
		} catch (error) {
			console.error("iAutoFill: Error processing standalone inputs:", error);
			return 0;
		}
	}

	/**
	 * Process a specific form or virtual form with GPT and fill it with data
	 *
	 * @param {HTMLFormElement|HTMLElement} form - The form or virtual form to process
	 * @param {boolean} isVirtual - Whether this is a virtual form (standalone inputs)
	 * @param {string} [customContext] - Optional custom context to use instead of the default
	 * @returns {Promise<boolean>} - Whether the form was filled successfully
	 */
	async processForm(form, isVirtual = false, customContext = null) {
		try {
			// Extract form elements for analysis
			const formElements = extractFormElements(form);

			// Extract hints for form fields from custom data
			const formFieldHints = this.buildFieldHints();

			// Use custom context if provided
			const contextToUse = customContext || this.contextData;

			// Process the form with GPT
			const mappings = await processFormWithGPT({
				apiKey: this.apiKey,
				formElements,
				userConversation: contextToUse,
				formFieldHints,
			});

			// Fill the form with the mappings
			let filledCount = 0;
			if (mappings && mappings.length > 0) {
				if (isVirtual) {
					// For virtual forms, fill the original inputs
					filledCount = fillVirtualFormWithMappings(form, mappings);
				} else {
					// For regular forms, fill normally
					filledCount = fillFormWithMappings(form, mappings);
				}
				return filledCount > 0;
			}

			return false;
		} catch (error) {
			console.error("Error processing form:", error);
			return false;
		}
	}
}
