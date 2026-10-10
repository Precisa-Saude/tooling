# Cobertura no CI do tooling

## Objetivo

Executar o gate existente de UI brand no CI, preservando os testes dos dois
CLIs e os pisos atuais. Este primeiro lote acompanha PRE-499.

## Estado atual

A baseline foi medida em 10/10/2026 no tooling v3.0.0, commit
`7b42c968c2da27c702d05ae1cd282557581a918d`, com Node 22.23.3, pnpm 9.15.9 e
lockfile congelado.

| Área         | Testes aprovados |     Linhas |      Ramos |    Funções | Piso existente      |
| ------------ | ---------------: | ---------: | ---------: | ---------: | ------------------- |
| UI brand     |               11 |     97,72% |     94,54% |     97,56% | 80% em cada métrica |
| CLI          |               37 | Não medida | Não medida | Não medida | Sem gate próprio    |
| worktree-cli |               17 | Não medida | Não medida | Não medida | Sem gate próprio    |

O comando de UI mede os sete arquivos compilados de `src/brand` em
`.brand-check/*.js`. Os outros 53 arquivos de origem de UI ficam fora desse
escopo. O runner nativo do Node não fornece métrica de statements nesse gate.
Os resultados acima não representam cobertura integral de UI nem dos CLIs.

`ci.yml` seleciona `test_script: test:coverage`. Quando o script selecionado
difere de `test`, `_checks.yml` executa primeiro `pnpm test` e depois o script
adicional. O default continua executando `test` uma única vez. Uma falha em
qualquer etapa reprova o job. Assim, os CLIs continuam testados mesmo que ainda
não tenham `test:coverage` próprio.

`.precisa.json` declara `test:coverage` em `requiredScripts`, permitindo que
`precisa doctor` detecte a ausência do comando ou da ligação estrutural ao CI.
Essa checagem não substitui a execução dos testes e dos thresholds.

Para reproduzir as verificações com Node 22:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm test:coverage
node packages/cli/dist/bin.js doctor
```

## Próximos passos

- Medir cobertura dos CLIs com coleta dos subprocessos e escopo de origem
  explícito antes de definir seus gates.
- Ampliar os testes de UI além de brand em lotes por comportamento.
- Tratar descoberta de worktrees, bibliotecas sem serviços e integridade do
  registry em uma PR própria, com testes locais de falha e recuperação.

## Contexto e adoção pelos consumidores

A migração para tooling v3.0.0 e as 20 PRs consumidoras já foram concluídas.
Não há sincronização integral de templates nem novas alterações de consumidores
neste lote. O template de criação continua com `test` como default.

A correção da implementação compartilhada de `_checks.yml` exige uma release
patch do tooling. Consumidores fixados em v3.0.0 continuam usando o workflow
anterior até adotar o SHA publicado em uma PR de dependências. Ao selecionar
`test_script: test:coverage`, cada consumidor deve medir sua baseline e conferir
scripts, exclusões e thresholds. Pisos existentes não podem ser reduzidos.

O tooling desabilita sua política de revisão externa e remove a chamada local
ao revisor para impedir envio de código durante esta PR. Não há alteração no
contrato de autorização pela política do commit base do workflow reutilizável.
