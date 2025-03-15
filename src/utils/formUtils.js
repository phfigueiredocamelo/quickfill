import { INPUT_SELECTORS, STYLES } from "./constants";

/**
 * Utility functions for form handling
 */

/**
 * Checks if an element is visible in the viewport
 * 
 * @param {Element} element - The element to check
 * @returns {boolean} - Whether the element is visible
 */
export function isElementVisible(element) {
  // Check if element exists
  if (!element) return false;
  
  // Check if element or any parent has display:none or visibility:hidden
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  // Check if element is in viewport
  const rect = element.getBoundingClientRect();
  
  // Element must have size to be considered visible
  if (rect.width === 0 || rect.height === 0) return false;
  
  // Element must be at least partially in the viewport
  return (
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}

/**
 * Gets the label associated with a form element.
 *
 * @param {Element} element - The form element
 * @returns {Element|null} - The associated label element or null
 */
export function getAssociatedLabel(element) {
	// Check for label with 'for' attribute
	if (element.id) {
		const label = document.querySelector(`label[for="${element.id}"]`);
		if (label) return label;
	}

	// Check if element is inside a label
	let parent = element.parentElement;
	while (parent) {
		if (parent.tagName.toLowerCase() === "label") {
			return parent;
		}
		parent = parent.parentElement;
	}

	// Check if there's a label preceding the element
	const prevSibling = element.previousElementSibling;
	if (prevSibling && prevSibling.tagName.toLowerCase() === "label") {
		return prevSibling;
	}

	return null;
}

/**
 * Extracts form elements from an HTML element.
 *
 * @param {HTMLElement} formElement - The form or virtual form element
 * @returns {Array} - Array of form element objects
 */
export function extractFormElements(formElement) {
	// Find all input, select, and textarea elements
	const elements = Array.from(
		formElement.querySelectorAll(INPUT_SELECTORS.FORM_INPUTS_COMBINED),
	);

	// Extract relevant information for each element, filtering out invisible elements
	return elements
		.filter((element) => {
			// For virtual forms, we don't check visibility since they're clones
			if (formElement.className === "quickfill-virtual-form") return true;
			
			// For real forms, only include visible elements
			return isElementVisible(element);
		})
		.map((element) => {
			const elementInfo = {
				id: element.id,
				name: element.name,
				type: element.type || element.tagName.toLowerCase(),
				placeholder: element.placeholder || "",
				required: element.required,
				options: [],
			};

			// Get label if available
			const labelElement = getAssociatedLabel(element);
			if (labelElement) {
				elementInfo.label = labelElement.textContent.trim();
			}

			// Extract options for select elements
			if (element.tagName.toLowerCase() === "select") {
				elementInfo.options = Array.from(element.options).map((option) => ({
					value: option.value,
					text: option.textContent.trim(),
				}));
			}
			
			// Extract radio button groups
			if (element.type === "radio" && element.name) {
				// Find all radio buttons in the same group
				const radioGroup = formElement.querySelectorAll(`input[type="radio"][name="${element.name}"]`);
				if (radioGroup.length > 1) {
					elementInfo.options = Array.from(radioGroup).map((radio) => {
						// Get label for this specific radio button
						const radioLabel = getAssociatedLabel(radio);
						return {
							value: radio.value,
							text: radioLabel ? radioLabel.textContent.trim() : radio.value,
						};
					});
				}
			}
			
			// For checkbox elements, add more context
			if (element.type === "checkbox") {
				// Add checkbox label as a possible option value
				const checkLabel = getAssociatedLabel(element);
				if (checkLabel) {
					elementInfo.options = [{
						value: "true",
						text: checkLabel.textContent.trim()
					}, {
						value: "false",
						text: `Not ${checkLabel.textContent.trim()}`
					}];
				}
			}

			return elementInfo;
		})
		.filter((el) => el.id || el.name); // Only include elements with id or name
}

/**
 * Groups inputs by their nearest common container.
 *
 * @param {NodeList} inputs - List of input elements
 * @returns {Array} - Array of input groups with container and inputs
 */
export function groupInputsByContainer(inputs) {
	const groups = [];
	const processedInputs = new Set();

	// For each input, find its container and group by container
	for (const input of inputs) {
		if (processedInputs.has(input)) continue;

		// Find a common container (going up to find related inputs)
		const container = findCommonContainer(input);

		// Find all inputs within this container that are not in a form
		const containerInputs = Array.from(
			container.querySelectorAll(INPUT_SELECTORS.STANDALONE_COMBINED),
		);

		// Mark these inputs as processed
		// biome-ignore lint/complexity/noForEach: <explanation>
		containerInputs.forEach((input) => processedInputs.add(input));

		groups.push({
			container,
			inputs: containerInputs,
		});
	}

	return groups;
}

/**
 * Find the common container for an input element
 *
 * @param {HTMLElement} element - The input element
 * @returns {HTMLElement} - The common container element
 */
function findCommonContainer(element) {
	// Start with parent element
	let container = element.parentElement;

	// Go up max 2 levels to find a better container
	for (let i = 0; i < 2 && container && container !== document.body; i++) {
		container = container.parentElement;
	}

	// Fallback to immediate parent if we went too far
	if (!container || container === document.body) {
		container = element.parentElement;
	}

	return container;
}

/**
 * Creates a virtual form element containing the specified inputs.
 * Used to process standalone inputs with existing form processing logic.
 *
 * @param {Array} inputs - Array of input elements
 * @returns {HTMLElement} - Virtual form element
 */
export function createVirtualForm(inputs) {
	const virtualForm = document.createElement("div");
	virtualForm.className = "quickfill-virtual-form";
	virtualForm.style.display = "none";

	// Clone inputs to preserve their properties and structure
	// biome-ignore lint/complexity/noForEach: <explanation>
	inputs.forEach((input) => {
		const clone = input.cloneNode(true);
		virtualForm.appendChild(clone);
	});

	// Custom property to map back to original inputs
	virtualForm.originalInputs = inputs;

	return virtualForm;
}

/**
 * Fills a form with the provided field mappings.
 *
 * @param {HTMLFormElement} form - The form to fill
 * @param {Array} mappings - The field mappings from GPT
 * @returns {number} - Number of successfully filled fields
 */
export function fillFormWithMappings(form, mappings) {
	if (!mappings || mappings.length === 0) {
		console.log("No mappings found for form");
		return 0;
	}

	// Track successfully filled fields
	const filledFields = [];

	// Fill each mapped field
	// biome-ignore lint/complexity/noForEach: <explanation>
	mappings.forEach((mapping) => {
		const { htmlElementId, value } = mapping;

		// Try to find the element by ID or name
		const element =
			form.querySelector(`#${htmlElementId}`) ||
			form.querySelector(`[name="${htmlElementId}"]`);

		if (!element) {
			console.warn(`Element with ID/name "${htmlElementId}" not found in form`);
			return;
		}

		// Fill the element
		const filled = fillElement(element, value);
		if (filled) {
			filledFields.push(element);
		}
	});

	console.log(`Successfully filled ${filledFields.length} fields in form`);
	return filledFields.length;
}

/**
 * Fills a virtual form's original inputs with the provided field mappings.
 *
 * @param {HTMLElement} virtualForm - The virtual form with originalInputs property
 * @param {Array} mappings - The field mappings from GPT
 * @returns {number} - Number of successfully filled fields
 */
export function fillVirtualFormWithMappings(virtualForm, mappings) {
	if (!mappings || mappings.length === 0 || !virtualForm.originalInputs) {
		console.log("No mappings or original inputs found for virtual form");
		return 0;
	}

	// Track successfully filled fields
	const filledFields = [];
	const originalInputs = virtualForm.originalInputs;

	// Create a map of original inputs by ID and name for quick lookup
	const inputMap = new Map();
	// biome-ignore lint/complexity/noForEach: <explanation>
	originalInputs.forEach((input) => {
		if (input.id) inputMap.set(input.id, input);
		if (input.name) inputMap.set(input.name, input);
	});

	// Fill each mapped field
	// biome-ignore lint/complexity/noForEach: <explanation>
	mappings.forEach((mapping) => {
		const { htmlElementId, value } = mapping;

		// Try to find the original element by ID or name
		const element = inputMap.get(htmlElementId);

		if (!element) {
			console.warn(
				`Original element with ID/name "${htmlElementId}" not found`,
			);
			return;
		}

		// Fill the element
		const filled = fillElement(element, value);
		if (filled) {
			filledFields.push(element);
		}
	});

	console.log(`Successfully filled ${filledFields.length} standalone fields`);
	return filledFields.length;
}

/**
 * Fills an element based on its type and returns success status.
 *
 * @param {HTMLElement} element - The element to fill
 * @param {*} value - The value to fill with
 * @returns {boolean} - Whether the element was successfully filled
 */
export function fillElement(element, value) {
	const tagName = element.tagName.toLowerCase();
	const type = element.type ? element.type.toLowerCase() : "";

	try {
		// Special handling for custom selects (e.g., gender dropdown)
		if (tagName === "div" && element.id && element.id.startsWith("Select")) {
			// Find the hidden input to set its value
			const hiddenInput = element.querySelector('input[type="hidden"]');
			if (hiddenInput) {
				hiddenInput.value = value;
				
				// Find and update the visible selection text
				const displayElement = element.querySelector('.sc-deXhhX');
				if (displayElement) {
					displayElement.textContent = value;
				}
				
				// Find all options and mark the selected one
				const options = element.querySelectorAll('.sc-epALIP');
				for (const option of options) {
					if (option.textContent.trim() === value) {
						// Simulate selection event
						option.click();
						break;
					}
				}
				
				// Mark the field as filled and highlight it
				highlightFilledField(hiddenInput);
				highlightFilledField(element);
				
				// Dispatch events
				if (hiddenInput) {
					triggerEvents(hiddenInput);
				}
				
				return true;
			}
			return false;
		} 
		// Standard handling for regular elements
		else if (tagName === "select") {
			fillSelectElement(element, value);
		} else if (type === "checkbox" || type === "radio") {
			fillCheckboxOrRadio(element, value);
		} else if (
			tagName === "textarea" ||
			(tagName === "input" &&
				["text", "email", "number", "tel", "url", "password", "date", "hidden"].includes(
					type,
				))
		) {
			fillInputElement(element, value);
		} else {
			console.warn(`Unsupported element type: ${tagName} (${type})`);
			return false;
		}

		// Mark the field as filled and highlight it
		highlightFilledField(element);

		// Dispatch input and change events to trigger any validation
		triggerEvents(element);

		return true;
	} catch (error) {
		console.error("Error filling element:", error);
		return false;
	}
}

/**
 * Fills a select element with a value.
 *
 * @param {HTMLSelectElement} element - The select element
 * @param {string} value - The value to select
 */
function fillSelectElement(element, value) {
	// Check each option
	let matched = false;
	for (const option of element.options) {
		if (option.value === value || option.textContent.trim() === value) {
			element.value = option.value;
			matched = true;
			break;
		}
	}

	if (!matched) {
		// If no exact match, try a case-insensitive partial match
		for (const option of element.options) {
			if (option.textContent.toLowerCase().includes(value.toLowerCase())) {
				element.value = option.value;
				matched = true;
				break;
			}
		}
	}

	if (!matched) {
		console.warn(
			`Could not match value "${value}" to any option in select element`,
		);
	}
}

/**
 * Fills a checkbox or radio input element.
 *
 * @param {HTMLInputElement} element - The input element
 * @param {string|boolean} value - The value to set
 */
function fillCheckboxOrRadio(element, value) {
	if (element.type === "checkbox") {
		// For checkboxes, we use true/false
		if (value === true || value === "true") {
			element.checked = true;
		} else if (value === false || value === "false") {
			element.checked = false;
		} else {
			console.warn(`Invalid value for checkbox: ${value}`);
		}
	} else if (element.type === "radio") {
		// For radio buttons, we can handle string values
		if (value === true || value === "true") {
			// Simple case - just check this radio button
			element.checked = true;
		} else if (value === false || value === "false") {
			// Simple case - uncheck this radio button
			element.checked = false;
		} else if (typeof value === "string") {
			// Check if value matches this radio button's value or label
			const label = getAssociatedLabel(element);
			const labelText = label ? label.textContent.trim() : "";
			
			if (element.value === value || labelText === value) {
				element.checked = true;
			}
		} else {
			console.warn(`Invalid value for radio button: ${value}`);
		}
	}
}

/**
 * Fills a text input or textarea element.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement} element - The input element
 * @param {string} value - The value to set
 */
function fillInputElement(element, value) {
	// For date inputs, ensure the value is formatted correctly
	if (element.type === "date" && value) {
		try {
			let date;
			// Handle different date formats
			
			// Check if it's a Brazilian format (DD/MM/YYYY)
			if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
				const [day, month, year] = value.split('/');
				date = new Date(`${year}-${month}-${day}`);
			} 
			// Check if it's a date with slashes (MM/DD/YYYY) - US format
			else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
				date = new Date(value);
			} 
			// Try with direct parsing (YYYY-MM-DD or other formats)
			else {
				date = new Date(value);
			}
			
			// Check if date is valid
			if (isNaN(date.getTime())) {
				throw new Error('Invalid date');
			}
			
			element.value = date.toISOString().split("T")[0];
		} catch (e) {
			console.warn(`Invalid date value: ${value}`, e);
			// Try to set the value directly if we couldn't parse it
			element.value = value;
		}
	} else if (element.getAttribute('maskplaceholder') === 'dd/mm/yyyy') {
		// Handle masked date inputs (usually in Brazilian format)
		try {
			let date;
			// Try different formats
			if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
				// Already in the right format
				element.value = value;
			} else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
				// ISO format YYYY-MM-DD
				const [year, month, day] = value.split('-');
				element.value = `${day}/${month}/${year}`;
			} else {
				// Try to parse and reformat
				date = new Date(value);
				if (!isNaN(date.getTime())) {
					const day = String(date.getDate()).padStart(2, '0');
					const month = String(date.getMonth() + 1).padStart(2, '0');
					const year = date.getFullYear();
					element.value = `${day}/${month}/${year}`;
				} else {
					throw new Error('Invalid date');
				}
			}
		} catch (e) {
			console.warn(`Invalid date value for masked input: ${value}`, e);
			element.value = value;
		}
	} else {
		element.value = value;
	}
}

