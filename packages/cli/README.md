# @precisa-saude/cli

O CLI cria repositórios e verifica os requisitos da Precisa Saúde. Os arquivos
criados pertencem ao repositório. Configurações compartilhadas são estendidas
por pacotes; o CI chama workflows do tooling por SHA.

## Criar um repositório

Use uma versão publicada e exata do CLI:

```bash
npx @precisa-saude/cli@<versão> new meu-repo --profile oss-library --non-interactive
```

Perfis: `oss-library`, `oss-site` e `private-app`. Revise `.precisa.json`,
crie os pacotes declarados e ajuste os comandos do `package.json` antes do
primeiro CI. Bibliotecas começam com `publishPackages: ["packages/core"]`;
perfis com site começam com `siteFilter: "@<repo>/site"` e
`siteProjectName: "<repo>"`.

Os templates incluem entradas de CI com referências imutáveis e a configuração
do Renovate para propor atualizações. A versão do CLI e o SHA do tooling são
incorporados durante o build da release. Builds locais com mudanças ainda não
publicadas servem para desenvolvimento, não para distribuir novos consumidores.

## Adicionar um arquivo

```bash
precisa scaffold --only .editorconfig SECURITY.md --dry-run
precisa scaffold --only .editorconfig SECURITY.md
```

A seleção inteira é validada antes da escrita. Somente arquivos ausentes são
criados. Conteúdo local, inclusive configuração e documentação, é preservado.
`ignoreTemplates` continua aceito e impede criar os alvos listados, mas não
suprime verificações de requisitos.

`precisa sync` foi descontinuado: imprime a orientação de migração, termina
com código 1 e não escreve arquivos. Não há sincronização integral substituta.

## Verificar requisitos

```bash
precisa doctor
```

A verificação é estrutural, offline e não executa código do repositório. Ela lê
o manifesto e `package.json`, confere o pnpm fixado, a versão do Node, os
arquivos de configuração, os pacotes declarados para publicação e os workflows
YAML. Também procura os comandos obrigatórios nos workflows de PR, seguindo
chamadas locais e reconhecendo a API de `_checks.yml` compartilhado.

São exigidos `lint`, `typecheck`, `format:check` e `test`. Repositórios com
`hasPackages` também precisam de `build`. Use `requiredScripts` para acrescentar
requisitos como `test:coverage`. Essa checagem não mede cobertura nem prova que
um comando foi executado: os jobs de CI continuam responsáveis pela execução,
inclusive por condições dinâmicas e pela validação efetiva de ESLint/TypeScript.

| Código | Resultado                                   |
| ------ | ------------------------------------------- |
| 0      | Requisitos estruturais atendidos            |
| 1      | Requisito pendente ou configuração inválida |
| 2      | `.precisa.json` ausente ou inválido         |

Personalizações de conteúdo não produzem alertas. O workflow de requisitos
roda em PRs e pushes, sem auditoria mensal nem criação de issues.

## Atualizar o tooling

Revise a PR agrupada `precisa-tooling` do Renovate. Ela inclui pacotes de
configuração, CLI e referências aos workflows compartilhados, com automerge
desativado. O CI valida a combinação no próprio repositório. Um rollback
restaura os pins e o lockfile da PR anterior.

Veja o [contrato e a ordem de migração](../../docs/development/versioned-tooling.md).
