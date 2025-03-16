import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./popup.css";
import { PROFILE_SCHEMA, ACTIONS } from "./utils/constants";
import {
	sendMessageToActiveTab,
	updateSettings,
	fillForms,
	clearCache,
	getCacheStats,
} from "./utils/chromeUtils";

// Available AI models
const AI_MODELS = {
	FAST: "Fast (Cheaper & Faster)",
	STANDARD: "Standard (Balanced)",
	ADVANCED: "Advanced (Better Accuracy)",
};

const Popup = () => {
	const [enabled, setEnabled] = useState(false);
	const [apiKey, setApiKey] = useState("");
	const [contextData, setContextData] = useState("");
	const [structuredData, setStructuredData] = useState({});
	const [useStructuredData, setUseStructuredData] = useState(false);
	const [activeTab, setActiveTab] = useState("settings");
	const [activeCategory, setActiveCategory] = useState("personal");
	const [status, setStatus] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [logMessages, setLogMessages] = useState([]);
	const [selectedModel, setSelectedModel] = useState("FAST");
	const [cacheStats, setCacheStats] = useState({
		formStructureSize: 0,
		formFillSize: 0,
	});

	// Load settings from storage when component mounts
	useEffect(() => {
		chrome.storage.sync.get(
			{
				enabled: false,
				apiKey: "",
				contextData: "",
				structuredData: {},
				useStructuredData: false,
				selectedModel: "FAST",
			},
			(items) => {
				setEnabled(items.enabled);
				setApiKey(items.apiKey);
				setContextData(items.contextData);
				setStructuredData(items.structuredData || {});
				setUseStructuredData(items.useStructuredData || false);
				setSelectedModel(items.selectedModel);
			},
		);

		// Get cache stats
		getCacheStats()
			.then((response) => {
				if (response && response.stats) {
					setCacheStats(response.stats);
				}
			})
			.catch(() => {});
	}, []);

	// Update model selection
	const updateModel = (model) => {
		setSelectedModel(model);
		updateSettings({
			selectedModel: model,
			enabled,
			apiKey,
			contextData,
			structuredData,
			useStructuredData,
		});
	};

	// Toggle structured data mode
	const toggleStructuredData = () => {
		const newValue = !useStructuredData;
		setUseStructuredData(newValue);
		updateSettings({
			useStructuredData: newValue,
			enabled,
			apiKey,
			contextData,
			structuredData,
			selectedModel,
		});
	};

	// Update structured data field
	const updateStructuredField = (category, field, value) => {
		const updatedData = {
			...structuredData,
			[category]: {
				...(structuredData[category] || {}),
				[field]: value,
			},
		};

		setStructuredData(updatedData);
		updateSettings({
			structuredData: updatedData,
			enabled,
			apiKey,
			contextData,
			useStructuredData,
			selectedModel,
		});
	};

	// Clear cache
	const handleClearCache = () => {
		clearCache()
			.then((response) => {
				if (response && response.success) {
					setCacheStats({ formStructureSize: 0, formFillSize: 0 });
					setStatus("Cache cleared successfully!");
					setTimeout(() => setStatus(""), 3000);
				}
			})
			.catch((error) => {
				setStatus("Failed to clear cache");
				setTimeout(() => setStatus(""), 3000);
			});
	};

	// Clear log messages
	const clearLogs = () => {
		setLogMessages([]);
	};

	// Fill forms on the current page
	const handleFillForms = () => {
		setIsLoading(true);
		setStatus("");
		setLogMessages([
			{ text: "Starting form filling process...", type: "info" },
		]);

		fillForms(true)
			.then((response) => {
				if (response && response.success) {
					setStatus("Forms filled successfully!");
					if (response.logs && response.logs.length > 0) {
						setLogMessages((prev) => [...prev, ...response.logs]);
					}
					setLogMessages((prev) => [
						...prev,
						{ text: "Forms filled successfully!", type: "success" },
					]);
				} else {
					setStatus("Error filling forms.");
					if (response && response.error) {
						setLogMessages((prev) => [
							...prev,
							{ text: `Error: ${response.error}`, type: "error" },
						]);
					}
				}
			})
			.catch((error) => {
				const errorMessage = error.message || "Could not connect to page";
				console.error("Form filling error:", error);
				setStatus(`Error: ${errorMessage}`);
				setLogMessages((prev) => [
					...prev,
					{ text: `Error: ${errorMessage}`, type: "error" },
					{ 
						text: "⚠️ Make sure you're on a regular webpage (not a chrome:// page or new tab)", 
						type: "warning" 
					},
				]);
			})
			.finally(() => {
				setIsLoading(false);
				// Clear status message after 3 seconds
				setTimeout(() => {
					setStatus("");
				}, 3000);
			});
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
							onChange={() => {
								const newEnabled = !enabled;
								setEnabled(newEnabled);

								// Save the enabled state immediately
								updateSettings({
									enabled: newEnabled,
									apiKey,
									contextData,
									structuredData,
									useStructuredData,
									selectedModel,
								});
							}}
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
					className={activeTab === "advanced" ? "active" : ""}
					onClick={() => setActiveTab("advanced")}
				>
					Advanced
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
								onChange={(e) => {
									const newApiKey = e.target.value;
									setApiKey(newApiKey);

									// Save the API key immediately
									updateSettings({
										enabled,
										apiKey: newApiKey,
										contextData,
										structuredData,
										useStructuredData,
										selectedModel,
									});
								}}
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
						<div className="data-mode-toggle">
							<button
								className={!useStructuredData ? "active" : ""}
								onClick={() => useStructuredData && toggleStructuredData()}
							>
								Free Text
							</button>
							<button
								className={useStructuredData ? "active" : ""}
								onClick={() => !useStructuredData && toggleStructuredData()}
							>
								Structured
							</button>
						</div>

						{!useStructuredData ? (
							<div className="form-group">
								<label htmlFor="contextData">User Context Data:</label>
								<textarea
									id="contextData"
									value={contextData}
									onChange={(e) => {
										const newContextData = e.target.value;
										setContextData(newContextData);

										// Save the context data immediately
										updateSettings({
											enabled,
											apiKey,
											contextData: newContextData,
											structuredData,
											useStructuredData,
											selectedModel,
										});
									}}
									placeholder="Add user context information here (e.g., name, email, phone number, address, etc.)"
									rows={8}
								/>
								<p className="input-info">
									Free text format - enter your information in any format.
								</p>
							</div>
						) : (
							<div className="structured-data">
								<div className="categories">
									{Object.keys(PROFILE_SCHEMA).map((category) => (
										<button
											key={category}
											className={activeCategory === category ? "active" : ""}
											onClick={() => setActiveCategory(category)}
										>
											{category.charAt(0).toUpperCase() + category.slice(1)}
										</button>
									))}
								</div>

								<div className="fields-container">
									{Object.entries(PROFILE_SCHEMA[activeCategory] || {}).map(
										([field, meta]) => (
											<div className="field-row" key={field}>
												<label htmlFor={`field-${field}`}>{meta.label}:</label>
												<input
													id={`field-${field}`}
													type="text"
													value={
														(structuredData[activeCategory] || {})[field] || ""
													}
													onChange={(e) =>
														updateStructuredField(
															activeCategory,
															field,
															e.target.value,
														)
													}
													placeholder={meta.placeholder}
												/>
											</div>
										),
									)}
								</div>
							</div>
						)}

						<div className="info-box">
							<p>
								This information will be used to automatically fill forms.{" "}
								{useStructuredData
									? "Structured data provides better accuracy."
									: "Free text is simpler but may be less accurate."}
							</p>
						</div>
					</div>
				)}

				{activeTab === "advanced" && (
					<div className="advanced-tab">
						<div className="form-group">
							<label htmlFor="modelSelect">AI Model:</label>
							<select
								id="modelSelect"
								value={selectedModel}
								onChange={(e) => updateModel(e.target.value)}
							>
								{Object.entries(AI_MODELS).map(([key, name]) => (
									<option key={key} value={key}>
										{name}
									</option>
								))}
							</select>
							<p className="model-info">
								Select the AI model based on your needs. Faster models are
								cheaper but may be less accurate.
							</p>
						</div>

						<div className="cache-section">
							<h3>Cache Statistics</h3>
							<div className="cache-stats">
								<div className="stat-item">
									<span className="stat-label">Form Structures:</span>
									<span className="stat-value">
										{cacheStats.formStructureSize}
									</span>
								</div>
								<div className="stat-item">
									<span className="stat-label">Form Values:</span>
									<span className="stat-value">{cacheStats.formFillSize}</span>
								</div>
							</div>
							<button
								className="clear-cache-btn"
								onClick={handleClearCache}
								disabled={
									cacheStats.formStructureSize === 0 &&
									cacheStats.formFillSize === 0
								}
							>
								Clear Cache
							</button>
						</div>
					</div>
				)}

				<div className="actions">
					<button
						className="fill-btn"
						onClick={handleFillForms}
						disabled={isLoading || !enabled || !apiKey}
					>
						{isLoading ? "Processing..." : "Fill Forms"}
					</button>
				</div>

				{status && <div className="status-message">{status}</div>}

				{logMessages.length > 0 && (
					<div className="log-container">
						<div className="log-header">
							<h3>Form Filling Log</h3>
							<button className="clear-log-btn" onClick={clearLogs}>
								Clear
							</button>
						</div>
						<div className="log-messages">
							{logMessages.map((log, index) => (
								<div key={index} className={`log-message ${log.type}`}>
									{log.text}
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

// Render the popup
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Popup />);