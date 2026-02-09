# CI/CD Integration

nevr-env provides helpers to generate CI/CD configurations for popular platforms, ensuring your environment variables are validated before deployment.

## Quick Start

```ts
import { generateCIConfig } from "nevr-env";
import { z } from "zod";

const schema = {
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(1),
  NODE_ENV: z.enum(["development", "staging", "production"]),
};

// Generate GitHub Actions workflow
const workflow = generateCIConfig({ server: schema }, "github");
console.log(workflow);
```

## Supported Platforms

### GitHub Actions

```ts
import { generateGitHubActionsWorkflow } from "nevr-env";

const workflow = generateGitHubActionsWorkflow(
  { server: schema },
  {
    name: "Validate & Deploy",
    nodeVersion: "20",
    packageManager: "pnpm",
  }
);

// Write to .github/workflows/validate-env.yml
```

**Generated output:**
```yaml
name: Validate & Deploy

on:
  pull_request:
  push:
    branches: [main, master]

jobs:
  validate-env:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Validate environment variables
        run: npx nevr-env check
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          API_KEY: ${{ secrets.API_KEY }}
```

### Vercel

```ts
import { generateVercelConfig } from "nevr-env";

const config = generateVercelConfig({ server: schema });
// Write to vercel.json
```

### Railway

```ts
import { generateRailwayConfig } from "nevr-env";

const config = generateRailwayConfig({ server: schema });
// Write to railway.json
```

### GitLab CI

```ts
import { generateGitLabCI } from "nevr-env";

const config = generateGitLabCI(
  { server: schema },
  { nodeVersion: "20" }
);
// Write to .gitlab-ci.yml
```

### CircleCI

```ts
import { generateCircleCI } from "nevr-env";

const config = generateCircleCI(
  { server: schema },
  { nodeVersion: "20" }
);
// Write to .circleci/config.yml
```

## Extract CI Configuration

Get a structured view of your environment requirements:

```ts
import { extractCIConfig } from "nevr-env";

const config = extractCIConfig({ server: schema });
// {
//   requiredVars: ["DATABASE_URL", "API_KEY", "NODE_ENV"],
//   optionalVars: [],
//   secretVars: ["API_KEY"]  // Auto-detected by name patterns
// }
```

## Programmatic Usage

Use `generateCIConfig` to generate configs for any supported platform:

```ts
import { generateCIConfig } from "nevr-env";

const schema = {
  server: {
    DATABASE_URL: z.string().url(),
    API_KEY: z.string(),
  },
};

// Generate for any platform
const github = generateCIConfig(schema, "github");
const vercel = generateCIConfig(schema, "vercel");
const railway = generateCIConfig(schema, "railway");
const gitlab = generateCIConfig(schema, "gitlab");
const circleci = generateCIConfig(schema, "circleci");
```

## Best Practices

### 1. Store Secrets Properly

Never commit secrets. Use platform-specific secret storage:

- **GitHub**: Repository Secrets or Environment Secrets
- **Vercel**: Environment Variables (marked as sensitive)
- **Railway**: Variables with ${{SECRET}} references
- **GitLab**: CI/CD Variables (masked)
- **CircleCI**: Contexts or Project Environment Variables

### 2. Validate in PR Checks

Run `nevr-env check` in your PR pipeline to catch missing variables early:

```yaml
- name: Validate environment
  run: npx nevr-env check
  env:
    # Use test/dummy values for validation
    DATABASE_URL: ${{ secrets.DATABASE_URL_TEST }}
```

### 3. Environment-Specific Configs

Generate separate configs for different environments:

```ts
import { generateGitHubActionsWorkflow } from "nevr-env";

// Production schema
const prodSchema = { server: { ... } };
const prodWorkflow = generateGitHubActionsWorkflow(prodSchema, {
  name: "Deploy Production",
});

// Staging schema (might have different vars)
const stagingSchema = { server: { ... } };
const stagingWorkflow = generateGitHubActionsWorkflow(stagingSchema, {
  name: "Deploy Staging",
});
```

### 4. Use with Vault

Combine CI/CD integration with vault for secure secret management:

```yaml
- name: Pull secrets from vault
  run: npx nevr-env vault pull
  env:
    NEVR_ENV_KEY: ${{ secrets.NEVR_ENV_KEY }}

- name: Validate environment
  run: npx nevr-env check
```
