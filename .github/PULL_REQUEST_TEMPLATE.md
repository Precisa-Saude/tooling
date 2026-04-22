<!--
Obrigado por contribuir. Preencha as seções abaixo para que o revisor
consiga aprovar rápido.
-->

## Resumo

<!-- Uma ou duas frases sobre o que muda e por quê. -->

## Tipo de alteração

- [ ] Correção de bug (`fix`, patch)
- [ ] Nova funcionalidade (`feat`, minor)
- [ ] Breaking change (major — inclua footer `BREAKING CHANGE:` no commit)
- [ ] Docs / templates / CI apenas (sem bump de versão)

## Pacotes afetados

- [ ] `@precisa-saude/eslint-config`
- [ ] `@precisa-saude/prettier-config`
- [ ] `@precisa-saude/tsconfig`
- [ ] `@precisa-saude/commitlint-config`
- [ ] `@precisa-saude/agent-instructions`
- [ ] `@precisa-saude/worktree-cli`
- [ ] `@precisa-saude/themes`
- [ ] `@precisa-saude/ui`
- [ ] `@precisa-saude/cli`
- [ ] `templates/`

## Impacto nos consumidores

<!-- Se isto altera o comportamento de um pacote publicado, descreva como os consumidores existentes são afetados. -->

- [ ] Testado contra pelo menos um repo consumidor (ex.: `pnpm link`)
- [ ] Notas de migração no CHANGELOG do pacote (para breaking changes)
- [ ] Consumidores que precisam rodar `precisa sync` após publicar foram documentados no PR

## Checklist

- [ ] Commits em pt-BR seguindo Conventional Commits
- [ ] `pnpm -r lint typecheck test` passa localmente
- [ ] Sem segredos ou tokens comitados

## Plano de teste

<!-- Como o revisor verifica a mudança. -->

- [ ]
