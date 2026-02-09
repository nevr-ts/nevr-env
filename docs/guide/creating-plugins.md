# Creating Plugins

Plugins extend nevr-env with pre-built schemas for common services. They provide type-safe validation, auto-discovery, and CLI integration.

## Quick Start

Use `createPlugin` to build configurable plugins with automatic type inference:

```ts
import { createPlugin } from "nevr-env";
import { z } from "zod";

export const myService = createPlugin({
  id: "my-service",
  name: "My Service",
  prefix: "MY_SERVICE_",
  sensitive: { MY_SERVICE_SECRET: true },

  base: {
    MY_SERVICE_API_KEY: z.string().min(1),
    MY_SERVICE_URL: z.string().url().default("https://api.myservice.com"),
  },

  cli: () => ({
    docs: "https://myservice.com/docs/api-keys",
    prompts: {
      MY_SERVICE_API_KEY: {
        message: "Enter your API key",
        type: "password",
      },
    },
  }),
});
```

Usage:

```ts
import { createEnv } from "nevr-env";
import { myService } from "./my-service";

const env = createEnv({
  plugins: [myService()],
  runtimeEnv: process.env,
});

env.MY_SERVICE_API_KEY; // string - fully typed!
env.MY_SERVICE_URL;     // string
```

## Three Schema Patterns

### Pattern 1: `base` + `when` — Additive flags

Use `base` for always-present schemas and `when` for schemas included when a boolean flag is `true`:

```ts
export const postgres = createPlugin({
  id: "postgres",
  name: "PostgreSQL",

  base: {
    DATABASE_URL: z.string().url(),
  },

  when: {
    directUrl: {
      DIRECT_URL: z.string().url(),
    },
    pool: {
      DATABASE_POOL_SIZE: z.coerce.number().optional(),
      DATABASE_POOL_MIN: z.coerce.number().optional(),
    },
  },
});

postgres()                    // → { DATABASE_URL }
postgres({ directUrl: true }) // → { DATABASE_URL, DIRECT_URL }
postgres({ pool: true })      // → { DATABASE_URL, DATABASE_POOL_SIZE, DATABASE_POOL_MIN }
```

### Pattern 2: `either` — Mutually exclusive flags

Use `either` for schemas where one branch or another is selected:

```ts
export const openai = createPlugin({
  id: "openai",
  name: "OpenAI",

  base: {},

  either: {
    azure: {
      true: {
        AZURE_OPENAI_ENDPOINT: z.string().url(),
        AZURE_OPENAI_API_KEY: z.string().min(1),
      },
      false: {
        OPENAI_API_KEY: z.string().startsWith("sk-"),
      },
    },
  },

  when: {
    model: {
      OPENAI_MODEL: z.enum(["gpt-4o", "gpt-4", "gpt-3.5-turbo"]),
    },
  },
});

openai()                // → { OPENAI_API_KEY } (false branch is default)
openai({ azure: true }) // → { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY }
```

### Pattern 3: `oauthProviders` + `dynamicSchema` — OAuth from array

Use `oauthProviders` to generate `CLIENT_ID`/`CLIENT_SECRET` schemas from a providers array:

```ts
import { createOAuthSchema } from "../shared/oauth";
import type { OAuthProvider } from "nevr-env";

export const betterAuth = createPlugin({
  id: "better-auth",
  name: "Better-Auth",

  $options: {} as { providers?: readonly OAuthProvider[] },
  oauthProviders: "providers" as const,

  base: {
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
  },

  dynamicSchema: (opts) => {
    const providers = opts.providers ?? [];
    return providers.length > 0 ? createOAuthSchema(providers) : {};
  },
});

betterAuth({ providers: ["google", "github"] })
// → { BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET }
```

## Plugin Config Interface

```ts
interface DefinePluginConfig<TBase, TWhen, TEither, TOAuthKey, TOptions> {
  id: string;                    // Unique identifier
  name: string;                  // Display name for CLI
  prefix?: string;               // Variable prefix
  sensitive?: boolean | Record<string, boolean>;
  runtime?: "node" | "deno" | "bun" | "all";

  base: TBase;                   // Always included schemas
  when?: TWhen;                  // Additive: included when flag is true
  either?: TEither;              // Exclusive: true-branch or false-branch
  oauthProviders?: TOAuthKey;    // Option key for OAuth providers array
  $options?: TOptions;           // Phantom: extra option types

  runtimeSchema?: (opts, schema) => void;       // Escape hatch for imperative logic
  dynamicSchema?: (opts) => StandardSchemaDictionary; // Runtime schema builder
  cli?: (opts) => PluginCliConfig;
  hooks?: (opts) => PluginHooks;
  discover?: (opts) => () => Promise<Record<string, DiscoveryResult>>;
  autoDiscover?: boolean | ((opts) => boolean);
}
```

