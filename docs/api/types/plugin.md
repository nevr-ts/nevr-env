# Plugin Types

TypeScript types for creating nevr-env plugins.

## NevrEnvPlugin

The core plugin interface. All plugins returned by `createPlugin()` satisfy this type.

```ts
interface NevrEnvPlugin<
  TSchema extends StandardSchemaDictionary = StandardSchemaDictionary
> {
  /** Unique identifier (e.g., "stripe", "postgres") */
  id: string;

  /** Human-readable name (displayed in CLI) */
  name: string;

  /** The resolved schema for this plugin's environment variables */
  schema: TSchema;

  /** Environment variable prefix (e.g., "STRIPE_", "DATABASE_") */
  prefix?: string;

  /** Auto-discovery function for the CLI Wizard */
  discover?: () => Promise<
    Partial<Record<string, DiscoveryResult | DiscoveryResult[]>>
  >;

  /** Whether auto-discovery is enabled (default: true) */
  autoDiscover?: boolean;

  /** Lifecycle hooks */
  hooks?: PluginHooks;

  /** CLI Wizard configuration */
  cli?: PluginCliConfig;

  /** Whether variables are sensitive (for vault & log masking) */
  sensitive?: boolean | Record<string, boolean>;

  /** Required runtime */
  runtime?: "node" | "deno" | "bun" | "all";
}
```

## createPlugin

The recommended way to create plugins. Returns a typed factory function with conditional schema support (`when`, `either`, `oauthProviders`).

```ts
import { createPlugin } from "@nevr-env/core";
import { z } from "zod";

export const sentry = createPlugin({
  id: "sentry",
  name: "Sentry",
  prefix: "SENTRY_",

  // Always included
  base: {
    SENTRY_DSN: z.string().url(),
  },

  // Included when the flag is true: sentry({ tunnel: true })
  when: {
    tunnel: { SENTRY_TUNNEL_URL: z.string().url() },
    performance: { SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1) },
  },

  // CLI integration
  cli: (opts) => ({
    docs: "https://docs.sentry.io/product/sentry-basics/dsn-explainer/",
  }),
});

// Usage:
sentry()                              // → { SENTRY_DSN }
sentry({ tunnel: true })              // → { SENTRY_DSN, SENTRY_TUNNEL_URL }
sentry({ tunnel: true, performance: true }) // → all three
```

### DefinePluginConfig

The configuration object accepted by `createPlugin()`:

```ts
interface DefinePluginConfig<TBase, TWhen, TEither, TOAuthKey, TOptions> {
  /** Unique plugin identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Env var prefix */
  prefix?: string;
  /** Whether variables are sensitive */
  sensitive?: boolean | Record<string, boolean>;
  /** Required runtime */
  runtime?: "node" | "deno" | "bun" | "all";

  /** Schema always included */
  base: TBase;

  /** Conditional schemas — included when flag is true */
  when?: TWhen;

  /** Either/or schemas — switches between two schemas based on flag */
  either?: TEither;

  /** OAuth provider key — generates CLIENT_ID + CLIENT_SECRET per provider */
  oauthProviders?: TOAuthKey;

  /** Type hint for custom options (use $options: {} as MyOptions) */
  $options?: TOptions;

  /** Mutate schema at runtime based on options */
  runtimeSchema?: (opts: TOptions, schema: Record<string, unknown>) => void;

  /** CLI wizard integration */
  cli?: (opts: TOptions) => PluginCliConfig;

  /** Lifecycle hooks */
  hooks?: (opts: TOptions) => PluginHooks;

  /** Auto-discovery function */
  discover?: (opts: TOptions) => () => Promise<
    Partial<Record<string, DiscoveryResult | DiscoveryResult[]>>
  >;
}
```

## PluginHooks

Lifecycle hooks called during validation.

```ts
interface PluginHooks {
  /** Called before validation — can transform values */
  beforeValidation?: (values: Record<string, unknown>) => Record<string, unknown>;

  /** Called after successful validation */
  afterValidation?: (values: Record<string, unknown>) => void;

  /** Called when validation fails */
  onValidationError?: (issues: readonly StandardSchemaV1.Issue[]) => void;
}
```

## PluginCliConfig

Configuration for the CLI Wizard integration.

```ts
interface PluginCliConfig {
  /** Custom prompts for missing variables */
  prompts?: Record<string, PromptConfig>;
  /** Link to documentation */
  docs?: string;
  /** Custom help text */
  helpText?: string;
}
```

## DiscoveryResult

Returned by a plugin's `discover()` function for auto-detection.

```ts
interface DiscoveryResult {
  /** The discovered value */
  value: string;
  /** Source of discovery (e.g., "docker", "local") */
  source: string;
  /** Human-readable description */
  description: string;
  /** Confidence level (0–1) */
  confidence: number;
}
```

## PromptConfig

Configuration for CLI wizard prompts.

```ts
interface PromptConfig {
  message: string;
  type: "text" | "password" | "select" | "confirm";
  placeholder?: string;
  defaultValue?: string;
  options?: Array<{ label: string; value: string }>;
  validate?: (value: string) => string | undefined;
}
```

## Type Helpers

### ExtractPluginSchema

Extract the schema type from a plugin.

```ts
type ExtractPluginSchema<T> = T extends NevrEnvPlugin<infer S> ? S : never;
```

### MergePluginSchemas

Recursively merge all plugin schemas into a single intersection type. Used internally by `createEnv` to build the final env type.

```ts
type MergePluginSchemas<T extends readonly NevrEnvPlugin[]> = T extends readonly [
  infer First,
  ...infer Rest
]
  ? First extends NevrEnvPlugin
    ? Rest extends readonly NevrEnvPlugin[]
      ? ExtractPluginSchema<First> & MergePluginSchemas<Rest>
      : ExtractPluginSchema<First>
    : {}
  : {};
```

### How Type Inference Works

The full chain from plugin creation to typed `env` access:

```
createPlugin({ base, when, either })
  → (options?) => NevrEnvPlugin<ResolvedSchema<TBase, TWhen, TEither, TOAuth, TOptions>>

createEnv({ plugins: [postgres(), stripe({ webhook: true })] })
  → const TPlugins preserves the tuple type
  → MergePluginSchemas<TPlugins> intersects all plugin schemas
  → InferDictionary<MergedSchema> produces the final TypeScript type
  → CreateEnvResult = Readonly<{ DATABASE_URL: string; STRIPE_SECRET_KEY: string; ... }>
```

No manual type annotations needed. Adding a new plugin or toggling a flag automatically updates the env type.

## Complete Example

```ts
import { createEnv } from "nevr-env";
import { postgres, stripe } from "nevr-env/plugins";

// Both plugins are fully typed — no NevrEnvPlugin[] annotation needed
const env = createEnv({
  plugins: [
    postgres({ directUrl: true }),
    stripe({ webhook: true }),
  ],
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  runtimeEnv: process.env,
});

env.DATABASE_URL;        // string ✅
env.DIRECT_URL;          // string ✅ (from directUrl: true)
env.STRIPE_SECRET_KEY;   // string ✅
env.STRIPE_WEBHOOK_SECRET; // string ✅ (from webhook: true)
env.NODE_ENV;            // "development" | "production" | "test" ✅
env.MISSING;             // ❌ TypeScript error
```