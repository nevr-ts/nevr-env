# Plugins

Plugins extend nevr-env with pre-built schemas, auto-discovery, and CLI integration for popular services.

## Why Plugins?

Instead of manually defining schemas for every service:

```ts
// ❌ Without plugins - repetitive and error-prone
const env = createEnv({
  server: {
    DATABASE_URL: z.string().url().refine(s => s.startsWith("postgres://")),
    STRIPE_SECRET_KEY: z.string().regex(/^sk_(test|live)_/),
    CLERK_SECRET_KEY: z.string(),
    // ... more boilerplate
  },
  runtimeEnv: process.env,
});
```

Use plugins with namespaces:

```ts
// ✅ With plugins - instant, correct, discoverable
import { createEnv } from "nevr-env";
import { auth, database, payment } from "nevr-env/plugins";

const env = createEnv({
  plugins: [
    auth.clerk(),
    database.postgres({ pool: true }),
    payment.stripe({ webhook: true }),
  ],
  runtimeEnv: process.env,
});

// env.CLERK_SECRET_KEY, env.DATABASE_URL, env.STRIPE_SECRET_KEY - all typed!
```

## Available Namespaces

### auth - Authentication Providers
- **betterAuth** - Better-Auth with OAuth providers
- **clerk** - Clerk authentication
- **auth0** - Auth0 identity platform
- **nextauth** - NextAuth.js / Auth.js

### database - Database Providers
- **postgres** - PostgreSQL with Docker auto-discovery
- **redis** - Redis with Upstash support
- **supabase** - Supabase Backend-as-a-Service

### payment - Payment Providers
- **stripe** - Stripe payments with webhooks

### ai - AI/LLM Providers
- **openai** - OpenAI API with Azure support

### email - Email Providers
- **resend** - Resend email API

### cloud - Cloud Providers
- **aws** - AWS services (S3, SES, SQS, etc.)

## Using Plugins

```ts
import { createEnv } from "nevr-env";
import { auth, database, payment, ai, email, cloud } from "nevr-env/plugins";

const env = createEnv({
  plugins: [
    // Authentication
    auth.betterAuth({ providers: ["google", "github"] }),
    
    // Database
    database.postgres({ pool: true }),
    database.redis({ cluster: true }),
    
    // Payments
    payment.stripe({ webhook: true }),
    
    // AI
    ai.openai({ organization: true }),
    
    // Email
    email.resend({ fromEmail: true }),
    
    // Cloud
    cloud.aws({ s3: true, ses: true }),
  ],
  server: {
    // Add your custom variables
    NODE_ENV: z.enum(["development", "test", "production"]),
  },
  runtimeEnv: process.env,
});
```
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

### Authentication Plugins

#### Better-Auth Options

```ts
auth.betterAuth({
  // OAuth providers to include
  providers: ["google", "github", "discord"],
  // Include email/password fields
  emailPassword: true,
  // Include magic link configuration
  magicLink: true,
  // Include 2FA configuration
  twoFactor: true,
  // Include session configuration
  session: true,
  // Include rate limiting
  rateLimit: true,
})
```

#### Clerk Options

```ts
auth.clerk({
  // Include JWT verification key
  jwtKey: true,
  // Include webhook secret
  webhook: true,
  // Include sign-in/sign-up URLs
  urls: true,
  // Include organization settings
  organization: true,
})
```

#### Auth0 Options

```ts
auth.auth0({
  // Include custom domain
  domain: true,
  // Include Management API settings
  management: true,
  // Include API audience
  api: true,
})
```

#### NextAuth Options

```ts
auth.nextauth({
  // OAuth providers
  providers: ["google", "github"],
  // Include database adapter config
  database: true,
})
```

### Database Plugins

#### PostgreSQL Options

```ts
database.postgres({
  // Include read replica URL field
  readReplica: true,
  // Include connection pool settings
  pool: true,
  // SSL settings
  ssl: true,
  // Custom variable names
  variableNames: {
    url: "MY_DATABASE_URL",
    host: "DB_HOST",
  },
})
```

#### Redis Options

```ts
database.redis({
  // Include cluster configuration
  cluster: true,
  // Include sentinel configuration
  sentinel: true,
  // Require TLS connections
  tls: true,
  // Custom variable names
  variableNames: {
    url: "REDIS_URL",
  },
})
```

