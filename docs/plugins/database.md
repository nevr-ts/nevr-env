# Database Namespace

The `database` namespace provides database providers for common database services.

```ts
import { database } from "nevr-env/plugins";
```

## Providers

| Provider | Description |
|----------|-------------|
| `database.postgres()` | PostgreSQL with Docker/Podman auto-discovery |
| `database.redis()` | Redis with Upstash and cluster support |
| `database.supabase()` | Supabase Backend-as-a-Service |

---

## PostgreSQL

PostgreSQL database with Docker/Podman auto-discovery, connection pooling, and Prisma support.

### Basic Usage

```ts
import { createEnv } from "nevr-env";
import { database } from "nevr-env/plugins";

const env = createEnv({
  plugins: [database.postgres()],
  runtimeEnv: process.env,
});

// env.DATABASE_URL
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `readReplica` | `boolean` | `false` | Include read replica URL |
| `directUrl` | `boolean` | `false` | Include direct URL (for Prisma) |
| `shadowDatabase` | `boolean` | `false` | Include shadow database URL |
| `pool` | `boolean` | `false` | Include connection pool settings |
| `ssl` | `boolean` | `false` | Include SSL mode configuration |
| `defaultPort` | `number` | `5432` | Default port for Docker discovery |
| `dockerContainerName` | `string` | - | Custom Docker container name |
| `variableNames` | `object` | - | Custom variable names |
| `extend` | `object` | - | Extend schema with custom fields |

### Environment Variables by Option

#### Default (no options)

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `DATABASE_URL` | ✅ | `postgres://` or `postgresql://` | Connection string |

#### `readReplica: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_READ_REPLICA_URL` | ✅ | Read replica connection string |

#### `directUrl: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `DIRECT_URL` | ✅ | Direct connection URL (bypasses PgBouncer) |

#### `shadowDatabase: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `SHADOW_DATABASE_URL` | ✅ | Shadow database for Prisma migrations |

#### `pool: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_POOL_SIZE` | ❌ | `10` | Connection pool size |
| `DATABASE_POOL_MIN` | ❌ | `2` | Minimum connections |
| `DATABASE_POOL_MAX` | ❌ | `10` | Maximum connections |
| `DATABASE_CONNECTION_TIMEOUT` | ❌ | `10000` | Connection timeout (ms) |
| `DATABASE_IDLE_TIMEOUT` | ❌ | `10000` | Idle timeout (ms) |

#### `ssl: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_SSL_MODE` | ❌ | `prefer` | SSL mode (disable/prefer/require/verify-full) |

### Auto-Discovery

PostgreSQL plugin automatically discovers databases from:
- **Docker / Podman containers** - Looks for containers with "postgres" or "pg" in name (auto-detects runtime)
- **Environment variables** - Existing `DATABASE_URL`
- **Local defaults** - `postgresql://postgres:postgres@localhost:5432/postgres`

### Examples

```ts
// Prisma with connection pooling
database.postgres({
  directUrl: true,
  pool: true,
})

// With read replicas
database.postgres({
  readReplica: true,
  ssl: true,
})

// Custom variable names
database.postgres({
  variableNames: {
    url: "PG_URL",
    directUrl: "PG_DIRECT_URL",
  }
})

// Extend with custom fields
database.postgres({
  extend: {
    DATABASE_SCHEMA: z.string().default("public"),
    DATABASE_DEBUG: z.coerce.boolean().default(false),
  }
})
```

---

## Redis

Redis with Docker/Podman auto-discovery, cluster support, and Upstash integration.

### Basic Usage

```ts
const env = createEnv({
  plugins: [database.redis()],
  runtimeEnv: process.env,
});

// env.REDIS_URL
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cluster` | `boolean` | `false` | Include cluster configuration |
| `tls` | `boolean` | `false` | Require TLS connections |
| `upstash` | `boolean` | `false` | Include Upstash REST API config |
| `pool` | `boolean` | `false` | Include connection pool settings |
| `keyPrefix` | `boolean` | `false` | Include key prefix for namespacing |
| `sentinel` | `boolean` | `false` | Include sentinel configuration |
| `variableNames` | `object` | - | Custom variable names |
| `extend` | `object` | - | Extend schema with custom fields |

### Environment Variables by Option

#### Default (no options)

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `REDIS_URL` | ✅ | `redis://` or `rediss://` | Redis connection URL |

#### `cluster: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_CLUSTER_NODES` | ✅ | Comma-separated list of cluster nodes |

#### `tls: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `REDIS_TLS_URL` | ✅ | `rediss://` | TLS-enabled Redis URL |

#### `upstash: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash REST API URL |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash REST API token |

#### `pool: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_MAX_CONNECTIONS` | ❌ | `10` | Maximum connections |
| `REDIS_MIN_CONNECTIONS` | ❌ | `2` | Minimum connections |

#### `keyPrefix: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_KEY_PREFIX` | ❌ | Key prefix for namespacing |

#### `sentinel: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_SENTINEL_MASTER` | ✅ | Sentinel master name |

### Auto-Discovery

Redis plugin discovers from:
- **Docker / Podman containers** - redis, bitnami/redis images (auto-detects runtime)
- **Cloud providers** - Upstash, Heroku Redis, Redis Cloud

### Examples

```ts
// Upstash serverless Redis
database.redis({
  upstash: true,
})

// Cluster with TLS
database.redis({
  cluster: true,
  tls: true,
})

// With caching configuration
database.redis({
  keyPrefix: true,
  extend: {
    REDIS_CACHE_TTL: z.coerce.number().default(3600),
  }
})
```

---

## Supabase

Supabase Backend-as-a-Service with database, storage, and auth.

### Basic Usage

```ts
const env = createEnv({
  plugins: [database.supabase()],
  runtimeEnv: process.env,
});

// env.SUPABASE_URL
// env.SUPABASE_ANON_KEY
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serviceRole` | `boolean` | `false` | Include service role key |
| `jwtSecret` | `boolean` | `false` | Include JWT secret |
| `database` | `boolean` | `false` | Include direct database URL |
| `pooler` | `boolean` | `false` | Include pooler connection URL |
| `storage` | `boolean` | `false` | Include storage bucket config |
| `realtime` | `boolean` | `false` | Include realtime configuration |
| `variableNames` | `object` | - | Custom variable names |
| `extend` | `object` | - | Extend schema with custom fields |

### Environment Variables by Option

#### Default (no options)

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `SUPABASE_URL` | ✅ | `*.supabase.co` | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | JWT (`eyJ...`) | Anonymous key for client-side |

#### `serviceRole: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | JWT (`eyJ...`) | Service role key (bypasses RLS) |

::: warning
Never expose the service role key on the client-side!
:::

#### `jwtSecret: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_JWT_SECRET` | ✅ | JWT secret (min 32 chars) |

#### `database: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `SUPABASE_DATABASE_URL` | ✅ | `postgresql://` | Direct database connection |

#### `pooler: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `SUPABASE_POOLER_URL` | ✅ | `postgresql://*:6543` | Pooler connection (serverless) |

#### `storage: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_STORAGE_BUCKET` | ❌ | Default storage bucket name |

### Examples

```ts
// Full server-side setup
database.supabase({
  serviceRole: true,
  database: true,
})

// Serverless with pooler
database.supabase({
  pooler: true,
  storage: true,
})

// Custom redirect URLs
database.supabase({
  extend: {
    SUPABASE_REDIRECT_URL: z.string().url(),
    SUPABASE_SITE_URL: z.string().url(),
  }
})
```
