/**
 * Constants for ScratchForms
 */

import { GPTModel } from "../types";

// Chrome message actions
export const ACTIONS = {
	FILL_FORMS: "fillForms",
	UPDATE_SETTINGS: "updateSettings",
	GET_FORM_DATA: "getFormData",
	CLEAR_CONTEXT: "clearContext",
	CLEAR_LOGS: "clearLogs",
	GET_LOGS: "getLogs",
};

// Storage keys
export const STORAGE_KEYS = {
	SETTINGS: "scratchforms_settings",
	LOGS: "scratchforms_logs",
	CONTEXT_DATA: "scratchforms_context",
};

// Input field selectors
export const INPUT_SELECTORS = [
	'input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"])',
	"select",
	"textarea",
];

// Default settings
export const DEFAULT_SETTINGS = {
	enabled: false,
	apiKey: "",
	contextData: {
		json: "",
		txt: "",
		csv: "",
		xml: "",
	},
	selectedFormat: "json" as const,
	selectedModel: "gpt-3.5-turbo" as GPTModel,
};

// Available GPT models
export const AVAILABLE_MODELS: GPTModel[] = [
	"gpt-3.5-turbo",
	"gpt-4-turbo",
	"gpt-4o",
];

// Maximum number of log entries to store
export const MAX_LOG_ENTRIES = 100;

// CSS styles for filled fields
export const FILLED_FIELD_STYLE = `
  background-color:rgb(182, 255, 188) !important;
  border: 1px solidrgb(30, 255, 0) !important;
  transition: background-color 0.3s ease;
`;

// OpenAI API endpoint
export const GPT_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
