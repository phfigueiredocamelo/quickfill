/**
 * Constants used throughout the application
 */

// Input field selectors
export const INPUT_SELECTORS = {
	STANDALONE: [
		'input:not([type="submit"]):not([type="button"]):not([type="reset"]):not(form *)',
		"select:not(form *)",
		"textarea:not(form *)",
		"div[id^='Select']:not(form *)",
	],
	FORM_INPUTS: [
		'input:not([type="submit"]):not([type="button"]):not([type="reset"])',
		"select",
		"textarea",
		"div[id^='Select']",
	],
	// Combined selector string for use in querySelectorAll
	get STANDALONE_COMBINED() {
		return this.STANDALONE.join(", ");
	},
	get FORM_INPUTS_COMBINED() {
		return this.FORM_INPUTS.join(", ");
	},
};

// CSS styles for visual feedback
export const STYLES = {
	FILLED_FIELD: `
    background-color: #f0f8ff !important; /* Light blue background */
    border: 1px solid #4682b4 !important; /* Steel blue border */
    transition: background-color 0.3s ease;
  `,
	NOTIFICATION: {
		BASE: {
			position: "fixed",
			top: "20px",
			right: "20px",
			zIndex: "9999",
			padding: "12px 20px",
			borderRadius: "4px",
			boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
			fontFamily: "Arial, sans-serif",
			fontSize: "14px",
			maxWidth: "300px",
			transition: "opacity 0.3s ease",
		},
		INFO: {
			backgroundColor: "#e3f2fd",
			color: "#0d47a1",
			border: "1px solid #90caf9",
		},
		SUCCESS: {
			backgroundColor: "#e8f5e9",
			color: "#2e7d32",
			border: "1px solid #a5d6a7",
		},
		ERROR: {
			backgroundColor: "#ffebee",
			color: "#c62828",
			border: "1px solid #ef9a9a",
		},
		WARNING: {
			backgroundColor: "#fff8e1",
			color: "#f57f17",
			border: "1px solid #ffe082",
		},
	},
};

// Default extension settings
export const DEFAULT_SETTINGS = {
	enabled: false,
	apiKey: "",
	contextData: "",
	customFields: {},
};

// Notification display duration in ms
export const NOTIFICATION_DURATION = 5000;
