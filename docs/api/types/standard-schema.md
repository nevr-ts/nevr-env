# StandardSchema

nevr-env uses [Standard Schema](https://github.com/standard-schema/standard-schema) for validation library agnosticism.

## Overview

Standard Schema is a specification that allows validation libraries to expose a common interface. This means nevr-env works with any compatible validation library.

## Supported Libraries

| Library | Version | Notes |
|---------|---------|-------|
| [Zod](https://zod.dev) | 3.x | Full support |
| [Valibot](https://valibot.dev) | 0.28+ | Full support |
| [ArkType](https://arktype.io) | 2.x | Full support |
| [Yup](https://github.com/jquense/yup) | 1.x | Via adapter |
| [Joi](https://joi.dev) | 17.x | Via adapter |

## StandardSchemaV1

The core interface all validators must implement.

```ts
interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown
    ) => StandardSchemaV1.Result<Output>;
    readonly types?: StandardSchemaV1.Types<Input, Output>;
  };
}
```

## Result Type

Validation result structure.

```ts
namespace StandardSchemaV1 {
  type Result<Output> =
    | { readonly value: Output; readonly issues?: undefined }
    | { readonly issues: readonly Issue[] };
}
```

## Issue Type

Validation error structure.

```ts
namespace StandardSchemaV1 {
  interface Issue {
    readonly message: string;
    readonly path?: readonly (string | number | symbol)[];
  }
}
```

## Using with Zod

```ts
import { createEnv } from "nevr-env";
import { z } from "zod";

const env = createEnv({
  server: {
    // Zod schemas are StandardSchema compatible
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().int().min(1).max(65535),
    NODE_ENV: z.enum(["development", "test", "production"]),
  },
  runtimeEnv: process.env,
});
```

## Using with Valibot

```ts
import { createEnv } from "nevr-env";
import * as v from "valibot";

const env = createEnv({
  server: {
    // Valibot schemas are StandardSchema compatible
    DATABASE_URL: v.pipe(v.string(), v.url()),
    PORT: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
    NODE_ENV: v.picklist(["development", "test", "production"]),
  },
  runtimeEnv: process.env,
});
```

## Using with ArkType

```ts
import { createEnv } from "nevr-env";
import { type } from "arktype";

const env = createEnv({
  server: {
    // ArkType schemas are StandardSchema compatible
    DATABASE_URL: type("string").narrow((s) => s.startsWith("postgres://")),
    PORT: type("string").pipe((s) => parseInt(s)),
    NODE_ENV: type("'development' | 'test' | 'production'"),
  },
  runtimeEnv: process.env,
});
```

## Type Inference

Standard Schema enables type inference across libraries.

```ts
import type { StandardSchemaV1 } from "nevr-env";

// Extract output type from any StandardSchema
type InferOutput<T extends StandardSchemaV1> = 
  T["~standard"]["types"] extends { readonly output: infer O } 
    ? O 
    : never;

// Works with any library
import { z } from "zod";
type StringOutput = InferOutput<typeof z.string>; // string
```

## Creating Custom Validators

You can create custom validators that implement Standard Schema.

```ts
import type { StandardSchemaV1 } from "nevr-env";

function customUrl(): StandardSchemaV1<string, URL> {
  return {
    "~standard": {
      version: 1,
      vendor: "custom",
      validate(value) {
        if (typeof value !== "string") {
          return {
            issues: [{ message: "Expected string" }],
          };
        }
        try {
          return { value: new URL(value) };
        } catch {
          return {
            issues: [{ message: "Invalid URL" }],
          };
        }
      },
    },
  };
}

// Use in createEnv
const env = createEnv({
  server: {
    API_URL: customUrl(),
  },
  runtimeEnv: process.env,
});

env.API_URL; // URL object, not string!
```

## Schema Composition

Standard Schema allows mixing validators from different libraries.

```ts
import { createEnv } from "nevr-env";
import { z } from "zod";
import * as v from "valibot";
import { type } from "arktype";

const env = createEnv({
  server: {
    // Mix and match validation libraries!
    DATABASE_URL: z.string().url(),
    PORT: v.pipe(v.string(), v.transform(Number)),
    NODE_ENV: type("'development' | 'test' | 'production'"),
  },
  runtimeEnv: process.env,
});
```

::: warning
While mixing libraries works, we recommend sticking to one library per project for consistency and bundle size optimization.
:::

## Library Adapters

For libraries that don't natively support Standard Schema, nevr-env provides adapters.

```ts
import { createEnv, adapters } from "nevr-env";
import Joi from "joi";

// Wrap Joi schema with adapter
const joiString = adapters.joi(Joi.string().required());

const env = createEnv({
  server: {
    API_KEY: joiString,
  },
  runtimeEnv: process.env,
});
```
