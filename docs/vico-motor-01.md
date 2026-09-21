# VIÇO — Motor da Obra 01

Primeira entrega estrutural do Motor da Obra, construída sobre o projeto e o
banco existentes. O checklist `os_tasks` foi evoluído para atividade
operacional; não foi criada uma tabela concorrente de atividades.

## Problema resolvido

O sistema ordenava pendências, mas não sabia se uma atividade estava pronta,
aguardando predecessora ou formalmente bloqueada. Também não havia estrutura
para datas, WBS, quantidades, produtividade, equipes, SST ou documentos
versionados.

## Entrega funcional

- Planejamento com visões Gantt, lista e bloqueios.
- WBS, início/fim planejados, duração, percentual informado, quantidade,
  unidade e custo planejado nas atividades existentes.
- Dependências FS, SS, FF e SF com defasagem e prevenção de ciclos.
- Bloqueios tipados, registro de motivo e resolução humana.
- Próxima ação calculada apenas entre atividades pendentes sem predecessoras
  abertas e sem bloqueios ativos.
- Eventos de auditoria para alterações de planejamento, dependências e
  bloqueios.
- Isolamento inicial por empresa em novos acessos e correção das rotas legadas
  mais sensíveis para respeitar empresa ou vínculo na obra.

## Migration

Migration `2026.09.21-motor-01`, transacional, idempotente e aditiva.

- Cria `companies`, `company_users`, `activity_dependencies`, `blockers`,
  `workers`, `teams`, `team_members`, `allocations`, `daily_reports`,
  `productivity_records`, `safety_requirements`,
  `activity_safety_requirements`, `documents` e `document_versions`.
- Acrescenta campos operacionais em `os_tasks` e `company_id` em `projects`.
- Vincula registros existentes à empresa VIÇO para preservar o acesso atual.
- Não executa `DROP`, `TRUNCATE` ou exclusão de dados na migration.
- O recálculo do roteiro preserva atividades antigas que já tenham
  planejamento, dependências, bloqueios, produtividade, SST ou documentos,
  marcando-as como não aplicáveis em vez de apagá-las.

## Limites desta entrega

- O Gantt mostra o planejamento cadastrado; ainda não calcula caminho crítico
  nem replano automático.
- Datas, avanço e resolução de bloqueios dependem de confirmação humana.
- As tabelas das próximas fases estão preparadas, mas RDO, produtividade,
  capacidade, SST estruturada e documentos versionados ainda receberão APIs e
  interfaces próprias antes de serem considerados funcionais.
- A leitura SQL pelo conector Render retornou `INVALID_ARGUMENT`; por isso a
  validação foi feita por schema versionado, testes de regras, TypeScript e
  build. A aplicação executa a migration em transação durante o deploy.

## Rollback

Reverter o commit remove as novas rotas e a interface. As tabelas e colunas
aditivas permanecem no PostgreSQL para preservar dados; não devem ser removidas
automaticamente. Nenhuma configuração, variável, serviço, URL ou banco foi
renomeado.
