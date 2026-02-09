/**
 * Better-Auth provider for the auth namespace
 */

import { z } from "zod";
import { createPlugin } from "@nevr-env/core";
import type { OAuthProvider } from "@nevr-env/core";
import type { DiscoveryResult, PromptConfig } from "@nevr-env/core";
import {
  createOAuthSchema,
  createOAuthPrompts,
  getOAuthDocsText,
} from "../shared/oauth";

/**
 * Better-Auth plugin options (non-flag options only)
 */
export interface BetterAuthOptions {
  /**
   * OAuth providers to include
   * @default []
   */
  providers?: readonly OAuthProvider[];

  /**
   * Custom variable names for base configuration
   */
  variableNames?: {
    secret?: string;
    url?: string;
    trustedOrigins?: string;
  };
}

/**
 * Better-Auth provider
 *
 * @example Basic usage
 * ```ts
 * import { auth } from "nevr-env/plugins";
 *
 * auth.betterAuth()
 * // env.BETTER_AUTH_SECRET, env.BETTER_AUTH_URL
 * ```
 *
 * @example With OAuth providers
 * ```ts
 * auth.betterAuth({
 *   providers: ["google", "github", "discord"]
 * })
 * // env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, etc.
 * ```
 *
 * @example With email and 2FA
 * ```ts
 * auth.betterAuth({
 *   emailPassword: true,
 *   twoFactor: true,
 *   magicLink: true,
 * })
 * ```
 */
export const betterAuth = createPlugin({
  id: "better-auth",
  name: "Better-Auth",
  prefix: "BETTER_AUTH_",

  $options: {} as BetterAuthOptions,
  oauthProviders: "providers" as const,

  base: {
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "Better-Auth secret must be at least 32 characters")
      .describe("Secret key for signing tokens and cookies"),
    BETTER_AUTH_URL: z
      .string()
      .url("Better-Auth URL must be a valid URL")
      .describe("Base URL of your application"),
    BETTER_AUTH_TRUSTED_ORIGINS: z
      .string()
      .optional()
      .describe("Comma-separated list of trusted origins for CORS"),
  },

  when: {
    emailPassword: {
      BETTER_AUTH_EMAIL_VERIFICATION: z
        .enum(["true", "false"])
        .default("true")
        .describe("Require email verification"),
      BETTER_AUTH_PASSWORD_MIN_LENGTH: z
        .coerce.number()
        .min(6)
        .default(8)
        .describe("Minimum password length"),
    },
    magicLink: {
      BETTER_AUTH_MAGIC_LINK_EXPIRY: z
        .coerce.number()
        .default(300)
        .describe("Magic link expiry time in seconds"),
    },
    twoFactor: {
      BETTER_AUTH_2FA_ISSUER: z
        .string()
        .optional()
        .describe("TOTP issuer name for authenticator apps"),
    },
    session: {
      BETTER_AUTH_SESSION_EXPIRY: z
        .coerce.number()
        .default(604800) // 7 days
        .describe("Session expiry time in seconds"),
      BETTER_AUTH_SESSION_UPDATE_AGE: z
        .coerce.number()
        .default(86400) // 1 day
        .describe("How often to update session"),
    },
    rateLimit: {
      BETTER_AUTH_RATE_LIMIT_WINDOW: z
        .coerce.number()
        .default(60)
        .describe("Rate limit window in seconds"),
      BETTER_AUTH_RATE_LIMIT_MAX: z
        .coerce.number()
        .default(100)
        .describe("Maximum requests per window"),
    },
  },

  dynamicSchema: (opts) => {
    const providers = opts.providers ?? [];
    if (providers.length > 0) {
      return createOAuthSchema(providers as readonly OAuthProvider[]);
    }
    return {};
  },

  runtimeSchema: (opts, schema) => {
    const varNames = opts.variableNames;
    if (!varNames) return;

    const remappings: [string, string | undefined][] = [
      ["BETTER_AUTH_SECRET", varNames.secret],
      ["BETTER_AUTH_URL", varNames.url],
      ["BETTER_AUTH_TRUSTED_ORIGINS", varNames.trustedOrigins],
    ];

    for (const [defaultKey, customKey] of remappings) {
      if (customKey && customKey !== defaultKey && schema[defaultKey]) {
        schema[customKey] = schema[defaultKey];
        delete schema[defaultKey];
      }
    }
  },

  cli: (opts) => {
    const providers = (opts.providers ?? []) as readonly OAuthProvider[];

    const varNames = {
      secret: opts.variableNames?.secret ?? "BETTER_AUTH_SECRET",
      url: opts.variableNames?.url ?? "BETTER_AUTH_URL",
    };

    const prompts: Record<string, PromptConfig> = {
      [varNames.secret]: {
        message: "Enter your Better-Auth secret (min 32 chars)",
        placeholder: "Generate with: openssl rand -base64 32",
        type: "password",
        validate: (val) => {
          if (val.length < 32) {
            return "Secret must be at least 32 characters";
          }
          return undefined;
        },
      },
      [varNames.url]: {
        message: "Enter your application URL",
        placeholder: "http://localhost:3000",
        type: "text",
        validate: (val) => {
          try {
            new URL(val);
            return undefined;
          } catch {
            return "Must be a valid URL";
          }
        },
      },
    };

    // Add OAuth prompts using shared module
    if (providers.length > 0) {
      Object.assign(prompts, createOAuthPrompts(providers));
    }

    return {
      docs: "https://www.better-auth.com/docs",
      helpText: providers.length > 0
        ? getOAuthDocsText(providers)
        : "Better-Auth is a comprehensive authentication library for TypeScript",
      prompts,
    };
  },

  discover: (opts) => async () => {
    const varNames = {
      secret: opts.variableNames?.secret ?? "BETTER_AUTH_SECRET",
      url: opts.variableNames?.url ?? "BETTER_AUTH_URL",
    };

    const results: Partial<Record<string, DiscoveryResult>> = {};

    if (process.env.BETTER_AUTH_SECRET) {
      results[varNames.secret] = {
        value: process.env.BETTER_AUTH_SECRET,
        source: "Environment variable",
        description: "Found existing BETTER_AUTH_SECRET",
        confidence: 1.0,
      };
    }

    if (process.env.BETTER_AUTH_URL) {
      results[varNames.url] = {
        value: process.env.BETTER_AUTH_URL,
        source: "Environment variable",
        description: "Found existing BETTER_AUTH_URL",
        confidence: 1.0,
      };
    }

    // Suggest localhost for development
    if (!results[varNames.url] && process.env.NODE_ENV !== "production") {
      results[varNames.url] = {
        value: "http://localhost:3000",
        source: "Development default",
        description: "Default development URL",
        confidence: 0.5,
      };
    }

    return results;
  },

  hooks: (opts) => {
    const providers = (opts.providers ?? []) as readonly OAuthProvider[];
    const varNames = {
      url: opts.variableNames?.url ?? "BETTER_AUTH_URL",
    };

    return {
      afterValidation(values) {
        const url = values[varNames.url];
        if (url && typeof url === "string") {
          console.log(`✓ Better-Auth: Configured for ${url}`);
        }

        if (providers.length > 0) {
          console.log(`✓ Better-Auth: OAuth providers: ${providers.join(", ")}`);
        }

        if (opts.twoFactor) {
          console.log("✓ Better-Auth: 2FA enabled");
        }
      },
    };
  },
});

export default betterAuth;
