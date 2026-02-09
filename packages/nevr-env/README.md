<p align="center">
  <img src="https://img.shields.io/npm/v/nevr-env?style=flat-square&color=blue" alt="npm version" />
  <img src="https://img.shields.io/npm/dm/nevr-env?style=flat-square&color=green" alt="npm downloads" />
  <img src="https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License" />
</p>

<h1 align="center">nevr-env</h1>

<p align="center">
  <strong>Type-safe environment variables with plugins, encrypted vault, and an interactive CLI.</strong>
  <br />
  <em>Stop copy-pasting <code>.env</code> files. Start shipping with confidence.</em>
</p>

---

## The Problem

Every project starts the same way:

```
ERROR: Missing required environment variable DATABASE_URL
```

Then you spend 20 minutes hunting for the right value, copy-pasting from Slack, and hoping nobody committed secrets to git. **nevr-env fixes all of that.**

## The Solution

```typescript
// src/env.ts — this is your entire env setup
import { createEnv } from "nevr-env";
import { postgres } from "nevr-env/plugins/postgres";
import { stripe } from "nevr-env/plugins/stripe";
import { z } from "zod";

export const env = createEnv({
  plugins: [
    postgres({ pool: true }),       // DATABASE_URL, POOL_SIZE — auto-typed
    stripe({ webhook: true }),      // STRIPE_SECRET_KEY, WEBHOOK_SECRET — auto-typed
  ],
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]),
    API_SECRET: z.string().min(32),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});
```

**That's it.** Full TypeScript inference. Runtime validation. No boilerplate.

```typescript
env.DATABASE_URL    // string — from postgres() plugin
env.STRIPE_SECRET_KEY  // string — from stripe() plugin
env.API_SECRET      // string — from your server schema
env.NEXT_PUBLIC_APP_URL  // string — safe for client bundles
env.SECRET_THING    // TypeScript error — doesn't exist
```

---

## Install

```bash
npm install nevr-env zod
# or
pnpm add nevr-env zod
# or
yarn add nevr-env zod
```

