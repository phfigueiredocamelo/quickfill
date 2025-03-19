/**
 * GPT API Utilities for QuickFill V2
 */

import { GPTResponse, FormElement, Settings, ContextFormat } from "../types";
import { GPT_API_ENDPOINT } from "./constants";

/**
 * Process form elements with GPT to get field values
 * @param elements Form elements to process
 * @param contextFormat Format of the user context
 * @param contextContent User context to use for filling
 * @param settings Extension settings
 * @returns Response with field mappings
 */
export const processFormWithGPT = async (
	elements: FormElement[],
	contextFormat: ContextFormat,
	contextContent: string,
	settings: Settings,
): Promise<GPTResponse> => {
	try {
		const apiKey = settings.apiKey;
		if (!apiKey) {
			return {
				success: false,
				mappings: [],
				error: "API key is not set",
			};
		}
		// Create the prompt for GPT
		const prompt = createGPTPrompt(elements, contextContent);
		// Call the GPT API
		const response = await callGPTAPI(prompt, apiKey, settings.selectedModel);
		// Parse the response to get field mappings
		const mappings = parseGPTResponse(response, elements);
		return {
			success: true,
			mappings,
			rawResponse: response,
		};
	} catch (error) {
		console.error("Error processing form with GPT:", error);
		return {
			success: false,
			mappings: [],
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
};

/**
 * Create a prompt for GPT to fill form fields
 * @param elements Form elements to process
 * @param format Format of the user context
 * @param context User context to use
 * @returns Prompt string
 */
const createGPTPrompt = (
	elements: FormElement[],
	format: string,
	context: string,
): string => {
	// Create a simple representation of the input elements
	const inputsRepresentation = elements
		.map((element) => {
			// Start with the element's basic info
			let inputInfo = `input_id: ${element.idx}`;

			// Add the concatenated attributes string
			if (
				element.otherAttributesMap &&
				typeof element.otherAttributesMap === "string"
			) {
				inputInfo += `\n  summarized_attributes: ${element.otherAttributesMap}`;
			}

			return inputInfo;
		})
		.join("\n\n");

	return `
You are an AI assistant that helps fill in form fields based on user information.

I'll provide you with:
1. A list of form inputs with their attributes
2. User's personal information as context

Please analyze the form fields and determine the appropriate values based on the user's context.

FORM INPUTS:
${inputsRepresentation}

USER CONTEXT (format: ${format}):
${context}

Respond with ONLY a JSON object containing field mappings in this exact format:
{
  "mappings": [
    { "idx": "input_id", "value": "extracted value from context" },
		...
  ]
}

Important guidelines:
- Only fill fields that you undertand that is a input text or textarea
- Be creative associating user context with form fields when necessary
- Use the exact field IDs provided
- Do not make up information that's not in the user context
- If you can't fill a field, omit it from the response
- Do not include any explanations, only the JSON object
- Try to transform value to match the expected mask if it exists in the field attributes
`;
};

/**
 * Call the GPT API with the prepared prompt
 * @param prompt Prompt to send to GPT
 * @param apiKey OpenAI API key
 * @param model GPT model to use
 * @returns GPT API response text
 */
const callGPTAPI = async (
	prompt: string,
	apiKey: string,
	model: string,
): Promise<string> => {
	const response = await fetch(GPT_API_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: model,
			messages: [
				{
					role: "system",
					content:
						"You are a helpful assistant that fills in form fields based on user context.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			temperature: 0.3,
			max_tokens: 2000,
		}),
	});

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(
			`GPT API error: ${errorData.error?.message || "Unknown error"}`,
		);
	}

	const data = await response.json();
	return data.choices[0].message.content;
};

/**
 * Parse GPT response to extract field mappings
 * @param responseText GPT response text
 * @param elements Original form elements
 * @returns Array of field mappings
 */
const parseGPTResponse = (
	responseText: string,
	elements: FormElement[],
): { idx: string; value: string }[] => {
	try {
		// Extract JSON from response (handling potential markdown code blocks)
		let jsonText = responseText.trim();

		// If the response is wrapped in a code block, extract it
		const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		if (codeBlockMatch) {
			jsonText = codeBlockMatch[1];
		}

		// Parse the JSON
		const data = JSON.parse(jsonText);

		// Validate the structure
		if (!data.mappings || !Array.isArray(data.mappings)) {
			throw new Error("Invalid response format");
		}

		// Filter out any mappings with invalid IDs
		const validIds = new Set(elements.map((e) => e.idx));
		return data.mappings.filter(
			(mapping) =>
				validIds.has(mapping.idx) && typeof mapping.value === "string",
		);
	} catch (error) {
		console.error("Error parsing GPT response:", error);
		return [];
	}
};
