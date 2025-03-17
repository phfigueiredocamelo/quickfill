import { processFormWithGPT, processHTMLWithGPT } from "./gptProcessor";
import {
	fillFormWithMappings,
	fillVirtualFormWithMappings,
	createVirtualForm,
} from "./formUtils";
import { INPUT_SELECTORS } from "./constants";

/**
 * Class that handles processing of forms and standalone inputs
 */
export class FormProcessor {
	constructor(settings) {
		this.apiKey = settings.apiKey;
		this.contextData = settings.contextData;
		this.structuredData = settings.structuredData || {};
		this.useStructuredData = settings.useStructuredData === true;
		this.isEnabled = settings.enabled === true;
	}

	/**
	 * Update processor settings
	 *
	 * @param {Object} settings - New settings
	 */
	updateSettings(settings) {
		this.apiKey = settings.apiKey;
		this.contextData = settings.contextData;
		this.structuredData = settings.structuredData || this.structuredData;
		this.useStructuredData = settings.useStructuredData === true;
		this.isEnabled = settings.enabled === true;
	}

	/**
	 * Convert the new field format to the legacy format used by fillFormWithMappings
	 * Includes label information for improved matching
	 *
	 * @param {Array} fields - Array of fields in new format
	 * @returns {Array} - Array of fields in legacy format
	 */
	convertToLegacyFormat(fields) {
		return fields.map((field) => ({
			htmlElementId: field.id,
			value: field.value,
			label: field.label, // Include label for label-based matching
			formId: field.formId, // Include formId for form-based matching
		}));
	}

	/**
	 * Process all forms and standalone inputs on the page
	 *
	 * @returns {Promise<Object>} - Object with counts of processed items
	 */
	async processAllForms() {
		try {
			if (!this.apiKey || !this.isEnabled) {
				console.log("QuickFill is disabled or missing API key");
				return { success: false, forms: 0, standaloneGroups: 0 };
			}

			console.log("QuickFill: Starting to process all forms on the page");

			// Import necessary utilities
			const { isElementVisible, groupInputsByContainer } = await import(
				"./formUtils"
			);

			// Process regular forms first
			const allForms = document.querySelectorAll("form");
			console.log("allForms", allForms);
			const visibleForms = Array.from(allForms).filter(
				(form) =>
					isElementVisible(form) &&
					form.querySelectorAll(INPUT_SELECTORS.FORM_INPUTS_COMBINED).length >
						0,
			);
			console.log("visibleForms", visibleForms);
			console.log(
				`QuickFill: Found ${visibleForms.length} visible forms on the page`,
			);

			let processedForms = 0;

			// Process each visible form
			for (const form of visibleForms) {
				const result = await this.processForm(form);
				if (result) {
					processedForms++;
					console.log(`QuickFill: Successfully filled form #${processedForms}`);
				}
			}

			// Now process standalone inputs (not in forms)
			const allStandaloneInputs = document.querySelectorAll(
				INPUT_SELECTORS.STANDALONE_COMBINED,
			);

			// Filter for visible inputs
			const visibleStandaloneInputs = Array.from(allStandaloneInputs).filter(
				(input) => isElementVisible(input),
			);

			let processedGroups = 0;

			if (visibleStandaloneInputs.length > 0) {
				console.log(
					`QuickFill: Found ${visibleStandaloneInputs.length} standalone inputs`,
				);

				// Group inputs by container
				const inputGroups = groupInputsByContainer(visibleStandaloneInputs);
				console.log(
					`QuickFill: Grouped into ${inputGroups.length} logical sections`,
				);

				// Process each group as a virtual form
				for (const group of inputGroups) {
					if (group.inputs.length === 0) continue;

					// Process the virtual form
					const result = await this.processForm(
						createVirtualForm(group.inputs),
						true,
					);
					if (result) {
						processedGroups++;
						console.log(
							`QuickFill: Successfully filled standalone group #${processedGroups}`,
						);
					}
				}
			}

			return {
				success: processedForms > 0 || processedGroups > 0,
				forms: processedForms,
				standaloneGroups: processedGroups,
			};
		} catch (error) {
			console.error("Error processing all forms:", error);
			return {
				success: false,
				forms: 0,
				standaloneGroups: 0,
				error: error.message,
			};
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
			// Extract form HTML
			const formHTML = form.outerHTML;
			const pageURL = window.location.href;

			// Process the form HTML with GPT to extract fields
			const extractedFields = await processHTMLWithGPT({
				apiKey: this.apiKey,
				html: formHTML,
				url: pageURL,
			});

			if (!extractedFields || extractedFields.length === 0) {
				console.log("No fields extracted from form");
				return false;
			}

			// Use custom context if provided
			const contextToUse = customContext || this.contextData;

			// Process the extracted fields with context to get values
			const filledFields = await processFormWithGPT({
				apiKey: this.apiKey,
				formElements: extractedFields,
				userConversation: contextToUse,
				structuredData: this.structuredData,
				useStructuredData: this.useStructuredData,
			});

			// Fill the form with the mappings
			let filledCount = 0;
			if (filledFields && filledFields.length > 0) {
				if (isVirtual) {
					// For virtual forms, fill the original inputs
					filledCount = fillVirtualFormWithMappings(
						form,
						this.convertToLegacyFormat(filledFields),
					);
				} else {
					// For regular forms, fill normally
					filledCount = fillFormWithMappings(
						form,
						this.convertToLegacyFormat(filledFields),
					);
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
