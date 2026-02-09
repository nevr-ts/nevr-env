# Runtime Utilities

Utilities for runtime detection and environment access.

## detectRuntime

Detect the current JavaScript runtime.

```ts
import { detectRuntime } from "nevr-env";

const runtime = detectRuntime();
// Returns: "node" | "browser" | "deno" | "bun" | "unknown"

switch (runtime) {
  case "node":
    // Node.js specific code
    break;
  case "browser":
    // Browser specific code
    break;
  case "deno":
    // Deno runtime
    break;
  case "bun":
    // Bun runtime
    break;
}
```

## isServerRuntime

Check if running in a server environment.

```ts
import { isServerRuntime } from "nevr-env";

if (isServerRuntime()) {
  // Safe to access server secrets
  console.log(process.env.DATABASE_URL);
} else {
  // Browser - don't expose secrets!
}
```

Returns `true` for Node.js, Deno, and Bun. Returns `false` when `window` is defined (browser), except for Deno which can have `window`.

## runtimeEnv

A Proxy-based environment object that works across runtimes. This is **not a function** — it's a Proxy object you use directly.

```ts
import { runtimeEnv } from "nevr-env";

// Automatically delegates to the correct env source:
// - process.env in Node.js
// - Deno.env in Deno
// - Bun.env in Bun
// - Internal shim in unknown runtimes

// Use directly (not as a function call)
const value = runtimeEnv.MY_VAR;

// Use as runtimeEnv in createEnv
import { createEnv } from "nevr-env";

const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  // Pass the proxy object directly
  runtimeEnv: runtimeEnv,
});
```

::: tip
In most cases, you can omit `runtimeEnv` entirely — `createEnv` uses `runtimeEnv` as the default when no `runtimeEnv`, `runtimeEnvStrict`, or `experimental__runtimeEnv` is provided.
:::

## getEnvVar

Safely get an environment variable with optional fallback.

```ts
import { getEnvVar } from "nevr-env";

// Returns undefined if not set
const apiKey = getEnvVar("API_KEY");

// With fallback value
const port = getEnvVar("PORT", "3000");
```

## getBooleanEnvVar

Parse boolean environment variables.

```ts
import { getBooleanEnvVar } from "nevr-env";

// Parses: "0", "false", "no", "" -> false
// Everything else -> true
const debug = getBooleanEnvVar("DEBUG");

// With default (default is true)
const verbose = getBooleanEnvVar("VERBOSE", false);
```

## ENV

Pre-configured environment accessor with common helpers.

```ts
import { ENV } from "nevr-env";

// Common getters
ENV.NODE_ENV;       // string (defaults to "development")
ENV.isProduction;   // boolean
ENV.isDevelopment;   // boolean
ENV.isTest;         // boolean
ENV.isCI;           // boolean
```

| Property | Type | Description |
|---|---|---|
| `NODE_ENV` | `string` | Current `NODE_ENV`, defaults to `"development"` |
| `isProduction` | `boolean` | `true` when `NODE_ENV === "production"` |
| `isDevelopment` | `boolean` | `true` when `NODE_ENV === "development"` or `"dev"` |
| `isTest` | `boolean` | `true` when `NODE_ENV === "test"` |
| `isCI` | `boolean` | `true` when `CI` env var is truthy |

## Platform-Specific Examples

### Node.js

```ts
import { createEnv } from "nevr-env";

const env = createEnv({
  server: { ... },
  runtimeEnv: process.env,
});
```

### Vite

```ts
import { createEnv } from "nevr-env";

const env = createEnv({
  client: { ... },
  clientPrefix: "VITE_",
  runtimeEnv: import.meta.env,
});
```

### Deno

```ts
import { createEnv } from "nevr-env";

const env = createEnv({
  server: { ... },
  runtimeEnv: Deno.env.toObject(),
});
```

### Cloudflare Workers

```ts
import { createEnv } from "nevr-env";

export default {
  async fetch(request, env) {
    const validatedEnv = createEnv({
      server: { ... },
      runtimeEnv: env, // Platform bindings
    });
  },
};
```
