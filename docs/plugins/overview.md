# Plugins Overview

nevr-env plugins provide pre-built schemas, auto-discovery, and CLI integration for common services. **All official plugins are bundled with nevr-env** - no extra installation needed!

## Namespaces

Plugins are organized into namespaces for better discoverability:

| Namespace | Providers | Description |
|-----------|-----------|-------------|
| [auth](/plugins/auth) | `betterAuth`, `clerk`, `auth0`, `nextauth` | Authentication providers |
| [database](/plugins/database) | `postgres`, `redis`, `supabase` | Database providers |
| [payment](/plugins/payment) | `stripe` | Payment providers |
| [ai](/plugins/ai) | `openai` | AI/LLM providers |
| [email](/plugins/email) | `resend` | Email providers |
| [cloud](/plugins/cloud) | `aws` | Cloud providers |

## Installation

Just install nevr-env - all plugins are included:

```bash
pnpm add nevr-env
```

## Usage

### Namespace Imports (Recommended)

```typescript
import { createEnv } from "nevr-env";
import { auth, database, payment, ai, email, cloud } from "nevr-env/plugins";

export const env = createEnv({
  plugins: [
    auth.betterAuth({ providers: ["google", "github"] }),
    database.postgres({ pool: true }),
    database.redis({ upstash: true }),
    payment.stripe({ webhook: true }),
    ai.openai({ organization: true }),
    email.resend({ fromEmail: true }),
    cloud.aws({ s3: true }),
  ],
  runtimeEnv: process.env,
});

// Access plugin variables with full type safety
env.BETTER_AUTH_SECRET;  // from auth.betterAuth
env.DATABASE_URL;        // from database.postgres
env.STRIPE_SECRET_KEY;   // from payment.stripe
env.OPENAI_API_KEY;      // from ai.openai
env.RESEND_API_KEY;      // from email.resend
env.AWS_S3_BUCKET;       // from cloud.aws
```

### Deep Imports (Best for Bundle Size)

Import individual plugins for optimal tree-shaking:

```typescript
import { createEnv } from "nevr-env";
import { postgres } from "nevr-env/plugins/postgres";
import { stripe } from "nevr-env/plugins/stripe";
import { clerk } from "nevr-env/plugins/clerk";

export const env = createEnv({
  plugins: [
    postgres(),
    stripe({ webhook: true }),
    clerk({ organization: true }),
  ],
  runtimeEnv: process.env,
});
```

All plugins have standalone deep import paths: `nevr-env/plugins/postgres`, `nevr-env/plugins/redis`, `nevr-env/plugins/supabase`, `nevr-env/plugins/stripe`, `nevr-env/plugins/openai`, `nevr-env/plugins/resend`, `nevr-env/plugins/clerk`, `nevr-env/plugins/auth0`, `nevr-env/plugins/aws`, `nevr-env/plugins/better-auth`, `nevr-env/plugins/nextauth`.


## The `extend` Option

Every plugin supports `extend` to add custom fields:

```ts
const env = createEnv({
  plugins: [
    stripe({
      webhook: true,
      extend: {
        STRIPE_PRODUCT_ID: z.string().startsWith("prod_"),
        STRIPE_TAX_RATE_ID: z.string().startsWith("txr_").optional(),
      },
    }),
  ],
});
```

## Plugin Options

Each plugin accepts options to customize its behavior:

```typescript
// Authentication with OAuth
auth.betterAuth({
  providers: ["google", "github", "discord"],
  emailPassword: true,
  twoFactor: true,
})

// Database with pooling
database.postgres({
  pool: true,
  directUrl: true, // For Prisma
})

// Stripe with webhooks and subscriptions
payment.stripe({
  webhook: true,
  pricing: true,
  customerPortal: true,
})

// OpenAI with Azure
ai.openai({
  azure: true,
  model: true,
})

// AWS with multiple services
cloud.aws({
  s3: true,
  ses: true,
  sqs: true,
})
```

## Auto-Discovery

Plugins can automatically discover values from your environment. Both Docker and Podman are supported — the container runtime is detected automatically:

```bash
$ npx nevr-env fix

🔍 Auto-discovering values...
   ✓ DATABASE_URL: Found Postgres in Docker (localhost:5432)
   ✓ REDIS_URL: Found Redis in Podman (localhost:6379)
   ✓ AWS_REGION: Found in ~/.aws/config
```

## CLI Integration

Plugins provide helpful prompts and documentation links:

```bash
$ npx nevr-env fix

📝 Missing: STRIPE_SECRET_KEY
   Docs: https://dashboard.stripe.com/apikeys
   ? Enter your Stripe secret key: sk_test_****
```

## Creating Custom Plugins

See [Creating Plugins](/guide/creating-plugins) for a complete guide.

Quick example using the declarative `createPlugin` API:

```typescript
import { createPlugin } from "@nevr-env/core";
import { z } from "zod";

export const myService = createPlugin({
  id: "my-service",
  name: "My Service",
  prefix: "MY_SERVICE_",

  base: {
    MY_SERVICE_API_KEY: z.string().min(1),
  },

  when: {
    webhook: {
      MY_SERVICE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
    },
  },
});
```
