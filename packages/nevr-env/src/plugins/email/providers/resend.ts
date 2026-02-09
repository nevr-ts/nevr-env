/**
 * Resend plugin for nevr-env with API key validation
 * and email configuration.
 */

import { z } from "zod";
import { createPlugin } from "@nevr-env/core";
import type { DiscoveryResult, PromptConfig } from "@nevr-env/core";

/**
 * Resend plugin options (non-flag options only)
 */
export interface ResendOptions {
  /**
   * Custom variable names
   */
  variableNames?: {
    apiKey?: string;
    fromEmail?: string;
    fromName?: string;
    audienceId?: string;
    webhookSecret?: string;
    domainId?: string;
    replyTo?: string;
    batchSize?: string;
  };
}

/**
 * Create a Resend API key schema
 */
function createApiKeySchema(): z.ZodEffects<z.ZodString, string, string> {
  return z
    .string()
    .min(1, "Resend API key is required")
    .refine(
      (val) => val.startsWith("re_"),
      {
        message: "Resend API key must start with 're_'",
      }
    );
}

/**
 * Resend plugin for nevr-env
 *
 * @example Basic usage
 * ```ts
 * import { createEnv } from "nevr-env";
 * import { resend } from "nevr-env/plugins";
 *
 * export const env = createEnv({
 *   plugins: [resend()],
 * });
 *
 * // Access: env.RESEND_API_KEY
 * ```
 *
 * @example With from email
 * ```ts
 * resend({ fromEmail: true })
 * // Access: env.RESEND_API_KEY, env.RESEND_FROM_EMAIL, env.RESEND_FROM_NAME
 * ```
 *
 * @example With webhook
 * ```ts
 * resend({ webhook: true })
 * // Access: env.RESEND_API_KEY, env.RESEND_WEBHOOK_SECRET
 * ```
 */
export const resend = createPlugin({
  id: "resend",
  name: "Resend",
  prefix: "RESEND_",

  $options: {} as ResendOptions,

  base: {
    RESEND_API_KEY: createApiKeySchema(),
  },

  when: {
    fromEmail: {
      RESEND_FROM_EMAIL: z
        .string()
        .email("Must be a valid email address")
        .describe("Default from email address"),
      RESEND_FROM_NAME: z
        .string()
        .optional()
        .describe("Default from name"),
    },
    audience: {
      RESEND_AUDIENCE_ID: z
        .string()
        .optional()
        .describe("Resend audience/contacts list ID"),
    },
    webhook: {
      RESEND_WEBHOOK_SECRET: z
        .string()
        .min(1, "Webhook secret is required")
        .refine(
          (val) => val.startsWith("whsec_"),
          { message: "Resend webhook secret must start with 'whsec_'" }
        ),
    },
    domain: {
      RESEND_DOMAIN_ID: z
        .string()
        .optional()
        .describe("Resend verified domain ID"),
    },
    replyTo: {
      RESEND_REPLY_TO: z
        .string()
        .email("Reply-to must be a valid email")
        .optional()
        .describe("Default reply-to email address"),
    },
    batch: {
      RESEND_BATCH_SIZE: z.coerce
        .number()
        .min(1)
        .max(100)
        .default(50)
        .describe("Maximum emails per batch request"),
    },
  },

  runtimeSchema: (opts, schema) => {
    const varNames = opts.variableNames;
    if (!varNames) return;

    const remappings: [string, string | undefined][] = [
      ["RESEND_API_KEY", varNames.apiKey],
      ["RESEND_FROM_EMAIL", varNames.fromEmail],
      ["RESEND_FROM_NAME", varNames.fromName],
      ["RESEND_AUDIENCE_ID", varNames.audienceId],
      ["RESEND_WEBHOOK_SECRET", varNames.webhookSecret],
      ["RESEND_DOMAIN_ID", varNames.domainId],
      ["RESEND_REPLY_TO", varNames.replyTo],
      ["RESEND_BATCH_SIZE", varNames.batchSize],
    ];

    for (const [defaultKey, customKey] of remappings) {
      if (customKey && customKey !== defaultKey && schema[defaultKey]) {
        schema[customKey] = schema[defaultKey];
        delete schema[defaultKey];
      }
    }
  },

  cli: (opts) => {
    const variableNames = opts.variableNames ?? {};

    const apiKeyVar = variableNames.apiKey || "RESEND_API_KEY";
    const fromEmailVar = variableNames.fromEmail || "RESEND_FROM_EMAIL";
    const fromNameVar = variableNames.fromName || "RESEND_FROM_NAME";
    const audienceIdVar = variableNames.audienceId || "RESEND_AUDIENCE_ID";
    const webhookSecretVar = variableNames.webhookSecret || "RESEND_WEBHOOK_SECRET";

    const prompts: Record<string, PromptConfig> = {
      [apiKeyVar]: {
        message: "Enter your Resend API key",
        placeholder: "re_...",
        type: "password",
        validate: (val) => {
          if (!val.startsWith("re_")) {
            return "API key must start with 're_'";
          }
          if (val.length < 20) {
            return "API key seems too short";
          }
          return undefined;
        },
      },
      [fromEmailVar]: {
        message: "Enter your default from email",
        placeholder: "hello@example.com",
        type: "text",
        validate: (val) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(val)) {
            return "Must be a valid email address";
          }
          return undefined;
        },
      },
      [fromNameVar]: {
        message: "Enter your default from name (optional)",
        placeholder: "My App",
        type: "text",
      },
      [audienceIdVar]: {
        message: "Enter your Resend audience ID (optional)",
        placeholder: "aud_...",
        type: "text",
      },
      [webhookSecretVar]: {
        message: "Enter your Resend webhook secret",
        placeholder: "whsec_...",
        type: "password",
        validate: (val) => {
          if (!val.startsWith("whsec_")) {
            return "Webhook secret must start with 'whsec_'";
          }
          return undefined;
        },
      },
    };

    return {
      docs: "https://resend.com/docs/api-reference/api-keys",
      helpText: "Resend is an email API for developers",
      prompts,
    };
  },

  discover: (opts) => async () => {
    const variableNames = opts.variableNames ?? {};
    const apiKeyVar = variableNames.apiKey || "RESEND_API_KEY";

    const results: Partial<Record<string, DiscoveryResult>> = {};

    if (process.env.RESEND_API_KEY) {
      results[apiKeyVar] = {
        value: process.env.RESEND_API_KEY,
        source: "Environment variable",
        confidence: 1.0,
        description: "Found existing RESEND_API_KEY",
      };
    }

    return results;
  },

  hooks: (opts) => {
    const variableNames = opts.variableNames ?? {};
    const apiKeyVar = variableNames.apiKey || "RESEND_API_KEY";
    const fromEmailVar = variableNames.fromEmail || "RESEND_FROM_EMAIL";

    return {
      afterValidation(values) {
        const key = values[apiKeyVar];
        if (key && typeof key === "string") {
          const masked = key.slice(0, 6) + "..." + key.slice(-4);
          console.log(`✓ Resend: API key configured (${masked})`);
        }

        if (opts.fromEmail) {
          const email = values[fromEmailVar];
          if (email && typeof email === "string") {
            console.log(`✓ Resend: Sending from ${email}`);
          }
        }
      },
    };
  },
});

export default resend;
