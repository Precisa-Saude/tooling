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
```

`setup` cria o worktree, instala dependências e reserva portas. `dev` inicia os
serviços em primeiro plano; `--detach` usa arquivos de log, e `--force` encerra
processos que ocupam as portas reservadas. `teardown` encerra serviços, remove o
worktree e libera as portas. Use `--keep-branch` para preservar a branch local.

Comandos com argumento de branch detectam o worktree atual quando executados
em um worktree vinculado. No checkout principal, informe a branch.

Um script existente pode delegar ao CLI:

```bash
#!/usr/bin/env bash
exec pnpm exec precisa-worktree "$@"
```

## Reserva de portas

O checkout principal usa `mainPort`. Worktrees recebem posições a partir de 1;
a posição N usa `featureBase + (N - 1) * increment`. As posições são recicladas
após `teardown`.

O registro JSON fica no caminho configurado em `portRegistry`. Um lock por
`mkdir` serializa alterações concorrentes em macOS e Linux. Registros em `/tmp`
podem ser removidos pelo sistema entre reinicializações.
