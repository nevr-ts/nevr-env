# Next.js Integration

nevr-env works seamlessly with Next.js, providing type-safe environment variables for both server and client.

## Setup

### 1. Install

```bash
npm install nevr-env zod
```

### 2. Create env.ts

```ts
// src/env.ts (or lib/env.ts)
import { createEnv } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string().min(1),
    NODE_ENV: z.enum(["development", "test", "production"]),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
    NEXT_PUBLIC_APP_NAME: z.string(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    API_SECRET: process.env.API_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  },
});
```

### 3. Use in Your App

```tsx
// Server Component
import { env } from "@/env";

export default async function Page() {
  // ✅ Server variables work in Server Components
  const data = await db.query(env.DATABASE_URL);
  
  return <div>{env.NEXT_PUBLIC_APP_NAME}</div>;
}
```

```tsx
// Client Component
"use client";
import { env } from "@/env";

export function ClientComponent() {
  // ✅ Client variables work
  console.log(env.NEXT_PUBLIC_API_URL);
  
  // ❌ Server variables throw
  // console.log(env.DATABASE_URL);
  
  return <div>...</div>;
}
```

## With Plugins

```ts
import { createEnv, postgres, stripe } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  plugins: [postgres(), stripe()],
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
  },
  client: {
    NEXT_PUBLIC_STRIPE_KEY: z.string(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});
```

## App Router

### Server Components

```tsx
// app/page.tsx
import { env } from "@/env";

export default function Home() {
  return (
    <div>
      <h1>{env.NEXT_PUBLIC_APP_NAME}</h1>
      {/* Server vars available in Server Components */}
      <p>DB: {env.DATABASE_URL.split("@")[1]}</p>
    </div>
  );
}
```

### API Routes

```ts
// app/api/route.ts
import { env } from "@/env";
import { NextResponse } from "next/server";

export async function GET() {
  // Full access to server variables
  const result = await fetch(env.API_SECRET);
  return NextResponse.json({ success: true });
}
```

### Server Actions

```ts
// app/actions.ts
"use server";
import { env } from "@/env";

export async function createUser(data: FormData) {
  // Server variables available
  await db.connect(env.DATABASE_URL);
}
```

## Pages Router

### getServerSideProps

```tsx
import { env } from "@/env";

export async function getServerSideProps() {
  // Server variables available
  const data = await fetch(env.DATABASE_URL);
  return { props: { data } };
}
```

### API Routes

```ts
// pages/api/hello.ts
import { env } from "@/env";

export default function handler(req, res) {
  // Full access to server variables
  res.json({ env: env.NODE_ENV });
}
```

## Type Safety

```tsx
import { env } from "@/env";

// TypeScript knows the types
const url: string = env.DATABASE_URL;
const port: number = env.PORT; // Error if PORT is string

// Autocomplete works
env. // Shows: DATABASE_URL, API_SECRET, NEXT_PUBLIC_API_URL, etc.
```

## Build-Time Validation

nevr-env validates at build time, failing fast if variables are missing:

```bash
$ next build

❌ Invalid environment variables:

  • DATABASE_URL: Required
  • STRIPE_SECRET_KEY: Invalid format

💡 Tip: Run `npx nevr-env fix` to interactively fix missing variables.
```

## Edge Runtime

For Edge Runtime (middleware, edge API routes):

```ts
// middleware.ts
import { env } from "@/env";

export function middleware(request: Request) {
  // Works in Edge Runtime
  console.log(env.NEXT_PUBLIC_API_URL);
}

export const config = {
  matcher: "/api/:path*",
};
```
