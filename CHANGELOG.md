# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-02-10

### Changed

- **Vault crypto is now async** — `encrypt()` and `decrypt()` return `Promise` instead of blocking the event loop. PBKDF2 key derivation runs in the libuv thread pool via `crypto.pbkdf2` (async) instead of `pbkdf2Sync`. **Breaking:** callers must `await` these functions.
- **Single source of truth** — Vault crypto primitives (`encrypt`, `decrypt`, `generateKey`) consolidated into `@nevr-env/core`. The CLI and `nevr-env` umbrella package now import from core instead of bundling their own copies.

### Added

- `@nevr-env/core` now exports vault crypto: `encrypt`, `decrypt`, `generateKey`, `parseEnv`, `stringifyEnv`, `mergeEnv`, `validateKey`, `getKeyFromEnv`, `VaultError`, `VaultFile`

## [0.1.0] - 2026-02-09

### Added

- **Core** (`@nevr-env/core`)
  - `createEnv()` with full TypeScript inference, Proxy-based server/client separation
  - Plugin system with declarative `createPlugin()` factory (`base`, `when`, `either`, `oauthProviders`)
  - Built-in schema helpers (`urlSchema`, `portSchema`, `booleanSchema`, `enumSchema`, `stringSchema`) for zero-dep usage
  - Standard Schema V1 support (Zod, Valibot, ArkType)
  - Validation modes: `strict`, `warn`, `strip`
  - Plugin hooks: `onValidationSuccess`, `onValidationError`, `onAccess`
  - Secret scanner for detecting leaked credentials in source code
  - Secret rotation tracking with age-based policies
  - Health check utilities for runtime monitoring
  - Auto-migration from t3-env configurations
  - CI platform detection (GitHub Actions, GitLab CI, CircleCI, Vercel, Railway)
  - `.env.example` generation from schemas

- **CLI** (`@nevr-env/cli`)
  - `init` — Interactive project setup wizard with framework detection
  - `check` — Validate .env against schema (CI-friendly)
  - `fix` — Interactive wizard for missing variables with auto-discovery
  - `generate` — Generate .env.example from schema (`--force` for CI)
  - `types` — Generate TypeScript type definitions (`--force` for CI)
  - `scan` — Scan codebase for accidentally committed secrets (`--format json`)
  - `diff` — Compare environment schemas between configs
  - `rotate` — Check and record secret rotation status (`--format json`)
  - `ci` — Generate CI/CD validation configs (GitHub Actions, GitLab, CircleCI)
  - `vault keygen` — Generate AES-256 encryption key
  - `vault push` — Encrypt .env to `.nevr-env.vault`
  - `vault pull` — Decrypt vault back to .env
  - `vault status` — Show vault metadata and sync status
  - `watch` — Watch .env files and validate on change
  - `dev` — Run dev server with environment validation
  - Graceful non-TTY handling for CI/Docker environments

- **Plugins** (bundled in `nevr-env`)
  - `postgres` — PostgreSQL with Docker/Podman auto-discovery, connection pooling, Prisma support
  - `redis` — Redis with Docker/Podman auto-discovery, Upstash, cluster, sentinel
  - `supabase` — Supabase with service role, JWT, database, storage, realtime
  - `stripe` — Stripe with webhooks, Connect, pricing tables, customer portal
  - `openai` — OpenAI with Azure support (`either` pattern), embeddings, parameters
  - `resend` — Resend email with audiences, webhooks, domain config
  - `clerk` — Clerk auth with JWT, webhooks, organization, URLs
  - `auth0` — Auth0 with API audience, M2M, management API
  - `aws` — AWS with IAM role support (`either` pattern), S3, SES, SQS, SNS, DynamoDB, CloudFront
  - `better-auth` — Better Auth with OAuth providers, email/password, magic link, 2FA
  - `nextauth` — NextAuth.js with OAuth providers, database adapter, email

- **Presets**
  - `vercel` — Vercel deployment environment variables
  - `netlify` — Netlify deployment environment variables
  - `railway` — Railway deployment environment variables

- **Vault**
  - AES-256-GCM encryption with HMAC-SHA256 integrity verification
  - PBKDF2 key derivation (SHA-512, 600,000 iterations)
  - Timing-safe comparison to prevent timing attacks
  - Audit logging for vault operations
  - Team secret sharing via encrypted vault files in git

- **Bundle optimization**
  - Tree-shaking with standalone deep imports (`nevr-env/plugins/postgres`, etc.)
  - CLI split as optional dependency (not bundled into library code)
  - `sideEffects: false` for aggressive dead-code elimination
