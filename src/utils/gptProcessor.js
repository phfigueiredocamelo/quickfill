/**
 * GPT Processor - Processes form elements and HTML using GPT API
 *
 * This module handles:
 * 1. Processing HTML to extract form elements
 * 2. Sending form elements to GPT for field extraction
 * 3. Caching responses to avoid redundant API calls
 * 4. Matching form data with user context
 */

// Enhanced cache system for GPT responses
const CACHE_SETTINGS = {
	MAX_SIZE: 50, // Maximum number of entries in cache
	DEFAULT_EXPIRATION: 60 * 60 * 1000, // 1 hour default
	FORM_EXPIRATION: 24 * 60 * 60 * 1000, // 24 hours for form structure
};

// Cache with access timestamps for LRU eviction
class EnhancedCache {
	constructor() {
		this.cache = new Map();
		this.accessOrder = [];
	}

	// Get value from cache
	get(key) {
		const entry = this.cache.get(key);
		if (!entry) return null;

		// Update access timestamp and order
		this.updateAccessTime(key);

		// Check if entry is expired
		if (Date.now() > entry.expiresAt) {
			this.delete(key);
			return null;
		}

		return entry.data;
	}

	// Set value in cache with optional custom expiration
	set(key, data, expiration = CACHE_SETTINGS.DEFAULT_EXPIRATION) {
		// Enforce size limit - remove least recently used if at capacity
		if (this.cache.size >= CACHE_SETTINGS.MAX_SIZE && !this.cache.has(key)) {
			this.evictLRU();
		}

		const expiresAt = Date.now() + expiration;
		this.cache.set(key, { data, expiresAt });
		this.updateAccessTime(key);

		return this;
	}

	// Delete a specific cache entry
	delete(key) {
		this.cache.delete(key);
		const index = this.accessOrder.indexOf(key);
		if (index > -1) {
			this.accessOrder.splice(index, 1);
		}
	}

	// Clear all cache entries
	clear() {
		this.cache.clear();
		this.accessOrder = [];
	}

	// Check if key exists in cache
	has(key) {
		return this.cache.has(key);
	}

	// Get cache size
	get size() {
		return this.cache.size;
	}

	// Update access time and move to most-recently-used position
	updateAccessTime(key) {
		const index = this.accessOrder.indexOf(key);
		if (index > -1) {
			this.accessOrder.splice(index, 1);
		}
		this.accessOrder.push(key);
	}

	// Evict least recently used entry
	evictLRU() {
		if (this.accessOrder.length > 0) {
			const lruKey = this.accessOrder.shift();
			this.cache.delete(lruKey);
		}
	}
}

// Initialize caches
const formStructureCache = new EnhancedCache(); // Cache for HTML form structure
const formFillCache = new EnhancedCache(); // Cache for form field values

/**
 * Simplified HTML cleaning to reduce token usage.
 *
 * @param {string} html - Raw HTML content
 * @returns {string} - Cleaned HTML with only relevant form elements
 */
