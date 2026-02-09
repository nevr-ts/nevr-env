# Email Namespace

The `email` namespace provides email service providers.

```ts
import { email } from "nevr-env/plugins";
```

## Providers

| Provider | Description |
|----------|-------------|
| `email.resend()` | Resend - Modern email API |

---

## Resend

Modern email API with React Email support, webhooks, and batch sending.

### Basic Usage

```ts
import { createEnv } from "nevr-env";
import { email } from "nevr-env/plugins";

const env = createEnv({
  plugins: [email.resend()],
  runtimeEnv: process.env,
});

// env.RESEND_API_KEY
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fromEmail` | `boolean` | `false` | Include from email configuration |
| `audience` | `boolean` | `false` | Include audience/contacts config |
| `webhook` | `boolean` | `false` | Include webhook secret |
| `domain` | `boolean` | `false` | Include custom domain config |
| `replyTo` | `boolean` | `false` | Include reply-to configuration |
| `batch` | `boolean` | `false` | Include batch sending config |
| `variableNames` | `object` | - | Custom variable names |
| `extend` | `object` | - | Extend schema with custom fields |

### Environment Variables by Option

#### Default (no options)

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `RESEND_API_KEY` | ✅ | `re_*` | Resend API key |

#### `fromEmail: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `RESEND_FROM_EMAIL` | ✅ | Email | Default from email address |
| `RESEND_FROM_NAME` | ❌ | String | Default from name |

#### `audience: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_AUDIENCE_ID` | ❌ | Audience/contacts list ID |

#### `webhook: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `RESEND_WEBHOOK_SECRET` | ✅ | `whsec_*` | Webhook signing secret |

#### `domain: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_DOMAIN_ID` | ❌ | Verified domain ID |

#### `replyTo: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `RESEND_REPLY_TO` | ❌ | Email | Default reply-to email |

#### `batch: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RESEND_BATCH_SIZE` | ❌ | `50` | Batch sending size (1-100) |

### Examples

```ts
// Transactional emails
email.resend({
  fromEmail: true,
})

// With webhooks for tracking
email.resend({
  fromEmail: true,
  webhook: true,
})

// Newsletter/marketing
email.resend({
  fromEmail: true,
  audience: true,
  batch: true,
})

// Full configuration
email.resend({
  fromEmail: true,
  replyTo: true,
  webhook: true,
  domain: true,
})

// Custom templates
email.resend({
  fromEmail: true,
  extend: {
    RESEND_WELCOME_TEMPLATE: z.string().optional(),
    RESEND_RESET_TEMPLATE: z.string().optional(),
    RESEND_INVOICE_TEMPLATE: z.string().optional(),
  }
})
```

### Integration Example

```ts
// env.ts
import { createEnv } from "nevr-env";
import { email } from "nevr-env/plugins";

export const env = createEnv({
  plugins: [
    email.resend({
      fromEmail: true,
      webhook: true,
    }),
  ],
  runtimeEnv: process.env,
});

// resend.ts
import { Resend } from "resend";
import { env } from "./env";

export const resend = new Resend(env.RESEND_API_KEY);

// email.ts
import { env } from "./env";
import { resend } from "./resend";
import { WelcomeEmail } from "./emails/welcome";

export async function sendWelcomeEmail(email: string, name: string) {
  await resend.emails.send({
    from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
    to: email,
    subject: "Welcome!",
    react: WelcomeEmail({ name }),
  });
}

// webhook.ts
import { env } from "./env";
import { Webhook } from "svix";

export async function handleWebhook(req: Request) {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  
  const wh = new Webhook(env.RESEND_WEBHOOK_SECRET);
  const event = wh.verify(payload, headers);
  
  // Handle event (email.sent, email.delivered, etc.)
}
```

### React Email Example

```tsx
// emails/welcome.tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface WelcomeEmailProps {
  name: string;
}

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to our platform!</Preview>
      <Body>
        <Container>
          <Heading>Welcome, {name}!</Heading>
          <Text>
            Thanks for signing up. We're excited to have you!
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```
