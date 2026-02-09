# Express Integration

nevr-env works great with Express.js for type-safe server configuration.

## Setup

### 1. Install

```bash
npm install nevr-env zod
```

### 2. Create env.ts

```ts
// src/env.ts
import { createEnv, postgres, redis } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  plugins: [postgres(), redis()],
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default("0.0.0.0"),
    API_SECRET: z.string().min(32),
    CORS_ORIGIN: z.string().url().optional(),
  },
  runtimeEnv: process.env,
});
```

### 3. Use in Your App

```ts
// src/index.ts
import express from "express";
import { env } from "./env";

const app = express();

// Type-safe configuration
app.listen(env.PORT, env.HOST, () => {
  console.log(`Server running on ${env.HOST}:${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});
```

## Complete Example

```ts
// src/env.ts
import { createEnv, postgres } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  plugins: [postgres()],
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    PORT: z.coerce.number().default(3000),
    JWT_SECRET: z.string().min(32),
    CORS_ORIGINS: z.string().transform(s => s.split(",")),
  },
  runtimeEnv: process.env,
});
```

```ts
// src/index.ts
import express from "express";
import cors from "cors";
import { env } from "./env";

const app = express();

// CORS with validated origins
app.use(cors({
  origin: env.CORS_ORIGINS,
}));

// Database connection
import { Pool } from "pg";
const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

// Routes
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "healthy", env: env.NODE_ENV });
  } catch (error) {
    res.status(500).json({ status: "unhealthy" });
  }
});

// Start server
app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
```

## With TypeScript

Full type safety:

```ts
import { env } from "./env";

// TypeScript knows the types
const port: number = env.PORT;
const secret: string = env.JWT_SECRET;

// Autocomplete works
env. // Shows all available variables
```

## Configuration Patterns

### Database Config

```ts
import { Pool } from "pg";
import { env } from "./env";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});
```

### JWT Config

```ts
import jwt from "jsonwebtoken";
import { env } from "./env";

export function signToken(payload: object) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "1d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET);
}
```

### Rate Limiting

```ts
import rateLimit from "express-rate-limit";
import { env } from "./env";

export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === "production" ? 100 : 1000,
});
```

## Startup Validation

nevr-env validates on import, failing fast:

```bash
$ node dist/index.js

❌ Invalid environment variables:

  • DATABASE_URL: Required
  • JWT_SECRET: String must contain at least 32 character(s)

💡 Tip: Run `npx nevr-env fix` to interactively fix missing variables.
```

## Health Check Integration

```ts
import { healthCheck } from "nevr-env";
import { env } from "./env";

app.get("/health", (req, res) => {
  const result = healthCheck({
    server: {
      DATABASE_URL: z.string().url(),
      REDIS_URL: z.string().url(),
    },
    runtimeEnv: process.env,
  });
  
  res.status(result.status === "healthy" ? 200 : 500).json(result);
});
```
