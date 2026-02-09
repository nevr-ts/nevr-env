# Changelog

All notable changes to nevr-env will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-09

Initial public release.

### Core

- **`createEnv()`** — Type-safe environment validation with full TypeScript inference
- **Standard Schema V1** — Works with Zod, Valibot, ArkType, and any Standard Schema compliant library
- **Server/Client Proxy** — Prevents server secrets from leaking to client bundles via a runtime Proxy
- **`extends`** — Compose environments by inheriting from base configurations
- **Validation modes** — `strict` (throw), `warn` (console.warn), or skip validation entirely
- **`onInvalidAccess`** — Custom handler when client code attempts to access server variables
- **Health check** — `healthCheck()` and `createHealthEndpoint()` for Express and Web API

### Plugins (13)

Declarative plugin system using `createPlugin()` with full type inference.

**Database:**
- `postgres()` — PostgreSQL with Docker auto-discovery, pool, SSL, direct URL
- `redis()` — Redis with TLS, cluster, Upstash, sentinel support
- `supabase()` — Supabase with service role, anon key, storage, realtime

**Authentication:**
- `betterAuth()` — Better Auth with OAuth providers, 2FA, magic link
- `clerk()` — Clerk with webhook, organizations, JWT template
- `auth0()` — Auth0 with management API, M2M, custom domains
- `nextauth()` — NextAuth.js with OAuth providers

**Payment:**
- `stripe()` — Stripe with webhook, Connect, Customer Portal, Checkout

**AI/LLM:**
- `openai()` — OpenAI with Azure support, model config, embeddings

**Email:**
- `resend()` — Resend with webhook, batch sending, custom domains

**Cloud:**
- `aws()` — AWS with S3, SES, SQS, SNS, DynamoDB, CloudFront, IAM role support

### Presets (3)

Platform-specific environment variable presets:

- `vercel()` — All Vercel system variables with helper functions (`isVercel`, `isVercelPreview`, `getVercelUrl`)
- `railway()` — All Railway system variables with helpers (`isRailway`, `isRailwayProduction`, `getRailwayUrl`)
- `netlify()` — All Netlify system variables with helpers (`isNetlify`, `isNetlifyProduction`, `getNetlifyUrl`)

### CLI (12 commands)

- `nevr-env init` — Interactive setup wizard with framework detection
- `nevr-env check` — Validate environment against schema (CI-friendly, exit code 0/1)
- `nevr-env fix` — Interactive wizard for missing variables with Docker auto-discovery
- `nevr-env generate` — Generate `.env.example` from schema
- `nevr-env types` — Generate `env.d.ts` with `ProcessEnv` augmentation
- `nevr-env scan` — Scan codebase for accidentally committed secrets
- `nevr-env diff` — Compare schemas between config files (text, JSON, markdown output)
- `nevr-env rotate` — Track secret rotation status and stale secrets
- `nevr-env ci` — Generate CI/CD configs (GitHub Actions, Vercel, Railway, GitLab, CircleCI)
- `nevr-env dev` — Validate env then run your dev server
- `nevr-env watch` — Watch `.env` files, validate on change
- `nevr-env vault` — Encrypted vault management (keygen, push, pull, status)

### Vault

- **AES-256-GCM** encryption with PBKDF2 600K iterations
- **HMAC-SHA256** integrity verification with timing-safe comparison
- `vault keygen` — Generate encryption key, auto-save to `.env`, update `.gitignore`
- `vault push` — Encrypt `.env` to `.nevr-env.vault`
- `vault pull` — Decrypt `.nevr-env.vault` to `.env`
- `vault status` — Show vault status and file discovery
- **Audit logging** — Blockchain-like tamper-evident log with query, export, and rotation

### Advanced APIs

- **Schema diffing** — `diffSchemas()`, `diffPlugins()`, `generateMigrationGuide()` with rename detection
- **Auto-migration** — `renameVar()`, `transformVar()`, `splitVar()`, `mergeVars()`, `addVar()`, `deleteVar()`, `migrate()`, `rollback()`
- **Secret scanning** — `scanForSecrets()` with 12 built-in patterns, custom patterns, `generatePreCommitHook()`
- **Rotation tracking** — `createRotationChecker()`, `recordRotation()`, `getRotationStatus()`
- **CI/CD generation** — `generateCIConfig()` for 5 platforms
- **Runtime utilities** — `runtimeEnv`, `isServerRuntime()`, `detectRuntime()`, `ENV` helpers

### Framework Support

Framework agnostic — works with any JavaScript runtime:

- Next.js (`NEXT_PUBLIC_`)
- Nuxt (`NUXT_PUBLIC_`)
- Vite / SvelteKit (`VITE_`)
- Remix / Astro (`PUBLIC_`)
- Express / Hono / Fastify (no prefix needed)
- Cloudflare Workers
- Deno / Bun

---

## Reporting Issues

Found a bug? Please [open an issue](https://github.com/nevr-ts/nevr-env/issues) on GitHub.

## Contributing

We welcome contributions! See our [Contributing Guide](https://github.com/nevr-ts/nevr-env/blob/main/CONTRIBUTING.md) for details.
