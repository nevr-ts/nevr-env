# @nevr-env/cli

Interactive CLI for nevr-env — validate, fix, generate, scan, and manage your environment variables.

## Install

Usually installed automatically via the `nevr-env` umbrella package:

```bash
pnpm add nevr-env zod
npx nevr-env --help
```

Or install standalone:

```bash
pnpm add -g @nevr-env/cli
```

## Commands

| Command | Description |
|---------|-------------|
| `nevr-env init` | Interactive project setup wizard |
| `nevr-env check` | Validate .env against schema |
| `nevr-env fix` | Interactive wizard for missing variables |
| `nevr-env generate` | Generate .env.example from schema |
| `nevr-env types` | Generate TypeScript type definitions |
| `nevr-env scan` | Scan codebase for leaked secrets |
| `nevr-env diff` | Compare schemas between configs |
| `nevr-env rotate` | Track secret rotation status |
| `nevr-env ci <platform>` | Generate CI/CD validation config |
| `nevr-env vault keygen` | Generate encryption key |
| `nevr-env vault push` | Encrypt .env to vault |
| `nevr-env vault pull` | Decrypt vault to .env |
| `nevr-env watch` | Watch .env files and validate on change |
| `nevr-env dev <cmd>` | Run dev server with validation |

## CI / Non-interactive Usage

Commands that produce output work in CI without a TTY:

```bash
# Validate (exits non-zero on failure)
npx nevr-env check

# Generate files without prompts
npx nevr-env types --force
npx nevr-env generate --force

# JSON output for scripting
npx nevr-env scan --format json
npx nevr-env rotate --format json

# Generate CI workflow
npx nevr-env ci github > .github/workflows/validate-env.yml
```
## Ecosystem

| Package | Description |
|---------|-------------|
| [`nevr-env`](https://www.npmjs.com/package/nevr-env) | The umbrella package — includes everything: core, plugins, presets, vault, and CLI |
| [`@nevr-env/core`](https://www.npmjs.com/package/@nevr-env/core) | Core engine — `createEnv`, `createPlugin`, Proxy, Standard Schema validation |

## License

[MIT](LICENSE) — Built with obsession by the nevr-env contributors.
