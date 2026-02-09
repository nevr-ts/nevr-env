# CLI Wizard

The nevr-env CLI provides interactive commands to manage, validate, and secure your environment variables.

## Installation

```bash
npm install nevr-env
```

Or run directly:

```bash
npx nevr-env
```

## Commands Overview

| Command | Description |
|---------|-------------|
| `nevr-env init` | Initialize nevr-env in your project |
| `nevr-env fix` | Interactive wizard to fix missing variables |
| `nevr-env check` | Validate environment against schema |
| `nevr-env generate` | Generate `.env.example` from schema |
| `nevr-env types` | Generate TypeScript type definitions |
| `nevr-env dev` | Validate environment then run dev server |
| `nevr-env watch` | Watch `.env` files and validate on change |
| `nevr-env scan` | Scan codebase for leaked secrets |
| `nevr-env diff` | Compare schemas between config files |
| `nevr-env rotate` | Track secret rotation status |
| `nevr-env ci` | Generate CI/CD config for platforms |
| `nevr-env vault` | Encrypted vault for team secrets |

---

## `nevr-env init`

Initialize a new nevr-env configuration in your project.

```bash
npx nevr-env init
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `--cwd <path>` | Working directory | `.` |
| `-f, --force` | Overwrite existing config | `false` |

The wizard will:
1. Detect your framework (Next.js, Vite, etc.) and set the client prefix
2. Ask which plugins to enable (PostgreSQL, Stripe)
3. Let you choose config location (`src/env.ts`, `lib/env.ts`, `nevr.config.ts`)
4. Create the config file and optionally a `.env` file

```bash
$ npx nevr-env init

��� nevr-env init

? Which plugins would you like to use?
◉ PostgreSQL
◉ Stripe

? Where should we create the config file?
❯ src/env.ts (Recommended)
  lib/env.ts
  nevr.config.ts

✅ Created src/env.ts
✅ Created .env
```

---

## `nevr-env fix`

Interactive wizard to configure missing environment variables with auto-discovery.

```bash
npx nevr-env fix
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `--cwd <path>` | Working directory | `.` |
| `-c, --config <path>` | Path to config file | auto-detect |
| `-e, --env-file <path>` | Target `.env` file | auto-detect |
| `-y, --yes` | Skip confirmations | `false` |

```bash
$ npx nevr-env fix

��� nevr-env fix

Found 2 missing variable(s)

��� DATABASE_URL (PostgreSQL)
   Docs: https://postgresql.org/docs/current/libpq-connect.html

? How would you like to configure DATABASE_URL?
❯ ��� Use Docker container (postgres:5432/mydb)
  ✏️  Enter value manually
  ⏭️  Skip for now

��� STRIPE_SECRET_KEY (Stripe)

? Enter value for STRIPE_SECRET_KEY:
› sk_test_****

��� Summary
   ✓ Configured: 2

��� All variables configured! You're ready to go.
```

---

## `nevr-env check`

Validate all environment variables against the schema without prompts.

```bash
npx nevr-env check
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `--cwd <path>` | Working directory | `.` |
| `-c, --config <path>` | Path to config file | auto-detect |

Exit codes: `0` = all valid, `1` = missing required variables.

```bash
$ npx nevr-env check

✓ 6 variables configured
  • NODE_ENV
  • DATABASE_URL
  • STRIPE_SECRET_KEY
  • API_SECRET
  • PORT
  • NEXT_PUBLIC_APP_URL

✅ All required environment variables are configured!
```

---

## `nevr-env generate`

Generate a `.env.example` file from your schema, grouped by plugin.

```bash
npx nevr-env generate
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `--cwd <path>` | Working directory | `.` |
| `-c, --config <path>` | Path to config file | auto-detect |
| `-o, --output <path>` | Output file path | `.env.example` |
| `-f, --force` | Overwrite output file without prompting | `false` |

In non-TTY environments (CI, Docker, piped output), `--force` is implied automatically — the file is written without prompting.

---

## `nevr-env types`

Generate TypeScript type definitions from your schema. Useful for projects that want `ProcessEnv` augmentation.

