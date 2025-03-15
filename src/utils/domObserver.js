/**
 * DOMObserver
 * 
 * Esta classe é responsável por monitorar mudanças no DOM para detectar 
 * formulários e campos de entrada que são adicionados dinamicamente à página.
 * 
 * Muitas aplicações web modernas carregam formulários de forma dinâmica após o 
 * carregamento inicial da página ou em resposta a interações do usuário. Ao observar
 * estas mudanças no DOM, podemos detectar quando novos formulários ou inputs são
 * adicionados e então processá-los automaticamente.
 * 
 * Funcionalidades:
 * - Utiliza MutationObserver para monitorar adições de nós ao DOM
 * - Detecta formulários completos adicionados à página
 * - Detecta inputs independentes (fora de formulários) adicionados à página
 * - Notifica através de um callback quando novos elementos são detectados
 * - Gerencia seu próprio ciclo de vida (iniciar/parar observação)
 * 
 * Esta classe é parte do sistema que permite que o QuickFill funcione não apenas
 * com formulários presentes no carregamento inicial da página, mas também com
 * formulários carregados dinamicamente através de AJAX, frameworks SPA ou outras
 * técnicas de manipulação dinâmica do DOM.
 */
export class DOMObserver {
  constructor(onNewFormsDetected) {
    this.onNewFormsDetected = onNewFormsDetected;
    this.observer = null;
  }

  /**
   * Inicia a observação de mudanças no DOM
   * 
   * Configura e ativa o MutationObserver para detectar adições de nós ao DOM
   * que possam conter formulários ou campos de entrada.
   */
  startObserving() {
    if (this.observer) {
      return; // Já está observando
    }

    // Cria um observer de mutação para observar novos formulários
    this.observer = new MutationObserver(mutations => {
      let newFormsAdded = false;

      mutations.forEach(mutation => {
        // Verifica se algum nó adicionado contém formulários
        if (mutation.addedNodes && mutation.addedNodes.length) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Verifica se o nó adicionado é um formulário ou contém formulários
              if (
                (node.tagName && node.tagName.toLowerCase() === "form") ||
                node.querySelector("form")
              ) {
                newFormsAdded = true;
                break;
              }

              // Verifica se há inputs independentes
              if (
                node.tagName &&
                (["input", "select", "textarea"].includes(
                  node.tagName.toLowerCase()
                ) ||
                  node.querySelector(
                    "input:not(form *), select:not(form *), textarea:not(form *)"
                  ))
              ) {
                newFormsAdded = true;
                break;
              }
            }
          }
        }
      });

      // Se novos formulários ou inputs foram adicionados, notifica o callback
      if (newFormsAdded && typeof this.onNewFormsDetected === 'function') {
        console.log("QuickFill: Detectados novos formulários ou inputs adicionados à página");
        // Adiciona um pequeno atraso para garantir que os elementos estejam completamente renderizados
        setTimeout(this.onNewFormsDetected, 500);
      }
    });

    // Inicia a observação do documento com os parâmetros configurados
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log("QuickFill: Observador DOM iniciado");
  }

  /**
   * Para a observação de mudanças no DOM
   * 
   * Desconecta o MutationObserver e libera recursos.
   */
  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log("QuickFill: Observador DOM parado");
    }
  }
}

/**
 * Adiciona os estilos CSS necessários para o QuickFill ao documento
 * 
 * Cria e anexa um elemento <style> com os estilos para destacar campos
 * preenchidos e esconder formulários virtuais.
 */
export function addStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .quickfill-filled {
      background-color: #f0f8ff !important; /* Fundo azul claro */
      border: 1px solid #4682b4 !important; /* Borda azul aço */
      transition: background-color 0.3s ease;
    }
    
    .quickfill-virtual-form {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}