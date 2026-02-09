# Health Check

Monitor environment variable health in production with built-in health check utilities.

## Quick Start

```typescript
import { healthCheck, createHealthEndpoint } from "nevr-env";

// Check health programmatically
const result = healthCheck({
  server: envSchema.server,
  plugins: [postgres(), stripe()],
  runtimeEnv: process.env,
});

console.log(result.status); // "healthy" | "degraded" | "unhealthy"
```

## Express Integration

```typescript
import express from "express";
import { createHealthEndpoint, postgres, stripe } from "nevr-env";

const app = express();

// Add health check endpoint
app.get("/health/env", createHealthEndpoint({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "production"]),
  },
  plugins: [postgres(), stripe()],
}));

app.listen(3000);
```

## Next.js API Route

```typescript
// app/api/health/env/route.ts
import { createHealthEndpoint, postgres } from "nevr-env";

export const GET = createHealthEndpoint({
  server: envSchema.server,
  plugins: [postgres()],
});
```

## Response Format

```json
{
  "status": "healthy",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "summary": {
    "total": 8,
    "valid": 8,
    "invalid": 0,
    "missing": 0
  },
  "variables": [
    {
      "name": "DATABASE_URL",
      "valid": true,
      "present": true,
      "source": "PostgreSQL",
      "sensitive": true
    },
    {
      "name": "STRIPE_SECRET_KEY",
      "valid": true,
      "present": true,
      "source": "Stripe",
      "sensitive": true
    },
    {
      "name": "NODE_ENV",
      "valid": true,
      "present": true,
      "source": "custom",
      "sensitive": false
    }
  ]
}
```

## Status Codes

| Status | HTTP Code | Description |
|--------|-----------|-------------|
| `healthy` | 200 | All variables valid |
| `degraded` | 503 | Some optional variables missing |
| `unhealthy` | 503 | Required variables invalid/missing |

## Options

```typescript
healthCheck({
  // Schema definitions
  server: { ... },
  client: { ... },
  shared: { ... },
  plugins: [...],
  
  // Runtime environment source
  runtimeEnv: process.env,
  
  // Mark additional keys as sensitive (masked in output)
  sensitiveKeys: ["CUSTOM_API_TOKEN"],
  
  // Include non-sensitive values in response (for debugging)
  includeValues: false,
});
```

## Kubernetes Liveness/Readiness Probes

```yaml
# deployment.yaml
spec:
  containers:
    - name: app
      livenessProbe:
        httpGet:
          path: /health/env
          port: 3000
        initialDelaySeconds: 10
        periodSeconds: 30
      readinessProbe:
        httpGet:
          path: /health/env
          port: 3000
        initialDelaySeconds: 5
        periodSeconds: 10
```

## Monitoring Integration

```typescript
import { healthCheck } from "nevr-env";

// Periodic health check with alerting
setInterval(async () => {
  const result = healthCheck({
    server: envSchema.server,
    plugins: [postgres()],
    runtimeEnv: process.env,
  });
  
  if (result.status === "unhealthy") {
    // Send alert
    await slack.send({
      channel: "#alerts",
      text: `⚠️ Environment unhealthy: ${result.summary.invalid} invalid, ${result.summary.missing} missing`,
    });
  }
  
  // Send metrics
  metrics.gauge("env.health.valid", result.summary.valid);
  metrics.gauge("env.health.invalid", result.summary.invalid);
}, 60000);
```
