# @nevr-env/core

Type-safe environment validation with a plugin system, Proxy pattern, and zero required dependencies.

## Install

```bash
pnpm add @nevr-env/core zod
```

## Usage

```typescript
import { createEnv } from "@nevr-env/core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string().min(32),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});

// Fully typed — env.DATABASE_URL is string, env.API_SECRET is string
```

## Features

- **Type-safe** — Full TypeScript inference from schemas, no codegen needed
- **Plugin system** — `createPlugin()` factory for declarative env definitions
- **Multi-library** — Works with Zod, Valibot, ArkType, or any Standard Schema
- **Proxy-based** — Server variables throw if accessed on the client
- **Zero required deps** — Core has no runtime dependencies (schema libs are optional peers)

## Built-in Schema Helpers

Skip Zod entirely with lightweight built-in validators:

```typescript
import { urlSchema, portSchema, booleanSchema } from "@nevr-env/core";

const env = createEnv({
  server: {
    API_URL: urlSchema(),
    PORT: portSchema(),
    DEBUG: booleanSchema(false),
  },
  runtimeEnv: process.env,
});
```

## Batteries-included Package

For plugins, vault, CLI, and presets, install the umbrella package instead:

```bash
pnpm add nevr-env zod
```
## Ecosystem

| Package | Description |
|---------|-------------|
| [`nevr-env`](https://www.npmjs.com/package/nevr-env) | The umbrella package — includes everything: core, plugins, presets, vault, and CLI |
| [`@nevr-env/cli`](https://www.npmjs.com/package/@nevr-env/cli) | Interactive CLI — fix wizard, scanner, vault, schema diff, and 12 more commands |
  
See [nevr-env on npm](https://www.npmjs.com/package/nevr-env) or the [full documentation](https://nevr-ts.github.io/nevr-env/).

## License

[MIT](LICENSE) — Built with obsession by the nevr-env contributors.
