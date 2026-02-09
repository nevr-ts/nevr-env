# Monorepo Setup

nevr-env works seamlessly in monorepos. Define your env schema once in a shared package, and every app imports it.

## Structure

```
apps/
  web/
    src/env.ts        # Re-exports or extends
  api/
    src/env.ts        # Re-exports or extends
packages/
  env/                # Single source of truth
    src/index.ts
    package.json
```

## 1. Create the Shared Package

```bash
mkdir -p packages/env/src
cd packages/env && pnpm init
pnpm add nevr-env zod
pnpm add -D tsup typescript
```

Add a build script to `packages/env/package.json`:

```json
{
  "name": "@myorg/env",
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts"
  }
}
```

## 2. Define Your Schema Once

**packages/env/src/index.ts**:
```ts
import { createEnv, postgres, stripe, redis, openai } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  plugins: [
    postgres({ pool: true }),
    stripe({ webhook: true }),
    redis({ upstash: true }),
    openai({ model: true }),
  ],
  server: {
    NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});

export type Env = typeof env;
```

## 3. Use in Apps

**apps/web/src/env.ts** — just re-export:
```ts
export { env } from "@myorg/env";
```

**apps/api/src/env.ts** — same:
```ts
export { env } from "@myorg/env";
```

## App-Specific Extensions

When an app needs extra variables, use `extends`:

**apps/web/src/env.ts**:
```ts
import { createEnv } from "nevr-env";
import { z } from "zod";
import { env as baseEnv } from "@myorg/env";

export const env = createEnv({
  extends: [baseEnv],
  client: {
    NEXT_PUBLIC_ANALYTICS_ID: z.string(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});
```

**apps/admin/src/env.ts**:
```ts
import { createEnv } from "nevr-env";
import { z } from "zod";
import { env as baseEnv } from "@myorg/env";

export const env = createEnv({
  extends: [baseEnv],
  server: {
    ADMIN_SECRET: z.string().min(32),
    FEATURE_FLAGS_API: z.string().url(),
  },
  runtimeEnv: process.env,
});
```

## Workspace Configuration

**pnpm-workspace.yaml**:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

In each app's `package.json`:
```json
{
  "dependencies": {
    "@myorg/env": "workspace:*"
  }
}
```

### Turborepo

**turbo.json**:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    }
  }
}
```

Make sure `@myorg/env` is built before apps by adding it to `dependsOn`.

## Environment Files

### Option 1: Root .env (Recommended)

```
my-monorepo/
  .env              # All variables
  .env.example      # Auto-generated
  apps/
  packages/
```

Turborepo automatically loads root `.env`. For Next.js apps, load from root explicitly:

```js
// next.config.js
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
```

### Option 2: Per-App .env

```
my-monorepo/
  apps/
    web/.env
    admin/.env
    api/.env
```

## Vault in Monorepos

```bash
cd packages/env
npx nevr-env vault keygen

# Encrypt root .env
npx nevr-env vault push --env ../../.env

# Teammates pull
npx nevr-env vault pull --output ../../.env
```

## Type Safety Across Apps

The shared package gives you monorepo-wide type safety:

```ts
import { env } from "@myorg/env";

env.DATABASE_URL;     // string
env.STRIPE_SECRET_KEY; // string
env.NODE_ENV;         // "development" | "staging" | "production"
env.DOES_NOT_EXIST;   // ❌ TypeScript error
```

## Best Practices

1. **Keep schema in packages/env** — don't duplicate validation logic
2. **Use `extends` for app-specific vars** — base schema + extensions keeps things DRY
3. **Single `.env` at root** — easier to manage, works with Turborepo
4. **Build env package first** — add to `dependsOn` in turbo.json
5. **Use vault for team sync** — one encrypted file, committed to git
