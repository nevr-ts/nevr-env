# What is nevr-env?

**nevr-env** is a type-safe environment variable validation library for TypeScript and JavaScript. It provides:

- **Validation** using Standard Schema V1 (Zod, Valibot, ArkType, etc.)
- **Plugin system** for common services (PostgreSQL, Stripe, Redis, OpenAI)
- **Auto-discovery** to detect values from Docker, config files, etc.
- **Security** via Proxy-based protection for server secrets
- **CLI wizard** for interactive setup and .env file generation

## The Problem

Environment variables are one of the most error-prone parts of application development:

```typescript
// ❌ Common issues with raw process.env

// 1. No type safety - everything is string | undefined
const port = process.env.PORT; // string | undefined
const debug = process.env.DEBUG; // string | undefined (not boolean!)

// 2. No validation - runtime errors
const apiUrl = process.env.API_URL; // might be invalid URL
fetch(apiUrl + "/data"); // crash at runtime

// 3. No server/client separation
// This server secret might end up in your client bundle!
const dbUrl = process.env.DATABASE_URL;

// 4. Typos silently fail
const key = process.env.STRIPE_SECERT_KEY; // typo = undefined
```

## The Solution

nevr-env solves all of these:

```typescript
import { createEnv } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string().min(32),
    PORT: z.coerce.number().default(3000),
    DEBUG: z.coerce.boolean().default(false),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});

// ✅ Full type safety
env.PORT; // number (coerced and defaulted)
env.DEBUG; // boolean
env.DATABASE_URL; // string (validated URL)

// ✅ TypeScript errors for typos
env.STRIPE_SECERT_KEY; // Error: Property does not exist

// ✅ Validation at startup
// App won't start with invalid/missing env vars

// ✅ Server protection
// On client: env.DATABASE_URL throws an error
```

## Framework Agnostic

nevr-env works with **any** JavaScript/TypeScript framework. The core library has zero framework-specific code — it only needs two things from you:

1. **`runtimeEnv`** — where to read values from (`process.env`, `import.meta.env`, Cloudflare bindings, etc.)
2. **`clientPrefix`** — which prefix marks client-safe variables (optional, for server/client separation)

| Framework | `runtimeEnv` | `clientPrefix` |
|-----------|-------------|----------------|
| Next.js | `process.env` | `NEXT_PUBLIC_` |
| Nuxt | `process.env` | `NUXT_PUBLIC_` |
| Vite / SvelteKit | `import.meta.env` | `VITE_` |
| Remix / Astro | `process.env` | `PUBLIC_` |
| Express / Hono / Fastify | `process.env` | _(not needed — server-only)_ |
| Cloudflare Workers | `c.env` (bindings) | _(not needed)_ |
| Deno / Bun | `process.env` | _(your choice)_ |

The CLI `init` wizard auto-detects your framework from `package.json` and sets the right prefix, but you can always configure it manually.

## Philosophy

### Standard Schema First

nevr-env uses [Standard Schema V1](https://github.com/standard-schema/standard-schema), meaning you can use your favorite validation library:

- **Zod** - Most popular
- **Valibot** - Smallest bundle
- **ArkType** - Best performance
- **Effect/Schema** - Functional approach

### Plugin-Based Architecture

Instead of manually defining schemas for every service, use plugins:

```typescript
import { postgres, stripe } from "nevr-env";

export const env = createEnv({
  plugins: [postgres(), stripe()],
  runtimeEnv: process.env,
});
```

Plugins provide:
- Pre-built schemas with proper validation
- Auto-discovery from Docker containers
- CLI prompts with documentation links
- Sensitive field marking

### Developer Experience

The CLI wizard makes setup painless:

```
$ npx nevr-env init

🔍 Detecting plugins...
   Found: postgres, stripe

🐳 Auto-discovering values...
   ✓ DATABASE_URL: Found Postgres in Docker (localhost:5432)

📝 Missing values:
   ? STRIPE_SECRET_KEY: ****************************
   ✓ Validated: Stripe secret key format

✅ Created .env with 3 variables
✅ Created env.ts with type-safe configuration
```

## Comparison

| Feature | nevr-env | t3-env | envalid |
|---------|----------|--------|---------|
| Type-safe validation | ✅ | ✅ | ✅ |
| Standard Schema V1 | ✅ | ✅ | ❌ |
| Plugin system | ✅ | ❌ | ❌ |
| Interactive CLI wizard | ✅  | ❌ | ❌ | ❌ |
| Encrypted vault | ✅  | ❌ | ❌ | ❌ |
| Secret scanning | ✅ | ❌ | ❌ | ❌ |
| Auto-discovery (Docker/podman) | ✅ | ❌ | ❌ | ❌ |
| .env.example generation | ✅ | ❌ | ❌ | ❌ |
| Type generation (env.d.ts) | ✅ | ❌ | ❌ | ❌ |
| Rotation tracking | ✅ | ❌ | ❌ | ❌ |
| CI/CD config generation | ✅  | ❌ | ❌ | ❌ |
| Server/client protection | ✅ | ✅ | ❌ |
| Framework presets | ✅ | ✅ | ❌ |
| Extend configurations | ✅ | ✅ | ❌ |

## When to Use nevr-env

✅ **Good fit:**
- Production applications needing robust env validation
- Projects using multiple services (databases, APIs, etc.)
- Teams wanting consistent env setup across projects
- Applications with complex server/client separation

❌ **Maybe overkill:**
- Simple scripts with 1-2 env vars
