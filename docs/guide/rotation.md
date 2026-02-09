# Secret Rotation

Track when secrets were last rotated and get warnings when they're stale. Essential for security compliance (SOC2, PCI-DSS, etc.).

## Quick Start

```typescript
import { createEnv, createRotationChecker, postgres, stripe } from "nevr-env";
import { z } from "zod";

// Create rotation checker
const checkRotation = createRotationChecker({
  trackedKeys: ["DATABASE_URL", "STRIPE_SECRET_KEY", "API_SECRET"],
  defaultMaxAgeDays: 90,
});

export const env = createEnv({
  plugins: [postgres(), stripe()],
  server: {
    API_SECRET: z.string().min(32),
  },
  // Run rotation check after validation
  onSuccess: checkRotation,
  runtimeEnv: process.env,
});
```

Output when secrets are stale:
```
⚠️  Secret Rotation Warnings:
   • DATABASE_URL: 95 days old (max: 90)
   • STRIPE_SECRET_KEY: No rotation record found

   Run `npx nevr-env rotate <key>` to record a rotation.
```

## Recording Rotations

When you rotate a secret, record it:

```typescript
import { recordRotation } from "nevr-env";

// After rotating DATABASE_URL
recordRotation("DATABASE_URL", {
  maxAgeDays: 90,
  rotatedBy: "john@example.com",
  notes: "Quarterly rotation",
});
```

Or via CLI:

```bash
npx nevr-env rotate --record DATABASE_URL --max-age 90
```

## Tracking File

Rotation records are stored in `.nevr-env.rotation.json`:

```json
{
  "version": 1,
  "updatedAt": "2026-02-05T10:30:00.000Z",
  "records": [
    {
      "key": "DATABASE_URL",
      "lastRotated": "2026-01-15T08:00:00.000Z",
      "maxAgeDays": 90,
      "rotatedBy": "john@example.com",
      "notes": "Quarterly rotation"
    }
  ]
}
```

::: tip
Commit `.nevr-env.rotation.json` to git so your team shares rotation tracking.
:::

## Checking Status

```typescript
import { getRotationStatus, checkRotationStatus } from "nevr-env";

// Single key
const status = getRotationStatus("DATABASE_URL");
console.log(status);
// {
//   key: "DATABASE_URL",
//   lastRotated: "2026-01-15T08:00:00.000Z",
//   daysSinceRotation: 21,
//   maxAgeDays: 90,
//   needsRotation: false,
//   status: "fresh"
// }

// Multiple keys
const statuses = checkRotationStatus([
  "DATABASE_URL",
  "STRIPE_SECRET_KEY",
  "API_SECRET",
]);
```

## Status Levels

| Status | Description |
|--------|-------------|
| `fresh` | Less than 50% of max age |
| `warning` | Between 50-100% of max age |
| `expired` | Exceeded max age |
| `unknown` | No rotation record found |

## Custom Alert Handler

```typescript
createRotationChecker({
  trackedKeys: ["DATABASE_URL"],
  defaultMaxAgeDays: 90,
  onStaleSecret: (record, ageDays) => {
    // Send Slack alert
    slack.send({
      channel: "#security",
      text: `🔐 ${record.key} is ${ageDays} days old (max: ${record.maxAgeDays})`,
    });
    
    // Create ticket
    jira.createIssue({
      project: "SEC",
      summary: `Rotate ${record.key}`,
      description: `Secret is ${ageDays} days old`,
    });
  },
});
```

## CI/CD Integration

Add rotation checks to your CI pipeline:

```yaml
# .github/workflows/security.yml
name: Security Checks
on: [push]

jobs:
  rotation-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx nevr-env rotate
```

## Compliance Reports

Generate rotation reports for audits:

```typescript
import { checkRotationStatus } from "nevr-env";

const secrets = [
  "DATABASE_URL",
  "STRIPE_SECRET_KEY",
  "AWS_SECRET_ACCESS_KEY",
];

const statuses = checkRotationStatus(secrets);

// Generate compliance report
const report = {
  generatedAt: new Date().toISOString(),
  compliant: statuses.every(s => !s.needsRotation),
  secrets: statuses.map(s => ({
    name: s.key,
    lastRotated: s.lastRotated,
    daysSinceRotation: s.daysSinceRotation,
    maxAgeDays: s.maxAgeDays,
    compliant: !s.needsRotation,
  })),
};

console.log(JSON.stringify(report, null, 2));
```
