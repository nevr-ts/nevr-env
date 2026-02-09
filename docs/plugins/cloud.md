# Cloud Namespace

The `cloud` namespace provides cloud service providers.

```ts
import { cloud } from "nevr-env/plugins";
```

## Providers

| Provider | Description |
|----------|-------------|
| `cloud.aws()` | AWS - Amazon Web Services |

---

## AWS

Full-featured AWS integration with S3, SES, SQS, SNS, DynamoDB, Lambda, and more.

### Basic Usage

```ts
import { createEnv } from "nevr-env";
import { cloud } from "nevr-env/plugins";

const env = createEnv({
  plugins: [cloud.aws()],
  runtimeEnv: process.env,
});

// env.AWS_ACCESS_KEY_ID
// env.AWS_SECRET_ACCESS_KEY
// env.AWS_REGION
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `s3` | `boolean` | `false` | Include S3 bucket configuration |
| `ses` | `boolean` | `false` | Include SES email configuration |
| `sqs` | `boolean` | `false` | Include SQS queue configuration |
| `sns` | `boolean` | `false` | Include SNS notification config |
| `dynamodb` | `boolean` | `false` | Include DynamoDB configuration |
| `lambda` | `boolean` | `false` | Include Lambda configuration |
| `secretsManager` | `boolean` | `false` | Include Secrets Manager config |
| `cloudfront` | `boolean` | `false` | Include CloudFront distribution |
| `useIamRole` | `boolean` | `false` | Use IAM role (no credentials) |
| `variableNames` | `object` | - | Custom variable names |
| `extend` | `object` | - | Extend schema with custom fields |

### Environment Variables by Option

#### Default (no options, credentials mode)

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `AWS_ACCESS_KEY_ID` | ✅ | `[A-Z0-9]+` | Access key ID (min 16 chars) |
| `AWS_SECRET_ACCESS_KEY` | ✅ | String | Secret access key |
| `AWS_SESSION_TOKEN` | ❌ | String | Session token (temporary creds) |
| `AWS_REGION` | ✅ | Region code | AWS region (e.g., `us-east-1`) |

#### `useIamRole: true`

When using IAM roles, only region is required:

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_REGION` | ✅ | AWS region |

::: tip IAM Roles
Use `useIamRole: true` when running on:
- EC2 with instance profile
- ECS with task role
- Lambda with execution role
- EKS with service account
:::

#### `s3: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `AWS_S3_BUCKET` | ✅ | 3-63 chars | S3 bucket name |
| `AWS_S3_ENDPOINT` | ❌ | URL | Custom endpoint (MinIO, R2) |

#### `ses: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `AWS_SES_FROM_EMAIL` | ✅ | Email | Verified sender email |

#### `sqs: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `AWS_SQS_QUEUE_URL` | ✅ | `*.sqs.*.amazonaws.com/*` | SQS queue URL |

#### `sns: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `AWS_SNS_TOPIC_ARN` | ✅ | `arn:aws:sns:*` | SNS topic ARN |

#### `dynamodb: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `AWS_DYNAMODB_TABLE` | ✅ | 3-255 chars | DynamoDB table name |

#### `cloudfront: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `AWS_CLOUDFRONT_DISTRIBUTION_ID` | ✅ | `[A-Z0-9]+` | CloudFront distribution ID |

### Supported Regions

```ts
const AWS_REGIONS = [
  // US
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  // Europe
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
  // Asia Pacific
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-south-1",
  // Other
  "sa-east-1", "ca-central-1", "me-south-1", "af-south-1",
];
```

### Auto-Discovery

AWS plugin discovers credentials from:
- **Environment variables** - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- **AWS credentials file** - `~/.aws/credentials`
- **AWS config file** - `~/.aws/config`

### Examples

```ts
// S3 file storage
cloud.aws({
  s3: true,
})

// SES email with S3 attachments
cloud.aws({
  s3: true,
  ses: true,
})

// Queue processing
cloud.aws({
  sqs: true,
  dynamodb: true,
})

// Full serverless stack
cloud.aws({
  s3: true,
  sqs: true,
  sns: true,
  dynamodb: true,
  cloudfront: true,
})

// IAM role (no credentials)
cloud.aws({
  useIamRole: true,
  s3: true,
  dynamodb: true,
})

// S3-compatible storage (MinIO, Cloudflare R2)
cloud.aws({
  s3: true,
  extend: {
    AWS_S3_ENDPOINT: z.string().url(), // Make endpoint required
  }
})

// Custom CloudWatch logging
cloud.aws({
  extend: {
    AWS_CLOUDWATCH_LOG_GROUP: z.string(),
    AWS_CLOUDWATCH_LOG_STREAM: z.string().optional(),
  }
})
```

### Integration Example

```ts
// env.ts
import { createEnv } from "nevr-env";
import { cloud } from "nevr-env/plugins";

export const env = createEnv({
  plugins: [
    cloud.aws({
      s3: true,
      ses: true,
    }),
  ],
  runtimeEnv: process.env,
});

// s3.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "./env";

export const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function uploadFile(key: string, body: Buffer) {
  await s3.send(new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    Body: body,
  }));
  return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
}

// ses.ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { env } from "./env";

export const ses = new SESClient({
  region: env.AWS_REGION,
});

export async function sendEmail(to: string, subject: string, body: string) {
  await ses.send(new SendEmailCommand({
    Source: env.AWS_SES_FROM_EMAIL,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: body } },
    },
  }));
}
```

### IAM Role Example

```ts
// For Lambda, ECS, EC2 with instance profile
import { createEnv } from "nevr-env";
import { cloud } from "nevr-env/plugins";

export const env = createEnv({
  plugins: [
    cloud.aws({
      useIamRole: true,
      s3: true,
      dynamodb: true,
    }),
  ],
  runtimeEnv: process.env,
});

// Only AWS_REGION, AWS_S3_BUCKET, AWS_DYNAMODB_TABLE needed
// Credentials come from IAM role automatically
```

### S3-Compatible Storage Example

```ts
// For MinIO, Cloudflare R2, DigitalOcean Spaces
import { createEnv } from "nevr-env";
import { cloud } from "nevr-env/plugins";
import { z } from "zod";

export const env = createEnv({
  plugins: [
    cloud.aws({
      s3: true,
      extend: {
        AWS_S3_ENDPOINT: z.string().url(), // Required for S3-compatible
      }
    }),
  ],
  runtimeEnv: process.env,
});

// Use with S3 client
const s3 = new S3Client({
  region: env.AWS_REGION,
  endpoint: env.AWS_S3_ENDPOINT, // Custom endpoint
  forcePathStyle: true, // Required for most S3-compatible services
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});
```
