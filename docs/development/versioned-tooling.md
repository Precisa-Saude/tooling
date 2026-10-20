# Tooling versionado

## Objetivo

Manter convenções compartilhadas com atualizações revisáveis e preservar a
configuração que cada projeto precisa manter. A mudança substitui auditoria de
conteúdo por requisitos estruturais e distribui implementações por versões.

## Contrato

- Pacotes de ESLint, Prettier, TypeScript e commitlint são estendidos localmente.
- Workflows compartilhados são chamados por SHA com comentário da versão.
- `ci.yml`, documentação, hooks e instruções locais pertencem ao consumidor.
- Renovate agrupa as dependências do tooling em uma PR, com automerge desligado.
- `scaffold --only` cria arquivos ausentes; `sync` não escreve mais.
- `doctor` verifica a configuração e os comandos ligados ao CI de PR.

Os inputs de workflows têm defaults compatíveis. Alterações incompatíveis nos
inputs ou nas saídas exigem release maior. `_checks.yml` aceita `node_version`
e `test_script`; `review.yml` aceita `exclude_paths`. Os dois aceitam
`runs_on`, o rótulo do runner em JSON (`'"ubuntu-latest"'` por padrão): os
repositórios privados passam o self-hosted, porque o GitHub não cobra minuto
de runner próprio. Jobs específicos podem
continuar em workflows locais. O caller concede as permissões necessárias e
passa secrets apenas aos jobs que já dependiam deles.

## Estado atual

Implementação em worktrees `refactor/versioned-tooling`. A release prevista é
maior pela descontinuação de `sync`. Os consumidores devem adotar a versão e o
SHA efetivamente publicados, antes de mesclar suas migrações. Nenhuma publicação
é feita pelo script de preparação.

## Próximos passos e ordem de publicação

1. Revisar e publicar o tooling com mensagem de quebra e changelog de migração.
2. Confirmar a versão do CLI no npm e o SHA da tag correspondente no GitHub.
3. Executar `scripts/prepare-consumers.mjs` com a versão publicada e o SHA real.
   O script consulta GitHub e npm, confere a tag e recusa referências inválidas e prepara apenas os workflows de
   requisitos e os pins compartilhados; não faz commit, push ou deploy.
4. Validar os diffs e o CI de cada consumidor. Começar pelo datasus-dbc.
5. Adotar os demais consumidores mantendo suas extensões locais. Na plataforma,
   validar o workflow em dev antes de propor merge, conforme `AGENTS.md`.

A configuração do Renovate mantém as agendas existentes e atualiza os pins por
PR. Atualizações não exigem sincronizar o conjunto inteiro de repositórios.
Para rollback, reverta a PR de atualização com seu lockfile.

## Contexto e consumidores

Os 11 repositórios são tooling, platform, decks, fhir-brasil,
calculadoras-clinicas, medbench-brasil, datasus-dbc, datasus-sdk,
datasus-parquet, datasus-viz e pns.

FHIR mantém validações de catálogo, ValueSet e publicação. MedBench mantém as
exclusões de dados na revisão até adotar o input da release nova. A plataforma
mantém checks de segurança, cobertura, risco e deploy. Datasus-parquet mantém
os jobs próprios de pipeline; o CI de PR passa a executar o script de testes
que já existe no projeto. As entradas locais continuam controlando as flags de
release, inclusive `require_package_changes: false` no datasus-viz.

O novo workflow não cria nem atualiza issues de drift. Issues antigas podem ser
encerradas após a adoção e a passagem do check de requisitos.

Exemplo de preparação após a publicação:

```bash
node scripts/prepare-consumers.mjs --root ../ --version <versão-publicada> --ref <sha-da-tag>
node scripts/prepare-consumers.mjs --root ../ --version <versão-publicada> --ref <sha-da-tag> --write
```

## Verificação local (10/10/2026)

- 27 testes do CLI passaram, incluindo preservação de arquivos, requisitos,
  compatibilidade do manifesto e preparação idempotente dos pins.
- 72 testes do datasus-parquet passaram com o comando adicionado ao CI.
- Lint, formatação e typechecks do tooling passaram. O lint ainda reporta
  27 avisos anteriores de console em worktree-cli.
- Os 11 worktrees passaram no doctor novo, no actionlint dos workflows alterados
  e no git diff --check. Foram inspecionados 67 workflows sem chamadas locais
  para arquivos removidos.
- As 11 configurações de Renovate passaram no schema oficial. O gerenciador
  extraiu a versão do CLI nos dez consumidores.

As verificações usaram o CLI compilado localmente. As PRs consumidoras ainda
precisam da versão publicada e dos checks hospedados. O CI candidato usa
`2.0.0`; o preparador deve conferir a release real antes do merge. Não foram
executados deploys, publicações nem jobs de dados.
