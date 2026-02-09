# Auth Namespace

The `auth` namespace provides authentication providers for popular auth libraries and services.

```ts
import { auth } from "nevr-env/plugins";
```

## Providers

| Provider | Description |
|----------|-------------|
| `auth.betterAuth()` | Better-Auth - Full-featured TypeScript auth library |
| `auth.clerk()` | Clerk - Drop-in authentication UI |
| `auth.auth0()` | Auth0 - Enterprise identity platform |
| `auth.nextauth()` | NextAuth.js / Auth.js - Authentication for Next.js |

---

## Better-Auth

Full-featured TypeScript authentication library with OAuth, email/password, magic links, and 2FA.

### Basic Usage

```ts
import { createEnv } from "nevr-env";
import { auth } from "nevr-env/plugins";

const env = createEnv({
  plugins: [auth.betterAuth()],
  runtimeEnv: process.env,
});

// env.BETTER_AUTH_SECRET
// env.BETTER_AUTH_URL
// env.BETTER_AUTH_TRUSTED_ORIGINS (optional)
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `providers` | `OAuthProvider[]` | `[]` | OAuth providers to include |
| `emailPassword` | `boolean` | `false` | Include email/password authentication |
| `magicLink` | `boolean` | `false` | Include magic link configuration |
| `twoFactor` | `boolean` | `false` | Include 2FA (TOTP) configuration |
| `session` | `boolean` | `false` | Include session configuration |
| `rateLimit` | `boolean` | `false` | Include rate limiting configuration |
| `variableNames` | `object` | - | Custom variable names |
| `extend` | `object` | - | Extend schema with custom fields |

### Available OAuth Providers

```ts
type OAuthProvider =
  | "google" | "github" | "discord" | "twitter" | "facebook"
  | "apple" | "microsoft" | "linkedin" | "spotify" | "twitch"
  | "slack" | "gitlab" | "bitbucket" | "dropbox" | "notion";
```

### Environment Variables by Option

#### Default (no options)

| Variable | Required | Description |
|----------|----------|-------------|
| `BETTER_AUTH_SECRET` | ✅ | Secret key for signing tokens (min 32 chars) |
| `BETTER_AUTH_URL` | ✅ | Base URL of your application |
| `BETTER_AUTH_TRUSTED_ORIGINS` | ❌ | Comma-separated list of trusted origins |

#### `providers: ["google", "github"]`

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | ✅ | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | ✅ | GitHub OAuth client secret |

#### `emailPassword: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BETTER_AUTH_EMAIL_VERIFICATION` | ❌ | `"true"` | Require email verification |
| `BETTER_AUTH_PASSWORD_MIN_LENGTH` | ❌ | `8` | Minimum password length |

#### `magicLink: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BETTER_AUTH_MAGIC_LINK_EXPIRY` | ❌ | `300` | Magic link expiry in seconds |

#### `twoFactor: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `BETTER_AUTH_2FA_ISSUER` | ❌ | TOTP issuer name for authenticator apps |

#### `session: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BETTER_AUTH_SESSION_EXPIRY` | ❌ | `604800` | Session expiry in seconds (7 days) |
| `BETTER_AUTH_SESSION_UPDATE_AGE` | ❌ | `86400` | Session update frequency (1 day) |

#### `rateLimit: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BETTER_AUTH_RATE_LIMIT_WINDOW` | ❌ | `60` | Rate limit window in seconds |
| `BETTER_AUTH_RATE_LIMIT_MAX` | ❌ | `100` | Maximum requests per window |

### Examples

```ts
// Full-featured setup
auth.betterAuth({
  providers: ["google", "github", "discord"],
  emailPassword: true,
  magicLink: true,
  twoFactor: true,
  session: true,
  rateLimit: true,
})

// Custom variable names
auth.betterAuth({
  variableNames: {
    secret: "AUTH_SECRET",
    url: "APP_URL",
  }
})
```

---

## Clerk

Drop-in authentication UI with built-in user management.

### Basic Usage

```ts
const env = createEnv({
  plugins: [auth.clerk()],
  runtimeEnv: process.env,
});

// env.CLERK_PUBLISHABLE_KEY
// env.CLERK_SECRET_KEY
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `jwtKey` | `boolean` | `false` | Include JWT verification key |
| `webhook` | `boolean` | `false` | Include webhook secret |
| `urls` | `boolean` | `false` | Include sign-in/sign-up URLs |
| `organization` | `boolean` | `false` | Include organization settings |
| `allowDevelopment` | `boolean` | `true` in dev | Allow test keys in production |
| `variableNames` | `object` | - | Custom variable names |
| `extend` | `object` | - | Extend schema with custom fields |

### Environment Variables by Option

#### Default (no options)

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `CLERK_PUBLISHABLE_KEY` | ✅ | `pk_test_*` or `pk_live_*` | Publishable key for client-side |
| `CLERK_SECRET_KEY` | ✅ | `sk_test_*` or `sk_live_*` | Secret key for server-side |

#### `jwtKey: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `CLERK_JWT_KEY` | ✅ | PEM-encoded public key for JWT verification |

