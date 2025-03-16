/**
 * Constants used throughout the application
 */

// Chrome message actions
export const ACTIONS = {
	FILL_FORMS: "fillForms",
	UPDATE_SETTINGS: "updateSettings",
	GET_FORM_DATA: "getFormData",
	CLEAR_CACHE: "clearCache",
	GET_CACHE_STATS: "getCacheStats",
};

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

// Profile schema for structured user data
export const PROFILE_SCHEMA = {
	personal: {
		firstName: { label: "First Name", placeholder: "John" },
		lastName: { label: "Last Name", placeholder: "Smith" },
		fullName: { label: "Full Name", placeholder: "John Smith" },
		email: { label: "Email", placeholder: "john.smith@example.com" },
		phone: { label: "Phone", placeholder: "+1 (555) 123-4567" },
		mobile: { label: "Mobile", placeholder: "+1 (555) 987-6543" },
		birthdate: { label: "Birth Date", placeholder: "1990-01-15" },
		gender: { label: "Gender", placeholder: "Male/Female/Other" },
		nationality: { label: "Nationality", placeholder: "American" },
		occupation: { label: "Occupation", placeholder: "Software Engineer" },
		company: { label: "Company", placeholder: "Acme Corp" },
	},
	address: {
		street: { label: "Street Address", placeholder: "123 Main St" },
		apartment: { label: "Apartment/Unit", placeholder: "Apt 4B" },
		city: { label: "City", placeholder: "New York" },
		state: { label: "State/Province", placeholder: "NY" },
		zipCode: { label: "Zip/Postal Code", placeholder: "10001" },
		country: { label: "Country", placeholder: "United States" },
	},
	payment: {
		cardType: { label: "Card Type", placeholder: "Visa/Mastercard/Amex" },
		nameOnCard: { label: "Name on Card", placeholder: "JOHN SMITH" },
	},
	government: {
		ssn: { label: "SSN (last 4 digits)", placeholder: "1234" },
		driverLicense: { label: "Driver's License", placeholder: "DL12345678" },
		passport: { label: "Passport Number", placeholder: "P12345678" },
	},
	preferences: {
		language: { label: "Preferred Language", placeholder: "English" },
		currency: { label: "Preferred Currency", placeholder: "USD" },
		timeZone: { label: "Time Zone", placeholder: "America/New_York" },
	},
};

// Default extension settings
export const DEFAULT_SETTINGS = {
	enabled: false,
	apiKey: "",
	contextData: "",
	structuredData: {},
	selectedModel: "FAST",
	useStructuredData: false,
};

// Notification display duration in ms
export const NOTIFICATION_DURATION = 5000;
