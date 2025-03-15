import { processFormWithGPT, processHTMLWithGPT } from "./gptProcessor";
import {
	fillFormWithMappings,
	fillVirtualFormWithMappings,
	createVirtualForm,
	groupInputsByContainer,
} from "./formUtils";
import { INPUT_SELECTORS } from "./constants";

/**
 * Class that handles processing of forms and standalone inputs
 */
export class FormProcessor {
	constructor(settings) {
		this.apiKey = settings.apiKey;
		this.contextData = settings.contextData;
		this.customFields = settings.customFields || {};
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
		this.customFields = settings.customFields || {};
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
	 * Fill standalone inputs (not in forms) with the mapped values
	 *
	 * @param {Array} fields - Array of field objects to fill
	 * @returns {Promise<number>} - Number of fields filled
	 */
	async fillStandaloneInputs(fields) {
		try {
			// Find all standalone inputs
			const { isElementVisible } = await import("./formUtils");
			const allStandaloneInputs = document.querySelectorAll(
				INPUT_SELECTORS.STANDALONE_COMBINED,
			);

			// Filter for visible inputs
			const visibleStandaloneInputs = Array.from(allStandaloneInputs).filter(
				(input) => isElementVisible(input),
			);

			if (visibleStandaloneInputs.length === 0) {
				return 0;
			}

			// Create a map of inputs by ID, name or label association
			const inputMap = new Map();
			const labelMap = new Map();
			const formIdMap = new Map();

			visibleStandaloneInputs.forEach((input) => {
				// Store by ID and name
				if (input.id) inputMap.set(input.id, input);
				if (input.name) inputMap.set(input.name, input);

				// Store by associated label text
				if (input.id) {
					const label = document.querySelector(`label[for="${input.id}"]`);
					if (label && label.textContent) {
						const labelText = label.textContent.trim();
						labelMap.set(labelText.toLowerCase(), input);
					}
				}

				// Store by form ID association
				const closestForm = input.closest("form");
				if (closestForm && closestForm.id) {
					formIdMap.set(closestForm.id, input);
				}
			});

			// Find inputs that match the fields to fill
			const matchedInputs = [];
			fields.forEach((field) => {
				// Try to match by ID first
				let input = inputMap.get(field.id);

				// If no match by ID, try by label
				if (!input && field.label) {
					input = labelMap.get(field.label.toLowerCase());
				}

				// If still no match, try by formId
				if (!input && field.formId && !field.formId.startsWith("virtual-")) {
					input = formIdMap.get(field.formId);
				}

				if (input) {
					matchedInputs.push({
						input,
						value: field.value,
					});
				}
			});

			if (matchedInputs.length === 0) {
				return 0;
			}

			// Group inputs by container
			const inputGroups = groupInputsByContainer(
				matchedInputs.map((m) => m.input),
			);
			let filledGroups = 0;

			// Process each group of inputs
			for (const group of inputGroups) {
				if (group.inputs.length === 0) continue;

				// Create a virtual form for these inputs
				const virtualForm = createVirtualForm(group.inputs);

				// Map the matched inputs to the virtual form format
				const virtualFormMappings = matchedInputs
					.filter((match) => group.inputs.includes(match.input))
					.map((match) => ({
						htmlElementId: match.input.id || match.input.name,
						value: match.value,
					}));

				// Fill the virtual form
				const filledCount = fillVirtualFormWithMappings(
					virtualForm,
					virtualFormMappings,
				);
				if (filledCount > 0) filledGroups++;
			}

			return filledGroups;
		} catch (error) {
			console.error("Error filling standalone inputs:", error);
			return 0;
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
				formFieldHints: this.buildFieldHints(),
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
