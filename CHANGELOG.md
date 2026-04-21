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
