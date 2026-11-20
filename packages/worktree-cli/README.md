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

## Repositório sem servidor de desenvolvimento

Uma biblioteca sem servidor local declara `"services": []`:

```json
{
  "worktree": {
    "directoryPrefix": "example-lib",
    "portRegistry": "/tmp/example-lib-worktree-ports.json",
    "buildCommand": "pnpm turbo run build --filter=./packages/*",
    "services": []
  }
}
```

Nesse caso `setup` cria o worktree, instala as dependências e roda o
`buildCommand`, mas não reserva porta nenhuma: o registro de portas não é lido
nem criado, e `portRegistry` continua obrigatório só para manter um formato
único de configuração. `dev`, `stop` e `logs` avisam que não há servidor para
rodar e saem com código 0. `list` mostra os worktrees de `git worktree list`
com a branch e o caminho, já que não há portas a listar. `teardown` e `prune`
funcionam como em qualquer outro repositório.

Sem o campo `worktree`, `prune` funciona e os outros comandos param com um erro
que pede a configuração.

## Comandos

```bash
pnpm exec precisa-worktree --version
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
O worktree da branch é localizado pelo `git worktree list`, então o `teardown`
também remove worktrees criados com `git worktree add` fora do diretório
`<directoryPrefix>-<branch>`, e limpa o registro de um worktree cujo diretório
já foi apagado. Se o worktree tiver alterações não commitadas, o `teardown`
recusa e não remove nada; faça commit ou descarte as alterações e rode de novo.
`prune` remove em lote os worktrees e as branches de PRs já mesclados e
arquiva e remove as branches paradas (veja abaixo). `--version` imprime a
versão do pacote instalado, lida do `package.json` dele em tempo de execução.

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

Sem `--yes` nada muda. A saída tem uma linha por branch local, e os worktrees
com alterações não commitadas aparecem num bloco à parte, no fim:

```text
would remove fix/exemplo (PR #12 MERGED, tip 4fe632a) and /src/example-fix-exemplo
would remove feat/velha (no PR, idle 40d, tip 1d231f6); archives as archive/2026-11-11/feat/velha
kept         feat/em-andamento (PR #14 OPEN)
would remove fix/atrasada (PR #13 MERGED, local tip behind the PR head, tip 9a4c3f2)
kept         feat/outra (PR #11 MERGED, but the local tip has commits not in the PR head; idle 0d, archived and removed after 1d idle)
ignored      park/ideia (no PR, parked under park/)
ignored      detached /src/example-conferencia (HEAD a3961e3, idle 2d, archived and removed after 7d idle)
would free   slot 2 of feat/apagada (worktree gone)

Worktrees with uncommitted changes, never removed by prune:
kept         feat/slide (PR #15 MERGED, but /src/example-feat-slide has uncommitted changes: commit or discard them, then run prune again)
kept         detached /src/example-bench (HEAD 7c1e2d0, uncommitted changes: commit or discard them, then run prune again)

3 would be removed, 1 slots would be freed, 6 kept (2 with uncommitted changes). Run with --yes to apply.
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

Também fica sempre, com ou sem `--yes`, qualquer worktree com alterações não
commitadas: arquivo rastreado modificado ou arquivo novo fora do `.gitignore`,
a mesma verificação (`git status --porcelain`) que faz o `teardown` recusar.
Vale para o worktree de PR mesclado ou fechado, de branch sem PR parada há
muito tempo e para o worktree em HEAD destacado, por mais tempo que estejam
parados. A branch em checkout nele também fica. Essas linhas saem como `kept`
no bloco do fim, com o caminho, e não contam como falha: o comando termina com
código 0. Para liberar o worktree, faça commit ou descarte as alterações e rode
`prune` de novo.

Sai na hora, sem arquivamento, a branch cujo PR está `MERGED` (ou `CLOSED`, com
`--include-closed`) e cuja ponta local é o `headRefOid` do PR. Nada se perde,
porque a ponta está no GitHub.
Com PR mesclado, vale o mesmo para a ponta local que é ancestral do
`headRefOid` (alguém fez push no PR de outro clone e esta branch não recebeu
o pull): a branch não tem nada que o PR não tenha.

PR mesclado com a ponta local à frente do `headRefOid` (o próximo commit foi
feito em cima da branch já mesclada) espera um dia de inatividade
(`MERGED_GRACE_DAYS`, ou `staleDays` se for menor) e então é arquivado e
removido. O dia existe para não tirar o
worktree de um agente que acabou de commitar a correção seguinte e ainda vai
levá-la para uma branch nova. Quando o commit do `headRefOid` não está no clone
local, não dá para provar que a ponta está atrás, e a branch segue esta regra.

Os outros casos esperam `staleDays` dias de inatividade (7 por padrão) e então
são arquivados e removidos: PR fechado sem `--include-closed` e branch sem PR.

Enquanto o prazo não vence, a linha diz há quantos dias a branch está parada.
Inatividade é o mais recente entre a data do commit da ponta e a última entrada
do reflog da branch (criação, reset, pull).

Branch sem PR cujo nome começa com um prefixo de `prune.keepPrefixes`
(`park/` por padrão) fica estacionada e nunca sai. Para guardar trabalho sem
abrir PR, use `park/<nome>`. Com PR, a branch `park/...` segue as regras do PR.

Worktree em HEAD destacado (`git worktree add --detach`, comum para conferir
um commit ou rodar um benchmark) não tem branch nem PR. Ele aparece como
`detached <caminho>` e é arquivado e removido depois de `staleDays` dias de
inatividade, a não ser que seja o worktree atual ou tenha alterações não
commitadas. Inatividade, aqui, é o mais recente entre a data do commit do HEAD
e o `mtime` dos arquivos `HEAD`, `index` e `logs/HEAD` do worktree no `.git`;
sem esses arquivos, um worktree criado agora num commit antigo pareceria
parado.

### Arquivo

Antes de remover uma branch parada, `prune --yes` cria a tag anotada
`archive/<AAAA-MM-DD>/<branch>` na ponta, e a linha `removed` mostra a tag.
Como worktree com alterações não commitadas nunca sai, a ponta é tudo o que a
branch tem. Para um worktree destacado, a tag é
`archive/<AAAA-MM-DD>/detached/<nome do diretório>` no HEAD, e só o worktree
sai.

Só depois da tag o worktree sai e a branch é apagada. Se o arquivamento falhar,
por exemplo porque a assinatura da tag falhou com `tag.gpgSign` ligado, a linha
`FAILED` aparece e nada é apagado.

Para recuperar uma branch arquivada:

```bash
git checkout -b feat/velha archive/2026-11-11/feat/velha
```

As tags ficam só no clone local. Para apagar o arquivo antigo, use
`git tag -d` e remova o diretório da data.

### Remoção

A remoção começa pelo worktree, com `git worktree remove` sem `--force`: se
alguém alterou o worktree depois da verificação, o git recusa, a branch fica e
a linha `FAILED` diz qual passo falhou. Arquivos ignorados, como
`node_modules`, não impedem a remoção. Quando o repositório tem configuração de
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
com `--include-closed`) também são listadas. `--yes` as apaga pela API do
GitHub (`gh api -X DELETE repos/<dono>/<repo>/git/refs/heads/<branch>`), e não
com `git push origin --delete`, porque o push roda o pre-push do repositório a
cada branch apagada (no platform, instalação, lint, typecheck e testes), sem
enviar código nenhum. Se a ponta remota é o `headRefOid`, a branch é apagada na
hora. Se não é, ela espera o commit da ponta ficar mais velho que `staleDays`;
então o comando busca esse commit, cria a tag
`archive/<AAAA-MM-DD>/origin__<branch>` nele e só depois apaga a branch remota.

### Configuração

Tudo fica em `worktree.prune`. Um repositório sem serviços pode declarar só
isso:

```json
{
  "worktree": {
    "prune": {
      "protected": ["test/fixture-permanente"],
      "staleDays": 7,
      "keepPrefixes": ["park/"]
    }
  }
}
```

`--stale-days` na linha de comando tem precedência sobre `staleDays`. O antigo
`archiveDir` não é mais usado e, se estiver no `package.json`, é ignorado.

## Reserva de portas

O checkout principal usa `mainPort`. Worktrees recebem posições a partir de 1;
a posição N usa `featureBase + (N - 1) * increment`. As posições são recicladas
após `teardown`.

O registro JSON fica no caminho configurado em `portRegistry`. Um lock por
`mkdir` serializa alterações concorrentes em macOS e Linux. Registros em `/tmp`
podem ser removidos pelo sistema entre reinicializações.
