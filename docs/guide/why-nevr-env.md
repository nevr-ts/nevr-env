# Why nevr-env?

We built nevr-env because existing solutions weren't solving the **real problems** developers face with environment variables.

## The Real Problems

### 1. "It works on my machine"

New developer joins the team:

```
Day 1: Clone repo
Day 1: npm run dev
Day 1: "Missing DATABASE_URL"
Day 1: Slack: "Hey can someone send me the .env?"
Day 2: Still waiting...
Day 2: Gets partial .env, missing 3 variables
Day 3: Finally works
```

**nevr-env solution**: `npx nevr-env vault pull` → Working in 10 seconds.

### 2. Type Safety Theater

Most "type-safe" env solutions:

```typescript
// Sure, it's "typed"...
const env = {
  DATABASE_URL: process.env.DATABASE_URL!, // trust me bro
  PORT: Number(process.env.PORT), // could be NaN
  DEBUG: process.env.DEBUG === "true", // "" is false? "1"?
};
```

**nevr-env solution**: Real validation with Zod/Valibot at startup:

```typescript
const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().default(3000),
    DEBUG: z.coerce.boolean().default(false),
  },
});
// Crashes immediately if invalid, with helpful error
```

### 3. Copy-Paste Schemas

Every project:
- Copy Stripe schema from last project
- Copy Postgres schema from docs
- Copy OpenAI schema from tutorial
- Realize they're all slightly different
- Spend 30 mins debugging

**nevr-env solution**: Official plugins with battle-tested schemas:

```typescript
import { createEnv, postgres, stripe } from "nevr-env";

const env = createEnv({
  plugins: [postgres(), stripe()],
});
```

### 4. Security Incidents

Junior dev adds to client bundle:

```typescript
// components/Payment.tsx
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // 😱
```

**nevr-env solution**: Proxy throws error immediately:

```typescript
// On client-side, this throws:
env.STRIPE_SECRET_KEY;
// ❌ Error: Attempted to access server-side variable on client
```

### 5. .env.example Lies

Your `.env.example`:
```
DATABASE_URL=your-database-url-here
STRIPE_SECRET_KEY=sk_test_xxx
API_KEY=
```

Reality:
- What format is DATABASE_URL?
- Is STRIPE_SECRET_KEY required?
- What should API_KEY be?

**nevr-env solution**: Schema IS the documentation:

```typescript
server: {
  DATABASE_URL: z.string().url().describe("PostgreSQL connection URL"),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  API_KEY: z.string().min(32).optional(),
}
```

## What Makes nevr-env Different

### vs t3-env

| Feature | t3-env | nevr-env |
|---------|--------|----------|
| Type-safe validation | ✅ | ✅ |
| Server/client split | ✅ | ✅ |
| Standard Schema V1 | ✅ | ✅ |
| **Plugin system** | ❌ | ✅ |
| **Auto-discovery** | ❌ | ✅ |
| **CLI wizard** | ❌ | ✅ |
| **Encrypted vault** | ❌ | ✅ |
| **Dev wrapper** | ❌ | ✅ |

t3-env is great, but it's just validation. nevr-env is an **environment lifecycle framework**.

### vs Doppler/Infisical

| Feature | Doppler | nevr-env |
|---------|---------|----------|
| Centralized secrets | ✅ (their server) | ✅ (your git) |
| Team sharing | ✅ | ✅ |
| Type safety | ❌ | ✅ |
| Free | ❌ (free tier limits) | ✅ |
| Self-hosted | ❌ | ✅ (it's just a file) |
| Offline | ❌ | ✅ |
| Vendor lock-in | ✅ | ❌ |

### vs dotenv-vault

| Feature | dotenv-vault | nevr-env |
|---------|--------------|----------|
| Encrypted vault | ✅ | ✅ |
| Type safety | ❌ | ✅ |
| Schema validation | ❌ | ✅ |
| Plugin system | ❌ | ✅ |
| CLI wizard | ❌ | ✅ |
| Free | ✅ (with limits) | ✅ (unlimited) |

## The Philosophy

### 1. Local-First

Your secrets live in your repo (encrypted). No external service dependency.

### 2. Schema as Documentation

If it's not in the schema, it doesn't exist. No more .env.example.

### 3. Plugins > Boilerplate

Don't write Stripe validation for the 100th time. Use a plugin.

### 4. Developer Experience

Setup should be one command, not a 15-step guide.

### 5. Security by Default

Server secrets can't leak to client. Validation happens at startup.

## Migration

Already using t3-env? See our [Migration Guide](/guide/migration).

Already using dotenv? Just add nevr-env on top:

```typescript
// Before
import "dotenv/config";
const dbUrl = process.env.DATABASE_URL;

// After
import { env } from "./env";
const dbUrl = env.DATABASE_URL; // Now typed and validated
```
