/**
 * GPT Processor - Processes form elements and HTML using GPT API
 *
 * This module handles:
 * 1. Processing HTML to extract form elements
 * 2. Sending form elements to GPT for field extraction
 * 3. Caching responses to avoid redundant API calls
 * 4. Matching form data with user context
 */

// Cache for GPT responses (in-memory)
const gptResponseCache = new Map();
const CACHE_EXPIRATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Cleans HTML to reduce token usage by removing unnecessary content.
 *
 * @param {string} html - Raw HTML content
 * @returns {string} - Cleaned HTML with only relevant form elements
 */
function cleanHTML(html) {
	// Create a DOM parser
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	// Remove all non-essential elements in one operation for better performance
	const nonEssentialSelectors = [
		"script", "style", "link", "img", "svg", "video", 
		"audio", "canvas", "iframe", "noscript", "meta",
		"footer", "header", "aside", "nav", "div.banner", 
		"div.advertisement", "div.footer", "div.header",
		"[class*='banner']", "[class*='ad-']", "[class*='footer']",
		"[class*='header']", "[id*='banner']", "[id*='ad-']"
	].join(",");
	
	const nonEssentialElements = doc.querySelectorAll(nonEssentialSelectors);
	nonEssentialElements.forEach(el => el.remove());

	// Extract just the form elements and their context
	const relevantHTML = [];

	// Optimized attribute cleaning - only keep essential attributes in one pass
	const cleanAttributes = (element) => {
		const attributesToKeep = new Set([
			"id", "name", "type", "value", "placeholder", 
			"for", "checked", "selected", "required"
		]);
		
		// Remove all non-essential attributes in one pass
		for (let i = element.attributes.length - 1; i >= 0; i--) {
			const attr = element.attributes[i];
			if (!attributesToKeep.has(attr.name)) {
				element.removeAttribute(attr.name);
			}
		}

		// Process children only once
		const children = Array.from(element.children);
		children.forEach(child => cleanAttributes(child));
		
		return element;
	};

	// Process forms with minimal HTML structure
	const forms = doc.querySelectorAll("form");
	forms.forEach(form => {
		const formId = form.id || "";
		const formName = form.name || "";
		
		// Get only the essential form inputs
		const formInputs = form.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"]), select, textarea');
		
		// If form has no relevant inputs, skip it
		if (formInputs.length === 0) return;
		
		// Clone once and clean attributes
		const formClone = form.cloneNode(true);
		cleanAttributes(formClone);
		
		// Create minimal form HTML
		const formHTML = `<form id="${formId}" name="${formName}">${formClone.innerHTML}</form>`;
		relevantHTML.push(formHTML);
	});

	// Process standalone inputs more efficiently
	const inputSelectors = [
		'input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"]):not(form *)',
		"select:not(form *)",
		"textarea:not(form *)",
		'div[id^="Select"]:not(form *)',
	].join(",");

	const standaloneInputs = doc.querySelectorAll(inputSelectors);
	
	if (standaloneInputs.length > 0) {
		relevantHTML.push('<div class="standalone-inputs">');
		
		// Build a map of labels for faster lookups
		const labelMap = new Map();
		const labels = doc.querySelectorAll('label[for]');
		labels.forEach(label => {
			labelMap.set(label.getAttribute('for'), label);
		});

		standaloneInputs.forEach(input => {
			// Clone and clean in one operation
			const inputClone = input.cloneNode(true);
			cleanAttributes(inputClone);
			
			// Lookup label from map instead of querying DOM again
			let labelHTML = "";
			if (input.id && labelMap.has(input.id)) {
				const labelClone = labelMap.get(input.id).cloneNode(true);
				cleanAttributes(labelClone);
				labelHTML = labelClone.outerHTML;
			}
			
			// Compact HTML structure
			relevantHTML.push(`<div class="input-group">${labelHTML}${inputClone.outerHTML}</div>`);
		});
		
		relevantHTML.push("</div>");
	}

	// Return compact HTML with minimal whitespace
	return relevantHTML.join("");
}

/**
 * Creates a cache key for the page
 *
 * @param {string} url - Current page URL
 * @param {string} html - HTML content
 * @returns {string} - Unique cache key
 */
function createCacheKey(url, html) {
	// Use the URL as the base of the cache key
	let key = url;

	// Add a hash of the first 200 chars of the HTML to detect major changes
	const hashInput = html.substring(0, 200);
	let hashCode = 0;
	for (let i = 0; i < hashInput.length; i++) {
		hashCode = (hashCode << 5) - hashCode + hashInput.charCodeAt(i);
		hashCode |= 0; // Convert to 32bit integer
	}

	return `${key}-${hashCode}`;
}

/**
 * Processes page HTML using GPT to extract form fields
 *
 * @param {Object} params - Processing parameters
 * @param {string} params.apiKey - OpenAI API key
 * @param {string} params.html - Page HTML content
 * @param {string} params.url - Current page URL
 * @returns {Promise<Array>} - Extracted form fields
 */
