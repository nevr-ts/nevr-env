/**
 * NextAuth.js (Auth.js) provider for the auth namespace
 */

import { z } from "zod";
import { createPlugin } from "@nevr-env/core";
import type { OAuthProvider } from "@nevr-env/core";
import type { DiscoveryResult, PromptConfig } from "@nevr-env/core";
import {
  createOAuthSchema,
  createOAuthPrompts,
  getOAuthDocsText,
  authSecretSchema,
} from "../shared/oauth";

/**
 * NextAuth.js plugin options (non-flag options only)
 */
export interface NextAuthOptions {
  /**
   * OAuth providers to include
   * @default []
   */
  providers?: readonly OAuthProvider[];

  /**
   * Custom variable names
   */
  variableNames?: {
    secret?: string;
    url?: string;
  };
}

/**
 * NextAuth.js (Auth.js) provider
 *
 * @example
 * ```ts
 * import { auth } from "nevr-env/plugins";
 *
 * auth.nextauth({
 *   providers: ["google", "github"],
 *   database: true,
 * })
 * ```
 */
export const nextauth = createPlugin({
  id: "auth-nextauth",
  name: "NextAuth.js",
  prefix: "NEXTAUTH_",

  $options: {} as NextAuthOptions,
  oauthProviders: "providers" as const,

  base: {
    NEXTAUTH_SECRET: authSecretSchema.describe("NextAuth.js secret for token encryption"),
    NEXTAUTH_URL: z
      .string()
      .url()
      .optional()
      .describe("Canonical URL of your site (required in production)"),
  },

  when: {
    database: {
      DATABASE_URL: z
        .string()
        .min(1, "Database URL is required for NextAuth database adapter"),
    },
    email: {
      EMAIL_SERVER: z
        .string()
        .describe("SMTP connection string: smtp://user:pass@smtp.example.com:587"),
      EMAIL_FROM: z
        .string()
        .email()
        .describe("Email from address"),
    },
    debug: {
      NEXTAUTH_DEBUG: z.enum(["true", "false"]).default("false"),
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
      ["NEXTAUTH_SECRET", varNames.secret],
      ["NEXTAUTH_URL", varNames.url],
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
      secret: opts.variableNames?.secret ?? "NEXTAUTH_SECRET",
      url: opts.variableNames?.url ?? "NEXTAUTH_URL",
    };

    const prompts: Record<string, PromptConfig> = {
      [varNames.secret]: {
        message: "Enter your NextAuth secret (min 32 chars)",
        placeholder: "Generate with: openssl rand -base64 32",
        type: "password",
        validate: (val) => val.length < 32 ? "Min 32 characters" : undefined,
      },
      [varNames.url]: {
        message: "Enter your site URL (for production)",
        placeholder: "https://example.com",
        type: "text",
      },
    };

    // Add OAuth prompts
    if (providers.length > 0) {
      Object.assign(prompts, createOAuthPrompts(providers));
    }

    if (opts.email) {
      prompts["EMAIL_SERVER"] = {
        message: "Enter your SMTP connection string",
        placeholder: "smtp://user:pass@smtp.example.com:587",
        type: "password",
      };
      prompts["EMAIL_FROM"] = {
        message: "Enter the from email address",
        placeholder: "noreply@example.com",
        type: "text",
      };
    }

    return {
      docs: "https://authjs.dev/getting-started/installation",
      helpText: providers.length > 0 ? getOAuthDocsText(providers) : undefined,
      prompts,
    };
  },

  discover: (opts) => async () => {
    const varNames = {
      secret: opts.variableNames?.secret ?? "NEXTAUTH_SECRET",
      url: opts.variableNames?.url ?? "NEXTAUTH_URL",
    };

    const results: Partial<Record<string, DiscoveryResult>> = {};

    if (process.env.NEXTAUTH_SECRET) {
      results[varNames.secret] = {
        value: process.env.NEXTAUTH_SECRET,
        source: "Environment variable",
        description: "Found existing NEXTAUTH_SECRET",
        confidence: 1.0,
      };
    }

    if (process.env.NEXTAUTH_URL) {
      results[varNames.url] = {
        value: process.env.NEXTAUTH_URL,
        source: "Environment variable",
        description: "Found existing NEXTAUTH_URL",
        confidence: 1.0,
      };
    }

    // Auto-detect Vercel URL
    if (!results[varNames.url] && process.env.VERCEL_URL) {
      results[varNames.url] = {
        value: `https://${process.env.VERCEL_URL}`,
        source: "Vercel environment",
        description: "Detected from VERCEL_URL",
        confidence: 0.8,
      };
    }

    return results;
  },

  hooks: (opts) => {
    const providers = (opts.providers ?? []) as readonly OAuthProvider[];

    return {
      afterValidation(values) {
        const url = values[opts.variableNames?.url ?? "NEXTAUTH_URL"];
        if (url && typeof url === "string") {
          console.log(`✓ NextAuth: ${url}`);
        }
        if (providers.length > 0) {
          console.log(`✓ OAuth: ${providers.join(", ")}`);
        }
      },
    };
  },
});

export default nextauth;
