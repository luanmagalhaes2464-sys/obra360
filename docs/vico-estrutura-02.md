# VIÇO — Capacidade, SST e documentos 0.1

## Capacidade da obra

- Cadastro de trabalhadores isolado por empresa, com função, empreiteiro e disponibilidade objetiva.
- Premissas de mão de obra por atividade: função necessária e produtividade planejada por pessoa/dia.
- Demanda calculada pela quantidade restante, produtividade e dias úteis do período planejado.
- Comparação de demanda e profissionais disponíveis da mesma função, mostrando déficit, equilíbrio ou sobra.
- Alocações validadas contra empresa, obra, atividade e intervalo de datas.
- Ausência de dados aparece como ausência de dados; o sistema não inventa capacidade.

## SST vinculada

- Catálogo de requisitos por empresa.
- Requisitos vinculados às atividades reais da obra.
- Estados pendente, revisado e não aplicável, com responsável, instante e nota de evidência.
- A interface informa expressamente que revisão no sistema não representa liberação legal automática.

## Documentos versionados

- Documento com tipo, número, status, validade e atividade relacionada.
- Versões imutáveis numeradas, com nome, tipo, tamanho, nota, responsável e checksum SHA-256.
- Inclusão de novas versões sem substituir ou apagar as anteriores.

## Segurança e integridade

- Leituras exigem vínculo com empresa ou obra; escritas exigem perfil de equipe.
- Trabalhadores, equipes, requisitos, atividades, RDOs e documentos são validados no mesmo contexto empresarial.
- Migration aditiva `2026.09.21-governance-01`; nenhum dado ou tabela é removido.
- Alterações relevantes geram eventos rastreáveis da obra.

## Limites conhecidos

- O cálculo atual compara a demanda da atividade com a disponibilidade cadastrada da função; a consolidação semanal entre múltiplas obras será a próxima evolução analítica.
- Arquivos permanecem no PostgreSQL existente para não criar infraestrutura nova. Antes de grande volume, deve-se avaliar armazenamento de objetos com autorização explícita.
- “Revisado” em SST significa conferência registrada no sistema, nunca declaração automática de conformidade legal.