function cleanHTML(html) {
	// Create a DOM parser
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	// Remove all non-essential elements in one operation
	const nonEssentialSelectors =
		"script, style, link, img, svg, video, audio, canvas, iframe";
	const nonEssentialElements = doc.querySelectorAll(nonEssentialSelectors);
	nonEssentialElements.forEach((el) => el.remove());

	// Extract just the form elements and their context
	const relevantHTML = [];

	// Essential attributes to keep
	const attributesToKeep = new Set([
		"id",
		"name",
		"type",
		"value",
		"placeholder",
		"for",
		"required",
	]);

	// Process forms
	const forms = doc.querySelectorAll("form");
	forms.forEach((form) => {
		// Skip empty forms
		const formInputs = form.querySelectorAll(
			'input:not([type="submit"]):not([type="button"]), select, textarea',
		);
		if (formInputs.length === 0) return;

		// Clean form attributes
		for (let i = form.attributes.length - 1; i >= 0; i--) {
			const attr = form.attributes[i];
			if (!attributesToKeep.has(attr.name)) {
				form.removeAttribute(attr.name);
			}
		}

		// Clean input attributes
		formInputs.forEach((input) => {
			for (let i = input.attributes.length - 1; i >= 0; i--) {
				const attr = input.attributes[i];
				if (!attributesToKeep.has(attr.name)) {
					input.removeAttribute(attr.name);
				}
			}
		});

		relevantHTML.push(form.outerHTML);
	});

	// Process standalone inputs
	const standaloneInputs = doc.querySelectorAll(
		"input:not(form *), select:not(form *), textarea:not(form *)",
	);

	if (standaloneInputs.length > 0) {
		relevantHTML.push('<div class="standalone-inputs">');

		// Collect labels
		const labels = doc.querySelectorAll("label[for]");
		const labelMap = new Map();
		labels.forEach((label) => {
			labelMap.set(label.getAttribute("for"), label);
		});

		standaloneInputs.forEach((input) => {
			// Clean attributes
			for (let i = input.attributes.length - 1; i >= 0; i--) {
				const attr = input.attributes[i];
				if (!attributesToKeep.has(attr.name)) {
					input.removeAttribute(attr.name);
				}
			}

			// Add label if it exists
			let labelHTML = "";
			if (input.id && labelMap.has(input.id)) {
				const label = labelMap.get(input.id);
				labelHTML = `<label for="${input.id}">${label.textContent}</label>`;
			}

			relevantHTML.push(`<div>${labelHTML}${input.outerHTML}</div>`);
		});

		relevantHTML.push("</div>");
	}

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
 * Processes page HTML using GPT to extract form fields with enhanced caching
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

		// Generate cache key
		const cacheKey = createCacheKey(url, cleanedHTML);
		console.log("Form structure cache key:", cacheKey);

		// Check if we have a valid cached form structure
		const cachedFields = formStructureCache.get(cacheKey);
		if (cachedFields) {
			console.log("Using cached form structure");
			return cachedFields;
		}

		// No valid cache found, proceed with API request
		const prompt = buildHTMLExtractPrompt(cleanedHTML, url);
		console.log("Prompt for GPT:", prompt);
		const response = await fetchGPTResponse(apiKey, prompt);
		const extractedFields = processGPTFieldExtractionResponse(response);
		console.log("Extracted fields:", extractedFields);
		// Only cache if we got valid fields
		if (extractedFields && extractedFields.length > 0) {
			// Use longer expiration for form structure (forms don't change often)
			formStructureCache.set(
				cacheKey,
				extractedFields,
				CACHE_SETTINGS.FORM_EXPIRATION,
			);
			console.log(
				`Cached ${extractedFields.length} form fields. Cache size: ${formStructureCache.size}`,
			);
		}

		return extractedFields;
	} catch (error) {
		console.error("Error processing HTML with GPT:", error);
		// Return empty array instead of throwing to be more resilient
		return [];
	}
}

/**
 * Simplified prompt for GPT to extract form fields from HTML
 *
 * @param {string} html - Cleaned HTML content
 * @param {string} url - Current page URL
 * @returns {string} - Prompt for GPT
 */
function buildHTMLExtractPrompt(html, url) {
	return `Extract all form fields from this HTML from ${url}:
\`\`\`html
${html}
\`\`\`

Return a JSON array of objects with these properties:
- formId: Form ID or "virtual-form" for standalone inputs
- id: Field ID or name
- label: Associated label text
- type: Field type (text, email, etc.)

Example:
[
  {"formId":"form1","id":"name","label":"Full Name","type":"text"},
  {"formId":"virtual-form","id":"email","label":"Email","type":"email"}
]

Return ONLY the JSON array, nothing else.`;
}

/**
 * Processes form elements and user context to determine field values with enhanced caching
 *
 * @param {Object} params - Processing parameters
 * @param {string} params.apiKey - OpenAI API key
 * @param {Array} params.formElements - Array of extracted form elements
 * @param {string|Object} params.userConversation - Free text context data
 * @param {Object} [params.structuredData] - Structured user data
 * @param {boolean} [params.useStructuredData] - Whether to use structured data
 * @returns {Promise<Array>} - Mapped form fields with values
 */
