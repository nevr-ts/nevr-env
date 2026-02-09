# Vercel Preset

The Vercel preset provides automatic validation for all Vercel system environment variables.

## Installation

```ts
import { vercel } from "nevr-env/presets/vercel";
```

## Usage

```ts
import { createEnv } from "nevr-env";
import { vercel } from "nevr-env/presets/vercel";

export const env = createEnv({
  plugins: [vercel()],
  server: {
    DATABASE_URL: z.string().url(),
  },
  runtimeEnv: process.env,
});

// Access Vercel variables
env.VERCEL_ENV; // "development" | "preview" | "production"
env.VERCEL_URL; // Deployment URL
```

## Included Variables

All Vercel system environment variables are automatically typed:

| Variable | Type | Description |
|----------|------|-------------|
| `VERCEL` | `string?` | Set to `1` when on Vercel |
| `VERCEL_ENV` | `"development" \| "preview" \| "production"` | Current environment |
| `VERCEL_URL` | `string?` | Deployment URL (without https://) |
| `VERCEL_BRANCH_URL` | `string?` | URL with branch name |
| `VERCEL_REGION` | `string?` | Serverless function region |
| `VERCEL_GIT_PROVIDER` | `string?` | `github`, `gitlab`, `bitbucket` |
| `VERCEL_GIT_REPO_SLUG` | `string?` | Repository name |
| `VERCEL_GIT_REPO_OWNER` | `string?` | Repository owner |
| `VERCEL_GIT_REPO_ID` | `string?` | Repository ID |
| `VERCEL_GIT_COMMIT_REF` | `string?` | Git branch name |
| `VERCEL_GIT_COMMIT_SHA` | `string?` | Git commit SHA |
| `VERCEL_GIT_COMMIT_MESSAGE` | `string?` | Commit message |
| `VERCEL_GIT_COMMIT_AUTHOR_LOGIN` | `string?` | Author username |
| `VERCEL_GIT_COMMIT_AUTHOR_NAME` | `string?` | Author name |
| `VERCEL_GIT_PREVIOUS_SHA` | `string?` | Previous commit SHA |
| `VERCEL_GIT_PULL_REQUEST_ID` | `string?` | PR number |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | `string?` | Protection bypass secret |

## Helper Functions

### isVercel()

Check if running on Vercel:

```ts
import { isVercel } from "nevr-env/presets/vercel";

if (isVercel()) {
  console.log("Running on Vercel!");
}
```

### isVercelPreview()

Check if running in preview environment:

```ts
import { isVercelPreview } from "nevr-env/presets/vercel";

if (isVercelPreview()) {
  // Show preview banner
  console.log("This is a preview deployment");
}
```

### isVercelProduction()

Check if running in production:

```ts
import { isVercelProduction } from "nevr-env/presets/vercel";

if (isVercelProduction()) {
  // Enable production features
  enableAnalytics();
}
```

### getVercelUrl()

Get the deployment URL with protocol:

```ts
import { getVercelUrl } from "nevr-env/presets/vercel";

const url = getVercelUrl(); // https://my-app-xxx.vercel.app
```

## Examples

### Next.js App

```ts
// env.ts
import { createEnv } from "nevr-env";
import { vercel } from "nevr-env/presets/vercel";
import { z } from "zod";

export const env = createEnv({
  plugins: [vercel()],
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});
```

### Dynamic URL Resolution

```ts
import { createEnv } from "nevr-env";
import { vercel, getVercelUrl } from "nevr-env/presets/vercel";

export const env = createEnv({
  plugins: [vercel()],
  server: {
    // Falls back to Vercel URL if not set
    APP_URL: z.string().url().default(
      getVercelUrl() || "http://localhost:3000"
    ),
  },
  runtimeEnv: process.env,
});
```

### Preview Environment Features

```ts
import { vercel, isVercelPreview } from "nevr-env/presets/vercel";

const env = createEnv({
  plugins: [vercel()],
  server: {
    // Use test database in preview
    DATABASE_URL: z.string().url(),
  },
  runtimeEnv: {
    ...process.env,
    DATABASE_URL: isVercelPreview()
      ? process.env.PREVIEW_DATABASE_URL
      : process.env.DATABASE_URL,
  },
});
```

## Protected Deployments

For Vercel Deployment Protection:

```ts
import { createEnv } from "nevr-env";
import { vercel } from "nevr-env/presets/vercel";

const env = createEnv({
  plugins: [vercel()],
  server: {
    // Available when deployment protection is enabled
    // Used to bypass protection for cron jobs, webhooks, etc.
  },
  runtimeEnv: process.env,
});

// Access the bypass secret for authenticated requests
const bypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET;
```

## TypeScript Types

```ts
import type { VercelEnv } from "nevr-env/presets/vercel";

// Full type interface
interface VercelEnv {
  VERCEL?: string;
  VERCEL_ENV?: "development" | "preview" | "production";
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_REGION?: string;
  VERCEL_AUTOMATION_BYPASS_SECRET?: string;
  VERCEL_GIT_PROVIDER?: string;
  VERCEL_GIT_REPO_SLUG?: string;
  VERCEL_GIT_REPO_OWNER?: string;
  VERCEL_GIT_REPO_ID?: string;
  VERCEL_GIT_COMMIT_REF?: string;
  VERCEL_GIT_COMMIT_SHA?: string;
  VERCEL_GIT_COMMIT_MESSAGE?: string;
  VERCEL_GIT_COMMIT_AUTHOR_LOGIN?: string;
  VERCEL_GIT_COMMIT_AUTHOR_NAME?: string;
  VERCEL_GIT_PREVIOUS_SHA?: string;
  VERCEL_GIT_PULL_REQUEST_ID?: string;
}
```

## Best Practices

1. **Use `plugins`** to combine preset with custom variables
2. **Check environment** before enabling features
3. **Use branch URLs** for preview-specific configurations
4. **Access Git info** for deployment tracking

```ts
// Log deployment info
console.log(`
  Deployed: ${env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)}
  Branch: ${env.VERCEL_GIT_COMMIT_REF}
  Author: ${env.VERCEL_GIT_COMMIT_AUTHOR_NAME}
  Region: ${env.VERCEL_REGION}
`);
```
