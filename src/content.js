import { FormProcessor } from "./utils/formProcessor";
import { collectFormData } from "./utils/formUtils";
import { DOMObserver, addStyles } from "./utils/domObserver";
import { DEFAULT_SETTINGS, INPUT_SELECTORS } from "./utils/constants";

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
		// Não executa scanForForms automaticamente, apenas quando solicitado pelo usuário
		console.log("QuickFill: DOM changes detected, ready for form filling when requested");
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
		if (message.action === "fillForms") {
			scanForForms()
				.then(() => sendResponse({ success: true }))
				.catch((error) =>
					sendResponse({ success: false, error: error.message }),
				);
			return true; // Indica resposta assíncrona
		}

		if (message.action === "updateSettings") {
			if (formProcessor) {
				formProcessor.updateSettings(message.settings);
			} else {
				formProcessor = new FormProcessor(message.settings);
			}
			sendResponse({ success: true });
		} else if (message.action === "getFormData") {
			const formData = collectFormData();
			sendResponse({ formData });
		} else if (message.action === "processForm") {
			// Processa um formulário específico com os dados fornecidos
			handleProcessFormRequest(message, sendResponse);
			return true; // Indica resposta assíncrona
		}
		return true; // Indica resposta assíncrona
	});
}

/**
 * Manipula requisição para processar um formulário específico
 *
 * @param {Object} message - Mensagem com dados da requisição
 * @param {Function} sendResponse - Função de callback para resposta
 */
async function handleProcessFormRequest(message, sendResponse) {
	const { formId, formData, useCustomContext } = message;

	try {
		// Importa a função de verificação de visibilidade
		const { isElementVisible, groupInputsByContainer, createVirtualForm } = await import(
			"./utils/formUtils"
		);
		
		// Encontra o formulário pelo ID
		let formElement = null;
		let isVirtual = false;

		if (formId?.startsWith("standalone-group-")) {
			// Este é um grupo de inputs independente
			// Busca apenas inputs independentes visíveis
			const allStandaloneInputs = document.querySelectorAll(
				'input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="hidden"]):not(form *), select:not(form *), textarea:not(form *)',
			);
			
			const visibleStandaloneInputs = Array.from(allStandaloneInputs).filter(
				input => isElementVisible(input)
			);

			if (!visibleStandaloneInputs.length) {
				sendResponse({
					success: false,
					message: "Nenhum input independente visível encontrado",
				});
				return;
			}

			const inputGroups = groupInputsByContainer(visibleStandaloneInputs);
			const groupIndex = Number.parseInt(
				formId.replace("standalone-group-", ""),
			);

			if (inputGroups[groupIndex]) {
				// Cria um formulário virtual para este grupo
				formElement = createVirtualForm(inputGroups[groupIndex].inputs);
				isVirtual = true;
			}
		} else {
			// Formulário regular
			formElement =
				document.getElementById(formId) ||
				document.querySelector(`form[action="${formId}"]`) ||
				document.forms[Number.parseInt(formId)] ||
				null;
				
			// Verifica se o formulário está visível
			if (formElement && !isElementVisible(formElement)) {
				sendResponse({
					success: false,
					message: `Formulário com ID ${formId} não está visível na tela`,
				});
				return;
			}
		}

		if (!formElement) {
			sendResponse({
				success: false,
				message: `Formulário com ID ${formId} não encontrado`,
			});
			return;
		}

		// Processa o formulário com GPT
		// Se estamos usando contexto personalizado, passamos como um parâmetro
		const result = await formProcessor.processForm(
			formElement,
			isVirtual,
			useCustomContext ? formData : null,
		);

		sendResponse({
			success: true,
			filled: result,
			message: result
				? "Formulário processado e preenchido com sucesso"
				: "Formulário processado mas nenhum campo pôde ser preenchido",
		});
	} catch (error) {
		sendResponse({
			success: false,
			message: `Erro ao processar formulário: ${error.message}`,
		});
	}
}

/**
 * Escaneia a página por formulários e tenta preenchê-los
 */
async function scanForForms() {
	if (!formProcessor) {
		console.log("QuickFill: Processador de formulários não inicializado");
		return;
	}

	try {
		// Processa formulários com o processador
		const result = await formProcessor.scanForForms();
		return result;
	} catch (error) {
		console.error("QuickFill: Erro ao preencher formulários:", error);
		const { showNotification } = await import("./utils/notification");
		showNotification(
			`Erro ao preencher formulários: ${error.message}`,
			"error",
		);
		throw error;
	}
}