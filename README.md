<div align="center">

# nevr-env

**Stop managing `.env` files. Start managing your application lifecycle.**

[![CI](https://github.com/nevr-ts/nevr-env/actions/workflows/ci.yml/badge.svg)](https://github.com/nevr-ts/nevr-env/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Type-safe environment validation with an interactive CLI, encrypted vault, plugin system, and secret scanning.

[Getting Started](#quick-start) · [CLI Commands](#cli-commands) · [Plugins](#plugins) · [Vault](#vault) · [Documentation](https://nevr-ts.github.io/nevr-env/)

</div>

---

## Ecosystem

| Package | Description |
|---------|-------------|
| [`nevr-env`](https://www.npmjs.com/package/nevr-env) | The umbrella package — includes everything: core, plugins, presets, vault, and CLI |
| [`@nevr-env/core`](https://www.npmjs.com/package/@nevr-env/core) | Core engine — `createEnv`, `createPlugin`, Proxy, Standard Schema validation |
| [`@nevr-env/cli`](https://www.npmjs.com/package/@nevr-env/cli) | Interactive CLI — fix wizard, scanner, vault, schema diff, and 12 more commands |

> **Most users should install `nevr-env`** — it re-exports everything from core and CLI in one package.

---

## Why nevr-env?

| Pain Point | t3-env | **nevr-env** |
|---|---|---|
| **Onboarding** | Crashes with cryptic error log | Interactive wizard guides setup |
| **Boilerplate** | `DATABASE_URL: z.string()` every project | `postgres()` plugin — done |
| **Missing keys** | "Go figure it out" | "Here's the docs link, paste it here" |
| **Monorepo** | Duplicate schema in each app | Shared `packages/env`, Proxy handles context |
| **Docker** | Nothing | Auto-detects running containers |
| **.env.example** | Manual, always outdated | Auto-generated from schema |
| **Team secrets** | Copy-paste in Slack | AES-256-GCM encrypted vault in git |
| **Secret leaks** | Nothing | Built-in scanner for CI/CD |
| **Rotation** | Nothing | Tracks stale secrets by age |

## Quick Start

Note: You can use any Standard Schema library (Zod, Valibot, ArkType, Effect/Schema). Zod is just the most popular.
```bash
pnpm add nevr-env zod
```
```typescript
// src/env.ts
import { createEnv } from "nevr-env";
import { postgres, stripe } from "nevr-env/plugins";
import { z } from "zod";

export const env = createEnv({
  plugins: [
    postgres(),
    stripe({ webhook: true }),
  ],
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    API_SECRET: z.string().min(32),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});
```

```typescript
// Anywhere in your app
import { env } from "./env";

env.DATABASE_URL      // ✅ string (typed, validated)
env.STRIPE_SECRET_KEY // ✅ string (from plugin)
env.MISSING_VAR       // ❌ TypeScript error
```

## Plugins

One import. Full schema, validation, auto-discovery, and CLI integration.

```typescript
import {
  // Direct imports
  postgres, stripe, redis, openai, resend, clerk, aws,

  // Or namespaced
  auth,      // auth.betterAuth(), auth.clerk(), auth.auth0(), auth.nextauth()
  database,  // database.postgres(), database.redis(), database.supabase()
  payment,   // payment.stripe()
  ai,        // ai.openai()
  email,     // email.resend()
  cloud,     // cloud.aws()
} from "nevr-env/plugins";
```

### Conditional schemas

```typescript
// Only include what you need
postgres({ directUrl: true, pool: true })
// → DATABASE_URL + DIRECT_URL + DATABASE_POOL_SIZE

stripe({ webhook: true, connect: true })
// → STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY + STRIPE_WEBHOOK_SECRET + STRIPE_CONNECT_CLIENT_ID

ai.openai({ azure: true })
// → AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY (instead of OPENAI_API_KEY)

auth.betterAuth({ providers: ["google", "github"], twoFactor: true })
// → BETTER_AUTH_SECRET + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GITHUB_CLIENT_ID + ...
```

### Create your own

```typescript
import { createPlugin } from "nevr-env";
import { z } from "zod";

export const sentry = createPlugin({
  id: "sentry",
  name: "Sentry",
  prefix: "SENTRY_",
  base: {
    SENTRY_DSN: z.string().url(),
  },
  when: {
    tunnel: { SENTRY_TUNNEL_URL: z.string().url() },
  },
  cli: () => ({
    docs: "https://docs.sentry.io/product/sentry-basics/dsn-explainer/",
  }),
});

// sentry()                → { SENTRY_DSN }
// sentry({ tunnel: true }) → { SENTRY_DSN, SENTRY_TUNNEL_URL }
```

## CLI Commands

```bash
npx nevr-env init          # Interactive project setup
npx nevr-env check         # Validate env against schema
npx nevr-env fix           # Interactive wizard for missing vars
npx nevr-env generate      # Generate .env.example
npx nevr-env types         # Generate env.d.ts
npx nevr-env dev next dev  # Validate then run dev server
npx nevr-env watch         # Watch .env files, validate on change
npx nevr-env scan          # Scan codebase for leaked secrets
npx nevr-env diff          # Compare schemas between configs
npx nevr-env rotate        # Track secret rotation status
npx nevr-env ci github     # Generate CI/CD config
npx nevr-env vault keygen  # Generate encryption key
npx nevr-env vault push    # Encrypt .env → vault
npx nevr-env vault pull    # Decrypt vault → .env
```

### The Fix Wizard

When variables are missing, nevr-env doesn't just crash — it helps:

```
$ npx nevr-env fix

🧙 nevr-env fix

Found 2 missing variable(s)

📝 DATABASE_URL (PostgreSQL)
   Docs: https://postgresql.org/docs/current/libpq-connect.html

? How would you like to configure DATABASE_URL?
❯ 🟢 Use Docker container (postgres:5432) — Detected!
  ✏️  Enter value manually
  ⏭️  Skip for now

📝 STRIPE_SECRET_KEY (Stripe)
? Enter value for STRIPE_SECRET_KEY:
› sk_test_****

🎉 All variables configured!
```

## Vault

Share `.env` files securely. The vault file is AES-256-GCM encrypted and safe to commit.

```bash
# Generate key (auto-saves to .env, adds .env to .gitignore)
npx nevr-env vault keygen

# Encrypt .env → .nevr-env.vault (NEVR_ENV_KEY auto-excluded)
npx nevr-env vault push
git add .nevr-env.vault && git commit -m "update secrets"

# Teammates: get key securely, then pull
echo "NEVR_ENV_KEY=nevr_..." > .env.local
npx nevr-env vault pull
```

**Security**: AES-256-GCM · PBKDF2 600K iterations · HMAC-SHA256 integrity · timing-safe comparison

## Framework Support

Works with any framework. The `clientPrefix` option enables client-side variable validation:

```typescript
// Next.js
createEnv({ clientPrefix: "NEXT_PUBLIC_", ... })

// Vite
createEnv({ clientPrefix: "VITE_", ... })

// Astro
createEnv({ clientPrefix: "PUBLIC_", ... })

// SvelteKit
createEnv({ clientPrefix: "PUBLIC_", ... })

// Remix / Express / Hono — no prefix needed
createEnv({ server: { ... }, runtimeEnv: process.env })
```

## Monorepo Support

Define once, share everywhere:

```typescript
// packages/env/src/index.ts
export const env = createEnv({
  plugins: [postgres(), stripe({ webhook: true })],
  server: { NODE_ENV: z.enum(["development", "production", "test"]) },
  clientPrefix: "NEXT_PUBLIC_",
  client: { NEXT_PUBLIC_API_URL: z.string().url() },
  runtimeEnv: process.env,
});

// apps/web/src/config.ts
import { env } from "@myorg/env";
env.DATABASE_URL // ✅ fully typed
```

## Comparison

| Feature | nevr-env | t3-env | envalid | znv |
|---------|----------|--------|---------|-----|
| Type-safe validation | ✅ | ✅ | ✅ | ✅ |
| Plugin system | ✅ 13 plugins | ❌ | ❌ | ❌ |
| Interactive CLI wizard | ✅ 12 commands | ❌ | ❌ | ❌ |
| Encrypted vault | ✅ AES-256-GCM | ❌ | ❌ | ❌ |
| Secret scanning | ✅ | ❌ | ❌ | ❌ |
| Auto-discovery (Docker) | ✅ | ❌ | ❌ | ❌ |
| .env.example generation | ✅ | ❌ | ❌ | ❌ |
| Type generation (env.d.ts) | ✅ | ❌ | ❌ | ❌ |
| Rotation tracking | ✅ | ❌ | ❌ | ❌ |
| CI/CD config generation | ✅ 5 platforms | ❌ | ❌ | ❌ |
| Standard Schema support | ✅ | ✅ | ❌ | ❌ |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, guidelines, and how to create plugins.

## License

[MIT](LICENSE) — Built with obsession by the nevr-env contributors.