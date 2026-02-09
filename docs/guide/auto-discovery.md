# Auto-Discovery

Plugins can automatically discover environment values from your development environment, reducing manual configuration.

## How It Works

When you run `npx nevr-env fix`, plugins check multiple sources:

1. **Docker containers** - Running databases, caches
2. **Config files** - `docker-compose.yml`, `.env.example`
3. **Cloud environment** - Vercel, Railway, Netlify variables
4. **Local files** - Existing `.env` files

## Docker Discovery

The postgres and redis plugins automatically detect running containers:

```bash
$ npx nevr-env fix

Discovering environment...

Found:
  • PostgreSQL container: localhost:5432/mydb
  • Redis container: localhost:6379

? Use discovered DATABASE_URL? (postgres://postgres:postgres@localhost:5432/mydb)
❯ Yes
  No, enter manually
```

### How Docker Discovery Works

```ts
// The postgres plugin checks:
// 1. docker ps for postgres containers
// 2. Extracts port mappings
// 3. Reads POSTGRES_* env vars from container
// 4. Constructs connection string

postgres({
  autoDiscover: true,
})
```

## docker-compose.yml Discovery

Plugins parse your `docker-compose.yml` for service configurations:

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypass
      POSTGRES_DB: mydb
    ports:
      - "5432:5432"
```

```bash
$ npx nevr-env fix

Found in docker-compose.yml:
  DATABASE_URL: postgres://myuser:mypass@localhost:5432/mydb

? Apply discovered values?
```

## Cloud Platform Discovery

When running in cloud environments, plugins detect platform-specific variables:

### Vercel

```ts
import { vercel } from "nevr-env/presets";

// Automatically uses:
// - VERCEL_URL
// - VERCEL_ENV
// - POSTGRES_URL (Vercel Postgres)
// - KV_URL (Vercel KV)
```

### Railway

```ts
import { railway } from "nevr-env/presets";

// Automatically uses:
// - RAILWAY_ENVIRONMENT
// - DATABASE_URL (Railway Postgres)
// - REDIS_URL (Railway Redis)
```

## Enabling Auto-Discovery

Auto-discovery is enabled by default for all plugins. You can disable it per-plugin:

```ts
import { createEnv, postgres, redis, stripe } from "nevr-env";

const env = createEnv({
  plugins: [
    postgres(),                        // autoDiscover defaults to true
    redis({ autoDiscover: true }),     // explicit enable
    stripe({ autoDiscover: false }),   // disable for this plugin
  ],
  runtimeEnv: process.env,
});
```

When `autoDiscover` is `false`, the CLI wizard will skip the discovery step for that plugin and prompt for manual input instead.

<!-- ## CLI Discovery Commands

```bash
# Discover and show all found values
npx nevr-env discover

# Fix missing variables with discovery
npx nevr-env fix --discover

# Generate .env from discovered values
npx nevr-env init --discover
``` -->

## Custom Discovery

Plugins can implement custom discovery logic:

```ts
import { createPlugin } from "nevr-env";

const myPlugin = createPlugin({
  id: "my-plugin",
  name: "My Plugin",
  schema: () => ({
    MY_VAR: z.string(),
  }),
  discover: async () => {
    // Check config files, APIs, etc.
    const value = await findMyValue();
    return value ? { MY_VAR: value } : undefined;
  },
});
```

## Security Considerations

- Discovery only runs locally (development)
- Discovered values are shown but not auto-applied
- Sensitive values require confirmation
- Production deployments should use explicit configuration