## Complete Example

Here's a production-ready plugin:

```ts
import { createPlugin } from "nevr-env";
import { z } from "zod";

export interface StripeOptions {
  testMode?: boolean;
  variableNames?: { secretKey?: string };
}

export const stripe = createPlugin({
  id: "stripe",
  name: "Stripe",
  prefix: "STRIPE_",
  sensitive: true,

  $options: {} as StripeOptions,

  base: {
    STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
    STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
  },

  when: {
    webhook: {
      STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
    },
    connect: {
      STRIPE_CONNECT_CLIENT_ID: z.string().startsWith("ca_"),
    },
  },

  runtimeSchema: (opts, schema) => {
    // Restrict to live keys in production
    if (!opts.testMode && process.env.NODE_ENV === "production") {
      schema.STRIPE_SECRET_KEY = z.string().startsWith("sk_live_");
    }
    // Custom variable names
    if (opts.variableNames?.secretKey) {
      schema[opts.variableNames.secretKey] = schema.STRIPE_SECRET_KEY;
      delete schema.STRIPE_SECRET_KEY;
    }
  },

  cli: (opts) => ({
    docs: "https://dashboard.stripe.com/apikeys",
    prompts: {
      STRIPE_SECRET_KEY: {
        message: "Stripe secret key",
        type: "password",
        placeholder: opts.testMode ? "sk_test_..." : "sk_live_...",
      },
    },
  }),

  discover: () => async () => ({}),

  hooks: () => ({
    afterValidation: (values) => {
      console.log("Stripe configured!");
    },
  }),
});
```

## The `extend` Option

Every plugin supports `extend` to add custom fields:

```ts
const env = createEnv({
  plugins: [
    stripe({
      webhook: true,
      extend: {
        STRIPE_PRODUCT_ID: z.string().startsWith("prod_"),
        STRIPE_TAX_RATE_ID: z.string().startsWith("txr_").optional(),
      },
    }),
  ],
});
```

## Auto-Discovery

Plugins can auto-discover values from the local environment:

```ts
createPlugin({
  id: "postgres",
  name: "PostgreSQL",
  base: { DATABASE_URL: z.string().url() },

  discover: (options) => async () => {
    const results: Record<string, DiscoveryResult> = {};

    // Check Docker containers
    try {
      const { execSync } = await import("child_process");
      const output = execSync('docker ps --format "{{.Names}}"', {
        encoding: "utf8",
      });

      if (output.includes("postgres")) {
        results.DATABASE_URL = {
          value: "postgres://postgres:postgres@localhost:5432/postgres",
          source: "docker",
          description: "Found Postgres container",
          confidence: 0.9,
        };
      }
    } catch {
      // Docker not available
    }

    return results;
  },
});
```

## Lifecycle Hooks

```ts
createPlugin({
  id: "my-plugin",
  name: "My Plugin",
  base: { API_URL: z.string().url() },

  hooks: (options) => ({
    // Transform values before validation
    beforeValidation: (values) => {
      if (values.API_URL && !values.API_URL.startsWith("https://")) {
        values.API_URL = `https://${values.API_URL}`;
      }
      return values;
    },

    // Run after successful validation
    afterValidation: (values) => {
      console.log("Validated:", Object.keys(values));
    },

    // Custom error handling
    onValidationError: (issues) => {
      console.error("Validation failed:", issues);
    },
  }),
});
```

## Schema Helpers

nevr-env provides helpers for common patterns:

```ts
import {
  urlSchema,
  portSchema,
  booleanSchema,
  enumSchema,
  stringSchema,
  optionalSchema,
} from "nevr-env";

createPlugin({
  id: "my-plugin",
  name: "My Plugin",
  base: {
    API_URL: urlSchema(["https"]),
    PORT: portSchema(1024, 65535),
    DEBUG: booleanSchema(false),
    LOG_LEVEL: enumSchema(["debug", "info", "warn", "error"]),
    API_KEY: stringSchema({ min: 32 }),
    OPTIONAL_VAR: optionalSchema(stringSchema()),
  },
});
```

## Best Practices

1. **Use declarative patterns** - `base`/`when`/`either` over imperative `if` statements
2. **Use descriptive IDs** - `"postgres"` not `"pg"`
3. **Prefix variables** - `STRIPE_*`, `DATABASE_*`
4. **Mark secrets** - `sensitive: true` or per-variable
5. **Provide CLI prompts** - Better onboarding experience
6. **Add discovery** - Auto-detect local services
7. **Document your plugin** - Include docs links
8. **Use `$options` for non-flag types** - `variableNames`, `defaultPort`, etc.
9. **Use `runtimeSchema` as escape hatch** - For logic that can't be declarative
