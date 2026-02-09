# Hono Integration

nevr-env integrates seamlessly with Hono for edge-first applications.

## Setup

### 1. Install

```bash
npm install nevr-env zod hono
```

### 2. Create env.ts

```ts
// src/env.ts
import { createEnv } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string().min(32),
    NODE_ENV: z.enum(["development", "test", "production"]),
  },
  runtimeEnv: process.env,
});
```

### 3. Use in Your App

```ts
// src/index.ts
import { Hono } from "hono";
import { env } from "./env";

const app = new Hono();

app.get("/", (c) => {
  return c.json({ 
    message: "Hello!",
    env: env.NODE_ENV 
  });
});

export default app;
```

## With Cloudflare Workers

For Cloudflare Workers, use bindings:

```ts
// src/env.ts
import { createEnv } from "nevr-env";
import { z } from "zod";

// Define the schema
export const envSchema = {
  DATABASE_URL: z.string().url(),
  API_SECRET: z.string(),
};

// Create env from bindings
export function getEnv(bindings: Record<string, string>) {
  return createEnv({
    server: envSchema,
    runtimeEnv: bindings,
  });
}
```

```ts
// src/index.ts
import { Hono } from "hono";
import { getEnv } from "./env";

type Bindings = {
  DATABASE_URL: string;
  API_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  const env = getEnv(c.env);
  return c.json({ url: env.DATABASE_URL });
});

export default app;
```

## With Bun

```ts
// src/index.ts
import { Hono } from "hono";
import { env } from "./env";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    database: env.DATABASE_URL ? "connected" : "missing",
  });
});

export default {
  port: 3000,
  fetch: app.fetch,
};
```

## Middleware Pattern

Create validated middleware:

```ts
import { Hono } from "hono";
import { createEnv } from "nevr-env";
import { z } from "zod";

const app = new Hono();

// Validate env on every request (for edge environments)
app.use("*", async (c, next) => {
  const env = createEnv({
    server: {
      API_KEY: z.string(),
    },
    runtimeEnv: c.env,
  });
  
  c.set("env", env);
  await next();
});

app.get("/", (c) => {
  const env = c.get("env");
  return c.json({ hasKey: !!env.API_KEY });
});
```

## With Plugins

```ts
import { createEnv, postgres } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  plugins: [postgres()],
  server: {
    NODE_ENV: z.enum(["development", "production"]),
  },
  runtimeEnv: process.env,
});
```

## Health Check Route

```ts
import { Hono } from "hono";
import { healthCheck } from "nevr-env";
import { z } from "zod";

const app = new Hono();

app.get("/health", (c) => {
  const result = healthCheck({
    server: {
      DATABASE_URL: z.string().url(),
    },
    runtimeEnv: process.env,
  });
  
  return c.json(result, result.status === "healthy" ? 200 : 500);
});
```

## Edge Runtime Considerations

1. **No filesystem access** - Can't read `.env` files
2. **Bindings-based** - Use platform bindings (Cloudflare, Vercel Edge)
3. **Validate per-request** - Bindings may vary by request

```ts
// For edge: validate from bindings
app.use("*", async (c, next) => {
  try {
    const env = createEnv({
      server: { API_KEY: z.string() },
      runtimeEnv: c.env, // Platform bindings
    });
    c.set("env", env);
    await next();
  } catch (error) {
    return c.json({ error: "Invalid configuration" }, 500);
  }
});
```
