# Templates

Os arquivos deste diretório são usados na criação de repositórios e na adição
explícita de arquivos ausentes. Depois disso, o repositório mantém seu conteúdo.

`templates.manifest.yml` declara `source`, `target`, `required_when` e
`merge_strategy: skip_if_exists`. `executable: true` preserva a permissão de
execução dos scripts criados. Nenhum template ativo sobrescreve arquivos.

Os valores de `.precisa.json` alimentam tokens como `REPO_NAME`, `REPO_SLUG`,
`NODE_VERSION`, `PNPM_VERSION`, `COMMIT_SCOPES`, `SITE_FILTER`,
`SITE_PROJECT_NAME`, `SITE_SOURCE_PATH` e `PUBLISH_PACKAGES_YAML`.
`CLI_VERSION`, `WORKFLOW_REF` e `WORKFLOW_VERSION` vêm do build da release.
Blocos condicionais usam `{{#if TOKEN}}` e `{{/if}}`.

As implementações reutilizáveis estão em `.github/workflows/` no tooling.
Os templates de CI e recuperação de publicação chamam essas implementações
por SHA, com comentário de versão para o Renovate. Triggers, permissões e jobs
específicos ficam nas entradas locais. Documentação de projeto e instruções
locais não precisam acompanhar textualmente os templates.

```bash
precisa scaffold --only .github/PULL_REQUEST_TEMPLATE.md --dry-run
precisa doctor
```

Para atualizar comportamento compartilhado, publique uma release e revise as
PRs de dependências. Consulte [a migração](../docs/development/versioned-tooling.md).
