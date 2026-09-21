# VIÇO — fases futuras 03

## Escopo entregue

- Apontamento de campo por voz com reconhecimento no navegador, interpretação estruturada, revisão e confirmação humana.
- Relatórios operacionais semanais, técnicos, executivos, de SST e para o proprietário, sempre baseados nos registros persistidos.
- Fluxos administrativos municipais configuráveis por empresa, sem requisitos legais fixos no código.
- Agente da Obra consultando planejamento, bloqueios, RDO, produtividade, documentos, SST, custos, alocações e fluxo municipal.
- Respostas do agente separando fatos, inferências/ressalvas e origem interna.
- Endurecimento do RBAC: vínculo empresarial de cliente não libera acesso às demais obras; cliente depende de associação explícita em `project_members`.
- Posicionamento institucional ampliado: a VIÇO desenvolve sistemas e soluções de engenharia, dados e segurança para construção, SST, saúde e outras operações. O produto implantado permanece identificado como VIÇO Obra.

## Segurança e responsabilidade

- Nenhum relato de voz é gravado diretamente sem tela de revisão.
- O agente não declara liberação técnica, conformidade jurídica ou aprovação automática.
- Fluxos municipais devem ser cadastrados a partir de fonte oficial verificada pelo usuário.
- Relatórios são rascunhos revisáveis antes de impressão, PDF ou compartilhamento.
- As migrations são aditivas e preservam o banco existente.

## Infraestrutura preservada

- Repositório: `luanmagalhaes2464-sys/obra360`.
- Branch de produção: `main`.
- Serviço Render: `obra360-portal`.
- URL: `https://obra360-portal.onrender.com`.
- Nenhum serviço, repositório ou banco adicional foi criado.

## Próximas evoluções recomendadas

- Histórico e aprovação de versões editadas dos relatórios.
- Fontes oficiais anexadas aos modelos municipais e revisão periódica dos fluxos.
- Transação única para confirmação conjunta do relato de voz, RDO, produção e ocorrência.
- Matriz RBAC granular por função operacional, além dos perfis globais atuais.
- Vertical própria de saúde somente após validação de problemas, usuários, dados sensíveis e requisitos regulatórios; o texto institucional não representa um módulo de saúde já disponível.
