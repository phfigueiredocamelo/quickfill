import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./popup.css";

const Popup = () => {
	const [enabled, setEnabled] = useState(true);
	const [apiKey, setApiKey] = useState("");
	const [contextData, setContextData] = useState("");
	const [customFields, setCustomFields] = useState({});
	const [activeTab, setActiveTab] = useState("settings");
	const [status, setStatus] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	// Load settings from storage when component mounts
	useEffect(() => {
		chrome.storage.sync.get(
			{
				enabled: true,
				apiKey: "",
				contextData: "",
				customFields: {},
			},
			(items) => {
				setEnabled(items.enabled);
				setApiKey(items.apiKey);
				setContextData(items.contextData);
				setCustomFields(items.customFields);
			},
		);
	}, []);

	// Save settings to storage
	const saveSettings = () => {
		setIsLoading(true);
		setStatus("");

		chrome.storage.sync.set(
			{
				enabled,
				apiKey,
				contextData,
				customFields,
			},
			() => {
				setStatus("Settings saved successfully!");

				// Send message to content script to update settings
				chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
					if (tabs[0]) {
						console.log("Sending message to update settings:", {
							enabled,
							apiKey,
							contextData,
							customFields,
						});
						chrome.tabs.sendMessage(tabs[0].id, {
							action: "updateSettings",
							settings: { enabled, apiKey, contextData, customFields },
						});
					}
				});

				setIsLoading(false);

				// Clear status message after 3 seconds
				setTimeout(() => {
					setStatus("");
				}, 3000);
			},
		);
	};

	// Fill forms on the current page
	const fillForms = () => {
		setIsLoading(true);
		setStatus("");

		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (tabs[0]) {
				chrome.tabs.sendMessage(
					tabs[0].id,
					{ action: "fillForms" },
					(response) => {
						if (chrome.runtime.lastError) {
							setStatus("Error: Could not connect to page.");
						} else if (response && response.success) {
							setStatus("Forms filled successfully!");
						} else {
							setStatus("Error filling forms.");
						}
						setIsLoading(false);

						// Clear status message after 3 seconds
						setTimeout(() => {
							setStatus("");
						}, 3000);
					},
				);
			}
		});
	};

	// Add a new custom field
	const addCustomField = () => {
		setCustomFields({
			...customFields,
			"": "",
		});
	};

	// Update a custom field key or value
	const updateCustomField = (oldKey, newKey, value) => {
		const updatedFields = { ...customFields };
		delete updatedFields[oldKey];
		updatedFields[newKey] = value;
		setCustomFields(updatedFields);
	};

	// Remove a custom field
	const removeCustomField = (key) => {
		const updatedFields = { ...customFields };
		delete updatedFields[key];
		setCustomFields(updatedFields);
	};

	return (
		<div className="popup-container">
			<header className="header">
				<h1>QuickFill</h1>
				<div className="toggle-container">
					<label className="toggle">
						<input
							type="checkbox"
							checked={enabled}
							onChange={() => setEnabled(!enabled)}
						/>
						<span className="toggle-slider"></span>
					</label>
					<span>{enabled ? "Enabled" : "Disabled"}</span>
				</div>
			</header>

			<div className="tabs">
				<button
					className={activeTab === "settings" ? "active" : ""}
					onClick={() => setActiveTab("settings")}
				>
					Settings
				</button>
				<button
					className={activeTab === "context" ? "active" : ""}
					onClick={() => setActiveTab("context")}
				>
					Context Data
				</button>
				<button
					className={activeTab === "fields" ? "active" : ""}
					onClick={() => setActiveTab("fields")}
				>
					Custom Fields
				</button>
			</div>

			<div className="tab-content">
				{activeTab === "settings" && (
					<div className="settings-tab">
						<div className="form-group">
							<label htmlFor="apiKey">OpenAI API Key:</label>
							<input
								type="password"
								id="apiKey"
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
								placeholder="sk-..."
							/>
						</div>
						<div className="info-box">
							<p>
								API Key is stored locally and used only for form filling
								requests.
							</p>
						</div>
					</div>
				)}

				{activeTab === "context" && (
					<div className="context-tab">
						<div className="form-group">
							<label htmlFor="contextData">User Context Data:</label>
							<textarea
								id="contextData"
								value={contextData}
								onChange={(e) => setContextData(e.target.value)}
								placeholder="Add user context information here (e.g., name, email, phone number, address, etc.)"
								rows={8}
							/>
						</div>
						<div className="info-box">
							<p>This information will be used to automatically fill forms.</p>
						</div>
					</div>
				)}

				{activeTab === "fields" && (
					<div className="fields-tab">
						<div className="custom-fields">
							<h3>Custom Field Mappings</h3>
							{Object.entries(customFields).map(([key, value], index) => (
								<div className="custom-field-row" key={index}>
									<input
										type="text"
										value={key}
										onChange={(e) =>
											updateCustomField(key, e.target.value, value)
										}
										placeholder="Field name or label"
									/>
									<input
										type="text"
										value={value}
										onChange={(e) =>
											updateCustomField(key, key, e.target.value)
										}
										placeholder="Value"
									/>
									<button
										className="remove-btn"
										onClick={() => removeCustomField(key)}
									>
										&times;
									</button>
								</div>
							))}
							<button className="add-field-btn" onClick={addCustomField}>
								+ Add Field
							</button>
						</div>
					</div>
				)}

				<div className="actions">
					<button
						className="fill-btn"
						onClick={fillForms}
						disabled={isLoading || !enabled || !apiKey}
					>
						{isLoading ? "Processing..." : "Fill Forms"}
					</button>
					<button
						className="save-btn"
						onClick={saveSettings}
						disabled={isLoading}
					>
						{isLoading ? "Saving..." : "Save Settings"}
					</button>
				</div>

				{status && <div className="status-message">{status}</div>}
			</div>
		</div>
	);
};

// Render the popup
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Popup />);