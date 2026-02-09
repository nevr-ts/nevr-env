# Netlify Preset

The Netlify preset provides automatic validation for all Netlify system environment variables.

## Installation

```ts
import { netlify } from "nevr-env/presets/netlify";
```

## Usage

```ts
import { createEnv } from "nevr-env";
import { netlify } from "nevr-env/presets/netlify";

export const env = createEnv({
  plugins: [netlify()],
  server: {
    DATABASE_URL: z.string().url(),
  },
  runtimeEnv: process.env,
});

// Access Netlify variables
env.CONTEXT; // "production" | "deploy-preview" | "branch-deploy" | "dev"
env.SITE_NAME; // Site name
```

## Included Variables

All Netlify system environment variables are automatically typed:

| Variable | Type | Description |
|----------|------|-------------|
| `NETLIFY` | `string?` | Set to `true` when on Netlify |
| `CONTEXT` | `"production" \| "deploy-preview" \| "branch-deploy" \| "dev"` | Build context |
| `DEPLOY_PRIME_URL` | `string?` | Primary deploy URL |
| `DEPLOY_URL` | `string?` | Unique deploy URL |
| `URL` | `string?` | Production URL |
| `SITE_ID` | `string?` | Netlify site ID |
| `SITE_NAME` | `string?` | Site name |

### Build Info Variables (enabled by default)

When `includeBuildInfo: true` (default):

| Variable | Type | Description |
|----------|------|-------------|
| `BUILD_ID` | `string?` | Unique build ID |
| `DEPLOY_ID` | `string?` | Unique deploy ID |
| `REPOSITORY_URL` | `string?` | Git repository URL |
| `BRANCH` | `string?` | Branch being built |
| `HEAD` | `string?` | Branch HEAD ref |
| `COMMIT_REF` | `string?` | Git commit SHA |
| `CACHED_COMMIT_REF` | `string?` | Previous cached commit |
| `PULL_REQUEST` | `string?` | PR status (`true`/`false`) |
| `REVIEW_ID` | `string?` | PR review ID |

## Options

```ts
netlify({
  includeBuildInfo: true,     // Include build/git variables (default: true)
  requireProduction: false,   // Require production context (default: false)
})
```

## Helper Functions

### isNetlify()

Check if running on Netlify:

```ts
import { isNetlify } from "nevr-env/presets/netlify";

if (isNetlify()) {
  console.log("Running on Netlify!");
}
```

### isNetlifyProduction()

Check if running in production context:

```ts
import { isNetlifyProduction } from "nevr-env/presets/netlify";

if (isNetlifyProduction()) {
  enableProductionMode();
}
```

### isNetlifyPreview()

Check if running in deploy preview:

```ts
import { isNetlifyPreview } from "nevr-env/presets/netlify";

if (isNetlifyPreview()) {
  showPreviewBanner();
}
```

### getNetlifyUrl()

Get the deployment URL:

```ts
import { getNetlifyUrl } from "nevr-env/presets/netlify";

const url = getNetlifyUrl(); // https://my-site.netlify.app
```

Returns `DEPLOY_PRIME_URL` or falls back to `URL`.

## Examples

### Basic Setup

```ts
import { createEnv } from "nevr-env";
import { netlify } from "nevr-env/presets/netlify";
import { z } from "zod";

export const env = createEnv({
  plugins: [netlify()],
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string(),
  },
  runtimeEnv: process.env,
});
```

### Context-Aware Configuration

```ts
import { netlify, isNetlifyProduction } from "nevr-env/presets/netlify";

const env = createEnv({
  plugins: [netlify()],
  server: {
    DATABASE_URL: z.string().url(),
    LOG_LEVEL: z
      .enum(["debug", "info", "warn", "error"])
      .default(isNetlifyProduction() ? "info" : "debug"),
  },
  runtimeEnv: process.env,
});
```

### Deploy Preview Handling

```ts
import { netlify, isNetlifyPreview, getNetlifyUrl } from "nevr-env/presets/netlify";

const env = createEnv({
  plugins: [netlify()],
  server: {
    APP_URL: z.string().url().default(
      getNetlifyUrl() || "http://localhost:3000"
    ),
  },
  runtimeEnv: process.env,
});

if (isNetlifyPreview()) {
  // Use preview-specific database
  console.log("Running in deploy preview");
}
```

## TypeScript Types

```ts
import type { NetlifyEnv } from "nevr-env/presets/netlify";

interface NetlifyEnv {
  NETLIFY?: string;
  BUILD_ID?: string;
  CONTEXT?: "production" | "deploy-preview" | "branch-deploy" | "dev";
  DEPLOY_ID?: string;
  DEPLOY_PRIME_URL?: string;
  DEPLOY_URL?: string;
  URL?: string;
  SITE_ID?: string;
  SITE_NAME?: string;
  REPOSITORY_URL?: string;
  BRANCH?: string;
  HEAD?: string;
  COMMIT_REF?: string;
  CACHED_COMMIT_REF?: string;
  PULL_REQUEST?: string;
  REVIEW_ID?: string;
}
```

## Best Practices

1. **Use `plugins`** to combine preset with custom variables
2. **Check context** before enabling production features
3. **Use `getNetlifyUrl()`** for dynamic URL resolution
4. **Enable `requireProduction`** for strict production-only deploys
