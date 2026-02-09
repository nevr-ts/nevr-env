# Server vs Client

nevr-env enforces a strict separation between server-side and client-side environment variables to prevent accidentally leaking secrets to the browser.

## The Problem

In frameworks like Next.js, it's easy to accidentally expose server secrets:

```ts
// ❌ DANGEROUS - This leaks to the browser!
const apiKey = process.env.API_SECRET_KEY;

export default function Page() {
  return <div>...</div>;
}
```

## The Solution

nevr-env separates variables into `server` and `client` schemas:

```ts
import { createEnv } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  // Server-only - never exposed to browser
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET_KEY: z.string(),
    JWT_SECRET: z.string(),
  },
  
  // Client-safe - exposed to browser
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_APP_NAME: z.string(),
  },
  
  // Client prefix (framework-specific)
  clientPrefix: "NEXT_PUBLIC_",
  
  runtimeEnv: process.env,
});
```

## How It Works

### Server Variables

- Only accessible in server-side code (API routes, `getServerSideProps`, etc.)
- Accessing from client code throws a runtime error
- Never bundled into client JavaScript

### Client Variables

- Accessible everywhere (server and client)
- Must have the correct prefix (`NEXT_PUBLIC_`, `VITE_`, etc.)
- Bundled into client JavaScript (so keep them non-sensitive!)

## Client Prefix

Different frameworks use different prefixes for client-safe variables:

| Framework | Prefix |
|-----------|--------|
| Next.js | `NEXT_PUBLIC_` |
| Nuxt | `NUXT_PUBLIC_` |
| Vite / SvelteKit | `VITE_` |
| Remix / Astro | `PUBLIC_` |
| Create React App | `REACT_APP_` |
| Express / Hono / Fastify | _(no prefix — server-only)_ |

```ts
// Next.js
const env = createEnv({
  clientPrefix: "NEXT_PUBLIC_",
  // ...
});

// Vite
const env = createEnv({
  clientPrefix: "VITE_",
  // ...
});
```

## Runtime Protection

Attempting to access server variables from client code throws an error:

```ts
// In client-side code
import { env } from "./env";

// ❌ Throws: "Attempted to access server-side environment variable 
//           DATABASE_URL on the client."
console.log(env.DATABASE_URL);

// ✅ Works fine
console.log(env.NEXT_PUBLIC_API_URL);
```

## Custom Invalid Access Handler

```ts
const env = createEnv({
  server: { SECRET: z.string() },
  client: { PUBLIC_URL: z.string() },
  clientPrefix: "PUBLIC_",
  runtimeEnv: process.env,
  
  onInvalidAccess: (variableName) => {
    // Must throw - return type is `never`
    throw new Error(`Security: Blocked access to ${variableName}`);
  },
});
```

## Shared Variables

For variables needed on both server and client:

```ts
const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  // Shared - validated on both, but typically server-only
  shared: {
    NODE_ENV: z.enum(["development", "test", "production"]),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});
```

## Best Practices

1. **Never put secrets in client variables** - They're visible in browser DevTools
2. **Use descriptive prefixes** - Makes it obvious what's client-safe
3. **Validate client variables** - Even public data should be validated
4. **Use TypeScript** - Catch server/client access errors at compile time
