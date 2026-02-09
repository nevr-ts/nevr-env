# Migration from t3-env

Migrating from t3-env to nevr-env is straightforward. The core API is compatible, with nevr-env adding plugins, vault, and CLI features.

## Quick Migration

### Before (t3-env)

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env, 
});
```

### After (nevr-env)

```typescript
import { createEnv } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env, 
});
```

## Key Differences

### 1. Package Name

Just one package to install and import:

```diff
- import { createEnv } from "@t3-oss/env-nextjs";
+ import { createEnv } from "nevr-env";
```

### 2. No Framework-Specific Packages

t3-env has separate packages for each framework. nevr-env uses one unified package:

```diff
- @t3-oss/env-nextjs
- @t3-oss/env-core
+ nevr-env
```

## Feature Comparison

| Feature | t3-env | nevr-env |
|---------|--------|----------|
| Schema validation | ✅ | ✅ |
| Server/client split | ✅ | ✅ |
| Standard Schema | ✅ | ✅ |
| Extends | ✅ | ✅ |
| emptyStringAsUndefined | ✅ | ✅ |
| skipValidation | ✅ | ✅ |
| onValidationError | ✅ | ✅ |
| onInvalidAccess | ✅ | ✅ |
| experimental__runtimeEnv | ✅ | ✅ |
| createFinalSchema | ✅ | ✅ |
| **Plugin system** | ❌ | ✅ |
| **Auto-discovery** | ❌ | ✅ |
| **CLI wizard** | ❌ | ✅ |
| **Encrypted vault** | ❌ | ✅ |
| **Dev command wrapper** | ❌ | ✅ |

## Taking Advantage of New Features

### Add Plugins

Replace manual schemas with plugins:

```diff
- server: {
-   DATABASE_URL: z.string().url().refine(
-     (url) => url.startsWith("postgres://"),
-     "Must be PostgreSQL URL"
-   ),
-   STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
- },
+ plugins: [
+   postgres(),
+   stripe(),
+ ],
```

### Use the CLI

```bash
# Check your configuration
npx nevr-env check

# Fix missing variables interactively
npx nevr-env fix

# Run dev with env loaded
npx nevr-env dev -- npm run dev
```

### Enable Vault for Team

```bash
# Generate key
npx nevr-env vault keygen

# Push .env to vault
npx nevr-env vault push

# Teammates pull
npx nevr-env vault pull
```

## Full Migration Example

### Original t3-env Setup

```typescript
// env.mjs
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});
```

### Migrated nevr-env Setup

```typescript
// env.ts
import { createEnv, postgres, stripe } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  plugins: [
    postgres(),
    stripe({ 
      webhook: true,
      publishableKey: true,
    }),
  ],
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});
```

Benefits of migrated version:
- 📦 Less code (plugins handle schemas)
- 🔍 Auto-discovery for DATABASE_URL
- 🛠️ CLI support for fixing missing vars
- 🔐 Vault support for team sharing
- ✅ Same type safety and validation
