# Payment Namespace

The `payment` namespace provides payment processing providers.

```ts
import { payment } from "nevr-env/plugins";
```

## Providers

| Provider | Description |
|----------|-------------|
| `payment.stripe()` | Stripe - Payment processing platform |

---

## Stripe

Full-featured Stripe integration with webhooks, Connect, and checkout support.

### Basic Usage

```ts
import { createEnv } from "nevr-env";
import { payment } from "nevr-env/plugins";

const env = createEnv({
  plugins: [payment.stripe()],
  runtimeEnv: process.env,
});

// env.STRIPE_SECRET_KEY
// env.STRIPE_PUBLISHABLE_KEY
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `webhook` | `boolean` | `false` | Include webhook secret |
| `testMode` | `boolean` | `true` in dev | Allow test mode keys |
| `customerPortal` | `boolean` | `false` | Include customer portal config |
| `connect` | `boolean` | `false` | Include Stripe Connect config |
| `checkout` | `boolean` | `false` | Include checkout URLs |
| `pricingTable` | `boolean` | `false` | Include pricing table ID |
| `pricing` | `boolean` | `false` | Include price IDs |
| `variableNames` | `object` | - | Custom variable names |
| `extend` | `object` | - | Extend schema with custom fields |

### Environment Variables by Option

#### Default (no options)

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `STRIPE_SECRET_KEY` | ✅ | `sk_test_*` or `sk_live_*` | API secret key |
| `STRIPE_PUBLISHABLE_KEY` | ✅ | `pk_test_*` or `pk_live_*` | Publishable key for client |

::: tip Key Prefixes
- **Test mode**: `sk_test_`, `pk_test_`, `rk_test_` (restricted)
- **Live mode**: `sk_live_`, `pk_live_`, `rk_live_` (restricted)
:::

#### `webhook: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `STRIPE_WEBHOOK_SECRET` | ✅ | `whsec_*` | Webhook signing secret |

#### `customerPortal: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `STRIPE_CUSTOMER_PORTAL_CONFIG_ID` | ✅ | `bpc_*` | Customer portal configuration ID |

#### `connect: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `STRIPE_CONNECT_CLIENT_ID` | ✅ | `ca_*` | Connect application client ID |

#### `checkout: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `STRIPE_SUCCESS_URL` | ✅ | URL | Checkout success redirect URL |
| `STRIPE_CANCEL_URL` | ✅ | URL | Checkout cancel redirect URL |

#### `pricingTable: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `STRIPE_PRICING_TABLE_ID` | ✅ | `prctbl_*` | Embedded pricing table ID |

#### `pricing: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `STRIPE_MONTHLY_PRICE_ID` | ✅ | `price_*` | Monthly subscription price ID |
| `STRIPE_YEARLY_PRICE_ID` | ✅ | `price_*` | Yearly subscription price ID |

### Key Validation

Stripe plugin validates key formats:

| Key Type | Test Mode | Live Mode |
|----------|-----------|-----------|
| Secret Key | `sk_test_*` | `sk_live_*` |
| Publishable Key | `pk_test_*` | `pk_live_*` |
| Restricted Key | `rk_test_*` | `rk_live_*` |
| Webhook Secret | `whsec_*` | `whsec_*` |
| Connect Client | `ca_*` | `ca_*` |
| Portal Config | `bpc_*` | `bpc_*` |
| Price ID | `price_*` | `price_*` |

### Examples

```ts
// SaaS with subscriptions
payment.stripe({
  webhook: true,
  pricing: true,
  customerPortal: true,
})

// Marketplace with Connect
payment.stripe({
  webhook: true,
  connect: true,
})

// E-commerce checkout
payment.stripe({
  checkout: true,
  webhook: true,
})

// Production-only (no test keys)
payment.stripe({
  testMode: false,
  webhook: true,
})

// Custom product/tax configuration
payment.stripe({
  extend: {
    STRIPE_PRODUCT_ID: z.string().startsWith("prod_"),
    STRIPE_TAX_RATE_ID: z.string().startsWith("txr_").optional(),
    STRIPE_COUPON_ID: z.string().optional(),
  }
})
```

### Integration Example

```ts
// env.ts
import { createEnv } from "nevr-env";
import { payment } from "nevr-env/plugins";

export const env = createEnv({
  plugins: [
    payment.stripe({
      webhook: true,
      pricing: true,
    }),
  ],
  runtimeEnv: process.env,
});

// stripe.ts
import Stripe from "stripe";
import { env } from "./env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// webhook.ts
import { env } from "./env";

export async function handleWebhook(req: Request) {
  const sig = req.headers.get("stripe-signature")!;
  const event = stripe.webhooks.constructEvent(
    await req.text(),
    sig,
    env.STRIPE_WEBHOOK_SECRET
  );
  // Handle event...
}
```
