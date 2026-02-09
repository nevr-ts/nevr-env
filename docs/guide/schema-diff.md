# Schema Diffing

Compare environment schemas between versions to detect breaking changes, generate migration guides, and track schema evolution.

## Quick Start

```typescript
import { diffSchemas } from "nevr-env";
import { z } from "zod";

const oldSchema = {
  DATABASE_URL: z.string().url(),
  API_KEY: z.string(),
};

const newSchema = {
  DATABASE_URL: z.string().url(),
  API_KEY: z.string(),
  REDIS_URL: z.string().url().optional(), // Added
};

const diff = diffSchemas(oldSchema, newSchema);

console.log(diff.summary);
// "Added 1 variable(s). Not a breaking change."

console.log(diff.isBreaking); // false
```

## Detecting Breaking Changes

```typescript
const oldSchema = {
  API_KEY: z.string().optional(),
};

const newSchema = {
  API_KEY: z.string(), // Now required!
};

const diff = diffSchemas(oldSchema, newSchema);

console.log(diff.isBreaking); // true
console.log(diff.changed[0].breakingReason);
// "Variable became required"
```

### What's Considered Breaking

| Change | Breaking? | Reason |
|--------|-----------|--------|
| New required variable | ✅ Yes | Existing deployments will fail |
| Removed required variable | ✅ Yes | Code may access undefined |
| Optional → Required | ✅ Yes | May not be set |
| Type changed | ✅ Yes | Validation will fail |
| Enum value removed | ✅ Yes | Existing values invalid |
| Min constraint increased | ✅ Yes | Existing values may fail |
| Max constraint decreased | ✅ Yes | Existing values may fail |
| New optional variable | ❌ No | Backwards compatible |
| Required → Optional | ❌ No | More permissive |
| Enum value added | ❌ No | Backwards compatible |

## Generating Migration Guides

```typescript
import { diffSchemas, generateMigrationGuide } from "nevr-env";

const diff = diffSchemas(oldSchema, newSchema);
const guide = generateMigrationGuide(diff);

console.log(guide);
```

Output:
```markdown
# Environment Migration Guide

**Status:** ⚠️ Breaking Change

## Renamed Variables

- `DB_URL` → `DATABASE_URL` (85% confidence)

## New Variables

- `REDIS_URL` (optional)
  - Type: string
  - Format: url

## Removed Variables

- `LEGACY_KEY` ⚠️

## Changed Variables

### `API_KEY` ⚠️
> Variable became required

| Property | Before | After |
|----------|--------|-------|
| Type | string | string |
| Optional | true | false |
| Has Default | false | false |
```

## Rename Detection

Automatically detect when variables are renamed:

```typescript
const oldSchema = {
  DB_URL: z.string().url(),
};

const newSchema = {
  DATABASE_URL: z.string().url(),
};

const diff = diffSchemas(oldSchema, newSchema, {
  detectRenames: true,
  renameSimilarityThreshold: 0.6, // 60% similarity
});

console.log(diff.renamed);
// [{ from: "DB_URL", to: "DATABASE_URL", confidence: 0.75 }]
```

## Comparing Plugins

```typescript
import { diffPlugins, postgres, stripe, redis } from "nevr-env";

const oldPlugins = [postgres(), stripe()];
const newPlugins = [postgres(), stripe({ webhook: true }), redis()];

const diff = diffPlugins(oldPlugins, newPlugins);

console.log(diff.added);
// [{ key: "STRIPE_WEBHOOK_SECRET", ... }, { key: "REDIS_URL", ... }]
```

## CLI Usage

```bash
# Compare current schema with previous version
npx nevr-env diff --old ./env.v1.ts --new ./env.v2.ts

# Generate migration guide
npx nevr-env diff --old v1 --new v2 --format markdown > MIGRATION.md

# Check for breaking changes in CI
npx nevr-env diff --old main --new HEAD --fail-on-breaking
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/schema-check.yml
name: Schema Check
on: [pull_request]

jobs:
  check-schema:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Check for breaking changes
        run: |
          npx nevr-env diff \
            --old origin/main:src/env.ts \
            --new HEAD:src/env.ts \
            --fail-on-breaking
      
      - name: Generate migration guide
        if: failure()
        run: |
          npx nevr-env diff \
            --old origin/main:src/env.ts \
            --new HEAD:src/env.ts \
            --format markdown >> $GITHUB_STEP_SUMMARY
```

### Semantic Versioning

Use schema diffs to determine version bumps:

```typescript
import { diffSchemas } from "nevr-env";

const diff = diffSchemas(oldSchema, newSchema);

if (diff.isBreaking) {
  console.log("MAJOR version bump required");
} else if (diff.added.length > 0) {
  console.log("MINOR version bump required");
} else if (diff.changed.length > 0) {
  console.log("PATCH version bump required");
} else {
  console.log("No version change needed");
}
```

## Options

```typescript
diffSchemas(oldSchema, newSchema, {
  // Detect potential renames (default: true)
  detectRenames: true,
  
  // Minimum similarity for rename detection (default: 0.7)
  renameSimilarityThreshold: 0.7,
  
  // Consider new required vars as breaking (default: true)
  newRequiredIsBreaking: true,
});
```

## Type Information Extraction

The diff system extracts detailed type info:

```typescript
interface TypeInfo {
  type: string;        // "string", "number", "boolean", "enum"
  optional: boolean;   // Whether it's optional
  hasDefault: boolean; // Whether it has a default
  enumValues?: string[]; // For enum types
  min?: number;        // Min length/value
  max?: number;        // Max length/value
  format?: string;     // "url", "email", "uuid", etc.
}
```

## Changelog Generation

Generate changelogs from schema history:

```typescript
import { diffSchemas, generateMigrationGuide } from "nevr-env";

const versions = [
  { version: "1.0.0", schema: v1Schema },
  { version: "1.1.0", schema: v2Schema },
  { version: "2.0.0", schema: v3Schema },
];

for (let i = 1; i < versions.length; i++) {
  const diff = diffSchemas(
    versions[i - 1].schema,
    versions[i].schema
  );
  
  console.log(`\n## ${versions[i].version}\n`);
  console.log(diff.summary);
  
  if (diff.isBreaking) {
    console.log(generateMigrationGuide(diff));
  }
}
```
