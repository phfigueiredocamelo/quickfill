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
		const { htmlElementId, value, label, type } = mapping;
		console.log(`Attempting to fill element: ID=${htmlElementId}, Label=${label}, Type=${type}, Value=${value}`);

		// Try to find the element by ID or name
		let element = null;
		
		if (htmlElementId) {
			try {
				// Use safe selectors - escape special characters in ID
				const safeId = CSS.escape(htmlElementId);
				element = form.querySelector(`#${safeId}`) || 
						form.querySelector(`[name="${safeId}"]`);
			} catch (e) {
				console.warn("Error using CSS.escape:", e);
				// Fallback to direct query if CSS.escape fails
				element = form.querySelector(`#${htmlElementId}`) || 
						form.querySelector(`[name="${htmlElementId}"]`);
			}
		}

		// Try to find by label if ID/name fails
		if (!element && label) {
			console.log(`Trying to find element by label: "${label}"`);
			
			// Use document-wide search when in zen mode or first try failed
			const useZenMode = form.zenProcess === true;
			
			// Try document-wide search for all cases
			const allLabels = document.querySelectorAll('label');
			for (const labelEl of allLabels) {
				const labelText = labelEl.textContent.trim();
				if (labelText.toLowerCase() === label.toLowerCase() || 
				   labelText.toLowerCase().includes(label.toLowerCase())) {
					
					// Try to find element by 'for' attribute
					if (labelEl.getAttribute('for')) {
						const inputById = document.getElementById(labelEl.getAttribute('for'));
						if (inputById) {
							element = inputById;
							console.log(`Found element by label 'for' attribute: ${element.id || element.name}`);
							break;
						}
					}
					
					// Look for inputs inside the label
					const inputsInLabel = labelEl.querySelectorAll('input, select, textarea');
					if (inputsInLabel.length > 0) {
						element = inputsInLabel[0];
						console.log(`Found input inside label: ${element.id || element.name || 'unnamed'}`);
						break;
					}
					
					// Look for inputs near this label
					const labelParent = labelEl.parentElement;
					if (labelParent) {
						const nearbyInputs = labelParent.querySelectorAll('input, select, textarea');
						if (nearbyInputs.length > 0) {
							element = nearbyInputs[0];
							console.log(`Found nearby input element: ${element.id || element.name || 'unnamed'}`);
							break;
						}
					}
					
					// If zen mode, try more aggressive DOM traversal
					if (useZenMode && !element) {
						// Look for inputs in neighboring elements
						const labelGrandparent = labelParent?.parentElement;
						if (labelGrandparent) {
							// Try siblings of the label's parent
							Array.from(labelGrandparent.children).forEach(sibling => {
								if (!element && sibling !== labelParent) {
									const siblingInputs = sibling.querySelectorAll('input, select, textarea');
									if (siblingInputs.length > 0) {
										element = siblingInputs[0];
										console.log(`Found input in sibling container: ${element.id || element.name || 'unnamed'}`);
									}
								}
							});
							
							// If still no element, look at the grandparent's other children
							if (!element) {
								const allInputs = labelGrandparent.querySelectorAll('input, select, textarea');
								if (allInputs.length > 0) {
									element = allInputs[0];
									console.log(`Found input in grandparent container: ${element.id || element.name || 'unnamed'}`);
								}
							}
						}
					}
				}
			}
			
			// If still no element found and not in zen mode, try form-scoped approach
			if (!element && !useZenMode) {
				// Find all labels in the form
				const labels = Array.from(form.querySelectorAll('label'));
				
				// Find a label that matches or contains our target text
				const matchingLabel = labels.find(labelEl => {
					const labelText = labelEl.textContent.trim();
					return labelText.toLowerCase() === label.toLowerCase() || 
						   labelText.toLowerCase().includes(label.toLowerCase());
				});
				
				if (matchingLabel && matchingLabel.getAttribute('for')) {
					element = form.querySelector(`#${matchingLabel.getAttribute('for')}`);
					console.log(`Found element by label: ${element ? (element.id || element.name) : 'not found'}`);
				}
				
				// If we still don't have an element, try finding inputs near this label
				if (!element && matchingLabel) {
					// Look for inputs that are siblings or children of the label's parent
					const labelParent = matchingLabel.parentElement;
					if (labelParent) {
						const nearbyInputs = labelParent.querySelectorAll('input, select, textarea');
						if (nearbyInputs.length > 0) {
							element = nearbyInputs[0];
							console.log(`Found nearby input element: ${element.id || element.name || 'unnamed'}`);
						}
					}
					
					// Try looking for inputs inside the label itself
					if (!element) {
						const inputsInLabel = matchingLabel.querySelectorAll('input, select, textarea');
						if (inputsInLabel.length > 0) {
							element = inputsInLabel[0];
							console.log(`Found input inside label: ${element.id || element.name || 'unnamed'}`);
						}
					}
				}
			}
		}

		// Try to find by type and value for radio buttons
		if (!element && type === "radio" && value) {
			console.log(`Trying to find radio button with value: "${value}"`);
			const radioButtons = form.querySelectorAll('input[type="radio"]');
			for (const radio of radioButtons) {
				if (radio.value === value) {
					element = radio;
					console.log(`Found radio button with value: ${value}`);
					break;
				}
			}
		}

		// If we still can't find it, try a more generic approach by input type and position
		if (!element && type) {
			console.log(`Trying to find element by type: "${type}"`);
			const typeSelector = type === "hidden" ? 
				`input[type="${type}"]` : 
				`input[type="${type}"]:not([type="hidden"]), ${type}`;
				
			const elements = Array.from(form.querySelectorAll(typeSelector));
			if (elements.length > 0) {
				// If we have a label, try to find an element that's near text containing the label
				if (label) {
					// Look for text nodes that contain our label text
					const walker = document.createTreeWalker(form, NodeFilter.SHOW_TEXT);
					let textNode;
					let bestElement = null;
					let shortestDistance = Infinity;
					
					while (textNode = walker.nextNode()) {
						const text = textNode.textContent.trim();
						if (text.toLowerCase().includes(label.toLowerCase())) {
							// Found text matching our label, now find closest input
							for (const el of elements) {
								// Calculate a simple "distance" between the text node and this element
								const textRect = textNode.parentElement.getBoundingClientRect();
								const elRect = el.getBoundingClientRect();
								const distance = Math.abs(textRect.top - elRect.top) + Math.abs(textRect.left - elRect.left);
								
								if (distance < shortestDistance) {
									shortestDistance = distance;
									bestElement = el;
								}
							}
						}
					}
					
					if (bestElement) {
						element = bestElement;
						console.log(`Found element by proximity to label text: ${element.id || element.name || 'unnamed'}`);
					}
				}
				
				// If we still don't have an element, just take the first one
				if (!element) {
					element = elements[0];
					console.log(`Using first ${type} element found: ${element.id || element.name || 'unnamed'}`);
				}
			}
		}

		// If we still don't have an element, try to find by similar property (like a name containing the ID)
		if (!element && htmlElementId) {
			const inputs = form.querySelectorAll('input, select, textarea');
			// Look for inputs with ID or name containing our target ID
			for (const input of inputs) {
				if ((input.id && input.id.includes(htmlElementId)) || 
					(input.name && input.name.includes(htmlElementId))) {
					element = input;
					console.log(`Found element by partial ID/name match: ${input.id || input.name}`);
					break;
				}
			}
		}

		if (!element) {
			console.warn(`Element with ID="${htmlElementId}", label="${label}" not found in form`);
			return;
		}

		// Fill the element
		console.log(`Element found, filling with value: ${value}`);
		const filled = fillElement(element, value);
		if (filled) {
			filledFields.push(element);
			console.log(`Successfully filled element: ${element.id || element.name || 'unnamed'}`);
		} else {
			console.warn(`Failed to fill element: ${element.id || element.name || 'unnamed'}`);
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
	const labelMap = new Map();
	const typeMap = new Map();
	
	// biome-ignore lint/complexity/noForEach: <explanation>
	originalInputs.forEach((input) => {
		if (input.id) inputMap.set(input.id, input);
		if (input.name) inputMap.set(input.name, input);
		
		// Also map by associated label text
		if (input.id) {
			const label = document.querySelector(`label[for="${input.id}"]`);
			if (label) {
				const labelText = label.textContent.trim().toLowerCase();
				labelMap.set(labelText, input);
			}
		}
		
		// Group by input type
		const type = input.type || input.tagName.toLowerCase();
		if (!typeMap.has(type)) {
			typeMap.set(type, []);
		}
		typeMap.get(type).push(input);
	});

	console.log("Virtual form input map:", Array.from(inputMap.keys()));
	console.log("Virtual form label map:", Array.from(labelMap.keys()));
	console.log("Virtual form type map:", Array.from(typeMap.keys()));

	// Fill each mapped field
	// biome-ignore lint/complexity/noForEach: <explanation>
	mappings.forEach((mapping) => {
		const { htmlElementId, value, label, type } = mapping;
		console.log(`Attempting to fill virtual element: ID=${htmlElementId}, Label=${label}, Type=${type}, Value=${value}`);
		
		// Try to find element by ID or name
		let element = htmlElementId ? inputMap.get(htmlElementId) : null;
		
		// Try to find by label if ID/name fails
		if (!element && label) {
			const labelLower = label.toLowerCase();
			
			// Check exact label match
			if (labelMap.has(labelLower)) {
				element = labelMap.get(labelLower);
				console.log(`Found element by exact label match: ${element.id || element.name}`);
			} else {
				// Check for partial label match
				for (const [labelText, input] of labelMap.entries()) {
					if (labelText.includes(labelLower) || labelLower.includes(labelText)) {
						element = input;
						console.log(`Found element by partial label match: ${element.id || element.name}`);
						break;
					}
				}
			}
			
			// If still no match, try to find any label in the DOM that matches
			if (!element) {
				console.log("Trying to find element by directly searching DOM labels");
				const allLabels = document.querySelectorAll('label');
				for (const domLabel of allLabels) {
					const labelText = domLabel.textContent.trim().toLowerCase();
					if (labelText === labelLower || labelText.includes(labelLower) || labelLower.includes(labelText)) {
						// Found a matching label, now get the associated input
						if (domLabel.getAttribute('for')) {
							const inputId = domLabel.getAttribute('for');
							const input = document.getElementById(inputId);
							if (input) {
								// For zen-process, we don't check if the input is in originalInputs
								element = input;
								console.log(`Found element via DOM label search: ${element.id || element.name}`);
								break;
							}
						}
						
						// Check for inputs inside the label
						const inputsInLabel = domLabel.querySelectorAll('input, select, textarea');
						if (inputsInLabel.length > 0) {
							// Take the first input in label
							element = inputsInLabel[0];
							console.log(`Found element inside label: ${element.id || element.name || 'unnamed'}`);
							break;
						}
						
						// Check for inputs near the label
						if (!element) {
							const parent = domLabel.parentElement;
							if (parent) {
								const nearbyInputs = parent.querySelectorAll('input, select, textarea');
								if (nearbyInputs.length > 0) {
									element = nearbyInputs[0];
									console.log(`Found element near label: ${element.id || element.name || 'unnamed'}`);
									break;
								}
							}
						}
						
						// If still no element, look at siblings of parent
						if (!element) {
							const parent = domLabel.parentElement;
							if (parent && parent.parentElement) {
								const siblings = parent.parentElement.children;
								for (const sibling of siblings) {
									if (sibling !== parent) {
										const inputs = sibling.querySelectorAll('input, select, textarea');
										if (inputs.length > 0) {
											element = inputs[0];
											console.log(`Found element in sibling element: ${element.id || element.name || 'unnamed'}`);
											break;
										}
									}
								}
							}
						}
					}
				}
				
				// If we found an element outside the original inputs, make sure it's valid to use
				if (element && !originalInputs.includes(element)) {
					// Add this element to our tracked elements
					console.log(`Element found outside original inputs: ${element.id || element.name || 'unnamed'}`);
					originalInputs.push(element);
				}
			}
		}
		
		// Try to find by type and value for radio buttons
		if (!element && type === "radio" && value) {
			console.log(`Trying to find radio button with value: "${value}"`);
			const radioButtons = typeMap.get("radio") || [];
			for (const radio of radioButtons) {
				if (radio.value === value) {
					element = radio;
					console.log(`Found radio button with value: ${value}`);
					break;
				}
			}
		}
		
		// Try to find by type only as a fallback
		if (!element && type && typeMap.has(type)) {
			const typeInputs = typeMap.get(type);
			if (typeInputs.length > 0) {
				// If we have multiple inputs of the same type, try to match by label
				if (typeInputs.length > 1 && label) {
					// Find the input closest to text that matches our label
					for (const input of typeInputs) {
						const inputRect = input.getBoundingClientRect();
						
						// Look for text containing our label near this input
						let found = false;
						const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
						let textNode;
						
						while (textNode = walker.nextNode()) {
							const text = textNode.textContent.trim();
							if (text.toLowerCase().includes(label.toLowerCase())) {
								const textRect = textNode.parentElement.getBoundingClientRect();
								// Check if within reasonable distance
								const distance = Math.abs(textRect.top - inputRect.top) + Math.abs(textRect.left - inputRect.left);
								if (distance < 200) { // arbitrary threshold
									element = input;
									console.log(`Found element by type and proximity to label: ${input.id || input.name}`);
									found = true;
									break;
								}
							}
						}
						
						if (found) break;
					}
				}
				
				// If we still don't have an element, just take the first one of this type
				if (!element) {
					element = typeInputs[0];
					console.log(`Using first ${type} element found: ${element.id || element.name || 'unnamed'}`);
				}
			}
		}
		
		// If we still can't find it, try partial ID matching
		if (!element && htmlElementId) {
			for (const input of originalInputs) {
				if ((input.id && input.id.includes(htmlElementId)) || 
				    (input.name && input.name.includes(htmlElementId))) {
					element = input;
					console.log(`Found element by partial ID/name match: ${input.id || input.name}`);
					break;
				}
			}
		}

		if (!element) {
			console.warn(
				`Original element with ID="${htmlElementId}", label="${label}", type="${type}" not found in virtual form`,
			);
			return;
		}

		// Fill the element
		console.log(`Virtual element found, filling with value: ${value}`);
		const filled = fillElement(element, value);
		if (filled) {
			filledFields.push(element);
			console.log(`Successfully filled virtual element: ${element.id || element.name || 'unnamed'}`);
		} else {
			console.warn(`Failed to fill virtual element: ${element.id || element.name || 'unnamed'}`);
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
		console.log(`Filling ${tagName} (type=${type}) with value: "${value}"`);
		
		// Special handling for custom selects (e.g., gender dropdown)
		if (tagName === "div" && element.id && element.id.startsWith("Select")) {
			// Find the hidden input to set its value
			const hiddenInput = element.querySelector('input[type="hidden"]');
			if (hiddenInput) {
				hiddenInput.value = value;
				
				// Find and update the visible selection text
				const displayElement = element.querySelector('.sc-deXhhX') || 
									  element.querySelector('[class*="select"]') || 
									  element.querySelector('[class*="dropdown"]');
                                      
				if (displayElement) {
					displayElement.textContent = value;
				}
				
				// Find all options and mark the selected one
				const options = element.querySelectorAll('.sc-epALIP') || 
							   element.querySelectorAll('[class*="option"]') || 
							   element.querySelectorAll('li');
                               
				let optionFound = false;
				for (const option of options) {
					const optionText = option.textContent.trim();
					if (optionText.toLowerCase() === value.toLowerCase() || 
					    optionText.toLowerCase().includes(value.toLowerCase()) || 
					    value.toLowerCase().includes(optionText.toLowerCase())) {
						// Simulate selection event
						try {
							option.click();
							optionFound = true;
							console.log(`Clicked matching option: "${optionText}"`);
							break;
						} catch (e) {
							console.warn(`Failed to click option: ${e.message}`);
						}
					}
				}
				
				// If we couldn't find an option to click, at least set the value
				if (!optionFound) {
					console.log(`No matching option found, setting value directly`);
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
			// Try to handle custom elements or unknown types
			if (element.isContentEditable) {
				// Handle contenteditable elements
				element.textContent = value;
				console.log(`Filled contenteditable element`);
			} else if (typeof element.value !== 'undefined') {
				// Handle any element with a value property
				element.value = value;
				console.log(`Set value directly on element`);
			} else {
				console.warn(`Unsupported element type: ${tagName} (${type})`);
				return false;
			}
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
	console.log(`Filling select element ${element.id || element.name} with value "${value}"`);
	console.log(`Available options:`, Array.from(element.options).map(opt => 
		`${opt.value}: ${opt.textContent.trim()}`
	));

	// Check each option - first try exact match
	let matched = false;
	
	for (const option of element.options) {
		const optionText = option.textContent.trim();
		const optionValue = option.value;
		
		// Check for exact matches (case insensitive)
		if (optionValue.toLowerCase() === value.toLowerCase() || 
		    optionText.toLowerCase() === value.toLowerCase()) {
			element.value = optionValue;
			matched = true;
			console.log(`Exact match found: "${optionText}" (${optionValue})`);
			break;
		}
	}

	// If no exact match, try for partial matches
	if (!matched) {
		// Look for options containing the value
		for (const option of element.options) {
			const optionText = option.textContent.trim();
			const optionValue = option.value;
			
			if (optionText.toLowerCase().includes(value.toLowerCase()) || 
			    value.toLowerCase().includes(optionText.toLowerCase())) {
				element.value = optionValue;
				matched = true;
				console.log(`Partial match found: "${optionText}" (${optionValue})`);
				break;
			}
		}
	}
	
	// Check if this is a select with a value that might be capitalized or formatted differently
	if (!matched && typeof value === 'string') {
		const valueLower = value.toLowerCase();
		
		// Try with a normalized version of the value (lowercase, no special chars)
		const normalizeText = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
		const normalizedValue = normalizeText(value);
		
		for (const option of element.options) {
			const optionText = option.textContent.trim();
			const normalizedOption = normalizeText(optionText);
			
			if (normalizedOption === normalizedValue || 
			    normalizedOption.includes(normalizedValue) || 
			    normalizedValue.includes(normalizedOption)) {
				element.value = option.value;
				matched = true;
				console.log(`Normalized match found: "${optionText}" (${option.value})`);
				break;
			}
		}
	}

	if (!matched) {
		console.warn(
			`Could not match value "${value}" to any option in select element ${element.id || element.name}`,
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
	console.log(`Filling ${element.type} element ${element.id || element.name} with value "${value}"`);
	
	if (element.type === "checkbox") {
		// For checkboxes, we use true/false
		const positiveValues = [
			true, "true", "1", "yes", "sim", "verdadeiro", "checked", "selected", "on"
		];
		const negativeValues = [
			false, "false", "0", "no", "não", "nao", "falso", "unchecked", "unselected", "off"
		];
		
		// Convert to lowercase for string comparison
		const valueLower = typeof value === "string" ? value.toLowerCase() : value;
		
		if (positiveValues.includes(valueLower)) {
			element.checked = true;
			console.log(`Checkbox ${element.id || element.name} checked`);
		} else if (negativeValues.includes(valueLower)) {
			element.checked = false;
			console.log(`Checkbox ${element.id || element.name} unchecked`);
		} else {
			// If it's not a clear true/false value, try to infer from context
			const label = getAssociatedLabel(element);
			const labelText = label ? label.textContent.trim().toLowerCase() : "";
			
			if (labelText && typeof value === "string") {
				// If the value contains or is similar to the label text, check it
				if (value.toLowerCase().includes(labelText) || 
				    labelText.includes(value.toLowerCase())) {
					element.checked = true;
					console.log(`Checkbox ${element.id || element.name} checked based on label similarity`);
				} else {
					// Default to checked for agreement checkboxes (terms, privacy policy, etc.)
					const agreementTerms = ["agree", "accept", "consent", "terms", "policy", "privacy", 
					                       "newsletter", "email", "subscri", "offers", "news"];
					                      
					if (agreementTerms.some(term => labelText.includes(term))) {
						element.checked = true;
						console.log(`Checkbox ${element.id || element.name} checked as agreement checkbox`);
					} else {
						console.warn(`Could not determine checkbox value, defaulting to unchecked`);
					}
				}
			} else {
				console.warn(`Invalid value for checkbox: ${value}, leaving unchecked`);
			}
		}
	} else if (element.type === "radio") {
		// For radio buttons, we need to be more flexible
		const shouldCheck = (() => {
			// Simple boolean values
			if (value === true || value === "true" || value === "1" || 
			    (typeof value === "string" && value.toLowerCase() === "yes")) {
				return true;
			}
			
			// Special case handling for numbered values (common in forms)
			if (element.value && value && element.value === value.toString()) {
				return true;
			}
			
			// Special case handling for PF/PJ (Pessoa Física / Pessoa Jurídica) in Brazil
			if (element.value === "1" && (
				typeof value === "string" && (
					value.toLowerCase().includes("física") || 
					value.toLowerCase().includes("fisica") || 
					value.toLowerCase() === "pf"
				))) {
				return true;
			}
			
			if (element.value === "2" && (
				typeof value === "string" && (
					value.toLowerCase().includes("jurídica") || 
					value.toLowerCase().includes("juridica") || 
					value.toLowerCase() === "pj"
				))) {
				return true;
			}
			
			// Check if value directly matches this radio button's value
			if (element.value === value) {
				return true;
			}
			
			// Check radio button's label for matches
			const label = getAssociatedLabel(element);
			if (label && typeof value === "string") {
				const labelText = label.textContent.trim().toLowerCase();
				const valueLower = value.toLowerCase();
				
				// Check for exact or partial matches between label and value
				if (labelText === valueLower || 
				    labelText.includes(valueLower) || 
				    valueLower.includes(labelText)) {
					return true;
				}
				
				// For gender radio buttons
				if ((labelText.includes("male") || labelText.includes("homem") || labelText === "m") && 
				    (valueLower === "male" || valueLower === "homem" || valueLower === "m")) {
					return true;
				}
				
				if ((labelText.includes("female") || labelText.includes("mulher") || labelText === "f") && 
				    (valueLower === "female" || valueLower === "mulher" || valueLower === "f")) {
					return true;
				}
			}
			
			// Check if this radio is part of a group and its numerical value matches
			if (element.name && document.getElementsByName(element.name).length > 1) {
				// This radio is part of a group
				const allRadios = document.getElementsByName(element.name);
				const position = Array.from(allRadios).indexOf(element);
				
				// If value is a number and matches this radio's position (+1)
				if (typeof value === "number" && value === position + 1) {
					return true;
				}
				
				// If value is a string number and matches this radio's position (+1)
				if (typeof value === "string" && !isNaN(parseInt(value)) && 
				    parseInt(value) === position + 1) {
					return true;
				}
			}
			
			return false;
		})();
		
		if (shouldCheck) {
			element.checked = true;
			console.log(`Radio button ${element.id || element.name} (${element.value}) checked`);
			
			// Dispatch events to ensure any change handlers are triggered
			triggerEvents(element);
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