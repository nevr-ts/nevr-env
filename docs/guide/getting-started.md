# Getting Started

Install nevr-env in your project:

::: code-group

```sh [pnpm]
pnpm add nevr-env
```

```sh [npm]
npm install nevr-env
```

```sh [yarn]
yarn add nevr-env
```

```sh [bun]
bun add nevr-env
```

:::

## Basic Usage

nevr-env is **framework agnostic** — it works with Next.js, Vite, Express, Hono, Nuxt, Remix, Astro, SvelteKit, or any JavaScript runtime. Just set `clientPrefix` to match your framework and `runtimeEnv` to your env source.

Create a file `env.ts` (or `env.js`) in your project:

```typescript
import { createEnv } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string().min(32),
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});
```

Now import and use your environment variables:

```typescript
import { env } from "./env";

// ✅ Type-safe access
console.log(env.DATABASE_URL);  // string
console.log(env.NODE_ENV);      // "development" | "production" | "test"

// ❌ TypeScript error - doesn't exist
console.log(env.NONEXISTENT);

// ❌ Runtime error on client - server variable accessed in browser
console.log(env.API_SECRET);
```

## Using Plugins

All official plugins are included with nevr-env - no extra installation needed:

```typescript
import { createEnv, postgres, stripe } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  plugins: [
    postgres(),
    stripe({ webhook: true }),
  ],
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  runtimeEnv: process.env,
});

// Access plugin variables with full type safety
console.log(env.DATABASE_URL);      // from postgres plugin
console.log(env.STRIPE_SECRET_KEY); // from stripe plugin
```

### Available Plugins

check out the [Plugins Overview](/plugins/overview) for the full list of available plugins and their options.

### Tree-Shaking with Subpath Imports

If you want to optimize bundle size, use subpath imports:

```typescript
import { createEnv } from "nevr-env";
import { postgres } from "nevr-env/plugins/postgres";
import { stripe } from "nevr-env/plugins/stripe";
```

## Interactive CLI Setup

Use the CLI wizard to set up environment variables:

```sh
npx nevr-env init
```

The wizard will:
1. Detect installed plugins
2. Auto-discover values (e.g., Docker Postgres containers)
3. Prompt for missing values
4. Generate a `.env` file
5. Create type-safe configuration

## Next Steps

- [Why nevr-env?](/guide/why-nevr-env) - Learn why we built this
- [Plugins](/plugins/overview) - Browse official plugins
- [Creating Plugins](/guide/creating-plugins) - Build your own plugins
- [Vault](/guide/vault) - Team secret sharing
- [CLI Commands](/guide/cli-wizard) - Check, generate, scan, diff, rotate, CI
- [Secret Scanning](/guide/scanning) - Prevent accidental credential exposure
- [Secret Rotation](/guide/rotation) - Track when secrets need rotation
- [Schema Diffing](/guide/schema-diff) - Detect breaking changes between versions
- [CI/CD Integration](/guide/ci-cd) - Generate platform-specific CI configs
- [Migration from t3-env](/guide/migration) - Upgrade guide
