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
`prune` remove em lote os worktrees e as branches de PRs já mesclados e
arquiva e remove as branches paradas (veja abaixo).

Comandos com argumento de branch detectam o worktree atual quando executados
em um worktree vinculado. No checkout principal, informe a branch.

Um script existente pode delegar ao CLI:

```bash
#!/usr/bin/env bash
exec pnpm exec precisa-worktree "$@"
```

## Limpeza de branches mescladas e paradas

Quando o PR é mesclado no GitHub, fora de uma sessão, o `teardown` não roda e
o worktree e a branch local ficam para trás. O mesmo acontece com branches que
nunca viraram PR e com worktrees abandonados no meio do trabalho. `prune` faz
essa limpeza em lote:

```bash
pnpm exec precisa-worktree prune                   # ensaio: só lista
pnpm exec precisa-worktree prune --yes             # remove
pnpm exec precisa-worktree prune --include-closed  # PR fechado sem merge sai na hora
pnpm exec precisa-worktree prune --remote          # inclui branches remotas
pnpm exec precisa-worktree prune --stale-days 14   # outro prazo de inatividade
```

Sem `--yes` nada muda. A saída tem uma linha por branch local:

```text
would remove fix/exemplo (PR #12 MERGED, tip 4fe632a) and /src/example-fix-exemplo
would remove feat/velha (no PR, idle 40d, tip 1d231f6); archives as archive/2026-11-11/feat/velha
kept         feat/em-andamento (PR #14 OPEN)
kept         feat/outra (PR #11 MERGED, but the local tip is not the PR head; idle 3d, archived and removed after 7d idle)
ignored      park/ideia (no PR, parked under park/)
would free   slot 2 of feat/apagada (worktree gone)
```

O comando funciona em qualquer repositório Git, com ou sem o campo `worktree`
no `package.json`, e pode ser chamado de qualquer worktree: o checkout
principal é a primeira entrada de `git worktree list`. Ele requer o `gh`
autenticado e faz uma consulta `gh pr list --state all --limit 500`,
descartando PRs vindos de fork. Para cada nome de branch vale o PR mais
recente. Se a consulta bater no limite de 500, cada branch que não apareceu
nela é consultada sozinha (`gh pr list --head <branch>`). Quando essa consulta
falha, a branch fica e um aviso sai no stderr.

### Regras

Ficam sempre: `main`, a branch padrão do GitHub, a branch do checkout
principal, as listadas em `prune.protected`, o worktree de onde o comando foi
chamado, worktrees cujo `git status` não pode ser lido e branches com PR
aberto.

Sai na hora, sem arquivamento, a branch cujo PR está `MERGED` (ou `CLOSED`, com
`--include-closed`), cuja ponta local é o `headRefOid` do PR e cujo worktree,
se houver, não tem alterações. Nada se perde, porque a ponta está no GitHub.

Os outros casos esperam `staleDays` dias de inatividade (7 por padrão) e então
são arquivados e removidos:

- PR mesclado, mas a ponta local não é o `headRefOid` (commit depois do merge,
  ou squash merge seguido de mais trabalho);
- PR mesclado ou fechado com alterações não commitadas no worktree;
- PR fechado sem `--include-closed`;
- branch sem PR.

Enquanto o prazo não vence, a linha diz há quantos dias a branch está parada.
Inatividade é o mais recente entre a data do commit da ponta, a última entrada
do reflog da branch (criação, reset, pull) e o `mtime` dos arquivos que
aparecem no `git status` do worktree.

Branch sem PR cujo nome começa com um prefixo de `prune.keepPrefixes`
(`park/` por padrão) fica estacionada e nunca sai. Para guardar trabalho sem
abrir PR, use `park/<nome>`. Com PR, a branch `park/...` segue as regras do PR.

### Arquivo

Antes de remover uma branch parada, `prune --yes` cria a tag anotada
`archive/<AAAA-MM-DD>/<branch>` na ponta. Se o worktree tem alterações, o
`git diff HEAD --binary` vai para
`<archiveDir>/<AAAA-MM-DD>/<branch com / trocado por __>.patch` e os arquivos
não rastreados (fora do `.gitignore`) vão para um `.untracked.tgz` ao lado.
`archiveDir` é `~/.local/share/precisa-worktree/archive/<nome do diretório do
repositório>` por padrão. A linha `removed` mostra a tag e os caminhos.

Só depois do arquivo o worktree sai, com `git worktree remove --force` (o
único caso em que o comando usa `--force`), e a branch é apagada. Se o
arquivamento falhar, por exemplo porque a assinatura da tag falhou com
`tag.gpgSign` ligado, a linha `FAILED` aparece e nada é apagado.

Para recuperar uma branch arquivada:

```bash
git checkout -b feat/velha archive/2026-11-11/feat/velha
git apply ~/.local/share/precisa-worktree/archive/<repo>/2026-11-11/feat__velha.patch
tar -xzf ~/.local/share/precisa-worktree/archive/<repo>/2026-11-11/feat__velha.untracked.tgz
```

As tags ficam só no clone local. Para apagar o arquivo antigo, use
`git tag -d` e remova o diretório da data.

### Remoção

A remoção começa pelo worktree. Se ele não sair, a branch fica e a linha
`FAILED` diz qual passo falhou. Quando o repositório tem configuração de
serviços e a branch está no registro de portas, o comando também encerra os
servidores, libera as portas e apaga os logs, como o `teardown`. Cada remoção
imprime a ponta curta, para recriar a branch com `git branch <nome> <sha>` se
preciso. Com `--yes`, o comando roda `git worktree prune` no começo e no fim e
termina com código diferente de zero se alguma remoção falhou.

O registro de portas também é varrido. Uma entrada cuja branch não tem mais
worktree em `git worktree list` (o diretório foi apagado, por exemplo) aparece
como `would free`, e `--yes` encerra os servidores que ainda escutam naquelas
portas, libera a posição e apaga os logs.

Com `--remote`, as branches em `origin` cujo PR está `MERGED` (ou `CLOSED`,
com `--include-closed`) também são listadas. Se a ponta remota é o
`headRefOid`, `--yes` apaga a branch com `git push origin --delete`. Se não é,
a branch espera o commit da ponta ficar mais velho que `staleDays`; então o
comando busca esse commit, cria a tag `archive/<AAAA-MM-DD>/origin__<branch>`
nele e só depois apaga a branch remota.

### Configuração

Tudo fica em `worktree.prune`. Um repositório sem serviços pode declarar só
isso:

```json
{
  "worktree": {
    "prune": {
      "protected": ["test/fixture-permanente"],
      "staleDays": 7,
      "keepPrefixes": ["park/"],
      "archiveDir": "/caminho/para/arquivo"
    }
  }
}
```

`--stale-days` na linha de comando tem precedência sobre `staleDays`.

## Reserva de portas

O checkout principal usa `mainPort`. Worktrees recebem posições a partir de 1;
a posição N usa `featureBase + (N - 1) * increment`. As posições são recicladas
após `teardown`.

O registro JSON fica no caminho configurado em `portRegistry`. Um lock por
`mkdir` serializa alterações concorrentes em macOS e Linux. Registros em `/tmp`
podem ser removidos pelo sistema entre reinicializações.
