/**
 * AWS plugin for nevr-env with credential validation and service configuration
 */

import { z } from "zod";
import { createPlugin } from "@nevr-env/core";
import type { DiscoveryResult, PromptConfig } from "@nevr-env/core";

/**
 * AWS regions
 */
const AWS_REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-south-1",
  "sa-east-1", "ca-central-1", "me-south-1", "af-south-1",
] as const;

/**
 * AWS plugin options (non-flag options only)
 */
export interface AWSOptions {
  /**
   * Custom variable names
   */
  variableNames?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    region?: string;
    s3Bucket?: string;
    s3Endpoint?: string;
    sesFromEmail?: string;
    sqsQueueUrl?: string;
    snsTopicArn?: string;
    dynamodbTable?: string;
    cloudfrontDistribution?: string;
  };
}

/**
 * AWS plugin for nevr-env
 *
 * @example Basic usage (with credentials)
 * ```ts
 * import { createEnv } from "nevr-env";
 * import { aws } from "nevr-env/plugins";
 *
 * export const env = createEnv({
 *   plugins: [aws()],
 * });
 *
 * // Access: env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY, env.AWS_REGION
 * ```
 *
 * @example With S3
 * ```ts
 * aws({ s3: true })
 * // Access: env.AWS_S3_BUCKET, env.AWS_S3_ENDPOINT (optional)
 * ```
 *
 * @example Using IAM roles (no credentials needed)
 * ```ts
 * aws({ useIamRole: true, s3: true })
 * // Only env.AWS_REGION and env.AWS_S3_BUCKET are required
 * ```
 */
