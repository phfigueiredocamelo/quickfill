import React from "react";
import { LogEntry } from "../../types";

interface LogPanelProps {
	logs: LogEntry[];
	onClearLogs: () => void;
	isLoading: boolean;
}

const LogPanel: React.FC<LogPanelProps> = ({
	logs,
	onClearLogs,
	isLoading,
}) => {
	// Format timestamp to readable date/time
	const formatTime = (timestamp: number): string => {
		return new Date(timestamp).toLocaleString();
	};

	// Get icon for log entry based on success/action
	const getStatusIcon = (entry: LogEntry): string => {
		if (!entry.success) return "❌";

		switch (entry.action) {
			case "fill_forms":
				return "✅";
			case "update_settings":
				return "⚙️";
			case "clear_context":
				return "🗑️";
			case "debug_input_data":
				return "🔍";
			case "debug_gpt_process":
				return "🤖";
			default:
				return "📝";
		}
	};

	// Function to convert JSON data to readable text format
	const formatJsonData = (data: any): string => {
		let jsonObject;
		
		// Parse string JSON if needed
		if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
			try {
				jsonObject = JSON.parse(data);
			} catch (e) {
				return data;
			}
		} else {
			jsonObject = data;
		}
		
		// Convert to readable format
		if (!jsonObject) return '';
		
		// Handle array case
		if (Array.isArray(jsonObject)) {
			return jsonObject.map((item, index) => {
				if (typeof item === 'object') {
					return `Item ${index + 1}:\n${formatObjectToReadableText(item)}`;
				}
				return `Item ${index + 1}: ${item}`;
			}).join('\n\n');
		}
		
		// Handle object case
		return formatObjectToReadableText(jsonObject);
	};
	
	// Helper function to format object to readable text
	const formatObjectToReadableText = (obj: any, depth: number = 0): string => {
		if (!obj || typeof obj !== 'object') return String(obj);
		
		const indent = '  '.repeat(depth);
		const entries = Object.entries(obj);
		
		return entries.map(([key, value]) => {
			const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
			
			if (value === null || value === undefined) {
				return `${indent}${formattedKey}: -`;
			}
			
			if (typeof value === 'object') {
				if (Array.isArray(value)) {
					if (value.length === 0) return `${indent}${formattedKey}: Empty list`;
					if (typeof value[0] !== 'object') {
						return `${indent}${formattedKey}: ${value.join(', ')}`;
					}
					return `${indent}${formattedKey}:\n${value.map((item, i) => 
						`${indent}  Item ${i + 1}:\n${formatObjectToReadableText(item, depth + 2)}`
					).join('\n')}`;
				}
				return `${indent}${formattedKey}:\n${formatObjectToReadableText(value, depth + 1)}`;
			}
			
			return `${indent}${formattedKey}: ${value}`;
		}).join('\n');
	};

	return (
		<div className="log-panel">
			<h2>Activity Logs</h2>

			{logs.length === 0 ? (
				<div className="empty-state">
					<p>No activity logs yet.</p>
				</div>
			) : (
				<>
					<div className="log-list">
						{logs.map((log, index) => (
							<div
								key={index}
								className={`log-entry ${log.success ? "success" : "error"}`}
							>
								<div className="log-icon">{getStatusIcon(log)}</div>
								<div className="log-content">
									<div className="log-header">
										<span className="log-time">
											{formatTime(log.timestamp)}
										</span>
										<span className="log-action">
											{log.action.replace("_", " ")}
										</span>
									</div>
									<div className="log-details">{log.details}</div>
									{log.data && log.action === "fill_forms" && (
										<div className="log-data">
											<span>
												Fields: {log.data.filledFields}/{log.data.totalFields}{" "}
												filled
											</span>
											{log.data.url && <span>URL: {log.data.url}</span>}
										</div>
									)}
									{log.data && log.action === "debug_input_data" && (
										<div className="log-data">
											<span>Elements: {log.data.elements?.length || 0}</span>
											{log.data.url && <span>URL: {log.data.url}</span>}
											<details>
												<summary>Ver elementos</summary>
												<pre className="code-block">
													{formatJsonData(log.data.elements)}
												</pre>
											</details>
										</div>
									)}
									{log.data && log.action === "debug_gpt_process" && (
										<div className="log-data">
											<span>Model: {log.data.gptResponse?.mappings?.length || 0} fields mapped</span>
											<details>
												<summary>Ver contexto</summary>
												<pre className="code-block">
													{typeof log.data.contextBuilt === 'string' && log.data.contextBuilt.startsWith('{')
														? formatJsonData(log.data.contextBuilt)
														: log.data.contextBuilt}
												</pre>
											</details>
											<details>
												<summary>Ver resposta do GPT</summary>
												<pre className="code-block">
													{formatJsonData(log.data.gptResponse)}
												</pre>
											</details>
										</div>
									)}
								</div>
							</div>
						))}
					</div>

					<button
						className="danger-button"
						onClick={onClearLogs}
						disabled={isLoading}
					>
						Clear Logs
					</button>
				</>
			)}
		</div>
	);
};

export default LogPanel;