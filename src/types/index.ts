// Basic types for QuickFill V2

// Format options for saving context
export type ContextFormat = 'json' | 'txt' | 'csv' | 'xml';

// GPT model options
export type GPTModel = 'gpt-3.5-turbo' | 'gpt-4-turbo' | 'gpt-4o';

// Extension settings
export interface Settings {
  enabled: boolean;
  apiKey: string;
  contextData: Record<ContextFormat, string>;
  selectedFormat: ContextFormat;
  selectedModel: GPTModel;
}

// Data structure for tracking form elements
export interface FormElement {
  idx: string;           // Unique UUID for referencing
  [key: string]: any;    // Allow any additional attributes
}

// Form processing result
export interface ProcessingResult {
  success: boolean;
  fields: FormElement[];
  errors?: string[];
}

// Log entry structure
export interface LogEntry {
  timestamp: number;
  action: string;
  details: string;
  success: boolean;
  data?: Record<string, any>;
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