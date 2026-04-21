# @precisa-saude/prettier-config

Shared Prettier config for Precisa Saúde repositories.

## Install

```bash
pnpm add -D @precisa-saude/prettier-config prettier
```

For the Tailwind variant, also install `prettier-plugin-tailwindcss`:

```bash
pnpm add -D prettier-plugin-tailwindcss
```

## Use

### Default (libraries, Node backends, sites without Tailwind)

```json
{
  "prettier": "@precisa-saude/prettier-config"
}
```

### Tailwind variant (apps using Tailwind CSS)

```json
{
  "prettier": "@precisa-saude/prettier-config/tailwind"
}
```

## Config

| Option          | Value                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| `semi`          | `true`                                                                          |
| `singleQuote`   | `true`                                                                          |
| `printWidth`    | `100`                                                                           |
| `tabWidth`      | `2`                                                                             |
| `trailingComma` | `"all"`                                                                         |
| `plugins`       | `prettier-plugin-packagejson` (+ `prettier-plugin-tailwindcss` for `/tailwind`) |

## License

Apache-2.0