```bash
npx nevr-env types
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `--cwd <path>` | Working directory | `.` |
| `-c, --config <path>` | Path to config file | auto-detect |
| `-o, --output <path>` | Output file path | `env.d.ts` |
| `-n, --namespace <name>` | Namespace for ProcessEnv | `NodeJS` |
| `-f, --force` | Overwrite output file without prompting | `false` |

In non-TTY environments (CI, Docker, piped output), `--force` is implied automatically — the file is written without prompting.

Generates:
- `ProcessEnv` interface augmentation
- Typed `Env` interface
- `isValidEnv()` type guard

---

## `nevr-env dev`

Validate environment variables, then run your dev server. If variables are missing, offers to launch the fix wizard first.

```bash
npx nevr-env dev next dev
npx nevr-env dev npm run dev
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `--cwd <path>` | Working directory | `.` |
| `-c, --config <path>` | Path to config file | auto-detect |
| `--skip-check` | Skip environment validation | `false` |

The command:
1. Validates all environment variables
2. If missing, offers the interactive fix wizard
3. Runs your command with `NEVR_ENV_VALIDATED=true`
4. Forwards signals (SIGINT/SIGTERM) to the child process

---

## `nevr-env watch`

Watch mode that monitors `.env` files and validates on changes. Perfect for development.

```bash
npx nevr-env watch
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `--cwd <path>` | Working directory | `.` |
| `-c, --config <path>` | Path to config file | auto-detect |
| `-i, --interval <ms>` | Debounce interval | `300` |

Watches: `.env`, `.env.local`, `.env.development`, `.env.development.local`, `.env.test`, `.env.production`

```bash
$ npx nevr-env watch

��� nevr-env watch

Watching 8 environment variables
Watching files:
  .env
  .env.local

✓ All environment variables configured

[14:32:15] ↻ File changed: .env
[14:32:15] ✓ All 8 variables configured

[14:32:47] ↻ File changed: .env
[14:32:47] ⚠ Missing: DATABASE_URL
```

---

## `nevr-env scan`

Scan your codebase for accidentally committed secrets.

```bash
npx nevr-env scan
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --path <path>` | Directory to scan | `.` |
| `-f, --format <format>` | Output format (`text`, `json`) | `text` |
| `-e, --exclude <patterns...>` | Glob patterns to exclude | — |

Exit codes: `0` = clean, `1` = secrets found.

```bash
$ npx nevr-env scan

��� nevr-env scan

Scanning: ./src

Scan complete

✅ No secrets found!
```

---

## `nevr-env diff`

Compare environment schemas between two config files to detect breaking changes.

```bash
npx nevr-env diff --from ./v1/env.ts --to ./v2/env.ts
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `--from <path>` | Source config file | auto-detect |
| `--to <path>` | Target config file | auto-detect |
| `-f, --format <format>` | Output format (`text`, `json`, `markdown`) | `text` |
| `--cwd <path>` | Working directory | `.` |

Exit codes: `0` = no breaking changes, `1` = breaking changes (removed variables).

---

## `nevr-env rotate`

Track secret rotation status and flag stale secrets.

```bash
npx nevr-env rotate
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `--cwd <path>` | Working directory | `.` |
| `-c, --config <path>` | Path to config file | auto-detect |
| `--max-age <days>` | Max age before flagging | `90` |
| `-f, --format <format>` | Output format (`text`, `json`) | `text` |
| `--record <key>` | Record that a key was rotated | — |

Auto-detects sensitive keys by name (`secret`, `key`, `password`, `token`).

```bash
$ npx nevr-env rotate

��� nevr-env rotate

Checking 2 sensitive variable(s) (max age: 90 days)

  ● STRIPE_SECRET_KEY — never rotated
  ● API_SECRET — never rotated

2 secret(s) need rotation. Use --record <key> after rotating.
```

```bash
# Record a rotation
$ npx nevr-env rotate --record STRIPE_SECRET_KEY
✅ Rotation recorded.
```

---

## `nevr-env ci`

Generate CI/CD configuration for various platforms. Outputs to stdout for piping.

```bash
npx nevr-env ci <platform>
```

Platforms: `github`, `vercel`, `gitlab`, `circleci`, `railway`

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `--cwd <path>` | Working directory | `.` |
| `-c, --config <path>` | Path to config file | auto-detect |
| `--node-version <version>` | Node.js version for CI | `20` |
| `--package-manager <pm>` | Package manager (`npm`, `yarn`, `pnpm`) | auto-detect |

```bash
# GitHub Actions
$ npx nevr-env ci github > .github/workflows/env.yml

# Vercel
$ npx nevr-env ci vercel > vercel.json

