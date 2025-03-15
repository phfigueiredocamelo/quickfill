import { processFormWithGPT, processHTMLWithGPT } from "./gptProcessor";
import {
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
	 * Scan the page for forms and standalone inputs, then fill them
	 *
	 * @returns {Promise<{filledCount: number}>} - Results of the filling operation
	 */
	async scanForForms() {
		if (!this.isEnabled || !this.apiKey || !this.contextData) {
			console.log("QuickFill: Auto-fill is disabled or missing required data");
			return { filledCount: 0 };
		}

		try {
			// Extract form fields from the entire page HTML
			const pageHTML = document.documentElement.outerHTML;
			const pageURL = window.location.href;

			// Process the HTML with GPT to extract form fields
			const extractedFields = await processHTMLWithGPT({
				apiKey: this.apiKey,
				html: pageHTML,
				url: pageURL,
			});

			console.log("Extracted fields:", extractedFields);

			if (!extractedFields || extractedFields.length === 0) {
				console.log("No form fields extracted from the page");
				showNotification(
					"No form fields could be detected on this page.",
					"warning",
				);
				return { filledCount: 0 };
			}

			// Group fields by form for parallel processing
			const formFieldGroups = this.groupFieldsByForm(extractedFields);
			
			// Process each form group in parallel with the user context to get values
			const processPromises = [];
			
			for (const [formId, fields] of formFieldGroups.entries()) {
				// Create a processing task for each form
				const processPromise = processFormWithGPT({
					apiKey: this.apiKey,
					formElements: fields,
					userConversation: this.contextData,
					formFieldHints: this.buildFieldHints(),
				}).then(result => ({formId, fields: result}));
				
				processPromises.push(processPromise);
			}
			
			// Wait for all form processing to complete in parallel
			const processedResults = await Promise.all(processPromises);
			
			// Combine all field results
			let filledFields = [];
			processedResults.forEach(result => {
				if (result.fields && result.fields.length > 0) {
					filledFields = [...filledFields, ...result.fields];
				}
			});

			console.log("Filled fields:", filledFields);

			if (!filledFields || filledFields.length === 0) {
				console.log("No fields could be filled with the context data");
				showNotification(
					"No fields could be filled with the available context data.",
					"warning",
				);
				return { filledCount: 0 };
			}

			// Group the filled fields by formId
			const filledFieldGroups = this.groupFieldsByForm(filledFields);

			// Fill each form with its fields
			let filledCount = 0;
			
			// For zen-process, try direct filling first
			// This handles cases where fields aren't properly associated with forms
			console.log("Trying zen-process direct field filling first");
			let zenFilledCount = 0;
			
			// Create a general document form object for zen processing
			const documentForm = document.body;
			const allMappings = this.convertToLegacyFormat(filledFields);
			
			// Mark that we're using zen-process mode
			documentForm.zenProcess = true;
			
			// Try to fill all fields directly on the document body
			zenFilledCount = fillFormWithMappings(documentForm, allMappings);
			console.log(`Zen-process filled ${zenFilledCount} fields directly`);
			
			// If zen-process was successful, count it as one form filled
			if (zenFilledCount > 0) {
				filledCount++;
			} else {
				// Fallback to the regular form-by-form approach but process in parallel
				console.log("Falling back to regular form-by-form filling");
				
				// Create promises for all form filling operations
				const fillPromises = [];
				
				for (const [formId, fields] of filledFieldGroups.entries()) {
					if (formId.startsWith("virtual-")) {
						// Handle virtual forms (standalone inputs)
						fillPromises.push(
							this.fillStandaloneInputs(fields)
								.then(count => ({ formId, count }))
						);
					} else {
						// Handle regular forms
						const form =
							document.getElementById(formId) ||
							document.querySelector(`form[name="${formId}"]`) ||
							document.forms[0];

						if (form) {
							// Create a promise that resolves when form is filled
							const fillPromise = new Promise(resolve => {
								const filledFieldCount = fillFormWithMappings(
									form,
									this.convertToLegacyFormat(fields),
								);
								resolve({ formId, count: filledFieldCount });
							});
							fillPromises.push(fillPromise);
						}
					}
				}
				
				// Wait for all form filling operations to complete in parallel
				const fillResults = await Promise.all(fillPromises);
				
				// Count successfully filled forms
				fillResults.forEach(result => {
					if (result.count > 0) filledCount++;
				});
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
	 * Group fields by their form ID
	 *
	 * @param {Array} fields - Array of field objects with formId
	 * @returns {Map} - Map of formId to array of fields
	 */
	groupFieldsByForm(fields) {
		const groups = new Map();

		fields.forEach((field) => {
			if (!field.formId) return;

			if (!groups.has(field.formId)) {
				groups.set(field.formId, []);
			}

			groups.get(field.formId).push(field);
		});

		return groups;
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
			label: field.label,          // Include label for label-based matching
			formId: field.formId        // Include formId for form-based matching
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
				const closestForm = input.closest('form');
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
				if (!input && field.formId && !field.formId.startsWith('virtual-')) {
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