async function processHTMLWithGPT({ apiKey, html, url }) {
	if (!apiKey) throw new Error("API key is required");
	if (!html) throw new Error("HTML content is required");

	try {
		// Clean the HTML to reduce token usage
		const cleanedHTML = cleanHTML(html);
		console.log("Cleaned HTML:", cleanedHTML);
		// Generate cache key
		const cacheKey = createCacheKey(url, cleanedHTML);
		console.log("Cache key:", cacheKey);
		// Check if we have a valid cached response
		if (gptResponseCache.has(cacheKey)) {
			const cachedResponse = gptResponseCache.get(cacheKey);

			// Check if the cache is still valid
			if (Date.now() - cachedResponse.timestamp < CACHE_EXPIRATION) {
				console.log("Using cached GPT response");
				return cachedResponse.data;
			}

			// Cache has expired, remove it
			gptResponseCache.delete(cacheKey);
		}

		// Build the prompt for GPT
		const prompt = buildHTMLExtractPrompt(cleanedHTML, url);
		console.log("GPT Prompt:", prompt);
		// Make the API request
		const response = await fetchGPTResponse(apiKey, prompt);
		console.log("GPT Response:", response);
		// Process and validate the response
		const extractedFields = processGPTFieldExtractionResponse(response);
		console.log("Extracted fields:", extractedFields);
		// Cache the response
		gptResponseCache.set(cacheKey, {
			timestamp: Date.now(),
			data: extractedFields,
		});
		console.log("set cache", gptResponseCache);
		return extractedFields;
	} catch (error) {
		console.error("Error processing HTML with GPT:", error);
		throw error;
	}
}

/**
 * Builds the prompt for GPT to extract form fields from HTML
 *
 * @param {string} html - Cleaned HTML content
 * @param {string} url - Current page URL
 * @returns {string} - Prompt for GPT
 */
function buildHTMLExtractPrompt(html, url) {
	return `
You are a form field extraction assistant. Your task is to analyze HTML form content and extract all visible form fields.

## HTML Content from ${url}:
\`\`\`html
${html}
\`\`\`

## Instructions:
1. Extract all form elements information
2. For each field, identify:
   - formId: The ID of the form or a generated ID if standalone
   - id: The field's ID or name attribute
   - label: The text label associated with the field
   - type: The field type (text, email, checkbox, radio, select, etc.)
   - options: For select fields, list all available options
   - placeholder: The placeholder text if available
   - required: Whether the field is required (true/false)
   - value: The default value if available
   - checked: For checkboxes/radio buttons, whether it's checked (true/false)
   - selected: For select fields, whether it's selected (true/false)
   - for: The ID of the label associated with the field
   - name: The field's name attribute if available

3. Return ONLY a valid JSON array with the following structure:
[
  {
    "formId": "form1",
    "id": "name",
    "label": "Full Name",
    "type": "text"
  },
  {
    "formId": "virtual-form1",
    "id": "email",
    "label": "Email Address",
    "type": "email"
  }
]

For standalone inputs, use a virtual form ID like "virtual-form1".
Return ONLY the JSON array, no explanations or other text.
`;
}

/**
 * Processes form elements and user context to determine field values
 *
 * @param {Object} params - Processing parameters
 * @param {string} params.apiKey - OpenAI API key
 * @param {Array} params.formElements - Array of extracted form elements
 * @param {string} params.userConversation - User context data
 * @param {string} [params.formFieldHints] - Additional hints
 * @returns {Promise<Array>} - Mapped form fields with values
 */
async function processFormWithGPT({
	apiKey,
	formElements,
	userConversation,
	formFieldHints = "",
}) {
	// Validate required parameters
	if (!apiKey) throw new Error("API key is required");
	if (!formElements || !Array.isArray(formElements))
		throw new Error("Form elements array is required");
	if (!userConversation) throw new Error("User conversation is required");

	try {
		// Prepare prompt for GPT
		const prompt = buildGPTPrompt(
			formElements,
			userConversation,
			formFieldHints,
		);
		console.log("GPT Prompt:", prompt);
		// Make request to OpenAI API
		const response = await fetchGPTResponse(apiKey, prompt);
		console.log("GPT Response:", response);
		// Process and validate the response
		return processGPTMappingResponse(response, formElements);
	} catch (error) {
		console.error("Error processing form with GPT:", error);
		throw error;
	}
}

/**
 * Builds the prompt for GPT to match form fields with user context
 *
 * @param {Array} formElements - Form elements to fill
 * @param {string} userConversation - User context
 * @param {string} formFieldHints - Additional hints
 * @returns {string} - Complete prompt
 */
