# @precisa-saude/worktree-cli

CLI para criar e manter worktrees Git, instalar dependências e reservar portas
para serviços locais. A configuração pertence ao `package.json` de cada
repositório. Os exemplos abaixo são fictícios.

## Instalação

```bash
pnpm add -D @precisa-saude/worktree-cli
```

## Configuração de um serviço

```json
{
  "worktree": {
    "directoryPrefix": "example",
    "portRegistry": "/tmp/example-worktree-ports.json",
    "services": [
      {
        "name": "site",
        "mainPort": 4000,
        "featureBase": 4010,
        "increment": 10,
        "pnpmFilter": "@example/site",
        "logPrefix": "example-site"
      }
    ]
  }
}
```

## Configuração de vários serviços

```json
{
  "worktree": {
    "directoryPrefix": "example",
    "portRegistry": "/tmp/example-worktree-ports.json",
    "services": [
      {
        "name": "api",
        "mainPort": 4000,
        "featureBase": 4010,
        "increment": 10,
        "pnpmFilter": "@example/api",
        "logPrefix": "example-api",
        "env": { "PORT": "{port}" }
      },
      {
        "name": "web",
        "mainPort": 5000,
        "featureBase": 5010,
        "increment": 10,
        "pnpmFilter": "@example/web",
        "logPrefix": "example-web",
        "env": { "VITE_API_URL": "http://localhost:{api_port}/api" }
      }
    ],
    "writeFiles": [
      { "path": "apps/api/.env.local", "contents": "PORT={api_port}\n" },
      {
        "path": "apps/web/.env.local",
        "contents": "VITE_DEV_PORT={web_port}\nVITE_API_URL=http://localhost:{api_port}/api\n"
      }
    ],
    "buildCommand": "pnpm turbo run build --filter='./packages/**'"
  }
}
```

`buildCommand` executa após `pnpm install`. Use-o quando aplicações dependem dos
artefatos compilados de outros pacotes do workspace.

O campo opcional `inheritEnvFromMain` recebe caminhos relativos de arquivos de
ambiente. Durante `setup`, o CLI acrescenta as chaves ausentes ao arquivo
correspondente do novo worktree. Valores já escritos por `writeFiles` são
preservados. Se usado, mantenha esses arquivos ignorados pelo Git e limite a
herança às configurações necessárias ao desenvolvimento. Credenciais e detalhes
da infraestrutura pertencem aos mecanismos privados do repositório consumidor.

## Comandos

```bash
pnpm exec precisa-worktree setup feat/my-work
pnpm exec precisa-worktree dev --detach
pnpm exec precisa-worktree dev --force
pnpm exec precisa-worktree stop
pnpm exec precisa-worktree logs --service=api
pnpm exec precisa-worktree list
pnpm exec precisa-worktree teardown feat/my-work
pnpm exec precisa-worktree teardown --keep-branch feat/my-work
pnpm exec precisa-worktree prune
```

`setup` cria o worktree, instala dependências e reserva portas. `dev` inicia os
serviços em primeiro plano; `--detach` usa arquivos de log, e `--force` encerra
processos que ocupam as portas reservadas. `teardown` encerra serviços, remove o
worktree e libera as portas. Use `--keep-branch` para preservar a branch local.
`prune` remove em lote os worktrees e as branches de PRs já mesclados (veja
abaixo).

Comandos com argumento de branch detectam o worktree atual quando executados
em um worktree vinculado. No checkout principal, informe a branch.

Um script existente pode delegar ao CLI:

```bash
#!/usr/bin/env bash
exec pnpm exec precisa-worktree "$@"
```

## Limpeza de branches mescladas

Quando o PR é mesclado no GitHub, fora de uma sessão, o `teardown` não roda e
o worktree e a branch local ficam para trás. `prune` faz essa limpeza em lote:

```bash
pnpm exec precisa-worktree prune                   # ensaio: só lista
pnpm exec precisa-worktree prune --yes             # remove
pnpm exec precisa-worktree prune --include-closed  # inclui PR fechado sem merge
pnpm exec precisa-worktree prune --remote          # inclui branches remotas
```

Sem `--yes` nada muda. A saída tem uma linha por branch local:

```text
would remove fix/exemplo (PR #12 MERGED, tip 4fe632a) and /src/example-fix-exemplo
kept         feat/em-andamento (PR #14 OPEN)
kept         feat/outra (PR #11 MERGED, but the local tip is not the PR head)
ignored      spike/local (no PR: review by hand)
```

O comando funciona em qualquer repositório Git, com ou sem o campo `worktree`
no `package.json`, e pode ser chamado de qualquer worktree: o checkout
principal é a primeira entrada de `git worktree list`. Ele requer o `gh`
autenticado e faz uma única consulta `gh pr list --state all --limit 500`,
descartando PRs vindos de fork. Para cada nome de branch vale o PR mais
recente. Se a consulta devolver 500 PRs, um aviso sai no stderr, porque as
branches de PRs mais antigos aparecem como sem PR.

Uma branch local só sai quando todas estas condições valem:

- o PR está `MERGED`, ou `CLOSED` com `--include-closed`;
- a ponta local é o `headRefOid` do PR (um commit feito depois do merge, ou o
  nome reaproveitado para outro trabalho, mantém a branch);
- o worktree dela, se houver, tem `git status --porcelain` vazio. Se o estado
  não puder ser lido, a branch fica.

Nunca saem `main`, a branch padrão do GitHub, a branch do checkout principal,
o worktree de onde o comando foi chamado, branches com PR aberto, branches sem
PR e as listadas em `prune.protected`.

A remoção começa pelo worktree. Se ele não sair, a branch fica e a linha
`FAILED` diz qual passo falhou. Quando o repositório tem configuração de
serviços e a branch está no registro de portas, o comando também encerra os
servidores, libera as portas e apaga os logs, como o `teardown`. O worktree sai
com `git worktree remove` sem `--force`. Cada remoção imprime a ponta curta,
para recriar a branch com `git branch <nome> <sha>` se preciso. Com `--yes`, o
comando roda `git worktree prune` no fim e termina com código diferente de zero
se alguma remoção falhou.

Com `--remote`, as branches em `origin` cujo PR está `MERGED` (ou `CLOSED`,
com `--include-closed`) e cuja ponta remota ainda é o `headRefOid` também são
listadas, e `--yes` as apaga com `git push origin --delete`. Isso cobre o que o
GitHub não apagou no merge.

Para proteger branches, declare `prune.protected` no campo `worktree`. Um
repositório sem serviços pode declarar só isso:

```json
{
  "worktree": {
    "prune": { "protected": ["test/fixture-permanente"] }
  }
}
```

## Reserva de portas

O checkout principal usa `mainPort`. Worktrees recebem posições a partir de 1;
a posição N usa `featureBase + (N - 1) * increment`. As posições são recicladas
após `teardown`.

O registro JSON fica no caminho configurado em `portRegistry`. Um lock por
`mkdir` serializa alterações concorrentes em macOS e Linux. Registros em `/tmp`
podem ser removidos pelo sistema entre reinicializações.
