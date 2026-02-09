# createPlugin

Factory function for building configurable plugins with automatic type inference.

## Signature

```ts
function createPlugin<TBase, TWhen, TEither, TOAuthKey, TOptions>(
  config: DefinePluginConfig<TBase, TWhen, TEither, TOAuthKey, TOptions>
): <const T>(options?: T) => NevrEnvPlugin<ResolvedSchema<TBase, TWhen, TEither, TOAuthKey, T>>
```

All type parameters are inferred from the config object — no explicit generics needed.

## Usage

```ts
import { createPlugin } from "nevr-env";
import { z } from "zod";

export const myService = createPlugin({
  id: "my-service",
  name: "My Service",

  base: {
    MY_API_KEY: z.string().min(1),
  },

  when: {
    debug: {
      MY_DEBUG: z.coerce.boolean().default(false),
    },
  },
});

// Use in createEnv
createEnv({
  plugins: [myService({ debug: true })],
  runtimeEnv: process.env,
});
```

## Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier |
| `name` | `string` | Yes | Display name |
| `base` | `Record<string, ZodType>` | Yes | Always-present schemas |
| `when` | `Record<string, Record<string, ZodType>>` | | Additive conditional schemas |
| `either` | `Record<string, { true: ..., false: ... }>` | | Mutually exclusive schemas |
| `oauthProviders` | `string` | | Option key for OAuth providers array |
| `$options` | `TOptions` | | Phantom type for extra options |
| `prefix` | `string` | | Variable prefix |
| `sensitive` | `boolean \| Record<string, boolean>` | | Mark secrets |
| `runtimeSchema` | `(opts, schema) => void` | | Runtime schema adjustments |
| `dynamicSchema` | `(opts) => Record<string, ZodType>` | | Dynamic schema builder |
| `cli` | `(opts) => CliConfig` | | CLI prompts |
| `hooks` | `(opts) => Hooks` | | Lifecycle hooks |
| `discover` | `(opts) => () => Promise<Results>` | | Auto-discovery |
| `autoDiscover` | `boolean \| (opts) => boolean` | | Enable/disable auto-discovery |

## Examples

### Basic Plugin

```ts
export const redis = createPlugin({
  id: "redis",
  name: "Redis",
  base: {
    REDIS_URL: z.string().url(),
  },
});
```

### With Additive Flags (`when`)

```ts
export const postgres = createPlugin({
  id: "postgres",
  name: "PostgreSQL",
  sensitive: true,

  base: {
    DATABASE_URL: z.string().url(),
  },

  when: {
    directUrl: {
      DIRECT_URL: z.string().url(),
    },
    pool: {
      DATABASE_POOL_SIZE: z.coerce.number().default(10),
    },
  },
});

postgres()                    // → { DATABASE_URL }
postgres({ directUrl: true }) // → { DATABASE_URL, DIRECT_URL }
```

### With Mutually Exclusive Flags (`either`)

```ts
export const openai = createPlugin({
  id: "openai",
  name: "OpenAI",

  base: {},

  either: {
    azure: {
      true: { AZURE_OPENAI_ENDPOINT: z.string().url() },
      false: { OPENAI_API_KEY: z.string().startsWith("sk-") },
    },
  },
});

openai()                // → { OPENAI_API_KEY }
openai({ azure: true }) // → { AZURE_OPENAI_ENDPOINT }
```

### With Extra Options (`$options`)

```ts
export const stripe = createPlugin({
  id: "stripe",
  name: "Stripe",

  $options: {} as { testMode?: boolean; variableNames?: { secretKey?: string } },

  base: {
    STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  },

  runtimeSchema: (opts, schema) => {
    if (opts.variableNames?.secretKey) {
      schema[opts.variableNames.secretKey] = schema.STRIPE_SECRET_KEY;
      delete schema.STRIPE_SECRET_KEY;
    }
  },
});
```

### With CLI Prompts

```ts
export const stripe = createPlugin({
  id: "stripe",
  name: "Stripe",

  base: {
    STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  },

  cli: () => ({
    docs: "https://dashboard.stripe.com/apikeys",
    prompts: {
      STRIPE_SECRET_KEY: {
        message: "Enter your Stripe secret key",
        type: "password",
      },
    },
  }),
});
```

### With Discovery

```ts
export const postgres = createPlugin({
  id: "postgres",
  name: "PostgreSQL",

  base: {
    DATABASE_URL: z.string().url(),
  },

  discover: () => async () => {
    try {
      const { execSync } = await import("child_process");
      const output = execSync('docker ps', { encoding: "utf8" });
      if (output.includes("postgres")) {
        return {
          DATABASE_URL: {
            value: "postgres://localhost:5432/postgres",
            source: "docker",
            description: "Found Postgres container",
            confidence: 0.9,
          },
        };
      }
    } catch {}
    return {};
  },
});
```

### With `extend` (User-Side)

```ts
const env = createEnv({
  plugins: [
    postgres({
      pool: true,
      extend: {
        DATABASE_MAX_RETRIES: z.coerce.number().default(3),
      },
    }),
  ],
});
```

## Type Inference

Full TypeScript inference — no manual type annotations needed:

```ts
// All keys are inferred from the declarative config
const plugin = postgres({ directUrl: true, pool: true });
// plugin.schema keys: DATABASE_URL, DIRECT_URL, DATABASE_POOL_SIZE, ...

const env = createEnv({
  plugins: [plugin],
  runtimeEnv: process.env,
});

env.DATABASE_URL; // string
env.DIRECT_URL;   // string (only present because directUrl: true)
```

## See Also

- [Creating Plugins Guide](/guide/creating-plugins)
- [Schema Helpers](/api/schema-helpers)
