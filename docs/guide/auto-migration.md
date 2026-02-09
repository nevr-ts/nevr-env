# Auto-Migration

Automatically rename, transform, and restructure environment variables during schema changes. Safe, reversible migrations with backup and rollback support.

## Quick Start

```ts
import { 
  createMigrationPlan, 
  renameVar, 
  migrate,
  previewMigration 
} from "nevr-env";

// Define migration rules
const plan = createMigrationPlan([
  renameVar("DB_URL", "DATABASE_URL"),
  renameVar("API_SECRET", "API_KEY"),
]);

// Preview without applying
const preview = previewMigration(plan, `
  DB_URL=postgres://localhost/db
  API_SECRET=sk-123
`);
console.log(preview.changes);
// [
//   { rule: "rename_DB_URL_to_DATABASE_URL", type: "rename", from: {...}, to: {...} },
//   { rule: "rename_API_SECRET_to_API_KEY", type: "rename", from: {...}, to: {...} }
// ]

// Apply migration (creates backup automatically)
const result = migrate(plan, { envPath: ".env" });
console.log(`Applied ${result.applied} changes`);
console.log(`Backup at: ${result.backup}`);
```

## Migration Rules

### Rename Variables

```ts
import { renameVar } from "nevr-env";

renameVar("OLD_NAME", "NEW_NAME")
renameVar("MONGODB_URL", "DATABASE_URL", { 
  description: "Standardize database naming", 
  breaking: false 
})
```

### Transform Values

```ts
import { transformVar } from "nevr-env";

// Convert to uppercase
transformVar("LOG_LEVEL", (value) => value.toUpperCase())

// Add prefix
transformVar("API_URL", (value) => value.replace("http://", "https://"))
```

### Split Variables

One variable into multiple:

```ts
import { splitVar } from "nevr-env";

splitVar(
  "DATABASE_URL",
  ["DB_HOST", "DB_PORT", "DB_NAME"],
  (url) => {
    const parsed = new URL(url);
    return {
      DB_HOST: parsed.hostname,
      DB_PORT: parsed.port || "5432",
      DB_NAME: parsed.pathname.slice(1),
    };
  }
)
```

### Merge Variables

Multiple variables into one:

```ts
import { mergeVars } from "nevr-env";

mergeVars(
  ["DB_HOST", "DB_PORT", "DB_NAME"],
  "DATABASE_URL",
  (vars) => `postgres://${vars.DB_HOST}:${vars.DB_PORT}/${vars.DB_NAME}`
)
```

### Add Variables

```ts
import { addVar } from "nevr-env";

// Static default
addVar("NEW_FEATURE_FLAG", "false")

// Dynamic default
addVar("INSTANCE_ID", () => Math.random().toString(36).slice(2))

// Conditional add
addVar("SENTRY_DSN", "https://...", {
  condition: (vars) => vars.NODE_ENV === "production"
})
```

### Delete Variables

```ts
import { deleteVar } from "nevr-env";

deleteVar("DEPRECATED_VAR", { 
  breaking: true 
})
```

## Creating Migration Plans

```ts
import { createMigrationPlan, renameVar, addVar, deleteVar } from "nevr-env";

const plan = createMigrationPlan([
  // Rename for consistency
  renameVar("MONGO_URI", "DATABASE_URL"),
  renameVar("JWT_KEY", "JWT_SECRET"),
  
  // Add new required vars
  addVar("RATE_LIMIT", "100"),
  addVar("CACHE_TTL", "3600"),
  
  // Remove deprecated vars
  deleteVar("LEGACY_API_KEY"),
], {
  fromVersion: "1.0.0",
  toVersion: "2.0.0",
});

console.log(plan.hasBreakingChanges); // true (deleteVar is breaking)
```

## Preview Changes

Always preview before applying:

```ts
import { previewMigration } from "nevr-env";

const preview = previewMigration(plan, ".env");

console.log("Changes to apply:");
for (const change of preview.changes) {
  console.log(`  ${change.type}: ${JSON.stringify(change.from)} → ${JSON.stringify(change.to)}`);
}

if (preview.errors.length > 0) {
  console.error("Errors found:");
  preview.errors.forEach(e => console.error(`  ${e.rule}: ${e.error}`));
}
```

## Applying Migrations

```ts
import { migrate } from "nevr-env";

const result = migrate(plan, {
  envPath: ".env",
  backup: true,  // default: true
  dryRun: false, // default: false
});

if (result.success) {
  console.log(`✓ Applied ${result.applied} changes`);
  console.log(`  Skipped ${result.skipped} (conditions not met)`);
  console.log(`  Backup: ${result.backup}`);
} else {
  console.error("Migration failed:");
  result.errors.forEach(e => console.error(`  ${e.rule}: ${e.error}`));
}
```

## Rollback

If something goes wrong:

```ts
import { rollback } from "nevr-env";

// Using the backup path from migrate()
const success = rollback(result.backup);

if (success) {
  console.log("Rolled back successfully");
}
```

## Generate from Schema Diff

Automatically create migration from schema changes:

```ts
import { generateMigrationFromDiff } from "nevr-env";
import { z } from "zod";

const oldSchema = {
  DB_URL: z.string().url(),
  API_SECRET: z.string(),
};

const newSchema = {
  DATABASE_URL: z.string().url(),
  API_KEY: z.string(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
};

const plan = generateMigrationFromDiff(oldSchema, newSchema, {
  renameMap: {
    DB_URL: "DATABASE_URL",
    API_SECRET: "API_KEY",
  },
  defaultValues: {
    LOG_LEVEL: "info",
  },
});

// Plan will have:
// - rename DB_URL → DATABASE_URL
// - rename API_SECRET → API_KEY  
// - add LOG_LEVEL with default "info"
```

## Common Patterns

Built-in helpers for common migrations:

```ts
import { migrationPatterns as patterns } from "nevr-env";

// Add prefix to multiple vars
const rules = patterns.addPrefix("APP_", ["PORT", "HOST", "DEBUG"]);
// PORT → APP_PORT, HOST → APP_HOST, DEBUG → APP_DEBUG

// Parse URL into components
const parseRule = patterns.parseUrl("DATABASE_URL", ["host", "port", "path"]);

// Build URL from components
const buildRule = patterns.buildUrl(["host", "port", "path"], "DATABASE_URL");
```

## Migration Files

Store migrations as JSON:

```json
{
  "id": "migration_1704067200000",
  "fromVersion": "1.0.0",
  "toVersion": "2.0.0",
  "rules": [
    {
      "id": "rename_DB_URL_to_DATABASE_URL",
      "type": "rename",
      "from": "DB_URL",
      "to": "DATABASE_URL"
    }
  ]
}
```

## Best Practices

### 1. Always Preview First

```ts
const preview = previewMigration(plan, ".env");
if (preview.errors.length > 0) {
  throw new Error("Migration has errors");
}
migrate(plan);
```

### 2. Keep Backups

```ts
const result = migrate(plan, { backup: true });
// Never delete backup until verified in production
```

### 3. Version Your Migrations

```ts
const plan = createMigrationPlan(rules, {
  fromVersion: "1.2.0",
  toVersion: "1.3.0",
});
```

### 4. Test in CI

```yaml
- name: Test migration
  run: |
    cp .env.example .env
    npx nevr-env migrate --apply --plan migrations/latest.json
    npx nevr-env check
```

### 5. Handle Breaking Changes

```ts
if (plan.hasBreakingChanges) {
  console.warn("⚠️  This migration has breaking changes!");
  // Require explicit confirmation
}
```
