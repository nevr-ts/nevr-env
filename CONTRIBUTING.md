# Contributing to nevr-env

Thank you for considering contributing to nevr-env! Every contribution helps make environment management better for everyone.

## Philosophy

nevr-env is built on 3 principles:

1. **Lifecycle, not validation** — We manage the entire secret lifecycle: discovery, validation, syncing, rotation, and auditing
2. **DX over configuration** — The CLI should guide developers, not gate them
3. **Plugin-first** — Common services (Postgres, Stripe, etc.) ship as first-class plugins with auto-discovery

## Project Structure

```
nevr-env/
├── packages/
│   ├── core/          # createEnv(), type system, Standard Schema, plugin helpers
│   ├── cli/           # All CLI commands (check, fix, vault, scan, etc.)
│   └── nevr-env/      # Umbrella package — re-exports core + plugins + CLI
│       ├── plugins/   # Official plugins (postgres, stripe, redis, openai, etc.)
│       ├── presets/   # Framework presets (vercel, netlify)
│       └── vault/     # Vault crypto operations
├── docs/              # VitePress documentation
├── examples/          # Example projects and test fixtures
└── turbo.json         # Turborepo build config
```

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 9

### Setup

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/nevr-env.git
cd nevr-env

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Run tests
pnpm test

# 5. Type check
pnpm typecheck
```

### Development Workflow

```bash
# Watch mode (rebuilds on change)
pnpm dev

# Run tests for a specific package
pnpm -F @nevr-env/core test
pnpm -F @nevr-env/cli test

# Format code
pnpm format
```

## Contributing Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b type/description
   ```

   Branch prefixes:
   | Prefix | Purpose |
   |--------|---------|
   | `feat/` | New features |
   | `fix/` | Bug fixes |
   | `docs/` | Documentation |
   | `refactor/` | Code restructuring |
   | `test/` | Tests |
   | `chore/` | Maintenance |

2. **Make changes** — keep PRs focused and small

3. **Test thoroughly**:
   ```bash
   pnpm test        # All tests
   pnpm typecheck   # Type safety
   pnpm build       # Ensure build passes
   ```

4. **Commit** with [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add redis sentinel support to redis plugin"
   git commit -m "fix: vault pull preserves NEVR_ENV_KEY"
   git commit -m "docs: update vault security section"
   ```

5. **Open a PR** against `main`

## Where to Contribute

### Good First Issues

- Add missing CLI flag documentation
- Improve error messages in validation
- Add examples for new frameworks

### Plugin Development

Creating a new plugin is the easiest way to contribute:

```typescript
// packages/nevr-env/src/plugins/monitoring/providers/sentry.ts
import { createPlugin } from "@nevr-env/core";
import { z } from "zod";

export const sentry = createPlugin({
  id: "sentry",
  name: "Sentry",
  prefix: "SENTRY_",
  base: {
    SENTRY_DSN: z.string().url(),
  },
  when: {
    tunnel: {
      SENTRY_TUNNEL_URL: z.string().url(),
    },
  },
  cli: () => ({
    docs: "https://docs.sentry.io/product/sentry-basics/dsn-explainer/",
    prompts: {
      SENTRY_DSN: {
        message: "Enter your Sentry DSN",
        type: "text",
        placeholder: "https://xxx@xxx.ingest.sentry.io/xxx",
      },
    },
  }),
});
```

## Code Quality

- All code must be TypeScript with strict mode
- Use meaningful names — avoid abbreviations
- Functions should do one thing
- Handle errors explicitly — no silent failures
- Write tests for new features and bug fixes
- Keep the plugin API consistent across all providers

## Testing

```bash
# Run all tests
pnpm test

# Core unit tests (125 tests)
pnpm -F @nevr-env/core test

# CLI integration tests (13 tests)
pnpm -F @nevr-env/cli test

# Plugin tests
pnpm -F nevr-env test
```

## Documentation

Docs live in `/docs` and use [VitePress](https://vitepress.dev/).

```bash
# Run docs locally
cd docs && npm run docs:dev
```

When adding features, update:
1. The relevant guide in `docs/guide/`
2. API reference in `docs/api/`
3. Plugin docs in `docs/plugins/` (if applicable)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
