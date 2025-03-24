// Basic types

// GPT model options
export type GPTModel = "gpt-3.5-turbo" | "gpt-4-turbo" | "gpt-4o";

// Extension settings
export interface Settings {
  enabled: boolean;
  apiKey: string;
  contextData: string;
  selectedModel: GPTModel;
  contextPasswordHash?: string;
}

// Data structure for tracking form elements
export interface FormElement {
  idx: string; // Unique UUID for referencing
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  [key: string]: any; // Allow any additional attributes
}

// Form processing result
export interface ProcessingResult {
  success: boolean;
  fields: FormElement[];
  errors?: string[];
}

// GPT API response structure
export interface GPTResponse {
  success: boolean;
  mappings: {
    idx: string;
    value: string;
  }[];
  error?: string;
  rawResponse?: string;
}
