# Advanced Features

nevr-env includes several advanced features for enterprise-grade environment management.

## Validation Modes

By default, nevr-env throws an error when validation fails. You can change this behavior:

```typescript
import { createEnv } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  
  // "strict" (default) - throws on error
  // "warn" - logs warnings and continues
  validationMode: "warn",
  
  runtimeEnv: process.env,
});
```

### When to use "warn" mode

- **Development**: See all missing variables at once instead of fixing one at a time
- **Debugging**: Diagnose issues without crashing the app
- **Graceful degradation**: Continue with partial config in non-critical services

::: warning
Never use "warn" mode in production for security-critical variables!
:::

## Debug Mode

Enable verbose logging to troubleshoot configuration issues:

```typescript
export const env = createEnv({
  server: { ... },
  debug: true,  // Enable debug logging
  runtimeEnv: process.env,
});
```

Output:
```
[nevr-env] Debug mode enabled
[nevr-env] Is server: true
[nevr-env] Schema keys: ["DATABASE_URL", "API_KEY", "NODE_ENV"]
[nevr-env] Available env keys: ["NODE_ENV", "PATH", ...]
```

## Success Callback

Run code after successful validation:

```typescript
export const env = createEnv({
  server: { ... },
  onSuccess: (env) => {
    console.log("✅ Environment validated");
    
    // Send telemetry
    analytics.track("env_validated", {
      keys: Object.keys(env).length,
    });
    
    // Initialize services that depend on env
    initializeDatabase(env.DATABASE_URL);
  },
  runtimeEnv: process.env,
});
```

## Custom Error Handlers

Customize error handling for validation failures:

```typescript
export const env = createEnv({
  server: { ... },
  
  // Custom validation error handler
  onValidationError: (issues) => {
    // Log to error tracking service
    Sentry.captureException(new Error("Env validation failed"), {
      extra: { issues },
    });
    
    // Show custom error message
    console.error("Configuration error - check your .env file");
    process.exit(1);
  },
  
  // Custom client access error handler
  onInvalidAccess: (variableName) => {
    console.error(`Attempted to access ${variableName} on client`);
    throw new Error("Security violation");
  },
  
  runtimeEnv: process.env,
});
```

## Next Steps

- [Health Check](/guide/health-check) - Monitor env health in production
- [Secret Rotation](/guide/rotation) - Track secret age
- [Secret Scanning](/guide/scanning) - Prevent accidental exposure
- [Schema Diffing](/guide/schema-diff) - Track schema changes