/**
 * Highlights a filled field to indicate it was auto-filled.
 *
 * @param {HTMLElement} element - The element to highlight
 */
function highlightFilledField(element) {
	// Add a class to the element
	element.classList.add("quickfill-filled");
}

/**
 * Dispatches input and change events on an element.
 *
 * @param {HTMLElement} element - The element to trigger events on
 */
function triggerEvents(element) {
	// Create and dispatch events
	const inputEvent = new Event("input", { bubbles: true });
	const changeEvent = new Event("change", { bubbles: true });

	element.dispatchEvent(inputEvent);
	element.dispatchEvent(changeEvent);
}

/**
 * Collects form data from the page, including standalone inputs.
 *
 * @returns {Object} - Object containing form data
 */
export function collectFormData() {
	const formData = [];

	// Collect data from regular forms, but only visible ones
	const allForms = document.querySelectorAll("form");
	const visibleForms = Array.from(allForms).filter(form => isElementVisible(form));
	
	for (const form of visibleForms) {
		// Only use visible form elements
		const formElements = Array.from(form.elements).filter((el) => {
			const tagName = el.tagName.toLowerCase();
			const type = el.type ? el.type.toLowerCase() : "";

			// Filter out submit, button, reset, and hidden inputs, and ensure it's visible
			return (
				((tagName === "input" &&
					!["submit", "button", "reset", "hidden"].includes(type)) ||
				tagName === "select" ||
				tagName === "textarea") &&
				isElementVisible(el)
			);
		});

		const elements = formElements.map((el) => {
			const elData = {
				id: el.id,
				name: el.name,
				type: el.type || el.tagName.toLowerCase(),
				value: el.value,
				label: "",
			};

			// Get label text
			if (el.id) {
				const label = document.querySelector(`label[for="${el.id}"]`);
				if (label) {
					elData.label = label.textContent.trim();
				}
			}

			return elData;
		});

		// Only add forms that have visible elements
		if (elements.length > 0) {
			formData.push({
				id: form.id,
				action: form.action,
				method: form.method,
				elements,
			});
		}
	}

	// Collect data from standalone inputs - only visible ones
	const allStandaloneInputs = document.querySelectorAll(
		INPUT_SELECTORS.STANDALONE_COMBINED,
	);

	const visibleStandaloneInputs = Array.from(allStandaloneInputs).filter(
		input => isElementVisible(input)
	);

	if (visibleStandaloneInputs.length > 0) {
		// Group inputs by container
		const inputGroups = groupInputsByContainer(visibleStandaloneInputs);

		for (const group of inputGroups) {
			if (group.inputs.length === 0) continue;

			const elements = group.inputs.map((el) => {
				const elData = {
					id: el.id,
					name: el.name,
					type: el.type || el.tagName.toLowerCase(),
					value: el.value,
					label: "",
				};

				// Get label text
				if (el.id) {
					const label = document.querySelector(`label[for="${el.id}"]`);
					if (label) {
						elData.label = label.textContent.trim();
					}
				}

				return elData;
			});

			formData.push({
				id: `standalone-group-${formData.length}`,
				action: "",
				method: "",
				isStandalone: true,
				elements,
			});
		}
	}

	return formData;
}