#### Supabase Options

```ts
database.supabase({
  // Include direct database connection
  database: true,
  // Include storage configuration
  storage: true,
  // Include edge functions config
  functions: true,
})
```

### Payment Plugins

#### Stripe Options

```ts
payment.stripe({
  // Only allow test keys (useful for development)
  testMode: true,
  // Include webhook secret field
  webhook: true,
  // Include Stripe Connect configuration
  connect: true,
  // Custom variable names
  variableNames: {
    secretKey: "MY_STRIPE_KEY",
  },
})
```

### AI Plugins

#### OpenAI Options

```ts
ai.openai({
  // Include organization ID field
  organization: true,
  // Include project ID field
  project: true,
  // Include model configuration
  model: true,
  // Default model to use
  defaultModel: "gpt-4o",
  // Include Azure OpenAI configuration
  azure: true,
})
```

### Email Plugins

#### Resend Options

```ts
email.resend({
  // Include from email configuration
  fromEmail: true,
  // Include audience/contacts configuration
  audience: true,
  // Include webhook secret
  webhook: true,
})
```

### Cloud Plugins

#### AWS Options

```ts
cloud.aws({
  // Include S3 configuration
  s3: true,
  // Include SES email configuration
  ses: true,
  // Include SQS queue configuration
  sqs: true,
  // Include Lambda configuration
  lambda: true,
  // AWS region
  region: "us-east-1",
})
```
Full documentation for each plugin is available in the [Plugins Reference](/plugins/overview) section.
## Auto-Discovery

Plugins automatically discover configuration from:

- **Docker / Podman containers** - Running postgres/redis containers (auto-detects `docker` or `podman` CLI)
- **Config files** - `docker-compose.yml`, `.env.example`
- **Cloud providers** - Vercel, Railway, Heroku environment detection
- **AWS credentials** - `~/.aws/credentials` and `~/.aws/config` files

Auto-discovery is enabled by default for all plugins. It works with both Docker and Podman — the container runtime is detected automatically, so no configuration is needed. You can disable it per-plugin:

```ts
database.postgres({ autoDiscover: false })
```

## CLI Integration

Plugins integrate with the CLI wizard:

```bash
$ npx nevr-env fix

Missing: DATABASE_URL
[postgres plugin detected]

? How would you like to set DATABASE_URL?
❯ Use discovered Docker container (postgres:5432/mydb)
  Enter connection string manually
  Skip for now
```

## Tree-Shaking & Deep Imports

For optimal bundle size, use standalone deep imports instead of the barrel export. Each plugin has its own entry point that only pulls in the code for that specific plugin:

```ts
// ✅ Best for bundle size — only loads the postgres plugin code
import { postgres } from "nevr-env/plugins/postgres";
import { stripe } from "nevr-env/plugins/stripe";

const env = createEnv({
  plugins: [postgres(), stripe({ webhook: true })],
  runtimeEnv: process.env,
});
```

Available deep import paths:

| Import Path | Plugin |
|---|---|
| `nevr-env/plugins/postgres` | PostgreSQL |
| `nevr-env/plugins/redis` | Redis |
| `nevr-env/plugins/supabase` | Supabase |
| `nevr-env/plugins/stripe` | Stripe |
| `nevr-env/plugins/openai` | OpenAI |
| `nevr-env/plugins/resend` | Resend |
| `nevr-env/plugins/clerk` | Clerk |
| `nevr-env/plugins/auth0` | Auth0 |
| `nevr-env/plugins/aws` | AWS |
| `nevr-env/plugins/better-auth` | Better Auth |
| `nevr-env/plugins/nextauth` | NextAuth |

You can also import by namespace (pulls all providers in that namespace):

```ts
import { auth } from "nevr-env/plugins/auth";
import { database } from "nevr-env/plugins/database";
```

Or use the barrel export when bundle size is not a concern:

```ts
// Pulls all plugins — convenient but heavier
import { auth, database, payment } from "nevr-env/plugins";
```

## Next Steps

- [Creating Plugins](/guide/creating-plugins) - Build your own plugins
- [PostgreSQL Plugin](/plugins/database) - Full documentation
- [Stripe Plugin](/plugins/payment) - Full documentation
- [Authentication Guide](/plugins/auth) - Auth plugin usage