#### `webhook: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `CLERK_WEBHOOK_SECRET` | ✅ | `whsec_*` | Webhook signing secret |

#### `urls: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLERK_SIGN_IN_URL` | ❌ | `/sign-in` | Sign-in page URL |
| `CLERK_SIGN_UP_URL` | ❌ | `/sign-up` | Sign-up page URL |
| `CLERK_AFTER_SIGN_IN_URL` | ❌ | `/` | Redirect after sign-in |
| `CLERK_AFTER_SIGN_UP_URL` | ❌ | `/` | Redirect after sign-up |

#### `organization: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `CLERK_ORGANIZATION_ID` | ❌ | Default organization ID |
| `CLERK_ORGANIZATION_SLUG` | ❌ | Default organization slug |

### Examples

```ts
// With webhooks and URLs
auth.clerk({
  webhook: true,
  urls: true,
  organization: true,
})

// Production-only keys
auth.clerk({
  allowDevelopment: false,
})
```

---

## Auth0

Enterprise identity platform with social login and SSO.

### Basic Usage

```ts
const env = createEnv({
  plugins: [auth.auth0()],
  runtimeEnv: process.env,
});

// env.AUTH0_DOMAIN
// env.AUTH0_CLIENT_ID
// env.AUTH0_CLIENT_SECRET
// env.AUTH0_BASE_URL
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `api` | `boolean` | `false` | Include API audience configuration |
| `m2m` | `boolean` | `false` | Include M2M client credentials |
| `management` | `boolean` | `false` | Include Management API credentials |
| `variableNames` | `object` | - | Custom variable names |
| `extend` | `object` | - | Extend schema with custom fields |

### Environment Variables by Option

#### Default (no options)

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `AUTH0_DOMAIN` | ✅ | `*.auth0.com` | Auth0 tenant domain |
| `AUTH0_CLIENT_ID` | ✅ | - | Application client ID |
| `AUTH0_CLIENT_SECRET` | ✅ | - | Application client secret |
| `AUTH0_BASE_URL` | ✅ | URL | Your application base URL |
| `AUTH0_ISSUER_BASE_URL` | ❌ | URL | Auth0 issuer URL |

#### `api: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH0_AUDIENCE` | ✅ | - | API identifier/audience URL |
| `AUTH0_SCOPE` | ❌ | `openid profile email` | OAuth scopes |

#### `m2m: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH0_M2M_CLIENT_ID` | ✅ | M2M application client ID |
| `AUTH0_M2M_CLIENT_SECRET` | ✅ | M2M application client secret |

#### `management: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH0_MGMT_CLIENT_ID` | ✅ | Management API client ID |
| `AUTH0_MGMT_CLIENT_SECRET` | ✅ | Management API client secret |

### Examples

```ts
// Full setup with API and Management
auth.auth0({
  api: true,
  management: true,
})

// M2M communication
auth.auth0({
  m2m: true,
})
```

---

## NextAuth.js

Authentication for Next.js applications (Auth.js).

### Basic Usage

```ts
const env = createEnv({
  plugins: [auth.nextauth()],
  runtimeEnv: process.env,
});

// env.NEXTAUTH_SECRET
// env.NEXTAUTH_URL (optional)
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `providers` | `OAuthProvider[]` | `[]` | OAuth providers to include |
| `database` | `boolean` | `false` | Include database adapter config |
| `email` | `boolean` | `false` | Include email provider config |
| `debug` | `boolean` | `false` | Include debug mode |
| `variableNames` | `object` | - | Custom variable names |
| `extend` | `object` | - | Extend schema with custom fields |

### Environment Variables by Option

#### Default (no options)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXTAUTH_SECRET` | ✅ | Secret for token encryption (min 32 chars) |
| `NEXTAUTH_URL` | ❌ | Canonical URL (required in production) |

#### `providers: ["google", "github"]`

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | ✅ | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | ✅ | GitHub OAuth client secret |

#### `database: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Database connection URL for adapter |

#### `email: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `EMAIL_SERVER` | ✅ | SMTP connection string |
| `EMAIL_FROM` | ✅ | From email address |

#### `debug: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXTAUTH_DEBUG` | ❌ | `"false"` | Enable debug mode |

### Examples

```ts
// With OAuth providers and database
auth.nextauth({
  providers: ["google", "github"],
  database: true,
})

// With email magic links
auth.nextauth({
  email: true,
})
```
