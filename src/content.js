import { FormProcessor } from "./utils/formProcessor";
import { collectFormData } from "./utils/formUtils";
import { DOMObserver, addStyles } from "./utils/domObserver";
import { DEFAULT_SETTINGS, INPUT_SELECTORS, ACTIONS } from "./utils/constants";

/**
 * QuickFill Content Script
 *
 * Este script é injetado nas páginas para processar e preencher formulários
 * automaticamente usando GPT e dados de contexto fornecidos pelo usuário.
 */

// Processador de formulários global
let formProcessor = null;

// Observador DOM para detecção de formulários dinâmicos
let domObserver = null;

// Inicializa quando a página carrega
window.addEventListener("load", async () => {
	// Carrega configurações do armazenamento
	chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
		// Inicializa o processador de formulários com as configurações
		formProcessor = new FormProcessor(items);

		// Configura o observador DOM apenas se a extensão estiver habilitada
		if (formProcessor.isEnabled) {
			// Configura o observador DOM para detectar formulários adicionados dinamicamente
			setupDynamicFormObserver();
		}
	});

	// Adiciona estilos CSS necessários
	addStyles();

	// Configura listener para mensagens do popup ou background script
	setupMessageListener();
});

/**
 * Configura o observador de formulários dinâmicos
 */
function setupDynamicFormObserver() {
	if (
		!formProcessor ||
		!formProcessor.isEnabled ||
		!formProcessor.apiKey ||
		!formProcessor.contextData
	) {
		return;
	}

	// Cria o observador DOM com callback para scan de formulários
	domObserver = new DOMObserver(() => {
		// Em vez de escanear imediatamente, vamos verificar se a página mudou significativamente
		// para evitar processamento desnecessário
		// Só escaneia se o DOM tiver mudanças significativas (novos formulários ou inputs)
		console.log(
			"QuickFill: DOM changes detected, ready for form filling when requested",
		);
	});

	// Inicia a observação
	setTimeout(() => {
		domObserver.startObserving();
	}, 1500);
}

/**
 * Configura listener para mensagens
 */
function setupMessageListener() {
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		// Use message action constants instead of string literals
		if (message.action === ACTIONS.FILL_FORMS) {
			// Inicializa array de logs se o logToPopup estiver habilitado
			const logs = message.logToPopup ? [] : null;

			if (logs) {
				logs.push({
					text: "Scanning page for forms and fields...",
					type: "info",
				});
			}

			// Adiciona listener para capturar logs de console se logToPopup estiver habilitado
			let originalConsoleLog = null;
			if (message.logToPopup) {
				originalConsoleLog = console.log;
				console.log = function () {
					// Captura o log original
					originalConsoleLog.apply(console, arguments);

					// Apenas adiciona ao array de logs mensagens relevantes ao preenchimento
					const logText = Array.from(arguments).join(" ");
					if (
						logText.includes("field") ||
						logText.includes("form") ||
						logText.includes("input") ||
						logText.includes("Fill")
					) {
						// Formata o texto do log: limpa espaços extras e adiciona emoji baseado no tipo
						const cleanText = logText.replace(/\s+/g, " ").trim();
						const logType = logText.includes("Success")
							? "success"
							: logText.includes("Error") || logText.includes("failed")
								? "error"
								: logText.includes("Warning")
									? "warning"
									: "info";

						// Adiciona emoji correspondente ao tipo de log
						const emoji =
							logType === "success"
								? "✅ "
								: logType === "error"
									? "❌ "
									: logType === "warning"
										? "⚠️ "
										: "ℹ️ ";

						logs.push({
							text: emoji + cleanText,
							type: logType,
						});
					}
				};
			}

			// Processa todos os formulários na página
			if (formProcessor) {
				Promise.resolve().then(async () => {
					try {
						const result = await formProcessor.processAllForms();

						// Restaura o console.log original se necessário
						if (message.logToPopup && originalConsoleLog) {
							console.log = originalConsoleLog;
						}

						sendResponse({
							success: true,
							logs: logs || [],
							message: "Forms processed successfully",
							forms: result.forms,
							standaloneGroups: result.standaloneGroups,
						});
					} catch (error) {
						console.error("Error processing forms:", error);

						// Restaura o console.log original se necessário
						if (message.logToPopup && originalConsoleLog) {
							console.log = originalConsoleLog;
						}

						sendResponse({
							success: false,
							logs: logs || [],
							error: error.message || "Error processing forms",
						});
					}
				});
			} else {
				sendResponse({
					success: false,
					logs: logs || [],
					error: "Form processor not initialized",
				});
			}

			return true; // Indica resposta assíncrona
		}

		if (message.action === ACTIONS.UPDATE_SETTINGS) {
			if (formProcessor) {
				formProcessor.updateSettings(message.settings);

				// If model selection changed, update the AI model
				if (message.settings.selectedModel) {
					import("./utils/gptProcessor.js").then(({ setModel }) => {
						setModel(message.settings.selectedModel);
						console.log("Updated AI model to:", message.settings.selectedModel);
					});
				}
			} else {
				formProcessor = new FormProcessor(message.settings);
			}
			sendResponse({ success: true });
		} else if (message.action === ACTIONS.GET_FORM_DATA) {
			const formData = collectFormData();
			sendResponse({ formData });
		} else if (message.action === ACTIONS.CLEAR_CACHE) {
			import("./utils/gptProcessor.js").then(({ clearCache }) => {
				clearCache();
				console.log("Cache cleared");
				sendResponse({ success: true });
			});
			return true;
		} else if (message.action === ACTIONS.GET_CACHE_STATS) {
			import("./utils/gptProcessor.js").then(({ getCacheStats }) => {
				const stats = getCacheStats();
				console.log("Cache stats:", stats);
				sendResponse({ success: true, stats });
			});
			return true;
		}
		return true; // Indica resposta assíncrona
	});
}
