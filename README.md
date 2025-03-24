# ScratchForms Development Notes

## Objetivo
Extensão Chrome que preenche formulários HTML automaticamente usando GPT e dados contextuais. A extensão analisa campos de formulário e suas etiquetas para entender seu propósito, depois os combina com dados apropriados do contexto do usuário.

## Observações
- Suporte a formulários em modais e diálogos com técnicas anti-automação. Detecção especial de elementos com aria-hidden e pointer-events: none

## Regras de negócio
* Preenchimento automático de formulários usando GPT e dados contextuais
* Indexação de todos os inputs para facilitar o preenchimento (apenas idx é obrigatório)
* Preenchimento de campos usando índices de referência
* Gerenciamento de API key do GPT
* Salvamento automático de configurações
* Funcionalidades para limpar contexto, password e API key
* Uso de formId para melhorar a precisão de preenchimento
* Captura todos os atributos dos elementos em uma string concatenada para melhor contexto ao GPT
* Identificação e acesso a elementos em modais/diálogos mesmo com restrições como aria-hidden e pointer-events: none

## Estrutura do Projeto
- `/src/v2/types`: Definições de tipos TypeScript
- `/src/v2/utils`: Utilitários compartilhados
- `/src/v2/background`: Script de fundo da extensão
- `/src/v2/content`: Script de conteúdo que roda nas páginas
- `/src/v2/popup`: Interface do usuário da extensão