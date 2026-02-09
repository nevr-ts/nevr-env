# Schema Helpers

Built-in schema helpers for common validation patterns. These implement Standard Schema V1 directly — no zod dependency required.

All helpers are imported from the core package:

```ts
import { urlSchema, portSchema, booleanSchema, enumSchema, stringSchema, optionalSchema } from "nevr-env";
```

## urlSchema

Validates URL strings with optional protocol restriction.

```ts
urlSchema(protocols?: string[])
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `protocols` | `string[]` | `["http", "https"]` | Allowed URL protocols |

```ts
const env = createEnv({
  server: {
    API_URL: urlSchema(),                    // any http/https URL
    WEBHOOK_URL: urlSchema(["https"]),       // HTTPS only
    DATABASE_URL: urlSchema(["postgres", "postgresql"]),
  },
  runtimeEnv: process.env,
});
```

## portSchema

Validates and coerces port numbers from strings.

```ts
portSchema(min?: number, max?: number)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `min` | `number` | `1` | Minimum port number |
| `max` | `number` | `65535` | Maximum port number |

```ts
const env = createEnv({
  server: {
    PORT: portSchema(),                 // 1–65535
    ADMIN_PORT: portSchema(1024, 49151), // non-privileged only
  },
  runtimeEnv: process.env,
});

env.PORT // number (coerced from string "3000" → 3000)
```

## booleanSchema

Parses boolean-like strings (`"true"`, `"1"`, `"yes"`, `"on"` → `true`; `"false"`, `"0"`, `"no"`, `"off"` → `false`).

```ts
booleanSchema(defaultValue?: boolean)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `defaultValue` | `boolean` | `undefined` | Value when env var is undefined |

```ts
const env = createEnv({
  server: {
    DEBUG: booleanSchema(false),    // defaults to false
    VERBOSE: booleanSchema(),       // required
  },
  runtimeEnv: process.env,
});

env.DEBUG // boolean
```

## stringSchema

Validates strings with optional length and pattern constraints.

```ts
stringSchema(options?: { min?: number; max?: number; pattern?: RegExp; message?: string })
```

| Option | Type | Description |
|--------|------|-------------|
| `min` | `number` | Minimum length |
| `max` | `number` | Maximum length |
| `pattern` | `RegExp` | Required regex pattern |
| `message` | `string` | Custom error message |

```ts
const env = createEnv({
  server: {
    API_KEY: stringSchema({ min: 32 }),
    APP_NAME: stringSchema({ max: 100 }),
    SLUG: stringSchema({ pattern: /^[a-z0-9-]+$/, message: "Must be a valid slug" }),
  },
  runtimeEnv: process.env,
});
```

## enumSchema

Validates against a list of allowed string values. The return type is narrowed to the union of provided values.

```ts
enumSchema<T extends string>(values: readonly T[])
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `values` | `readonly T[]` | Allowed string values |

```ts
const env = createEnv({
  server: {
    NODE_ENV: enumSchema(["development", "test", "production"]),
    LOG_LEVEL: enumSchema(["debug", "info", "warn", "error"]),
  },
  runtimeEnv: process.env,
});

env.NODE_ENV  // "development" | "test" | "production"
env.LOG_LEVEL // "debug" | "info" | "warn" | "error"
```

## optionalSchema

Wraps any schema to accept `undefined`, `null`, or empty string `""`.

```ts
optionalSchema<T>(schema: StandardSchemaV1<unknown, T>)
```

```ts
const env = createEnv({
  server: {
    API_URL: optionalSchema(urlSchema()),      // string | undefined
    BACKUP_PORT: optionalSchema(portSchema()),  // number | undefined
  },
  runtimeEnv: process.env,
});
```

## Combining Helpers

```ts
import { createEnv, urlSchema, portSchema, booleanSchema, enumSchema, optionalSchema } from "nevr-env";

const env = createEnv({
  server: {
    DATABASE_URL: urlSchema(["postgres", "postgresql"]),
    PORT: portSchema(),
    DEBUG: booleanSchema(false),
    NODE_ENV: enumSchema(["development", "test", "production"]),
    SENTRY_DSN: optionalSchema(urlSchema()),
  },
  runtimeEnv: process.env,
});
```

## Using with Zod Instead

The built-in helpers are zero-dependency Standard Schema implementations. If you prefer zod, you can use zod schemas directly — they also implement Standard Schema:

```ts
import { z } from "zod";

const env = createEnv({
  server: {
    PORT: z.coerce.number().min(1).max(65535),
    DEBUG: z.enum(["true", "false"]).transform(v => v === "true"),
    API_URL: z.string().url(),
  },
  runtimeEnv: process.env,
});
```

Both approaches are fully interchangeable. Mix and match as needed.

## Custom Schema Helpers

Create your own reusable helpers following the Standard Schema V1 interface:

```ts
import type { StandardSchemaV1 } from "nevr-env";

export function emailSchema(domain?: string): StandardSchemaV1<string, string> {
  return {
    "~standard": {
      version: 1,
      vendor: "my-app",
      validate: (value) => {
        if (typeof value !== "string" || !value.includes("@")) {
          return { issues: [{ message: "Invalid email", path: [] }] };
        }
        if (domain && !value.endsWith(`@${domain}`)) {
          return { issues: [{ message: `Must be a @${domain} email`, path: [] }] };
        }
        return { value };
      },
    },
  };
}
```

Or use zod for convenience:

```ts
import { z } from "zod";

export const apiKeySchema = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[a-zA-Z0-9]{32,}$`));

export const durationSchema = () =>
  z.string().transform((val) => {
    const match = val.match(/^(\d+)(s|m|h|d)$/);
    if (!match) throw new Error("Invalid duration");
    const [, num, unit] = match;
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
    return parseInt(num) * multipliers[unit as keyof typeof multipliers];
  });
```

## Type Exports

```ts
import type {
  StandardSchemaV1,
  StandardSchemaDictionary,
  InferDictionary,
} from "nevr-env";

// StandardSchemaDictionary = Record<string, StandardSchemaV1>
// InferDictionary<T> infers the output types from a schema dictionary
```