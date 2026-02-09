# Vite Integration

nevr-env works great with Vite for both React and Vue applications.

## Setup

### 1. Install

```bash
npm install nevr-env zod
```

### 2. Create env.ts

```ts
// src/env.ts
import { createEnv } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET: z.string(),
  },
  client: {
    VITE_API_URL: z.string().url(),
    VITE_APP_TITLE: z.string(),
  },
  clientPrefix: "VITE_",
  runtimeEnv: import.meta.env,
});
```

### 3. TypeScript Setup

Add to `vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_TITLE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

## Usage

### In Components

```tsx
// src/App.tsx
import { env } from "./env";

function App() {
  return (
    <div>
      <h1>{env.VITE_APP_TITLE}</h1>
      <p>API: {env.VITE_API_URL}</p>
    </div>
  );
}
```

### In Config Files

```ts
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  define: {
    // Manually expose if needed
  },
});
```

## With Plugins

```ts
import { createEnv, postgres, stripe } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  plugins: [postgres(), stripe()],
  client: {
    VITE_STRIPE_KEY: z.string(),
    VITE_API_URL: z.string().url(),
  },
  clientPrefix: "VITE_",
  runtimeEnv: import.meta.env,
});
```

## SSR (Server-Side Rendering)

For Vite SSR setups:

```ts
// src/env.ts
import { createEnv } from "nevr-env";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    SESSION_SECRET: z.string(),
  },
  client: {
    VITE_API_URL: z.string().url(),
  },
  clientPrefix: "VITE_",
  runtimeEnv: typeof window === "undefined" 
    ? process.env 
    : import.meta.env,
});
```

## Vue

Works the same in Vue:

```vue
<script setup lang="ts">
import { env } from "./env";
</script>

<template>
  <div>
    <h1>{{ env.VITE_APP_TITLE }}</h1>
  </div>
</template>
```

## React + Vite

```tsx
import { env } from "./env";

export function ApiStatus() {
  const [status, setStatus] = useState<string>();
  
  useEffect(() => {
    fetch(`${env.VITE_API_URL}/health`)
      .then(r => r.json())
      .then(setStatus);
  }, []);
  
  return <span>{status}</span>;
}
```

## Build Validation

Vite build will fail if required variables are missing:

```bash
$ vite build

❌ Invalid environment variables:

  • VITE_API_URL: Required

💡 Tip: Run `npx nevr-env fix` to interactively fix missing variables.
```

## Environment Files

Vite supports multiple `.env` files:

```
.env                # Loaded in all cases
.env.local          # Loaded in all cases, ignored by git
.env.development    # Only in development
.env.production     # Only in production
```

nevr-env validates whichever file Vite loads.