async function processFormWithGPT({
	apiKey,
	formElements,
	userConversation,
	structuredData = {},
	useStructuredData = false,
}) {
	// Basic validation
	if (!apiKey || !formElements || !Array.isArray(formElements)) {
		console.error("Missing required parameters for form processing");
		return [];
	}

	// Check if we have valid user data based on the selected mode
	if (
		useStructuredData &&
		(!structuredData || Object.keys(structuredData).length === 0)
	) {
		console.error(
			"Structured data mode is enabled but no structured data provided",
		);
		return [];
	}

	if (
		!useStructuredData &&
		(!userConversation || userConversation.trim() === "")
	) {
		console.error("Free text mode is enabled but no context data provided");
		return [];
	}

	try {
		// Use the appropriate data source based on mode
		const userData = useStructuredData ? structuredData : userConversation;

		// Create a cache key based on essential form information and user data
		const cacheKey = createFormFillCacheKey(
			formElements,
			userData,
			useStructuredData,
		);
		console.log("Form fill cache key:", cacheKey);

		// Check if we have a valid cached mapping
		const cachedMapping = formFillCache.get(cacheKey);
		if (cachedMapping) {
			console.log("Using cached form mapping");
			return cachedMapping;
		}

		// No cache found, proceed with API request
		const prompt = buildGPTPrompt(formElements, userData, useStructuredData);
		const response = await fetchGPTResponse(apiKey, prompt);
		const mappings = processGPTMappingResponse(response, formElements);

		// Only cache if we got valid mappings
		if (mappings && mappings.length > 0) {
			formFillCache.set(cacheKey, mappings);
			console.log(
				`Cached ${mappings.length} form field mappings. Cache size: ${formFillCache.size}`,
			);
		}

		return mappings;
	} catch (error) {
		console.error("Error processing form with GPT:", error);
		return [];
	}
}

/**
 * Creates a cache key for form fill mappings based on form elements and user context
 *
 * @param {Array} formElements - Form elements to fill
 * @param {string|Object} userData - User context data (either free text or structured)
 * @param {boolean} isStructured - Whether the data is structured
 * @returns {string} - Cache key
 */
function createFormFillCacheKey(formElements, userData, isStructured = false) {
	// Extract essential form information
	const formInfo = formElements.map((el) => {
		// Include only essential properties to identify the form field
		return {
			id: el.id || "",
			label: el.label || "",
			type: el.type || "",
			formId: el.formId || "",
		};
	});

	// Create hash of form structure
	const formHash = JSON.stringify(formInfo);
	let formHashCode = 0;
	for (let i = 0; i < formHash.length; i++) {
		formHashCode = (formHashCode << 5) - formHashCode + formHash.charCodeAt(i);
		formHashCode |= 0;
	}

	// Create hash of user data - handle differently based on type
	let dataString;

	if (isStructured) {
		// For structured data, create a consistent string representation
		dataString = Object.entries(userData)
			.flatMap(([category, fields]) =>
				Object.entries(fields)
					.filter(([_, value]) => value && value.trim())
					.map(([field, value]) => `${category}.${field}:${value}`),
			)
			.sort() // Sort to ensure consistent ordering
			.join("|");
	} else {
		// For free text, just take the first portion
		dataString = userData.substring(0, 100);
	}

	// Calculate hash for the data string
	let contextHashCode = 0;
	for (let i = 0; i < dataString.length; i++) {
		contextHashCode =
			(contextHashCode << 5) - contextHashCode + dataString.charCodeAt(i);
		contextHashCode |= 0;
	}

	// Include data type in the key
	const dataType = isStructured ? "structured" : "freetext";

	return `form-${formHashCode}-${dataType}-${contextHashCode}`;
}

/**
 * Builds a prompt for GPT based on either structured or free-text user data
 *
 * @param {Array} formElements - Form elements to fill
 * @param {string|Object} userData - User context data (either free text or structured object)
 * @param {boolean} isStructured - Whether the data is structured or free text
 * @returns {string} - Complete prompt for GPT
 */
