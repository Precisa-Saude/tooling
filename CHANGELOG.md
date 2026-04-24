## [1.6.1](https://github.com/Precisa-Saude/tooling/compare/v1.6.0...v1.6.1) (2026-04-24)

### ⚠ BREAKING CHANGES

* **release:** unify release+publish with the rest of the ecosystem (#25)

### Bug Fixes

* **cli:** nota sobre higiene de templates no copy-templates ([131eb43](https://github.com/Precisa-Saude/tooling/commit/131eb43519348453923d4bbe737f8bc9f038000f))
* **templates:** usar contexto do repo atual no pr-review-responder ([c1dde13](https://github.com/Precisa-Saude/tooling/commit/c1dde13348f8f1966d1c79c6fba88fc4901484d8))

### CI/CD

* **release:** unify release+publish with the rest of the ecosystem ([#25](https://github.com/Precisa-Saude/tooling/issues/25)) ([55942e3](https://github.com/Precisa-Saude/tooling/commit/55942e3c8fe398aefb4ba7406a4a98a7b163ba21))

## [1.6.0](https://github.com/Precisa-Saude/tooling/compare/v1.5.1...v1.6.0) (2026-04-23)

### ⚠ BREAKING CHANGES

* **ui:** OpenFooter no longer accepts \`socials\` or
\`disclaimer\` props; the \`OpenFooterSocial\` type is removed.

Migration for consumers:

\`\`\`diff
-<OpenFooter
-  brand={{ ... }}
-  disclaimer="Este software é fornecido ..."
-  socials={[
-    { href: 'https://github.com/...', icon: <GitHubSvg />, label: 'GitHub' },
-    { href: 'https://www.npmjs.com/...', icon: <NpmSvg />, label: 'npm' },
-  ]}
-/>
+<OpenFooter
+  brand={{ ... }}
+  githubUrl="https://github.com/Precisa-Saude/<repo>"
+  npmUrl="https://www.npmjs.com/package/@precisa-saude/<pkg>"
+/>
\`\`\`

* refactor(ui): drop stale key prop from SocialLink

The key={href} inside SocialLink was a leftover from the previous
loop-based render; in the current OpenFooter layout SocialLink is used
twice statically, so the key serves no purpose.

### Features

* **ui:** bake social icons and disclaimer into OpenFooter ([#24](https://github.com/Precisa-Saude/tooling/issues/24)) ([e7aef06](https://github.com/Precisa-Saude/tooling/commit/e7aef0651d082841da822cb108ccd77fbb578b64))

## [1.5.1](https://github.com/Precisa-Saude/tooling/compare/v1.5.0...v1.5.1) (2026-04-23)

### Bug Fixes

* **worktree-cli:** forward dev flags to vite and reuse existing branches ([#23](https://github.com/Precisa-Saude/tooling/issues/23)) ([0cab460](https://github.com/Precisa-Saude/tooling/commit/0cab460be1ec5febd1458c4545651993b067b950))

## [1.5.0](https://github.com/Precisa-Saude/tooling/compare/v1.4.0...v1.5.0) (2026-04-23)

### Features

* **agent-instructions:** adicionar protocolo de auditoria de segurança ([#22](https://github.com/Precisa-Saude/tooling/issues/22)) ([dd23ee1](https://github.com/Precisa-Saude/tooling/commit/dd23ee1ad6a25c194795d95b0ed0c515078cbf08))

## [1.4.0](https://github.com/Precisa-Saude/tooling/compare/v1.3.0...v1.4.0) (2026-04-23)

### Features

* **ui:** Header com modos flex/grid e novo OpenFooter para sites OSS ([#20](https://github.com/Precisa-Saude/tooling/issues/20)) ([02fa415](https://github.com/Precisa-Saude/tooling/commit/02fa415fa8c227525950c6bfe9ce2942c9e75b1e))

## [1.3.0](https://github.com/Precisa-Saude/tooling/compare/v1.2.0...v1.3.0) (2026-04-23)

### Features

* **templates:** adicionar .claude/settings.json compartilhado ([7c3cd0b](https://github.com/Precisa-Saude/tooling/commit/7c3cd0be200586a68d6a9a1a7c51f498de5f8ab6))

### Documentation

* **agent-instructions:** add guidance on time estimates ([9ca8450](https://github.com/Precisa-Saude/tooling/commit/9ca84507adf541ea7b1efebe3800994de58ff3dc))

## [1.2.0](https://github.com/Precisa-Saude/tooling/compare/v1.1.2...v1.2.0) (2026-04-22)

### Features

* **eslint:** expandir override de tests pra cobrir benchmarks e test/ dirs ([4b0cf9e](https://github.com/Precisa-Saude/tooling/commit/4b0cf9e4c6bc2ec703a41bcf50675063726460c5))

### Chores

* **eslint:** mover max-lines off pra override compartilhado de testes ([8d91d68](https://github.com/Precisa-Saude/tooling/commit/8d91d68506c7a0a77cc07804a969d4692f8fe23d))

## [1.1.2](https://github.com/Precisa-Saude/tooling/compare/v1.1.1...v1.1.2) (2026-04-22)

### Bug Fixes

* **templates:** concede contents: write no caller para _release.yml ([9783ecf](https://github.com/Precisa-Saude/tooling/commit/9783ecfbc3d3badc0d9556b911e873715215be8e)), closes [#16](https://github.com/Precisa-Saude/tooling/issues/16) [#7](https://github.com/Precisa-Saude/tooling/issues/7)

## [1.1.1](https://github.com/Precisa-Saude/tooling/compare/v1.1.0...v1.1.1) (2026-04-22)

### Bug Fixes

* **ci:** concede models: read no caller para review.yml poder pedir ([4fa67b3](https://github.com/Precisa-Saude/tooling/commit/4fa67b392f7e7e7104ba3d3b529e60f3854f4363))

## [1.1.0](https://github.com/Precisa-Saude/tooling/compare/v1.0.4...v1.1.0) (2026-04-22)

### Features

* consolidação do tooling — novos pacotes, workflows canônicos, configs unificados ([9415943](https://github.com/Precisa-Saude/tooling/commit/9415943aba540c009c612c6bcc44fa365084f480))

## [1.0.4](https://github.com/Precisa-Saude/tooling/compare/v1.0.3...v1.0.4) (2026-04-22)

### Bug Fixes

* **ui:** annotate bare primitive re-exports with typeof ([#13](https://github.com/Precisa-Saude/tooling/issues/13)) ([0bb0d1c](https://github.com/Precisa-Saude/tooling/commit/0bb0d1c818d17106f4f9a2d132ff1b81c55618a8))

## [1.0.3](https://github.com/Precisa-Saude/tooling/compare/v1.0.2...v1.0.3) (2026-04-21)

### Bug Fixes

* **tsconfig:** address consumer-side plugin and tsbuild gotchas ([#12](https://github.com/Precisa-Saude/tooling/issues/12)) ([f3a5b1d](https://github.com/Precisa-Saude/tooling/commit/f3a5b1df548e20a246f990598d749fbca5985e33))

## [1.0.2](https://github.com/Precisa-Saude/tooling/compare/v1.0.1...v1.0.2) (2026-04-21)

### Bug Fixes

* **eslint:** broaden peer range to accept ESLint 10 ([#11](https://github.com/Precisa-Saude/tooling/issues/11)) ([5f0ca2a](https://github.com/Precisa-Saude/tooling/commit/5f0ca2afba4408f8684222329b9ddb559bd5c26a))

## [1.0.1](https://github.com/Precisa-Saude/tooling/compare/v1.0.0...v1.0.1) (2026-04-21)

### Bug Fixes

* **ci:** write resolved NPM_TOKEN to ~/.npmrc for pnpm publish ([#10](https://github.com/Precisa-Saude/tooling/issues/10)) ([6d3f5ab](https://github.com/Precisa-Saude/tooling/commit/6d3f5abc2eb23e1c9748242dacb31522defb4855)), closes [#8](https://github.com/Precisa-Saude/tooling/issues/8)

## 1.0.0 (2026-04-21)

### Features

* **ci:** add Claude code-review workflow + template ([416edf4](https://github.com/Precisa-Saude/tooling/commit/416edf4de9b9537732f940d4cf083ccc2618b50c))
* **ci:** add provider failover to review workflow (Anthropic → OpenAI) ([#3](https://github.com/Precisa-Saude/tooling/issues/3)) ([7e53557](https://github.com/Precisa-Saude/tooling/commit/7e535579f51d100b640aceecdce9c0040cab6003))
* **ci:** show tokens + cost in review attribution; drop verbose fallback message ([#9](https://github.com/Precisa-Saude/tooling/issues/9)) ([d54e31e](https://github.com/Precisa-Saude/tooling/commit/d54e31e1a5114c6dfc53ea2d02c32a042396be09))
* **cli:** implement precisa new / sync / doctor ([#8](https://github.com/Precisa-Saude/tooling/issues/8)) ([e2b7bd6](https://github.com/Precisa-Saude/tooling/commit/e2b7bd6782fcc299f720a4e8fe6c82a325aaa0a5))
* **templates:** add initial template set (dotfiles, husky, governance, github) ([b3b2628](https://github.com/Precisa-Saude/tooling/commit/b3b2628730ca0bc8d5d4d79d0883bc7acbf104a2))
* **themes:** add @precisa-saude/themes package ([#2](https://github.com/Precisa-Saude/tooling/issues/2)) ([e5afd69](https://github.com/Precisa-Saude/tooling/commit/e5afd6979b4b6cae7f584a135220ff334c5ff1e3))
* **ui:** add @precisa-saude/ui v0 — utilities + hooks ([#4](https://github.com/Precisa-Saude/tooling/issues/4)) ([393a3da](https://github.com/Precisa-Saude/tooling/commit/393a3dac6c730422bb70330649ed6414eb4c791e))
* **ui:** add decorative components (CornerSquares, DuotoneFilter, GridOverlay, MosaicBg) ([#5](https://github.com/Precisa-Saude/tooling/issues/5)) ([9c71a20](https://github.com/Precisa-Saude/tooling/commit/9c71a2084474f10d95c187356f82e84968d463b4)), closes [#id](https://github.com/Precisa-Saude/tooling/issues/id)
* **ui:** add primitive components (Button, Badge, Tooltip, Select) ([#6](https://github.com/Precisa-Saude/tooling/issues/6)) ([553ffc3](https://github.com/Precisa-Saude/tooling/commit/553ffc39c85aae583cc3758981772743e702f649))

### Bug Fixes

* **ci:** emit round markers only on successful reviews ([2c92979](https://github.com/Precisa-Saude/tooling/commit/2c92979af84b4b70a95ea12e26ae336ff758c93a))

### CI/CD

* add semantic-release config + publish workflow ([#7](https://github.com/Precisa-Saude/tooling/issues/7)) ([47ea45b](https://github.com/Precisa-Saude/tooling/commit/47ea45b1f9a44a8002281676ec8a750a13f350a6))

### Chores

* **release:** initial scaffold of @precisa-saude/tooling ([56bc2df](https://github.com/Precisa-Saude/tooling/commit/56bc2dfa791768ae95f77b9100578826425f244e))
