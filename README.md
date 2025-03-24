# ScratchForms Development Notes

## Objetivo
Extensão Chrome que preenche formulários HTML automaticamente usando GPT e dados contextuais. A extensão analisa campos de formulário e suas etiquetas para entender seu propósito, depois os combina com dados apropriados do contexto do usuário.

## Observações
- Projeto totalmente reescrito em TypeScript
- Salva o contexto do usuário em múltiplos formatos: JSON, TXT, XML e CSV
- Usa índices UUID para identificar campos de formulário para preenchimento
- Mantém logs detalhados de preenchimento no popup da extensão
- Melhoria na detecção de campos dentro de formulários
- Captura todos os atributos relevantes de campos incluindo labels e formId
- Suporte a formulários em modais e diálogos com técnicas anti-automação
- Detecção especial de elementos com aria-hidden e pointer-events: none

## Regras de negócio
1. Implementação completa em TypeScript
2. Preenchimento automático de formulários usando GPT e dados contextuais
3. Suporte a múltiplos formatos para contexto: JSON, TXT, XML e CSV
4. Indexação de todos os inputs para facilitar o preenchimento (apenas idx é obrigatório)
5. Processamento limpo de dados enviados ao modelo (apenas type, name, id, placeholder, label, formId se disponíveis)
6. Preenchimento de campos usando índices de referência
7. Interface de logs para monitoramento de ações
8. Gerenciamento de API key do GPT
9. Salvamento automático de configurações
10. Funcionalidades para limpar contexto e logs
11. Uso de formId para melhorar a precisão de preenchimento
12. Captura todos os atributos dos elementos em uma string concatenada para melhor contexto ao GPT
13. Identificação e acesso a elementos em modais/diálogos mesmo com restrições como aria-hidden e pointer-events: none

## Estrutura do Projeto
- `/src/v2/types`: Definições de tipos TypeScript
- `/src/v2/utils`: Utilitários compartilhados
- `/src/v2/background`: Script de fundo da extensão
- `/src/v2/content`: Script de conteúdo que roda nas páginas
- `/src/v2/popup`: Interface do usuário da extensão

## Updates
- 18/03/2025: Iniciada a implementação do zero com estrutura TypeScript, criando a hierarquia básica de arquivos e componentes principais.
- 18/03/2025: Melhorada a função indexAllInputs para detectar campos dentro de forms e extrair todos os atributos em uma string concatenada para melhor contexto ao GPT. Também foi adicionada a detecção e inclusão do formId para melhorar a precisão de preenchimento.
- 18/03/2025: Corrigido problema no LogPanel que impedia a exibição dos logs. Resolvido o erro nas funções handleGetLogs e handleClearLogs no background script, que estavam usando a chave literal "logs" ao invés da constante STORAGE_KEYS.LOGS definida na aplicação.
- 18/03/2025: Refatorado o código de gerenciamento de logs no background script para usar as funções utilitárias importadas de storageUtils em vez de acessar diretamente o chrome.storage. Isso melhora a consistência e manutenibilidade do código.
- 18/03/2025: Adicionados logs de depuração para acompanhar todo o fluxo de preenchimento de formulários. Agora registra detalhes dos inputs detectados, contexto completo enviado para o GPT e resposta completa do modelo, facilitando o diagnóstico de problemas no mapeamento de campos.
- 18/03/2025: Aprimorado o LogPanel para exibir corretamente os logs de debug_input_data e debug_gpt_process, permitindo uma visão mais detalhada do processo de coleta de campos e da resposta do GPT na interface do usuário.
- 18/03/2025: Adicionadas visualizações detalhadas para debug no LogPanel, com opções expansíveis para mostrar o conteúdo completo dos elementos detectados, contexto enviado ao GPT e resposta recebida, facilitando a depuração e análise do processo de preenchimento.
- 18/03/2025 15:35: Melhorada a exibição de logs JSON no LogPanel, convertendo estruturas JSON em texto legível com chaves e valores formatados para facilitar a leitura e análise dos dados. Adicionada função formatJsonData que transforma objetos JSON em texto humanamente legível, melhorando significativamente a visualização de contextos, elementos e respostas do GPT.
- 18/03/2025 17:20: Removido o suporte ao formato PDF para simplificar o sistema e reduzir complexidade. Contextos agora são suportados apenas nos formatos JSON, TXT, XML e CSV.
- 18/03/2025 18:45: Corrigido problema com formulários em modais que não estavam sendo preenchidos devido a atributos aria-hidden e pointer-events. Implementada detecção especial de elementos em diálogos e solução para tratar elementos em contêineres com pointer-events: none.
- 19/03/2025 08:03: Limita host permissions no manifest.json para apenas o dominio do OpenIA.
- 19/03/2025 08:44: Refina o prompt para melhorar o fit nos campos e só considerar campos textuais.
- 19/03/2025 11:43: Remove scripting permissions do manifest.json, pois não são mais necessárias.
- 19/03/2025 13:25: Implementa criptografia para o contexto do usuário usando crypto-js. Todo contexto agora é criptografado com AES e requer uma senha para acesso. Adiciona sistema de password prompt ao preencher formulários e ao acessar o painel de contexto, garantindo segurança dos dados pessoais. A senha é armazenada como hash SHA-256 para comparação segura.
- 19/03/2025 16:20: Corrigido problema no painel de contexto onde o texto não aparecia após inserir a senha correta. Implementada decriptação e exibição do conteúdo ao desbloquear o contexto, e atualização automática do texto ao trocar o formato de dados. Também melhorada a interface removendo rótulo confuso "Context Data (Encrypted)" para simplesmente "Context Data".
- 19/03/2025 13:20: Corrigido bug em que não fechava o prompt de senha pelo botão cancelar.
- 19/03/2025 19:40: Resolvido problema "document is not defined" no background script ajustando a configuração do webpack para usar 'webworker' como target para o background script. Configurada a compilação para evitar divisão de chunks no service worker, garantindo que todas as dependências sejam empacotadas em um único arquivo, evitando erros de importScripts.
- 23/03/2025 13:01: Adicionado biome
- 23/03/2025 21:18: Corrige modal de novo password para aparecer campo confirmar senha.
- 23/03/2025 21:27: Corrige bug que não dava para digitar no campo de contexto.
- 23/03/2025 22:06: Remove contextUtils que não estava sendo usado.
- 23/03/2025 22:13: Melhora o prompt para o GPT adicionando novos gidelines para deixar a experiência mais dinâminca.
- 23/03/2025 22:30: Aprimorado o botão "Clear All Context Data" para também limpar a API key quando acionado.