function buildGPTPrompt(formElements, userData, isStructured = false) {
	// Create the prompt differently based on data type
	let userInfoSection = "";

	if (isStructured) {
		// Format structured data for better readability
		userInfoSection = "User information (structured):\n";

		// Iterate through each category in the structured data
		for (const [category, fields] of Object.entries(userData)) {
			userInfoSection += `\n${category.toUpperCase()}:\n`;

			// Add each field in this category
			for (const [field, value] of Object.entries(fields)) {
				if (value && value.trim()) {
					userInfoSection += `- ${field}: ${value}\n`;
				}
			}
		}
	} else {
		// Use free text data directly
		userInfoSection = `User information:\n${userData}`;
	}

	return `Fill these form fields with values from the user information:

Fields: ${JSON.stringify(formElements)}

${userInfoSection}

Return a JSON array where each object has:
- formId: Same as input
- id: Same as input
- label: Same as input
- value: The value to fill in
- type: Same as input

IMPORTANT RULES:
- For checkboxes/radio: use "true" or "false"
- For selects: use an existing option
- For ALL date fields: ALWAYS format dates as YYYY-MM-DD, no matter how they appear in the user information
- For date fields with type "date": ALWAYS ensure the format is YYYY-MM-DD (year-month-day)

Example:
[
  {"formId":"form1","id":"name","label":"Full Name","value":"John Smith","type":"text"},
  {"formId":"form1","id":"birthdate","label":"Date of Birth","value":"1990-05-15","type":"date"}
]

Return ONLY JSON array, nothing else.`;
}

// Available LLM models
const MODELS = {
	FAST: "gpt-3.5-turbo-0125", // Faster, cheaper
	STANDARD: "gpt-3.5-turbo", // Default
	ADVANCED: "gpt-4o-mini", // Better accuracy but slower
};

// Current model setting - can be changed in settings
let currentModel = MODELS.FAST;

/**
 * Sets the AI model to use for queries
 *
 * @param {string} modelName - Model name to use (from MODELS object)
 */
function setModel(modelName) {
	if (MODELS[modelName]) {
		currentModel = MODELS[modelName];
	} else {
		// If invalid model name, default to STANDARD
		currentModel = MODELS.STANDARD;
	}
}

/**
 * Makes a request to the OpenAI API with simplified parameters
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
			model: currentModel,
			messages: [
				{
					role: "system",
					content:
						"Extract form fields or fill forms based on user info. Return JSON only.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			temperature: 0.2,
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
 * Simplified processor for GPT field extraction response
 *
 * @param {Object} response - GPT API response
 * @returns {Array} - Extracted form fields
 */
function processGPTFieldExtractionResponse(response) {
	// Extract content from response
	const content = response.choices?.[0]?.message?.content;
	if (!content) {
		throw new Error("Invalid response from GPT");
	}

	// Parse JSON from content
	try {
		// Find JSON array in content (anything between square brackets)
		const jsonMatch = content.match(/\[(.|\n)*\]/m);
		if (jsonMatch) {
			const fields = JSON.parse(jsonMatch[0]);
			return Array.isArray(fields) ? fields : [];
		} else {
			console.error("No JSON array found in response:", content);
			return [];
		}
	} catch (error) {
		console.error("Error parsing GPT response:", error);
		return [];
	}
}

/**
 * Simplified processor for GPT form field mapping response
 *
 * @param {Object} response - GPT API response
 * @param {Array} formElements - Original form elements
 * @returns {Array} - Mapped form fields with values
 */
function processGPTMappingResponse(response, formElements) {
	// Extract content from response
	const content = response.choices?.[0]?.message?.content;
	if (!content) {
		console.error("Invalid response from GPT");
		return [];
	}

	// Parse JSON from content
	let mappings = [];
	try {
		// Find JSON array in content
		const jsonMatch = content.match(/\[(.|\n)*\]/m);
		if (jsonMatch) {
			mappings = JSON.parse(jsonMatch[0]);
			if (!Array.isArray(mappings)) mappings = [];
		} else {
			console.error("No JSON array found in response");
		}
	} catch (error) {
		console.error("Error parsing GPT response:", error);
		return [];
	}

	// Convert mappings to the format expected by formUtils
	return mappings.map((mapping) => ({
		htmlElementId: mapping.id || "",
		value: mapping.value || "",
		label: mapping.label || "",
		formId: mapping.formId || "",
		type: mapping.type || "",
	}));
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

/**
 * Clears all cached data
 */
function clearCache() {
	formStructureCache.clear();
	formFillCache.clear();
	console.log("All caches cleared");
}

/**
 * Gets information about the current cache state
 *
 * @returns {Object} - Cache statistics
 */
function getCacheStats() {
	return {
		formStructureSize: formStructureCache.size,
		formFillSize: formFillCache.size,
		settings: CACHE_SETTINGS,
	};
}

// Export the functions
export {
	processFormWithGPT,
	processHTMLWithGPT,
	setModel,
	MODELS,
	clearCache,
	getCacheStats,
};
