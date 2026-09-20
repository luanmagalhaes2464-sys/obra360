# VIÇO — identidade e central da obra

Esta entrega sucede a estabilização inicial. O usuário autorizou implementação
e publicação no serviço existente. Não representa conclusão de todo o roadmap.

## O que mudou

- Marca VIÇO nativa em React, título, favicon e nova tela de entrada.
- Central da obra com pendências ordenadas por prioridade, itens obrigatórios e
  identificador, filtros Cliente/SST, custos, fotos e histórico reais.
- Minha Obra: prioridades do cliente e navegação reduzida com acesso às áreas
  detalhadas já existentes. Não modifica permissões do backend.
- Percentual rotulado como checklist; prazo e avanço físico não são inventados.
- Reativadas as abas Guia/Checklist, sem script que força clique a cada ciclo.
- Removidos do bundle os scripts concorrentes que reescreviam a marca.
- Todo comando de voz passa por confirmação; não há mais autoaplicação. Uma
  confirmação atrasada não pode clicar no botão de uma obra já desmontada.
- Relatório editável para exportação local, baixar texto e imprimir/salvar PDF
  pelo navegador. A edição local não é persistida no banco nesta entrega.
- Nova obra disponível mesmo quando já existem obras; proteção contra respostas
  atrasadas na troca de obra, erro recuperável de carregamento e labels acessíveis.

## Verificação

20 testes locais: regras de ordenação/cliente/progresso, renderização React com
estados vazios e escaping, cookies/headers e integridade do roteiro. Build Vite,
TypeScript e sintaxe dos gateways passaram. Fixtures apenas em testes locais;
nenhum dado fictício inserido no banco de produção.

O navegador remoto bloqueou a prévia em localhost. A validação visual pública
deve ser feita após deploy. Fluxos autenticados completos e testes reais em
mobile continuam dependentes de acesso apropriado; os testes de renderização
não substituem essa verificação.

## Infraestrutura e banco

O primeiro build no Render omitiu devDependencies por NODE_ENV=production.
TypeScript e tipos React foram movidos para dependencies, junto das ferramentas
Vite já necessárias ao build. O CI agora reproduz instalação com --omit=dev.
Nenhum comando ou variável do serviço precisou ser alterado.

Mesmo GitHub, branch main de produção, Render obra360-portal e PostgreSQL.
Sem mudança de configuração, variáveis, planos, schema ou dados. Nenhum recurso
novo. Deploy via auto-deploy já existente. Rollback pelo commit/deploy anterior.

## Ainda pendente

Motor de dependências/bloqueios, Gantt, RDO estruturado, produtividade, equipes,
capacidade, documentos versionados, SST estruturada e isolamento multiempresa.
A ordenação de pendências não é o motor de prontidão da obra e não libera
execução técnica. Os próximos passos de banco exigem inventário e restauração
verificada antes de migrations. Expiração informada do banco: 14/10/2026.
