# createEnv

The main function to create a type-safe environment configuration.

## Signature

```typescript
function createEnv<
  TPrefix extends string | undefined,
  TServer extends StandardSchemaDictionary,
  TClient extends StandardSchemaDictionary,
  TShared extends StandardSchemaDictionary,
  TExtends extends Record<string, unknown>[],
  TPlugins extends NevrEnvPlugin[]
>(options: EnvOptions): CreateEnvResult
```

## Options

### `server`

Server-side environment variables. These are validated on the server and protected from client access.

```typescript
createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string().min(32),
  },
  runtimeEnv: process.env,
});
```

### `client`

Client-side environment variables. Must use the `clientPrefix`.

```typescript
createEnv({
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_APP_NAME: z.string(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});
```

### `shared`

Variables available on both server and client.

```typescript
createEnv({
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  runtimeEnv: process.env,
});
```

### `clientPrefix`

Required prefix for client-side variables. Helps prevent accidental server variable exposure.

```typescript
createEnv({
  clientPrefix: "NEXT_PUBLIC_", // Next.js
  // or
  clientPrefix: "VITE_", // Vite
  // or
  clientPrefix: "EXPO_PUBLIC_", // Expo
});
```

### `runtimeEnv`

Source of environment variables. Usually `process.env`.

```typescript
createEnv({
  runtimeEnv: process.env,
});
```

### `runtimeEnvStrict`

Explicit list of runtime variables. More strict than `runtimeEnv`.

```typescript
createEnv({
  server: {
    API_KEY: z.string(),
  },
  runtimeEnvStrict: {
    API_KEY: process.env.API_KEY,
  },
});
```

### `experimental__runtimeEnv`

For Next.js 13.4.4+. Only client variables need explicit destructuring.

```typescript
createEnv({
  server: {
    DATABASE_URL: z.string().url(), // Auto from process.env
  },
  client: {
    NEXT_PUBLIC_URL: z.string().url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
  },
});
```

### `plugins`

Array of nevr-env plugins.

```typescript
import { createEnv, postgres, stripe } from "nevr-env";

createEnv({
  plugins: [
    postgres(),
    stripe({ webhook: true }),
  ],
  runtimeEnv: process.env,
});
```

### `extends`

Extend from other env configurations.

```typescript
import { baseEnv } from "./base-env";

createEnv({
  extends: [baseEnv],
  server: {
    EXTRA_VAR: z.string(),
  },
  runtimeEnv: process.env,
});
```

### `emptyStringAsUndefined`

Treat empty strings as undefined. Default: `false`.

```typescript
createEnv({
  emptyStringAsUndefined: true,
  // Now: PORT="" is treated as PORT=undefined
});
```

### `skipValidation`

Skip validation (for build time). Default: `false`.

```typescript
createEnv({
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
```

### `isServer`

Override server detection.

```typescript
createEnv({
  isServer: typeof window === "undefined",
});
```

### `onValidationError`

Custom error handler for validation failures.

```typescript
createEnv({
  onValidationError: (issues) => {
    console.error("ENV VALIDATION FAILED:");
    issues.forEach((issue) => {
      console.error(`  ${issue.path}: ${issue.message}`);
    });
    process.exit(1);
  },
});
```

### `onInvalidAccess`

Custom error handler for invalid client access to server variables.

```typescript
createEnv({
  onInvalidAccess: (varName) => {
    throw new Error(`Cannot access ${varName} on client`);
  },
});
```

### `validationMode`

Control how validation errors are handled. Default: `"strict"`.

- `"strict"` — throws on validation error (default)
- `"warn"` — logs warnings and continues with potentially invalid env

```typescript
createEnv({
  server: { ... },
  validationMode: "warn", // Log warnings instead of throwing
  runtimeEnv: process.env,
});
```

::: warning
Never use `"warn"` mode in production for security-critical variables.
:::

### `debug`

Enable verbose logging for troubleshooting. Default: `false`.

```typescript
createEnv({
  server: { ... },
  debug: true,
  runtimeEnv: process.env,
});
// Logs: schema keys, available env keys, server detection result
```

### `onSuccess`

Callback invoked after successful validation. Useful for logging, telemetry, or initializing services.

```typescript
createEnv({
  server: { ... },
  onSuccess: (env) => {
    console.log("Environment validated with", Object.keys(env).length, "keys");
  },
  runtimeEnv: process.env,
});
```

### `createFinalSchema`

Custom schema combination for cross-field validation.

```typescript
createEnv({
  server: {
    DB_HOST: z.string(),
    DB_PORT: z.coerce.number(),
  },
  createFinalSchema: (shape, isServer) => {
    return z.object(shape).refine(
      (data) => data.DB_HOST || data.DATABASE_URL,
      { message: "Either DB_HOST or DATABASE_URL required" }
    );
  },
});
```

## Return Value

Returns a `Readonly` proxy object with all validated environment variables.

```typescript
const env = createEnv({ ... });

// Access variables
env.DATABASE_URL; // string
env.NODE_ENV; // "development" | "production" | "test"

// Type error for non-existent
env.TYPO; // ❌ TypeScript error

// Runtime error on client for server vars
env.API_SECRET; // ❌ Throws on client
```

## Examples

### Basic Next.js

```typescript
import { createEnv } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});
```

### With Plugins

```typescript
import { createEnv } from "nevr-env";
import { postgres, stripe } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  plugins: [
    postgres({ directUrl: true }),
    stripe({ webhook: true }),
  ],
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  client: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});
```

### Vite

```typescript
import { createEnv } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {
    VITE_API_URL: z.string().url(),
  },
  clientPrefix: "VITE_",
  runtimeEnv: import.meta.env,
});
```
