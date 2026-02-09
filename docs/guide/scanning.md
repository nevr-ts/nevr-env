# Secret Scanning

Detect and prevent accidental secret exposure in your codebase. Use with pre-commit hooks or CI/CD pipelines.

## Quick Start

```typescript
import { scanForSecrets, formatScanResults } from "nevr-env";

const result = scanForSecrets({
  directory: "./src",
  redact: true,
});

if (result.hasSecrets) {
  console.error(formatScanResults(result));
  process.exit(1);
}
```

## CLI Usage

```bash
# Scan current directory
npx nevr-env scan

# Scan specific directory
npx nevr-env scan --path ./src

# Output as JSON
npx nevr-env scan --format json

# Exclude directories
npx nevr-env scan --exclude node_modules dist
```

## Built-in Patterns

nevr-env detects these secret types out of the box:

| Pattern | Severity | Description |
|---------|----------|-------------|
| AWS Access Key | Critical | `AKIA...` |
| AWS Secret Key | Critical | 40-char base64 |
| Stripe Secret Key | Critical | `sk_live_...`, `sk_test_...` |
| OpenAI API Key | Critical | `sk-...` |
| GitHub Token | Critical | `ghp_...`, `gho_...` |
| Slack Token | Critical | `xoxb-...` |
| Discord Token | Critical | Bot tokens |
| Private Key | Critical | `-----BEGIN PRIVATE KEY-----` |
| Database URL | Critical | URLs with credentials |
| JWT Token | High | `eyJ...` |
| Generic API Key | High | `api_key = "..."` |
| nevr-env Vault Key | Critical | `nevr_...` |

## Pre-Commit Hook

Automatically scan before each commit by creating `.git/hooks/pre-commit`:

```bash
#!/bin/sh
echo "🔍 Scanning for secrets..."
npx nevr-env scan
if [ $? -ne 0 ]; then
  echo "❌ Commit blocked: secrets detected!"
  exit 1
fi
```

### With Husky

```bash
# Install husky
pnpm add -D husky
npx husky init

# Add pre-commit hook
echo "npx nevr-env scan" > .husky/pre-commit
```

### With lint-staged

```json
// package.json
{
  "lint-staged": {
    "*.{ts,js,json}": [
      "npx nevr-env scan"
    ]
  }
}
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]

jobs:
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Scan for secrets
        run: npx nevr-env scan --json > scan-results.json
      
      - name: Check results
        run: |
          if [ $(jq '.hasSecrets' scan-results.json) = "true" ]; then
            echo "::error::Secrets detected in codebase!"
            jq '.matches[] | "\(.file):\(.line) - \(.pattern.name)"' scan-results.json
            exit 1
          fi
```

### GitLab CI

```yaml
# .gitlab-ci.yml
secret-scan:
  stage: test
  script:
    - npx nevr-env scan
  rules:
    - if: $CI_MERGE_REQUEST_ID
```

## Custom Patterns

Add custom patterns for your organization:

```typescript
import { scanForSecrets } from "nevr-env";

const result = scanForSecrets({
  directory: "./src",
  additionalPatterns: [
    {
      name: "Internal API Key",
      pattern: /INTERNAL_[A-Z0-9]{32}/g,
      severity: "critical",
      description: "Internal service API key",
    },
    {
      name: "Legacy Token",
      pattern: /legacy_token_[a-f0-9]{40}/g,
      severity: "high",
      description: "Legacy authentication token",
    },
  ],
});
```

## Scan Options

```typescript
scanForSecrets({
  // Directory to scan
  directory: "./src",
  
  // Files/directories to exclude
  exclude: [
    "node_modules",
    "dist",
    "*.test.ts",
    "__mocks__",
  ],
  
  // Additional patterns
  additionalPatterns: [...],
  
  // Redact matched values in output (default: true)
  redact: true,
  
  // Max file size to scan (default: 1MB)
  maxFileSize: 1024 * 1024,
});
```

## Output Format

```typescript
interface ScanResult {
  hasSecrets: boolean;
  filesScanned: number;
  matches: Array<{
    file: string;
    line: number;
    column: number;
    pattern: {
      name: string;
      severity: "critical" | "high" | "medium" | "low";
      description: string;
    };
    match: string;      // Redacted value
    lineContent: string; // Full line (redacted)
  }>;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}
```

## False Positives

Exclude false positives with inline comments:

```typescript
// nevr-env-ignore-next-line
const exampleKey = "sk_test_fake_key_for_docs";

const config = {
  // This is a placeholder, not a real secret
  apiKey: "sk_test_placeholder", // nevr-env-ignore
};
```

Or configure globally:

```typescript
scanForSecrets({
  exclude: [
    "**/*.example.*",
    "**/fixtures/**",
    "**/mocks/**",
  ],
});
```

## Severity Guide

| Severity | Action |
|----------|--------|
| **Critical** | Block commit immediately |
| **High** | Block commit, review required |
| **Medium** | Warning, should review |
| **Low** | Informational |