# GitLab CI
$ npx nevr-env ci gitlab > .gitlab-ci.yml
```

---

## `nevr-env vault`

Local-first encrypted vault for sharing secrets with your team. The vault file (`.nevr-env.vault`) is safe to commit to git.

### Security

- **AES-256-GCM** authenticated encryption
- **PBKDF2** key derivation (600,000 iterations, SHA-512)
- **HMAC-SHA256** integrity verification (timing-safe comparison)
- Random 32-byte salt + 16-byte IV per encryption
- `NEVR_ENV_KEY` is **never** stored in the vault

### `vault keygen`

Generate a new encryption key.

```bash
npx nevr-env vault keygen
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `--no-save` | Only print key, don't save to file | `false` |
| `-f, --file <path>` | File to save the key to | `.env` |

By default, keygen will:
1. Generate a `nevr_`-prefixed encryption key
2. Save `NEVR_ENV_KEY` to your `.env` file
3. Add `.env` to `.gitignore` (create if needed)

```bash
$ npx nevr-env vault keygen

✔ Generated new encryption key
✔ Saved NEVR_ENV_KEY to .env
✔ Created .gitignore with .env

⚠️  Share this key with your team securely (NOT via git/slack).
```

### `vault push`

Encrypt your `.env` and save to `.nevr-env.vault`.

```bash
npx nevr-env vault push
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `-e, --env <path>` | Path to `.env` file | `.env` |
| `-o, --output <path>` | Output vault path | `.nevr-env.vault` |

Key discovery order:
1. `NEVR_ENV_KEY` in `process.env`
2. `NEVR_ENV_KEY` in `.env` → `.env.local` → `.env.development.local` → `.env.development`
3. Interactive prompt (fallback)

`NEVR_ENV_KEY` is automatically excluded from the vault — only your application secrets are encrypted.

```bash
$ npx nevr-env vault push

● Using key from .env
◇ Encrypted!
◆ Vault saved: .nevr-env.vault
● Variables: 8
● NEVR_ENV_KEY excluded from vault (kept in .env only)
```

### `vault pull`

Decrypt `.nevr-env.vault` back to `.env`.

```bash
npx nevr-env vault pull
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `-i, --input <path>` | Vault file path | `.nevr-env.vault` |
| `-o, --output <path>` | Output `.env` path | `.env` |

After decrypting, `NEVR_ENV_KEY` is automatically re-appended to the output file so you don't lose it.

```bash
$ npx nevr-env vault pull

● Using key from .env.local
◇ Decrypted!
◆ Created: .env
● Variables: 8
● NEVR_ENV_KEY preserved in .env
```

### `vault status`

Show vault and key status at a glance.

```bash
npx nevr-env vault status
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `-v, --vault <path>` | Vault file path | `.nevr-env.vault` |

```bash
$ npx nevr-env vault status

  ✓ NEVR_ENV_KEY found (.env)
  ✓ .nevr-env.vault exists
  ✓ .env exists

  Vault metadata:
    Variables: 8
    Updated: 2026-02-08T08:57:39.880Z
    By: ENTEREST
```

### Team Workflow

```bash
# Developer A: Initial setup
npx nevr-env vault keygen       # Generate key, save to .env
npx nevr-env vault push         # Encrypt .env → .nevr-env.vault
git add .nevr-env.vault          # Commit vault (safe — it's encrypted)

# Developer B: Join the project
git pull                         # Get .nevr-env.vault
# Receive NEVR_ENV_KEY from team lead securely
echo "NEVR_ENV_KEY=nevr_..." > .env.local
npx nevr-env vault pull          # Decrypt vault → .env
```

---

## Configuration

The CLI automatically detects your config file in this order:

1. `src/env.ts` / `src/env.js`
2. `lib/env.ts` / `lib/env.js`
3. `app/env.ts` / `app/env.js`
4. `env.config.ts` / `env.config.js`

```ts
// src/env.ts
import { createEnv } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  plugins: [
    postgres(),
    stripe({ webhook: true }),
  ],
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    API_SECRET: z.string().min(32),
  },
  clientPrefix: "NEXT_PUBLIC_",
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  runtimeEnv: process.env,
});
```

## Plugin Integration

Plugins provide enhanced CLI experiences with auto-discovery, documentation links, and guided prompts:

```bash
$ npx nevr-env fix

Missing: DATABASE_URL

[postgres plugin]
? How would you like to configure PostgreSQL?
❯ ��� Use Docker container (found: postgres:16 on 5432)
  ✏️  Enter connection string manually
  ⏭️  Skip for now

✅ DATABASE_URL=postgres://postgres:postgres@localhost:5432/myapp_development
```
