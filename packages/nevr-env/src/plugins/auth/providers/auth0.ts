/**
 * Auth0 provider for the auth namespace
 */

import { z } from "zod";
import { createPlugin } from "@nevr-env/core";
import type { DiscoveryResult, PromptConfig } from "@nevr-env/core";

/**
 * Auth0 plugin options (non-flag options only)
 */
export interface Auth0Options {
  /**
   * Custom variable names
   */
  variableNames?: {
    domain?: string;
    clientId?: string;
    clientSecret?: string;
  };
}

const auth0DomainSchema = z
  .string()
  .regex(
    /^[\w-]+\.(?:[\w-]+\.)?auth0\.com$/,
    "Must be a valid Auth0 domain (e.g., your-tenant.auth0.com)"
  )
  .describe("Auth0 domain");

/**
 * Auth0 provider
 *
 * @example
 * ```ts
 * import { auth } from "nevr-env/plugins";
 *
 * auth.auth0({
 *   api: true,
 *   management: true,
 * })
 * ```
 */
export const auth0 = createPlugin({
  id: "auth-auth0",
  name: "Auth0",
  prefix: "AUTH0_",

  $options: {} as Auth0Options,

  base: {
    AUTH0_DOMAIN: auth0DomainSchema,
    AUTH0_CLIENT_ID: z.string().min(1, "Auth0 Client ID is required"),
    AUTH0_CLIENT_SECRET: z.string().min(1, "Auth0 Client Secret is required"),
    AUTH0_BASE_URL: z.string().url().describe("Your application base URL"),
    AUTH0_ISSUER_BASE_URL: z
      .string()
      .url()
      .optional()
      .describe("Auth0 issuer URL (defaults to https://{domain})"),
  },

  when: {
    api: {
      AUTH0_AUDIENCE: z
        .string()
        .url()
        .describe("API identifier/audience"),
      AUTH0_SCOPE: z
        .string()
        .default("openid profile email")
        .describe("OAuth scopes"),
    },
    m2m: {
      AUTH0_M2M_CLIENT_ID: z.string().min(1),
      AUTH0_M2M_CLIENT_SECRET: z.string().min(1),
    },
    management: {
      AUTH0_MGMT_CLIENT_ID: z.string().min(1),
      AUTH0_MGMT_CLIENT_SECRET: z.string().min(1),
    },
  },

  runtimeSchema: (opts, schema) => {
    const varNames = opts.variableNames;
    if (!varNames) return;

    const remappings: [string, string | undefined][] = [
      ["AUTH0_DOMAIN", varNames.domain],
      ["AUTH0_CLIENT_ID", varNames.clientId],
      ["AUTH0_CLIENT_SECRET", varNames.clientSecret],
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
      domain: opts.variableNames?.domain ?? "AUTH0_DOMAIN",
      clientId: opts.variableNames?.clientId ?? "AUTH0_CLIENT_ID",
      clientSecret: opts.variableNames?.clientSecret ?? "AUTH0_CLIENT_SECRET",
    };

    const prompts: Record<string, PromptConfig> = {
      [varNames.domain]: {
        message: "Enter your Auth0 domain",
        placeholder: "your-tenant.auth0.com",
        type: "text",
        validate: (val) => {
          if (!/^[\w-]+\.(?:[\w-]+\.)?auth0\.com$/.test(val)) {
            return "Must be a valid Auth0 domain";
          }
          return undefined;
        },
      },
      [varNames.clientId]: {
        message: "Enter your Auth0 Client ID",
        type: "text",
      },
      [varNames.clientSecret]: {
        message: "Enter your Auth0 Client Secret",
        type: "password",
      },
      AUTH0_BASE_URL: {
        message: "Enter your application URL",
        placeholder: "http://localhost:3000",
        type: "text",
      },
    };

    return {
      docs: "https://manage.auth0.com",
      helpText: "Get credentials from Auth0 Dashboard → Applications",
      prompts,
    };
  },

  discover: (opts) => async () => {
    const varNames = {
      domain: opts.variableNames?.domain ?? "AUTH0_DOMAIN",
      clientId: opts.variableNames?.clientId ?? "AUTH0_CLIENT_ID",
    };

    const results: Partial<Record<string, DiscoveryResult>> = {};

    if (process.env.AUTH0_DOMAIN) {
      results[varNames.domain] = {
        value: process.env.AUTH0_DOMAIN,
        source: "Environment variable",
        description: "Found existing AUTH0_DOMAIN",
        confidence: 1.0,
      };
    }

    if (process.env.AUTH0_CLIENT_ID) {
      results[varNames.clientId] = {
        value: process.env.AUTH0_CLIENT_ID,
        source: "Environment variable",
        description: "Found existing AUTH0_CLIENT_ID",
        confidence: 1.0,
      };
    }

    return results;
  },

  hooks: (opts) => {
    const varNames = {
      domain: opts.variableNames?.domain ?? "AUTH0_DOMAIN",
    };

    return {
      afterValidation(values) {
        const domain = values[varNames.domain];
        if (domain && typeof domain === "string") {
          console.log(`✓ Auth0: ${domain}`);
        }
      },
    };
  },
});

export default auth0;
