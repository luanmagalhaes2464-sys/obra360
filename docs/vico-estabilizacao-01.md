# VIÇO — entrega 01: estabilização

Base: `eff3fedd213ab03f96f196a21927649a8516d66f`, repositório
`luanmagalhaes2464-sys/obra360`. Serviço preservado: `obra360-portal`.

## Alterações

- Build passa a executar `tsc` antes do Vite.
- Typecheck segue o grafo de imports de `src/main.tsx` (aplicação ativa).
  Versões antigas não importadas continuam preservadas e não são declaradas
  corrigidas; sua retirada depende de inventário e migração posterior.
- `moduleDetection: force` isola os módulos imperativos como o bundler já faz.
- Tipagem explícita de `WorkKind` no guia elimina indexação insegura.
- Lockfile, comando `check` e CI em Node 22 para testes/tipos/build.
- `.gitignore` protege variáveis locais e exclui dependências/artefatos gerados.
- Parser de cookies compartilhado entre gateways ignora codificações inválidas
  sem lançar URIError; nomes de cookies não alteram o protótipo do objeto.
- Gateway externo aplica `nosniff`, política de referrer e `no-store` na API,
  mantendo Content-Type, Set-Cookie e cache dos assets estáticos.

## Verificação

Executar em `portal/`: `npm ci` e `npm run check`.

13 testes cobrem cookies, headers, resposta HTTP real de teste, integridade de
códigos/etapas/ordenação nos cinco perfis de obra e ausência de mutação no
gerador de roteiro. Esses testes não certificam conteúdo normativo nem
substituem testes autenticados com o PostgreSQL.

Checagem sintática: proxies v4/v5, launchers safe/safe-v2 e server-v3.

## Infraestrutura e dados

Não foram alterados `render.yaml`, comandos do Render, variáveis, banco,
migrations, URL, nomes de serviços ou política de deploy. Não foi criada
infraestrutura. O novo CI não é ainda um gate de deploy: o Render permanece
configurado para publicar commits na `main` independentemente dos checks.

## Pendências antes de publicar

- Validar login real, cliente/equipe, fotos, custos e voz com dados de teste.
- Verificar backup/restauração e continuidade do banco existente.
- Concluir leitura segura do schema e inventário de variáveis.
- Confirmar que a `main` não avançou e revisar o diff da entrega.

A entrega fica numa branch do mesmo repositório até esses checks; não é um
novo aplicativo. Reversão do código: revert do commit desta entrega, sem
migration reversa. Não apagar dados para testar rollback.

## Próxima entrega

Testes de integração seguros para os gateways e core, seguidos de consolidação
gradual do servidor e migrations aditivas de empresa/autorização. Sem afirmar
que isolamento multiempresa, rate limiting ou o Motor da Obra já existem.
