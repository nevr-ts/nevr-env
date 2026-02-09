# Vault - Team Secret Sharing
> the **Vault** - solves the age-old problem: *"How do I share .env files with my team securely?"*

The **Vault** is nevr-env's built-in solution for secure environment variable sharing and management across your development team. It provides an encrypted vault file that can be safely committed to git, allowing teams to share secrets without risking exposure or relying on third-party services. The vault is designed to integrate seamlessly with the nevr-env CLI, making it easy to push updates and pull secrets as part of your development workflow.
 team collaboration. 

## The Problem

```
❌ Copy-paste .env in Slack → Security risk
❌ .env.example with placeholders → Friction, outdated
❌ Doppler/Infisical → Costs money, vendor lock-in
❌ 1Password → Manual sync, not in workflow
```

## The Solution: Local-First Vault

```
✅ Encrypted .env in git → Safe to commit
✅ npx nevr-env vault pull → One command setup
✅ Key shared securely once → Works forever
✅ Free, open source → No vendor lock-in
```

## How It Works

1. **One developer** runs `vault push` to encrypt the `.env`
2. **Encrypted file** (`.nevr-env.vault`) is committed to git
3. **Key** is shared securely with the team (NOT via git)
4. **Other developers** run `vault pull` to decrypt

```
┌─────────────────────────────────────────────────────────┐
│                     Your Git Repo                       │
│                                                         │
│   .env ──────────────► .nevr-env.vault (encrypted)     │
│         vault push           │                          │
│                              │ (safe to commit!)        │
│                              ▼                          │
│   .env ◄──────────────── git pull                      │
│         vault pull                                      │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Generate a Key

```bash
npx nevr-env vault keygen
```

By default, this will:
1. Generate a `nevr_`-prefixed encryption key
2. Save `NEVR_ENV_KEY` to your `.env` file
3. Add `.env` to `.gitignore` (creates if needed)

```
✔ Generated new encryption key
✔ Saved NEVR_ENV_KEY to .env
✔ Created .gitignore with .env

⚠️  Share this key with your team securely (NOT via git/slack).
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `--no-save` | Only print key, don't save to file | `false` |
| `-f, --file <path>` | File to save the key to | `.env` |

### 2. Push to Vault

```bash
npx nevr-env vault push
```

The CLI will:
- Auto-discover `NEVR_ENV_KEY` from your `.env` files (no manual export needed!)  
- Automatically **exclude** `NEVR_ENV_KEY` from the vault (your app secrets only)

```
● Using key from .env
◇ Encrypted!
◆ Vault saved: .nevr-env.vault
● Variables: 8
● NEVR_ENV_KEY excluded from vault (kept in .env only)
```

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `-e, --env <path>` | Source `.env` file | `.env` |
| `-o, --output <path>` | Output vault path | `.nevr-env.vault` |

### 3. Commit the Vault

```bash
git add .nevr-env.vault
git commit -m "chore: update env vault"
git push
```

### 4. Teammates Pull

```bash
# First, get the key from team lead (securely!)
echo "NEVR_ENV_KEY=nevr_abc123..." > .env.local

# Then pull the secrets
npx nevr-env vault pull
```

`NEVR_ENV_KEY` is automatically re-appended to the output file so you never lose your key.

Options:

| Flag | Description | Default |
|------|-------------|---------|
| `-i, --input <path>` | Vault file path | `.nevr-env.vault` |
| `-o, --output <path>` | Output `.env` path | `.env` |

### 5. Check Status

```bash
npx nevr-env vault status
```

```
  ✓ NEVR_ENV_KEY found (.env)
  ✓ .nevr-env.vault exists
  ✓ .env exists

  Vault metadata:
    Variables: 8
    Updated: 2026-02-08T08:57:39.880Z
    By: ENTEREST
```

## Key Discovery

The CLI automatically finds your `NEVR_ENV_KEY` without manual `export`:

1. `NEVR_ENV_KEY` in `process.env` (already exported)
2. Searches `.env` → `.env.local` → `.env.development.local` → `.env.development`
3. Interactive prompt (fallback — great for first-time setup)

::: tip No Export Needed
After `vault keygen`, the key is saved to `.env` automatically. All vault commands find it there — no need to add it to your shell profile!
:::

## Security Model

### What's Safe

- ✅ `.nevr-env.vault` → **Safe to commit** (encrypted)
- ✅ Sharing vault file → **Safe** (useless without key)
- ✅ GitHub backup → **Safe** (encrypted at rest)

### What's NOT Safe

- ❌ `NEVR_ENV_KEY` → **NEVER commit this**
- ❌ `.env` file → **NEVER commit this**
- ❌ Key in Slack/Discord → **Security risk**



## Multiple Environments

```bash
# Development (default)
npx nevr-env vault push

# Staging
npx nevr-env vault push --env .env.staging --output .nevr-env.staging.vault

# Production
npx nevr-env vault push --env .env.production --output .nevr-env.production.vault
```

## CI/CD Integration

### GitHub Actions

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Pull env from vault
        env:
          NEVR_ENV_KEY: ${{ secrets.NEVR_ENV_KEY }}
        run: npx nevr-env vault pull
      
      - name: Deploy
        run: npm run deploy
```

### Vercel

```bash
# Add to Vercel environment variables
NEVR_ENV_KEY=nevr_abc123...

# In build command
npx nevr-env vault pull && npm run build
```

## Encryption Details

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: PBKDF2 with SHA-512, 600,000 iterations
- **Salt**: Random 256-bit per encryption
- **IV**: Random 128-bit per encryption
- **Integrity**: HMAC-SHA256 (timing-safe comparison)
- **Zero knowledge**: `NEVR_ENV_KEY` is never stored in the vault

Even if an attacker gets the `.nevr-env.vault` file, they cannot:
- Decrypt it without the key
- Tamper with it (HMAC + GCM authentication tag detect changes)
- Know how many or which variables exist

## Troubleshooting

### "Wrong key or corrupted vault"

- Make sure you have the correct key
- HMAC verification will fail if the vault was tampered with
- Check for git merge conflicts in `.nevr-env.vault`

### "Vault not found"

```bash
ls -la .nevr-env.vault
ls -la .nevr-env.*.vault   # different environment?
```

## Best Practices

1. **One key per project** — Different projects, different keys
2. **Rotate keys periodically** — Generate new key, re-push vault
3. **Use environment-specific vaults** — Dev, staging, production
4. **Add .env to .gitignore** — `vault keygen` does this automatically
5. **Add vault to git** — It's safe, that's the point!
