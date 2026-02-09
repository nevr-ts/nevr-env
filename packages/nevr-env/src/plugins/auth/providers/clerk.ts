/**
 * Clerk provider for the auth namespace
 */

import { z } from "zod";
import { createPlugin } from "@nevr-env/core";
import type { DiscoveryResult, PromptConfig } from "@nevr-env/core";

/**
 * Clerk plugin options (non-flag options only)
 */
export interface ClerkOptions {
  /**
   * Include development instance keys (for local development)
   * @default true in development
   */
  allowDevelopment?: boolean;

  /**
   * Custom variable names
   */
  variableNames?: {
    publishableKey?: string;
    secretKey?: string;
    jwtKey?: string;
    webhookSecret?: string;
    signInUrl?: string;
    signUpUrl?: string;
    afterSignInUrl?: string;
    afterSignUpUrl?: string;
  };
}

/**
 * Clerk provider
 *
 * @example
 * ```ts
 * import { auth } from "nevr-env/plugins";
 *
 * auth.clerk({
 *   webhook: true,
 *   urls: true,
 *   organization: true,
 * })
 * ```
 */
export const clerk = createPlugin({
  id: "clerk",
  name: "Clerk",
  prefix: "CLERK_",

  $options: {} as ClerkOptions,

  base: {
    CLERK_PUBLISHABLE_KEY: z
      .string()
      .min(1, "Clerk publishable key is required")
      .refine(
        (val) => val.startsWith("pk_test_") || val.startsWith("pk_live_"),
        { message: "Publishable key must start with pk_test_ or pk_live_" }
      )
      .describe("Clerk publishable key for client-side"),
    CLERK_SECRET_KEY: z
      .string()
      .min(1, "Clerk secret key is required")
      .refine(
        (val) => val.startsWith("sk_test_") || val.startsWith("sk_live_"),
        { message: "Secret key must start with sk_test_ or sk_live_" }
      )
      .describe("Clerk secret key for server-side"),
  },

  when: {
    jwtKey: {
      CLERK_JWT_KEY: z
        .string()
        .min(1, "JWT key is required")
        .describe("PEM-encoded public key for JWT verification"),
    },
    webhook: {
      CLERK_WEBHOOK_SECRET: z
        .string()
        .min(1, "Webhook secret is required")
        .refine(
          (val) => val.startsWith("whsec_"),
          { message: "Webhook secret must start with whsec_" }
        )
        .describe("Clerk webhook signing secret"),
    },
    urls: {
      CLERK_SIGN_IN_URL: z
        .string()
        .default("/sign-in")
        .describe("Sign-in page URL"),
      CLERK_SIGN_UP_URL: z
        .string()
        .default("/sign-up")
        .describe("Sign-up page URL"),
      CLERK_AFTER_SIGN_IN_URL: z
        .string()
        .default("/")
        .describe("Redirect URL after sign-in"),
      CLERK_AFTER_SIGN_UP_URL: z
        .string()
        .default("/")
        .describe("Redirect URL after sign-up"),
    },
    organization: {
      CLERK_ORGANIZATION_ID: z
        .string()
        .optional()
        .describe("Default organization ID"),
      CLERK_ORGANIZATION_SLUG: z
        .string()
        .optional()
        .describe("Default organization slug"),
    },
  },

  runtimeSchema: (opts, schema) => {
    const allowDev = opts.allowDevelopment ?? process.env.NODE_ENV !== "production";
    if (!allowDev) {
      // Override with production-only key schemas
      schema.CLERK_PUBLISHABLE_KEY = z
        .string()
        .min(1, "Clerk publishable key is required")
        .refine(
          (val) => val.startsWith("pk_live_"),
          { message: "Publishable key must start with pk_live_" }
        );
      schema.CLERK_SECRET_KEY = z
        .string()
        .min(1, "Clerk secret key is required")
        .refine(
          (val) => val.startsWith("sk_live_"),
          { message: "Secret key must start with sk_live_" }
        );
    }

    // Handle variable name remapping
    const varNames = opts.variableNames;
    if (!varNames) return;

    const remappings: [string, string | undefined][] = [
      ["CLERK_PUBLISHABLE_KEY", varNames.publishableKey],
      ["CLERK_SECRET_KEY", varNames.secretKey],
      ["CLERK_JWT_KEY", varNames.jwtKey],
      ["CLERK_WEBHOOK_SECRET", varNames.webhookSecret],
      ["CLERK_SIGN_IN_URL", varNames.signInUrl],
      ["CLERK_SIGN_UP_URL", varNames.signUpUrl],
      ["CLERK_AFTER_SIGN_IN_URL", varNames.afterSignInUrl],
      ["CLERK_AFTER_SIGN_UP_URL", varNames.afterSignUpUrl],
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
      publishableKey: opts.variableNames?.publishableKey ?? "CLERK_PUBLISHABLE_KEY",
      secretKey: opts.variableNames?.secretKey ?? "CLERK_SECRET_KEY",
      webhookSecret: opts.variableNames?.webhookSecret ?? "CLERK_WEBHOOK_SECRET",
    };

    const prompts: Record<string, PromptConfig> = {
      [varNames.publishableKey]: {
        message: "Enter your Clerk publishable key",
        placeholder: "pk_test_...",
        type: "text",
        validate: (val) => {
          if (!val.startsWith("pk_test_") && !val.startsWith("pk_live_")) {
            return "Key must start with pk_test_ or pk_live_";
          }
          return undefined;
        },
      },
      [varNames.secretKey]: {
        message: "Enter your Clerk secret key",
        placeholder: "sk_test_...",
        type: "password",
        validate: (val) => {
          if (!val.startsWith("sk_test_") && !val.startsWith("sk_live_")) {
            return "Key must start with sk_test_ or sk_live_";
          }
          return undefined;
        },
      },
    };

    if (opts.webhook) {
      prompts[varNames.webhookSecret] = {
        message: "Enter your Clerk webhook secret",
        placeholder: "whsec_...",
        type: "password",
        validate: (val) => {
          if (!val.startsWith("whsec_")) {
            return "Secret must start with whsec_";
          }
          return undefined;
        },
      };
    }

    return {
      docs: "https://dashboard.clerk.com",
      helpText: "Get your keys from the Clerk dashboard → API Keys",
      prompts,
    };
  },

  discover: (opts) => async () => {
    const varNames = {
      publishableKey: opts.variableNames?.publishableKey ?? "CLERK_PUBLISHABLE_KEY",
      secretKey: opts.variableNames?.secretKey ?? "CLERK_SECRET_KEY",
    };

    const results: Partial<Record<string, DiscoveryResult>> = {};

    const existingPk = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const existingSk = process.env.CLERK_SECRET_KEY;

    if (existingPk) {
      results[varNames.publishableKey] = {
        value: existingPk,
        source: "Environment variable",
        description: "Found existing CLERK_PUBLISHABLE_KEY",
        confidence: 1.0,
      };
    }

    if (existingSk) {
      results[varNames.secretKey] = {
        value: existingSk,
        source: "Environment variable",
        description: "Found existing CLERK_SECRET_KEY",
        confidence: 1.0,
      };
    }

    return results;
  },

  hooks: (opts) => {
    const varNames = {
      publishableKey: opts.variableNames?.publishableKey ?? "CLERK_PUBLISHABLE_KEY",
    };

    return {
      afterValidation(values) {
        const pk = values[varNames.publishableKey];
        if (pk && typeof pk === "string") {
          const isTest = pk.startsWith("pk_test_");
          console.log(`✓ Clerk: Using ${isTest ? "test" : "live"} keys`);

          if (isTest && process.env.NODE_ENV === "production") {
            console.warn("Warning: Clerk: Using test keys in production!");
          }
        }
      },
    };
  },
});

export default clerk;