function buildGPTPrompt(formElements, userConversation, formFieldHints) {
	return `
You are a form-filling assistant. You need to match form fields with appropriate values from the conversation context.

## Form Elements:
${JSON.stringify(formElements, null, 2)}

## User Conversation Context:
${userConversation}

${formFieldHints ? `## Additional Field Hints:\n${formFieldHints}` : ""}

## Instructions:
1. Analyze the form elements and their labels/types
2. Identify relevant information from the conversation context
3. Match the form fields with appropriate values, finding the best match possible for each field based on the context provided in the conversation
4. Include ALL of these identifiers in your response to maximize matching success:
   - formId: Always include the form ID even for standalone inputs
   - id: Include the field's ID or name
   - label: Always include the exact label text as it appears
5. Return ONLY a JSON array with the following structure:
[
  {
    "formId": "form1",
    "id": "name",
    "label": "Full Name",
    "value": "John Smith",
    "type": "text"
  }
]

It's CRITICAL to include ALL identifiers (formId, id, and label) for each field to ensure proper matching.
For select fields, ensure the value matches one of the available options.
For radio/checkbox fields, set the value to "true" or "false".
Do not include any explanation, just the JSON array.
`;
}

/**
 * Makes a request to the OpenAI API
 *
 * @param {string} apiKey - OpenAI API key
 * @param {string} prompt - Prompt for GPT
 * @returns {Promise<Object>} - API response
 */
async function fetchGPTResponse(apiKey, prompt) {
	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: "gpt-3.5-turbo",
			messages: [
				{
					role: "system",
					content:
						"You are a form field analysis assistant. Your task is to extract information from HTML and conversation context to fill form fields. Return only valid JSON.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			temperature: 0.3,
		}),
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(
			`OpenAI API error: ${error.error?.message || "Unknown error"}`,
		);
	}

	return await response.json();
}

/**
 * Processes the GPT response for HTML field extraction
 *
 * @param {Object} response - GPT API response
 * @returns {Array} - Extracted form fields
 */
function processGPTFieldExtractionResponse(response) {
	// Extract the content from the GPT response
	const content = response.choices?.[0]?.message?.content;
	if (!content) {
		throw new Error("Invalid response from GPT");
	}

	// Extract JSON from the response
	let fields;
	try {
		// Find JSON array in the response
		const jsonMatch = content.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			fields = JSON.parse(jsonMatch[0]);
		} else {
			throw new Error("No JSON array found in response");
		}
	} catch (error) {
		console.error("Error parsing GPT response:", error);
		throw new Error("Failed to parse GPT response");
	}

	// Validate the fields
	if (!Array.isArray(fields)) {
		throw new Error("GPT response is not an array");
	}

	return fields;
}

/**
 * Processes the GPT response for form field mapping
 *
 * @param {Object} response - GPT API response
 * @param {Array} formElements - Original form elements
 * @returns {Array} - Mapped form fields with values
 */
function processGPTMappingResponse(response, formElements) {
	// Extract the content from the GPT response
	const content = response.choices?.[0]?.message?.content;
	if (!content) {
		throw new Error("Invalid response from GPT");
	}

	console.log("Raw GPT response content:", content);

	// Extract JSON from the response
	let mappings;
	try {
		// Find JSON array in the response
		const jsonMatch = content.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			mappings = JSON.parse(jsonMatch[0]);
			console.log("Parsed mappings from GPT:", JSON.stringify(mappings, null, 2));
		} else {
			throw new Error("No JSON array found in response");
		}
	} catch (error) {
		console.error("Error parsing GPT response:", error);
		throw new Error("Failed to parse GPT response");
	}

	// Validate the mappings
	if (!Array.isArray(mappings)) {
		throw new Error("GPT response is not an array");
	}

	// Create maps of valid element IDs, names, labels, and formIds
	const validElementIds = new Map();
	const validElementLabels = new Map();
	const validElementFormIds = new Map();
	
	console.log("Form elements for validation:", JSON.stringify(formElements, null, 2));
	
	formElements.forEach((el) => {
		if (el.id) validElementIds.set(el.id, el);
		if (el.name) validElementIds.set(el.name, el);
		if (el.label) validElementLabels.set(el.label.toLowerCase(), el);
		if (el.formId) validElementFormIds.set(el.formId, el);
	});

	console.log("Valid element IDs:", Array.from(validElementIds.keys()));
	console.log("Valid element labels:", Array.from(validElementLabels.keys()));

	// Convert mappings to the format expected by formUtils with htmlElementId property
	const processedMappings = mappings.map(mapping => {
		// Create a new object with htmlElementId property
		return {
			htmlElementId: mapping.id || "",
			value: mapping.value || "",
			label: mapping.label || "",
			formId: mapping.formId || "",
			type: mapping.type || ""
		};
	});

	console.log("Prepared mappings for form filling:", JSON.stringify(processedMappings, null, 2));
	return processedMappings;
}

/**
 * Validates if a value is appropriate for an element type
 *
 * @param {string} value - Value to validate
 * @param {Object} element - Element info
 * @returns {boolean} - Whether the value is valid
 */
function isValidValueForElement(value, element) {
	// Handle null or undefined values
	if (value === null || value === undefined) {
		return false;
	}

	switch (element.type) {
		case "checkbox":
		case "radio":
			return (
				value === true ||
				value === false ||
				value === "true" ||
				value === "false"
			);

		case "select":
		case "select-one":
		case "select-multiple":
			// For select elements, check if the value is in the options
			return element.options.some(
				(option) => option.value === value || option.text === value,
			);

		case "number":
			return !isNaN(Number(value));

		case "date":
			return !isNaN(Date.parse(value));

		default:
			return typeof value === "string";
	}
}

// Export the functions
export { processFormWithGPT, processHTMLWithGPT };
