# Schema Validation

nevr-env uses the [Standard Schema V1](https://github.com/standard-schema/standard-schema) interface for type-safe environment variable validation. This means you can use **Zod**, **Valibot**, **ArkType**, or any Standard Schema-compliant validator. This ensures your app fails fast if environment variables are missing or invalid.

## Basic Schema

```ts
import { createEnv } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    API_KEY: z.string().min(1),
    PORT: z.coerce.number().default(3000),
  },
  runtimeEnv: process.env,
});
```

## Validation Rules

### Required vs Optional

```ts
const env = createEnv({
  server: {
    // Required - will throw if missing
    DATABASE_URL: z.string().url(),
    
    // Optional - undefined if missing
    DEBUG: z.string().optional(),
    
    // Default - uses default if missing
    PORT: z.coerce.number().default(3000),
  },
  runtimeEnv: process.env,
});
```

### Type Coercion

Environment variables are always strings. Use `z.coerce` for automatic conversion:

```ts
const env = createEnv({
  server: {
    // String to number
    PORT: z.coerce.number(),
    
    // String to boolean
    DEBUG: z.coerce.boolean(),
    
    // String to date
    START_DATE: z.coerce.date(),
  },
  runtimeEnv: process.env,
});
```

### Custom Validation

```ts
const env = createEnv({
  server: {
    // Must be valid URL
    API_URL: z.string().url(),
    
    // Must be valid email
    ADMIN_EMAIL: z.string().email(),
    
    // Enum values
    NODE_ENV: z.enum(["development", "test", "production"]),
    
    // Custom regex
    API_KEY: z.string().regex(/^sk_[a-zA-Z0-9]{32}$/),
    
    // Custom validator
    DATABASE_URL: z.string().refine(
      (url) => url.startsWith("postgres://"),
      "Must be a PostgreSQL connection string"
    ),
  },
  runtimeEnv: process.env,
});
```

## Schema Helpers

nevr-env provides built-in schema helpers for common patterns:

```ts
import { createEnv, urlSchema, portSchema, booleanSchema } from "nevr-env";

const env = createEnv({
  server: {
    API_URL: urlSchema(),           // z.string().url()
    PORT: portSchema(),             // z.coerce.number().min(1).max(65535)
    DEBUG: booleanSchema(),         // z.coerce.boolean()
  },
  runtimeEnv: process.env,
});
```

## Validation Errors

When validation fails, nevr-env provides helpful error messages:

```
❌ Invalid environment variables:

  • DATABASE_URL: Required
  • PORT: Expected number, received nan
  • NODE_ENV: Invalid enum value. Expected 'development' | 'test' | 'production'

💡 Tip: Run `npx nevr-env fix` to interactively fix missing variables.
```

## Custom Error Handling

```ts
const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  runtimeEnv: process.env,
  onValidationError: (issues) => {
    // Custom error handling
    console.error("Config error:", issues);
    process.exit(1);
  },
});
```

## Transform Values

Transform values after validation:

```ts
const env = createEnv({
  server: {
    // Parse JSON
    CONFIG: z.string().transform((s) => JSON.parse(s)),
    
    // Parse comma-separated list
    ALLOWED_ORIGINS: z.string().transform((s) => s.split(",")),
    
    // Uppercase
    LOG_LEVEL: z.string().transform((s) => s.toUpperCase()),
  },
  runtimeEnv: process.env,
});
```
