# QuickFill V2 Development Notes

## Objetivo
Criar uma nova versão do QuickFill, uma extensão Chrome que preenche formulários HTML automaticamente usando GPT e dados contextuais. A extensão analisa campos de formulário e suas etiquetas para entender seu propósito, depois os combina com dados apropriados do contexto do usuário.

## Observações
- Projeto totalmente reescrito em TypeScript
- Implementação do zero sem depender do código anterior
- Salva o contexto do usuário em múltiplos formatos: PDF, JSON, TXT, XML e CSV
- Usa índices UUID para identificar campos de formulário para preenchimento
- Mantém logs detalhados de preenchimento no popup da extensão
- Preenchimento ocorre apenas através do botão "Fill Forms", nunca automaticamente

## Regras de negócio
1. Implementação completa em TypeScript
2. Preenchimento automático de formulários usando GPT e dados contextuais
3. Suporte a múltiplos formatos para contexto: PDF, JSON, TXT, XML e CSV
4. Indexação de todos os inputs para facilitar o preenchimento (apenas idx é obrigatório)
5. Processamento limpo de dados enviados ao modelo (apenas type, name, id, placeholder, label, formId se disponíveis)
6. Preenchimento de campos usando índices de referência
7. Interface de logs para monitoramento de ações
8. Gerenciamento de API key do GPT
9. Salvamento automático de configurações
10. Funcionalidades para limpar contexto e logs
11. Uso de formId para melhorar a precisão de preenchimento

## Estrutura do Projeto
- `/src/v2/types`: Definições de tipos TypeScript
- `/src/v2/utils`: Utilitários compartilhados
- `/src/v2/background`: Script de fundo da extensão
- `/src/v2/content`: Script de conteúdo que roda nas páginas
- `/src/v2/popup`: Interface do usuário da extensão

## Updates
- 18/03/2025: Iniciada a implementação do zero com estrutura TypeScript, criando a hierarquia básica de arquivos e componentes principais.

## Comandos Úteis
- Desenvolvimento: `npm run dev`
- Build de produção: `npm run build`