# VIÇO — Campo, RDO e produtividade 0.1

## Entrega

- RDO diário salvo inicialmente como rascunho e confirmado por ação humana.
- Apontamentos de produção vinculados à obra, atividade e, opcionalmente, ao RDO.
- Quantidade executada, unidade, horas trabalhadas, trabalhadores, paralisação e motivo.
- Produtividade histórica calculada por hora-homem e consolidada na atividade.
- Ocorrências tipificadas e vinculáveis a atividade/RDO.
- Impactos de ocorrências registrados para revisão, sem alteração automática do cronograma.
- Isolamento por empresa/obra e escrita restrita à equipe.

## Migration

A migration é aditiva e transacional. Foram acrescentadas as estruturas `daily_report_workers` e `occurrences`; os registros de `daily_reports` e `productivity_records` criados na primeira evolução do motor foram conectados às novas rotas. Não há `DROP`, `TRUNCATE` ou exclusão de dados.

## Regras operacionais

- Um RDO confirmado não pode ser sobrescrito silenciosamente.
- Uma atividade ou um RDO informado em um lançamento deve pertencer à mesma obra.
- A unidade usada em novos apontamentos deve permanecer compatível com a unidade da atividade.
- Ocorrências nunca reprogramam atividades automaticamente.
- Registros importantes também geram evento rastreável no histórico da obra.

## Próximas conexões

- Presença nominal e composição de equipes no RDO.
- Planejamento de capacidade por função e período.
- Requisitos de SST e documentos impeditivos por atividade.
- Relatório semanal alimentado pelos registros confirmados.
