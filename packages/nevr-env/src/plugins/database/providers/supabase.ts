/**
 * Supabase plugin for nevr-env with URL and key validation
 */

import { z } from "zod";
import { createPlugin } from "@nevr-env/core";
import type { DiscoveryResult, PromptConfig } from "@nevr-env/core";

/**
 * Supabase plugin options (non-flag options only)
 */
export interface SupabaseOptions {
  /**
   * Custom variable names
   */
  variableNames?: {
    url?: string;
    anonKey?: string;
    serviceRoleKey?: string;
    jwtSecret?: string;
    databaseUrl?: string;
    poolerUrl?: string;
    storageBucket?: string;
  };
}

/**
 * Supabase plugin for nevr-env
 *
 * @example Basic usage
 * ```ts
 * import { createEnv } from "nevr-env";
 * import { supabase } from "nevr-env/plugins";
 *
 * export const env = createEnv({
 *   plugins: [supabase()],
 * });
 *
 * // Access: env.SUPABASE_URL, env.SUPABASE_ANON_KEY
 * ```
 *
 * @example With service role (server-side)
 * ```ts
 * supabase({ serviceRole: true })
 * // Access: env.SUPABASE_SERVICE_ROLE_KEY
 * ```
 *
 * @example With direct database access
 * ```ts
 * supabase({ database: true, pooler: true })
 * // Access: env.SUPABASE_DATABASE_URL, env.SUPABASE_POOLER_URL
 * ```
 */
export const supabase = createPlugin({
  id: "supabase",
  name: "Supabase",
  prefix: "SUPABASE_",

  $options: {} as SupabaseOptions,

  base: {
    SUPABASE_URL: z
      .string()
      .url("Supabase URL must be a valid URL")
      .refine(
        (val) => val.includes(".supabase.co") || val.includes("localhost"),
        { message: "Must be a Supabase project URL" }
      ),
    SUPABASE_ANON_KEY: z
      .string()
      .min(1, "Supabase anon key is required")
      .refine(
        (val) => val.startsWith("eyJ"),
        { message: "Anon key must be a valid JWT" }
      ),
  },

  when: {
    serviceRole: {
      SUPABASE_SERVICE_ROLE_KEY: z
        .string()
        .min(1, "Service role key is required")
        .refine(
          (val) => val.startsWith("eyJ"),
          { message: "Service role key must be a valid JWT" }
        ),
    },
    jwtSecret: {
      SUPABASE_JWT_SECRET: z
        .string()
        .min(32, "JWT secret must be at least 32 characters"),
    },
    database: {
      SUPABASE_DATABASE_URL: z
        .string()
        .refine(
          (val) => val.startsWith("postgresql://") || val.startsWith("postgres://"),
          { message: "Database URL must be a PostgreSQL connection string" }
        ),
    },
    pooler: {
      SUPABASE_POOLER_URL: z
        .string()
        .refine(
          (val) => val.startsWith("postgresql://") || val.startsWith("postgres://"),
          { message: "Pooler URL must be a PostgreSQL connection string" }
        )
        .refine(
          (val) => val.includes("pooler.supabase.com") || val.includes(":6543"),
          { message: "Pooler URL should use the pooler endpoint (port 6543)" }
        ),
    },
    storage: {
      SUPABASE_STORAGE_BUCKET: z
        .string()
        .min(1)
        .optional()
        .describe("Default storage bucket name"),
    },
    realtime: {},
  },

  runtimeSchema: (opts, schema) => {
    const varNames = opts.variableNames;
    if (!varNames) return;

    const remappings: [string, string | undefined][] = [
      ["SUPABASE_URL", varNames.url],
      ["SUPABASE_ANON_KEY", varNames.anonKey],
      ["SUPABASE_SERVICE_ROLE_KEY", varNames.serviceRoleKey],
      ["SUPABASE_JWT_SECRET", varNames.jwtSecret],
      ["SUPABASE_DATABASE_URL", varNames.databaseUrl],
      ["SUPABASE_POOLER_URL", varNames.poolerUrl],
      ["SUPABASE_STORAGE_BUCKET", varNames.storageBucket],
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
      url: opts.variableNames?.url ?? "SUPABASE_URL",
      anonKey: opts.variableNames?.anonKey ?? "SUPABASE_ANON_KEY",
      serviceRoleKey: opts.variableNames?.serviceRoleKey ?? "SUPABASE_SERVICE_ROLE_KEY",
      databaseUrl: opts.variableNames?.databaseUrl ?? "SUPABASE_DATABASE_URL",
    };

    const prompts: Record<string, PromptConfig> = {
      [varNames.url]: {
        message: "Enter your Supabase project URL",
        placeholder: "https://xxx.supabase.co",
        type: "text",
        validate: (val) => {
          if (!val.includes(".supabase.co") && !val.includes("localhost")) {
            return "Must be a Supabase project URL";
          }
          return undefined;
        },
      },
      [varNames.anonKey]: {
        message: "Enter your Supabase anon (public) key",
        placeholder: "eyJhbGciOiJIUzI1NiIs...",
        type: "password",
        validate: (val) => {
          if (!val.startsWith("eyJ")) {
            return "Must be a valid JWT token";
          }
          return undefined;
        },
      },
      [varNames.serviceRoleKey]: {
        message: "Enter your Supabase service role key (KEEP SECRET!)",
        placeholder: "eyJhbGciOiJIUzI1NiIs...",
        type: "password",
        validate: (val) => {
          if (!val.startsWith("eyJ")) {
            return "Must be a valid JWT token";
          }
          return undefined;
        },
      },
      [varNames.databaseUrl]: {
        message: "Enter your Supabase database URL",
        placeholder: "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres",
        type: "password",
      },
    };

    return {
      docs: "https://supabase.com/dashboard/project/_/settings/api",
      helpText: "Get your keys from the Supabase dashboard → Settings → API",
      prompts,
    };
  },

  discover: (opts) => async () => {
    const varNames = {
      url: opts.variableNames?.url ?? "SUPABASE_URL",
      anonKey: opts.variableNames?.anonKey ?? "SUPABASE_ANON_KEY",
    };

    const results: Partial<Record<string, DiscoveryResult>> = {};

    const existingUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const existingKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (existingUrl) {
      results[varNames.url] = {
        value: existingUrl,
        source: "Environment variable",
        description: "Found existing SUPABASE_URL",
        confidence: 1.0,
      };
    }

    if (existingKey) {
      results[varNames.anonKey] = {
        value: existingKey,
        source: "Environment variable",
        description: "Found existing SUPABASE_ANON_KEY",
        confidence: 1.0,
      };
    }

    return results;
  },

  hooks: (opts) => {
    const varNames = {
      url: opts.variableNames?.url ?? "SUPABASE_URL",
      serviceRoleKey: opts.variableNames?.serviceRoleKey ?? "SUPABASE_SERVICE_ROLE_KEY",
    };

    return {
      afterValidation(values) {
        const url = values[varNames.url];
        if (url && typeof url === "string") {
          const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
          if (projectRef) {
            console.log(`✓ Supabase: Connected to project ${projectRef}`);
          }
        }

        if (opts.serviceRole && values[varNames.serviceRoleKey]) {
          console.log("Warning: Supabase service role key detected - ensure it's only used server-side!");
        }
      },
    };
  },
});

export default supabase;
