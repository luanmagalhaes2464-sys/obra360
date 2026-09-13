# Obra360 — protótipo de site + calculadora inteligente

Protótipo front-end de uma empresa de **gestão e acompanhamento de obras**, integrando Engenharia Civil, Arquitetura, Engenharia de Produção, Segurança do Trabalho e tecnologia.

## O que já funciona

- Landing page responsiva e moderna
- Diagnóstico gratuito de viabilidade
- Município, lote, tipo de obra, área, pavimentos, padrão, terreno e extras
- Faixa preliminar de custo
- Prazo provável
- Equipe-base sugerida
- Reserva recomendada
- Distribuição estimada por etapa
- Checklist inicial de documentação
- Linha do tempo da obra
- Pontos de atenção
- CTA para WhatsApp
- Mockup da futura área privada do cliente

## Base técnica usada neste protótipo

**CUB/MG — Agosto/2026 (Sinduscon-MG)**
- R1 baixo: R$ 2.562,62/m²
- R1 normal: R$ 3.102,16/m²
- R1 alto: R$ 3.852,38/m²
- R8 baixo: R$ 2.285,68/m²
- R8 normal: R$ 2.554,58/m²
- R8 alto: R$ 3.120,21/m²

Fonte: Sinduscon-MG, tabela CUB Agosto/2026.

O próprio CUB informa que diversos custos **não estão incluídos** em seus valores básicos, como fundações, projetos, taxas, elevadores, obras complementares e remuneração do construtor/incorporador. Por isso o protótipo não usa CUB x m² como “preço final”: ele aplica fatores preliminares de complexidade e devolve uma **faixa**, não um orçamento.

**SINAPI**
Referência nacional de custos e composições mantida por CAIXA/IBGE. Nesta primeira versão ele aparece como referência metodológica; a etapa seguinte é automatizar a atualização das composições.

**NR-18 / SCPO**
A área de documentação inclui alertas orientativos relacionados à segurança. A NR-18 exige PGR nos canteiros abrangidos e a Comunicação Prévia de Obras deve ser realizada antes do início das atividades nos casos aplicáveis.

## Importante

Este sistema é um **diagnóstico paramétrico preliminar**. Não substitui:
- orçamento executivo;
- projeto;
- sondagem;
- análise do terreno;
- aprovação municipal;
- ART/RRT;
- PGR;
- avaliação por profissional legalmente habilitado.

## Próximos passos de produto

1. Backend e banco de dados
2. Login do cliente
3. Cadastro de obras
4. Orçamento previsto x realizado
5. Cronograma físico-financeiro
6. Documentos e vencimentos
7. Fotos e diário de obra
8. Checklists por etapa
9. Segurança do trabalho
10. IA para gerar relatórios semanais e responder perguntas com base nos dados reais da obra
11. Painel interno da equipe técnica
12. Atualização automática CUB/SINAPI
13. Captação de leads
14. Assinatura eletrônica / proposta comercial

## Publicação

O protótipo é estático e pode ser publicado facilmente em GitHub Pages, Netlify, Vercel ou Render.

Antes de publicar:
- trocar nome/marca;
- trocar número do WhatsApp no `app.js`;
- inserir profissionais/CREA/CAU quando aplicável;
- revisar textos jurídicos;
- definir política de privacidade/LGPD.
