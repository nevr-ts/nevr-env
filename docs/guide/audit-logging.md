# Vault Audit Logging

Track who changed what in your vault, when, and from where. The audit log provides a tamper-evident trail for compliance and debugging.

## Quick Start

```ts
import { logAuditEntry, queryAuditLog, verifyAuditLog } from "nevr-env/vault";

// Entries are logged automatically when using vault operations
// But you can also log custom entries:
logAuditEntry("secret.rotate", {
  type: "secret",
  secretKeys: ["API_KEY"],
});

// Query the log
const entries = queryAuditLog({
  action: "secret.rotate",
  fromDate: new Date("2024-01-01"),
});

// Verify integrity
const result = verifyAuditLog();
console.log(result.valid); // true if no tampering detected
```

## How It Works

The audit log uses a blockchain-like structure where each entry contains:
- A SHA-256 hash of its contents
- A reference to the previous entry's hash

This creates a tamper-evident chain - if anyone modifies an old entry, the chain breaks.

## Audit Actions

| Action | Description |
|--------|-------------|
| `vault.push` | Local .env pushed to vault |
| `vault.pull` | Vault pulled to local .env |
| `vault.sync` | Bidirectional sync |
| `vault.diff` | Diff viewed |
| `secret.add` | New secret added |
| `secret.update` | Secret value changed |
| `secret.remove` | Secret removed |
| `secret.rotate` | Secret rotated |
| `key.generate` | New encryption key generated |
| `key.rotate` | Encryption key rotated |
| `access.granted` | Vault access granted |
| `access.denied` | Vault access denied |
| `config.change` | Configuration changed |

## Querying the Log

### By Action

```ts
import { queryAuditLog } from "nevr-env/vault";

// Single action
const pushes = queryAuditLog({ action: "vault.push" });

// Multiple actions
const secretChanges = queryAuditLog({
  action: ["secret.add", "secret.update", "secret.remove"],
});
```

### By Actor

```ts
const byUser = queryAuditLog({ actor: "john.doe" });
```

### By Secret Key

```ts
const apiKeyHistory = queryAuditLog({ secretKey: "API_KEY" });
```

### By Date Range

```ts
const lastWeek = queryAuditLog({
  fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  toDate: new Date(),
});
```

### With Limit

```ts
const recent = queryAuditLog({ limit: 10 });
```

## Audit Summary

Get a high-level overview:

```ts
import { getAuditSummary } from "nevr-env/vault";

const summary = getAuditSummary({
  from: new Date("2024-01-01"),
  to: new Date("2024-12-31"),
});

// {
//   totalEntries: 150,
//   byAction: {
//     "vault.push": 45,
//     "vault.pull": 80,
//     "secret.rotate": 25,
//   },
//   byActor: {
//     "john.doe": 100,
//     "ci-service": 50,
//   },
//   secretsModified: ["DATABASE_URL", "API_KEY", "STRIPE_KEY"],
//   firstEntry: "2024-01-15T10:30:00Z",
//   lastEntry: "2024-12-20T14:45:00Z",
// }
```

## Verifying Integrity

```ts
import { verifyAuditLog } from "nevr-env/vault";

const result = verifyAuditLog();

if (!result.valid) {
  console.error("Audit log has been tampered with!");
  for (const error of result.errors) {
    console.error(`Entry ${error.index}: ${error.error}`);
  }
}
```

## Exporting the Log

```ts
import { exportAuditLog } from "nevr-env/vault";

// JSON format
const json = exportAuditLog("json");

// CSV format (for spreadsheets)
const csv = exportAuditLog("csv");

// Plain text (human readable)
const text = exportAuditLog("plaintext");
```

## Log Rotation

Prevent the log from growing too large:

```ts
import { rotateAuditLog } from "nevr-env/vault";

const result = rotateAuditLog({
  keepEntries: 1000, // Keep last 1000 entries
  archivePath: ".nevr-env.audit.2024.archive",
});

console.log(`Archived ${result.archived} entries`);
console.log(`Remaining ${result.remaining} entries`);
```

## Audit Entry Structure

```ts
interface AuditEntry {
  id: string;           // Unique entry ID
  timestamp: string;    // ISO timestamp
  action: AuditAction;  // What happened
  actor: {
    name: string;       // Username or service
    email?: string;     // Email if available
    type: "user" | "service" | "ci" | "unknown";
    machine?: string;   // Hostname
  };
  target: {
    type: "vault" | "secret" | "key" | "config";
    vaultPath?: string;
    secretKeys?: string[];  // Keys only, never values!
    beforeHash?: string;
    afterHash?: string;
  };
  context: {
    environment?: string;  // NODE_ENV
    branch?: string;       // Git branch
    commit?: string;       // Git commit
    ciRunId?: string;      // CI run ID
  };
  previousHash?: string;   // Link to previous entry
  hash: string;            // This entry's hash
}
```

## CI/CD Integration

The audit log automatically captures CI context:

```yaml
# GitHub Actions
- name: Pull from vault
  run: npx nevr-env vault pull
  env:
    NEVR_ENV_KEY: ${{ secrets.NEVR_ENV_KEY }}
# Audit entry will include:
# - actor: github-actions (from GITHUB_ACTOR)
# - context.branch: main (from GITHUB_REF_NAME)
# - context.commit: abc123 (from GITHUB_SHA)
# - context.ciRunId: 12345 (from GITHUB_RUN_ID)
```

## Best Practices

### 1. Regular Integrity Checks

```ts
// Add to your CI pipeline
const result = verifyAuditLog();
if (!result.valid) {
  process.exit(1);
}
```

### 2. Archive Old Entries

```ts
// Run monthly
rotateAuditLog({ keepEntries: 5000 });
```

### 3. Monitor for Anomalies

```ts
const summary = getAuditSummary({ from: lastWeek });

// Alert if unusual activity
if (summary.byAction["access.denied"] > 10) {
  sendAlert("Multiple denied access attempts detected");
}
```

### 4. Commit the Audit Log

Unlike `.env`, the audit log is safe to commit:

```gitignore
# .gitignore
.env
.nevr-env.vault  # Optional: commit if sharing secrets
.nevr-env.audit.log  # Safe to commit for audit trail
```
