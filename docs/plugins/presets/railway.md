# Railway Preset

The Railway preset provides automatic validation for all Railway system environment variables.

## Installation

```ts
import { railway } from "nevr-env/presets/railway";
```

## Usage

```ts
import { createEnv } from "nevr-env";
import { railway } from "nevr-env/presets/railway";

export const env = createEnv({
  plugins: [railway()],
  server: {
    DATABASE_URL: z.string().url(),
  },
  runtimeEnv: process.env,
});

// Access Railway variables
env.RAILWAY_ENVIRONMENT; // "production" | "staging"
env.RAILWAY_PUBLIC_DOMAIN; // Deployment URL
```

## Included Variables

All Railway system environment variables are automatically typed:

| Variable | Type | Description |
|----------|------|-------------|
| `RAILWAY_ENVIRONMENT` | `string?` | Environment name |
| `RAILWAY_ENVIRONMENT_ID` | `string?` | Environment UUID |
| `RAILWAY_ENVIRONMENT_NAME` | `string?` | Human-readable env name |
| `RAILWAY_SERVICE_ID` | `string?` | Service UUID |
| `RAILWAY_SERVICE_NAME` | `string?` | Service name |
| `RAILWAY_PROJECT_ID` | `string?` | Project UUID |
| `RAILWAY_PROJECT_NAME` | `string?` | Project name |
| `RAILWAY_DEPLOYMENT_ID` | `string?` | Current deployment UUID |
| `RAILWAY_REPLICA_ID` | `string?` | Replica UUID |
| `RAILWAY_PUBLIC_DOMAIN` | `string?` | Public domain |
| `RAILWAY_PRIVATE_DOMAIN` | `string?` | Private network domain |
| `RAILWAY_STATIC_URL` | `string?` | Static asset URL |
| `RAILWAY_GIT_COMMIT_SHA` | `string?` | Git commit SHA |
| `RAILWAY_GIT_AUTHOR` | `string?` | Git author |
| `RAILWAY_GIT_BRANCH` | `string?` | Git branch name |
| `RAILWAY_GIT_REPO_NAME` | `string?` | Repository name |
| `RAILWAY_GIT_REPO_OWNER` | `string?` | Repository owner |
| `RAILWAY_GIT_COMMIT_MESSAGE` | `string?` | Commit message |

## Helper Functions

### isRailway()

Check if running on Railway:

```ts
import { isRailway } from "nevr-env/presets/railway";

if (isRailway()) {
  console.log("Running on Railway!");
}
```

### isRailwayProduction()

Check if running in production environment:

```ts
import { isRailwayProduction } from "nevr-env/presets/railway";

if (isRailwayProduction()) {
  enableProductionMode();
}
```

### getRailwayUrl()

Get the deployment URL with protocol:

```ts
import { getRailwayUrl } from "nevr-env/presets/railway";

const url = getRailwayUrl(); // https://myapp.up.railway.app
```

## Examples

### Basic Setup

```ts
// env.ts
import { createEnv } from "nevr-env";
import { railway } from "nevr-env/presets/railway";
import { z } from "zod";

export const env = createEnv({
  plugins: [railway()],
  server: {
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
  },
  runtimeEnv: process.env,
});
```

### Private Networking

Railway provides private networking between services:

```ts
import { createEnv } from "nevr-env";
import { railway } from "nevr-env/presets/railway";

const env = createEnv({
  plugins: [railway()],
  runtimeEnv: process.env,
});

// Use private domain for internal service communication
const internalApiUrl = `http://${env.RAILWAY_PRIVATE_DOMAIN}:3000`;
```

### Multi-Environment Setup

```ts
import { railway, isRailwayProduction } from "nevr-env/presets/railway";

const env = createEnv({
  plugins: [railway()],
  server: {
    DATABASE_URL: z.string().url(),
    LOG_LEVEL: z
      .enum(["debug", "info", "warn", "error"])
      .default(isRailwayProduction() ? "info" : "debug"),
  },
  runtimeEnv: process.env,
});
```

### Deployment Tracking

```ts
import { railway } from "nevr-env/presets/railway";

const env = createEnv({
  plugins: [railway()],
  runtimeEnv: process.env,
});

// Log deployment info
console.log(`
  Service: ${env.RAILWAY_SERVICE_NAME}
  Project: ${env.RAILWAY_PROJECT_NAME}
  Environment: ${env.RAILWAY_ENVIRONMENT_NAME}
  Commit: ${env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7)}
  Branch: ${env.RAILWAY_GIT_BRANCH}
`);
```

## Railway Features

### Database Integration

Railway automatically injects database URLs:

```ts
const env = createEnv({
  plugins: [railway()],
  server: {
    // Railway auto-injects these for linked services
    DATABASE_URL: z.string().url(),        // PostgreSQL
    REDIS_URL: z.string().url().optional(), // Redis
    MYSQL_URL: z.string().url().optional(), // MySQL
    MONGODB_URL: z.string().url().optional(), // MongoDB
  },
  runtimeEnv: process.env,
});
```

### Health Checks

```ts
// Railway expects a health check endpoint
// Use environment variables to configure

const env = createEnv({
  plugins: [railway()],
  server: {
    PORT: z.coerce.number().default(3000),
    RAILWAY_HEALTHCHECK_TIMEOUT_SEC: z.coerce.number().default(300),
  },
  runtimeEnv: process.env,
});

// Start server on Railway's expected port
app.listen(env.PORT);
```

### Volume Mounts

```ts
const env = createEnv({
  plugins: [railway()],
  server: {
    // Path to mounted volume
    RAILWAY_VOLUME_MOUNT_PATH: z.string().optional(),
  },
  runtimeEnv: process.env,
});

// Use volume for persistent data
const dataPath = env.RAILWAY_VOLUME_MOUNT_PATH || "./data";
```

## TypeScript Types

```ts
import type { RailwayEnv } from "nevr-env/presets/railway";

interface RailwayEnv {
  RAILWAY_ENVIRONMENT?: string;
  RAILWAY_ENVIRONMENT_ID?: string;
  RAILWAY_ENVIRONMENT_NAME?: string;
  RAILWAY_SERVICE_ID?: string;
  RAILWAY_SERVICE_NAME?: string;
  RAILWAY_PROJECT_ID?: string;
  RAILWAY_PROJECT_NAME?: string;
  RAILWAY_DEPLOYMENT_ID?: string;
  RAILWAY_REPLICA_ID?: string;
  RAILWAY_PUBLIC_DOMAIN?: string;
  RAILWAY_PRIVATE_DOMAIN?: string;
  RAILWAY_STATIC_URL?: string;
  RAILWAY_GIT_COMMIT_SHA?: string;
  RAILWAY_GIT_AUTHOR?: string;
  RAILWAY_GIT_BRANCH?: string;
  RAILWAY_GIT_REPO_NAME?: string;
  RAILWAY_GIT_REPO_OWNER?: string;
  RAILWAY_GIT_COMMIT_MESSAGE?: string;
}
```

## Best Practices

1. **Use private networking** for service-to-service communication
2. **Enable health checks** for better reliability
3. **Use volumes** for persistent data
4. **Configure replicas** through Railway dashboard

```ts
// Production-ready Railway setup
const env = createEnv({
  plugins: [railway()],
  server: {
    // Required
    DATABASE_URL: z.string().url(),
    
    // Railway provides
    PORT: z.coerce.number().default(3000),
    
    // Optional services
    REDIS_URL: z.string().url().optional(),
  },
  runtimeEnv: process.env,
});
```
