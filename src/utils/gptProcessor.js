/**
 * Processes form elements using GPT-4 to extract field mappings from context.
 *
 * @param {Object} params - The parameters for processing
 * @param {string} params.apiKey - OpenAI API key
 * @param {Array} params.formElements - Array of extracted form elements
 * @param {string} params.userConversation - Conversation context to analyze
 * @param {string} [params.formFieldHints] - Additional context about form fields
 * @returns {Promise<Array>} - JSON array of field mappings
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
		return processGPTResponse(response, formElements);
	} catch (error) {
		console.error("Error processing form with GPT:", error);
		throw error;
	}
}

// Form element extraction has been moved to formUtils.js

/**
 * Builds the prompt for GPT-4.
 *
 * @param {Array} formElements - Array of form element objects
 * @param {string} userConversation - Conversation context
 * @param {string} formFieldHints - Additional hints
 * @returns {string} - The complete prompt for GPT
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
3. Match the form fields with appropriate values find the best match possible for each field based on the context provided in the conversation.
4. Return ONLY a JSON array with the following structure:
[
  {
    "htmlElementId": "exact-html-element-id-or-name",
    "value": "extracted-value-from-context"
  }
]

For select fields, ensure the value matches one of the available options.
For radio/checkbox fields, set the value to "true" or "false".
Do not include any explanation, just the JSON array.
`;
}

/**
 * Makes a request to the OpenAI API.
 *
 * @param {string} apiKey - OpenAI API key
 * @param {string} prompt - The prompt for GPT
 * @returns {Promise<Object>} - The API response
 */
async function fetchGPTResponse(apiKey, prompt) {
	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: "gpt-4-turbo-preview",
			messages: [
				{
					role: "system",
					content:
						"You are a form field analysis assistant. Your task is to extract information from conversation context to fill form fields. Return only valid JSON.",
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
 * Processes and validates the GPT response.
 *
 * @param {Object} response - The API response
 * @param {Array} formElements - Array of form element objects
 * @returns {Array} - Validated field mappings
 */
function processGPTResponse(response, formElements) {
	// Extract the content from the GPT response
	const content = response.choices?.[0]?.message?.content;
	if (!content) {
		throw new Error("Invalid response from GPT");
	}

	// Extract JSON from the response (in case there's any extra text)
	let mappings;
	try {
		// Find JSON array in the response
		const jsonMatch = content.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			mappings = JSON.parse(jsonMatch[0]);
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

	// Create a map of valid element IDs and names
	const validElementIds = new Map();
	// biome-ignore lint/complexity/noForEach: <explanation>
	formElements.forEach((el) => {
		if (el.id) validElementIds.set(el.id, el);
		if (el.name) validElementIds.set(el.name, el);
	});

	// Validate each mapping
	return mappings.filter((mapping) => {
		const { htmlElementId, value } = mapping;

		// Check if the element exists
		if (!htmlElementId || !validElementIds.has(htmlElementId)) {
			console.warn(`Element with ID/name "${htmlElementId}" not found`);
			return false;
		}

		// Check if the value is appropriate for the element type
		const element = validElementIds.get(htmlElementId);
		if (!isValidValueForElement(value, element)) {
			console.warn(`Invalid value for element "${htmlElementId}"`);
			return false;
		}

		return true;
	});
}

/**
 * Validates if a value is appropriate for an element type.
 *
 * @param {string} value - The value to validate
 * @param {Object} element - The element info
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

// Export the main function
export { processFormWithGPT };