export const aws = createPlugin({
  id: "aws",
  name: "AWS",
  prefix: "AWS_",

  $options: {} as AWSOptions,

  base: {
    AWS_REGION: z
      .enum(AWS_REGIONS)
      .describe("AWS region"),
  },

  either: {
    useIamRole: {
      true: {},
      false: {
        AWS_ACCESS_KEY_ID: z
          .string()
          .min(16, "Access Key ID must be at least 16 characters")
          .max(128)
          .refine(
            (val) => /^[A-Z0-9]+$/.test(val),
            { message: "Access Key ID must contain only uppercase letters and numbers" }
          ),
        AWS_SECRET_ACCESS_KEY: z
          .string()
          .min(1, "Secret Access Key is required"),
        AWS_SESSION_TOKEN: z
          .string()
          .optional()
          .describe("AWS session token for temporary credentials"),
      },
    },
  },

  when: {
    s3: {
      AWS_S3_BUCKET: z
        .string()
        .min(3, "S3 bucket name must be at least 3 characters")
        .max(63, "S3 bucket name must be at most 63 characters")
        .refine(
          (val) => /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(val),
          { message: "S3 bucket name must follow AWS naming rules" }
        ),
      AWS_S3_ENDPOINT: z
        .string()
        .url()
        .optional()
        .describe("Custom S3 endpoint (for MinIO, R2, etc.)"),
    },
    ses: {
      AWS_SES_FROM_EMAIL: z
        .string()
        .email("SES from email must be a valid email address"),
    },
    sqs: {
      AWS_SQS_QUEUE_URL: z
        .string()
        .url()
        .refine(
          (val) => val.includes(".sqs.") && val.includes(".amazonaws.com"),
          { message: "Must be a valid SQS queue URL" }
        ),
    },
    sns: {
      AWS_SNS_TOPIC_ARN: z
        .string()
        .refine(
          (val) => val.startsWith("arn:aws:sns:"),
          { message: "Must be a valid SNS topic ARN" }
        ),
    },
    dynamodb: {
      AWS_DYNAMODB_TABLE: z
        .string()
        .min(3, "DynamoDB table name must be at least 3 characters")
        .max(255),
    },
    cloudfront: {
      AWS_CLOUDFRONT_DISTRIBUTION_ID: z
        .string()
        .refine(
          (val) => /^[A-Z0-9]+$/.test(val),
          { message: "CloudFront distribution ID must be alphanumeric" }
        ),
    },
  },

  runtimeSchema: (opts, schema) => {
    const varNames = opts.variableNames;
    if (!varNames) return;

    const remappings: [string, string | undefined][] = [
      ["AWS_ACCESS_KEY_ID", varNames.accessKeyId],
      ["AWS_SECRET_ACCESS_KEY", varNames.secretAccessKey],
      ["AWS_SESSION_TOKEN", varNames.sessionToken],
      ["AWS_REGION", varNames.region],
      ["AWS_S3_BUCKET", varNames.s3Bucket],
      ["AWS_S3_ENDPOINT", varNames.s3Endpoint],
      ["AWS_SES_FROM_EMAIL", varNames.sesFromEmail],
      ["AWS_SQS_QUEUE_URL", varNames.sqsQueueUrl],
      ["AWS_SNS_TOPIC_ARN", varNames.snsTopicArn],
      ["AWS_DYNAMODB_TABLE", varNames.dynamodbTable],
      ["AWS_CLOUDFRONT_DISTRIBUTION_ID", varNames.cloudfrontDistribution],
    ];

    for (const [defaultKey, customKey] of remappings) {
      if (customKey && customKey !== defaultKey && schema[defaultKey]) {
        schema[customKey] = schema[defaultKey];
        delete schema[defaultKey];
      }
    }
  },

  cli: (opts) => {
    const varNames = {
      accessKeyId: opts.variableNames?.accessKeyId ?? "AWS_ACCESS_KEY_ID",
      secretAccessKey: opts.variableNames?.secretAccessKey ?? "AWS_SECRET_ACCESS_KEY",
      region: opts.variableNames?.region ?? "AWS_REGION",
      s3Bucket: opts.variableNames?.s3Bucket ?? "AWS_S3_BUCKET",
    };

    const prompts: Record<string, PromptConfig> = {
      [varNames.accessKeyId]: {
        message: "Enter your AWS Access Key ID",
        placeholder: "your-access-key-id",
        type: "text",
        validate: (val) => {
          if (!/^[A-Z0-9]+$/.test(val)) {
            return "Must contain only uppercase letters and numbers";
          }
          if (val.length < 16) {
            return "Must be at least 16 characters";
          }
          return undefined;
        },
      },
      [varNames.secretAccessKey]: {
        message: "Enter your AWS Secret Access Key",
        placeholder: "your-secret-access-key",
        type: "password",
      },
      [varNames.region]: {
        message: "Select your AWS region",
        type: "select",
        options: AWS_REGIONS.map((r) => ({ value: r, label: r })),
      },
      [varNames.s3Bucket]: {
        message: "Enter your S3 bucket name",
        placeholder: "my-bucket",
        type: "text",
      },
    };

    return {
      docs: "https://console.aws.amazon.com/iam/home#/security_credentials",
      helpText: "Get your credentials from AWS IAM → Security Credentials",
      prompts,
    };
  },

  discover: (opts) => async () => {
    const varNames = {
      accessKeyId: opts.variableNames?.accessKeyId ?? "AWS_ACCESS_KEY_ID",
      secretAccessKey: opts.variableNames?.secretAccessKey ?? "AWS_SECRET_ACCESS_KEY",
      region: opts.variableNames?.region ?? "AWS_REGION",
    };

    const results: Partial<Record<string, DiscoveryResult>> = {};

    if (process.env.AWS_ACCESS_KEY_ID) {
      results[varNames.accessKeyId] = {
        value: process.env.AWS_ACCESS_KEY_ID,
        source: "Environment variable",
        description: "Found existing AWS_ACCESS_KEY_ID",
        confidence: 1.0,
      };
    }

    if (process.env.AWS_SECRET_ACCESS_KEY) {
      results[varNames.secretAccessKey] = {
        value: process.env.AWS_SECRET_ACCESS_KEY,
        source: "Environment variable",
        description: "Found existing AWS_SECRET_ACCESS_KEY",
        confidence: 1.0,
      };
    }

    if (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION) {
      results[varNames.region] = {
        value: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION!,
        source: "Environment variable",
        description: "Found existing AWS_REGION",
        confidence: 1.0,
      };
    }

    // Try to read from AWS credentials file
    try {
      const os = await import("os");
      const fs = await import("fs");
      const path = await import("path");

      const credentialsPath = path.join(os.homedir(), ".aws", "credentials");
      if (fs.existsSync(credentialsPath)) {
        const content = fs.readFileSync(credentialsPath, "utf-8");
        const defaultMatch = content.match(/\[default\]\s*\n([^[]*)/);

        if (defaultMatch) {
          const section = defaultMatch[1];
          const accessKey = section.match(/aws_access_key_id\s*=\s*(.+)/)?.[1]?.trim();
          const secretKey = section.match(/aws_secret_access_key\s*=\s*(.+)/)?.[1]?.trim();

          if (accessKey && !results[varNames.accessKeyId]) {
            results[varNames.accessKeyId] = {
              value: accessKey,
              source: "~/.aws/credentials",
              description: "Found in AWS credentials file",
              confidence: 0.8,
            };
          }

          if (secretKey && !results[varNames.secretAccessKey]) {
            results[varNames.secretAccessKey] = {
              value: secretKey,
              source: "~/.aws/credentials",
              description: "Found in AWS credentials file",
              confidence: 0.8,
            };
          }
        }
      }

      const configPath = path.join(os.homedir(), ".aws", "config");
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, "utf-8");
        const regionMatch = content.match(/region\s*=\s*(.+)/);

        if (regionMatch && !results[varNames.region]) {
          results[varNames.region] = {
            value: regionMatch[1].trim(),
            source: "~/.aws/config",
            description: "Found in AWS config file",
            confidence: 0.8,
          };
        }
      }
    } catch {
      // Ignore errors reading AWS config
    }

    return results;
  },

  hooks: (opts) => {
    const varNames = {
      accessKeyId: opts.variableNames?.accessKeyId ?? "AWS_ACCESS_KEY_ID",
      region: opts.variableNames?.region ?? "AWS_REGION",
    };

    return {
      afterValidation(values) {
        const region = values[varNames.region];
        if (region && typeof region === "string") {
          console.log(`✓ AWS: Region ${region}`);
        }

        if (opts.useIamRole) {
          console.log("✓ AWS: Using IAM role authentication");
        } else if (values[varNames.accessKeyId]) {
          const keyId = values[varNames.accessKeyId] as string;
          console.log(`✓ AWS: Access key ${keyId.slice(0, 4)}...${keyId.slice(-4)}`);
        }
      },
    };
  },
});

export default aws;
