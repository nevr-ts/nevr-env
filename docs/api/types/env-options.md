# EnvOptions

Configuration options for `createEnv`.

## Type Definition

```ts
interface EnvOptions<
  TServer extends StandardSchemaDictionary,
  TClient extends StandardSchemaDictionary,
  TShared extends StandardSchemaDictionary,
  TPlugins extends NevrEnvPlugin[]
> {
  // Schema definitions
  server?: TServer;
  client?: TClient;
  shared?: TShared;
  
  // Plugins
  plugins?: TPlugins;
  
  // Runtime environment
  runtimeEnv: Record<string, string | undefined>;
  
  // Client variable prefix
  clientPrefix?: string;
  
  // Validation behavior
  validationMode?: "strict" | "warn" | "skip";
  skipValidation?: boolean;
  
  // Callbacks
  onValidationError?: (issues: StandardSchemaV1.Issue[]) => never;
  onInvalidAccess?: (variableName: string) => never;
  onSuccess?: (env: Record<string, unknown>) => void;
}
```

## Properties

### `server`

Schema for server-only environment variables.

```ts
createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string(),
  },
  // ...
});
```

### `client`

Schema for client-safe environment variables.

```ts
createEnv({
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  // ...
});
```

### `shared`

Schema for variables available in both server and client.

```ts
createEnv({
  shared: {
    NODE_ENV: z.enum(["development", "test", "production"]),
  },
  // ...
});
```

### `plugins`

Array of plugins to merge into the schema.

```ts
createEnv({
  plugins: [postgres(), stripe()],
  // ...
});
```

### `runtimeEnv`

The runtime environment object to validate against.

```ts
// Node.js
createEnv({
  runtimeEnv: process.env,
});

// Vite
createEnv({
  runtimeEnv: import.meta.env,
});
```

### `clientPrefix`

Required prefix for client variables.

```ts
createEnv({
  clientPrefix: "NEXT_PUBLIC_", // Next.js
  // clientPrefix: "VITE_",     // Vite
  // clientPrefix: "PUBLIC_",    // Remix
});
```

### `validationMode`

How to handle validation errors.

```ts
createEnv({
  validationMode: "strict", // Default: throw on errors
  // validationMode: "warn", // Log warnings, don't throw
  // validationMode: "skip", // Skip validation entirely
});
```

### `skipValidation`

Skip validation entirely (useful for build scripts).

```ts
createEnv({
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
```

### `onValidationError`

Custom handler for validation errors.

```ts
createEnv({
  onValidationError: (issues) => {
    console.error("Config error:", issues);
    process.exit(1);
  },
});
```

### `onInvalidAccess`

Custom handler when server variables are accessed from client.

```ts
createEnv({
  onInvalidAccess: (variableName) => {
    throw new Error(`Cannot access ${variableName} on client`);
  },
});
```

### `onSuccess`

Callback after successful validation.

```ts
createEnv({
  onSuccess: (env) => {
    console.log("Environment validated:", Object.keys(env));
  },
});
```

## Example

```ts
import { createEnv, postgres, stripe } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  plugins: [postgres(), stripe()],
  
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    API_SECRET: z.string().min(32),
  },
  
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  
  shared: {
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  },
  
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
  validationMode: "strict",
  
  onSuccess: (env) => {
    console.log(`✅ Environment validated (${env.NODE_ENV})`);
  },
});
```