> **Note:** `zod` is optional — nevr-env supports any [Standard Schema](https://github.com/standard-schema/standard-schema) library (Zod, Valibot, ArkType).

---

## Features at a Glance

### Plugins — One Line, Full Type Safety

built-in plugins that handle schema, validation, auto-discovery, and CLI integration:

```typescript
postgres()                          // DATABASE_URL
postgres({ pool: true })            // DATABASE_URL + DATABASE_POOL_SIZE + DATABASE_POOL_TIMEOUT
stripe({ webhook: true })           // STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY + STRIPE_WEBHOOK_SECRET
openai({ azure: true })             // AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY (either pattern)
aws({ s3: true, ses: true })        // AWS_ACCESS_KEY_ID + S3_BUCKET + SES_FROM_EMAIL + ...
betterAuth({ providers: ["google", "github"] })  // BETTER_AUTH_SECRET + GOOGLE_CLIENT_ID + ...
```

### CLI — Interactive, Not Just Errors

```bash
npx nevr-env init          # Setup wizard — detects framework, picks plugins
npx nevr-env check         # Validate .env against schema (CI-friendly, exit code 0/1)
npx nevr-env fix           # Missing vars? Interactive wizard with auto-discovery
npx nevr-env generate      # Generate .env.example from your schema
npx nevr-env types         # Generate env.d.ts with ProcessEnv augmentation
npx nevr-env scan          # Find accidentally committed secrets
npx nevr-env rotate        # Track stale secrets by age
npx nevr-env diff          # Compare schemas between config files
npx nevr-env watch         # Live validation on .env file changes
npx nevr-env dev           # Validate env then run your dev server
npx nevr-env ci github     # Generate CI/CD config for your platform
```

**Auto-discovery**: The `fix` command detects running Docker/Podman containers and offers to use them:

```
Missing: DATABASE_URL

? How would you like to configure DATABASE_URL?
> Use Docker container (postgres:16 on port 5432)
  Enter value manually
  Skip for now
```

### Vault — Encrypted Secrets in Git

AES-256-GCM encryption with HMAC-SHA256 integrity verification. No more sharing secrets over Slack.

```bash
npx nevr-env vault keygen     # Generate encryption key
npx nevr-env vault push       # Encrypt .env -> .nevr-env.vault
git add .nevr-env.vault        # Safe to commit — it's encrypted

# New team member:
npx nevr-env vault pull        # Decrypt vault -> .env
```

- Automatic key discovery from `.env`, `.env.local`, or `NEVR_ENV_KEY` env var

### Extends — Compose Environments

Build on shared base configurations:

```typescript
// lib/env-base.ts
export const baseEnv = createEnv({
  plugins: [postgres()],
  server: { NODE_ENV: z.enum(["development", "production", "test"]) },
  runtimeEnv: process.env,
});

// src/env.ts
export const env = createEnv({
  extends: [baseEnv],              // Inherit all base schemas + validated values
  plugins: [stripe({ webhook: true })],
  server: { API_SECRET: z.string() },
  runtimeEnv: process.env,
});

env.DATABASE_URL   // from baseEnv (inherited)
env.API_SECRET     // from this config
```

### Tree-Shaking — Import Only What You Need

Every plugin has a standalone deep import path. Your bundle only includes the plugins you actually use:

```typescript
// Pulls in ONLY postgres — not stripe, not openai, not anything else
import { postgres } from "nevr-env/plugins/postgres";
```

The umbrella package is marked `sideEffects: false` for aggressive dead-code elimination.

---

## Why Not t3-env?

We love t3-env. We built on its ideas. But we needed more.

| | t3-env | **nevr-env** |
|---|--------|------------|
| **Missing keys** | Crash with error log | Interactive wizard + Docker auto-discovery |
| **Schema boilerplate** | `DATABASE_URL: z.string()` every project | `postgres()` — one function call |
| **Docker/Podman** | Manual | Auto-detects running containers |
| **`.env.example`** | Manual | `npx nevr-env generate` |
| **Team secrets** | Copy-paste in Slack | Encrypted vault in git |
| **Secret scanning** | External tool | `npx nevr-env scan` |
| **Rotation tracking** | Nothing | `npx nevr-env rotate` |
| **CI integration** | Manual | `npx nevr-env ci github` |
| **Schema validation** | Zod only | Any Standard Schema (Zod, Valibot, ArkType) |
| **Plugin system** | None | 13 built-in + custom plugins |

---

## Deployment Presets

Pre-built presets for common platforms:

```typescript
import { vercel } from "nevr-env/presets/vercel";
import { netlify } from "nevr-env/presets/netlify";
import { railway } from "nevr-env/presets/railway";
```

---

## CI/CD

All commands work in non-interactive environments. Key CI commands:

```bash
npx nevr-env check              # Exit code 0/1
npx nevr-env generate --force   # No prompts
npx nevr-env types --force      # No prompts
npx nevr-env scan --format json # Machine-readable output
```

---

## Documentation

> Read full documentation at 👉🏻 https://nevr-ts.github.io/nevr-env/


- [Getting Started](https://nevr-ts.github.io/nevr-env/guide/getting-started)
- [CLI Reference](https://nevr-ts.github.io/nevr-env/guide/cli-wizard)
- [Plugin Guide](https://nevr-ts.github.io/nevr-env/guide/plugins)
- [Vault & Security](https://nevr-ts.github.io/nevr-env/guide/cli-wizard#nevr-env-vault)
- [Creating Custom Plugins](https://nevr-ts.github.io/nevr-env/plugins/overview)

---
## Ecosystem

| Package | Description |
|---------|-------------|
| [`@nevr-env/core`](https://www.npmjs.com/package/@nevr-env/core) | Core engine — `createEnv`, `createPlugin`, Proxy, Standard Schema validation |
| [`@nevr-env/cli`](https://www.npmjs.com/package/@nevr-env/cli) | Interactive CLI — fix wizard, scanner, vault, schema diff, and 12 more commands |

## License

[MIT](LICENSE) — Built with obsession by the nevr-env contributors.
