/**
 * Railway preset plugin for nevr-env
 *
 * Pre-built environment preset for Railway deployments using createPlugin pattern.
 * @see https://docs.railway.app/reference/variables#railway-provided-variables
 */

import { z } from "zod";
import { createPlugin } from "@nevr-env/core";

/**
 * Railway environment variables (all auto-injected by Railway)
 */
export interface RailwayEnv {
  RAILWAY_ENVIRONMENT?: string;
  RAILWAY_ENVIRONMENT_ID?: string;
  RAILWAY_ENVIRONMENT_NAME?: string;
  RAILWAY_SERVICE_ID?: string;
  RAILWAY_SERVICE_NAME?: string;
  RAILWAY_PROJECT_ID?: string;
  RAILWAY_PROJECT_NAME?: string;
  RAILWAY_DEPLOYMENT_ID?: string;
  RAILWAY_REPLICA_ID?: string;
  RAILWAY_PUBLIC_DOMAIN?: string;
  RAILWAY_PRIVATE_DOMAIN?: string;
  RAILWAY_STATIC_URL?: string;
  RAILWAY_GIT_COMMIT_SHA?: string;
  RAILWAY_GIT_AUTHOR?: string;
  RAILWAY_GIT_BRANCH?: string;
  RAILWAY_GIT_REPO_NAME?: string;
  RAILWAY_GIT_REPO_OWNER?: string;
  RAILWAY_GIT_COMMIT_MESSAGE?: string;
}

/**
 * Railway preset options
 */
export interface RailwayOptions {
  /**
   * Include Git-related environment variables
   * @default true
   */
  includeGit?: boolean;

  /**
   * Require production environment
   * @default false
   */
  requireProduction?: boolean;
}

/**
 * Railway preset — provides all Railway system environment variables.
 *
 * @example
 * ```ts
 * import { createEnv } from "nevr-env";
 * import { railway } from "nevr-env/presets/railway";
 *
 * export const env = createEnv({
 *   plugins: [railway()],
 *   server: {
 *     DATABASE_URL: z.string().url(),
 *   },
 * });
 *
 * env.RAILWAY_PUBLIC_DOMAIN; // typed!
 * ```
 */
export const railway = createPlugin({
  id: "railway",
  name: "Railway",
  prefix: "RAILWAY_",

  $options: {} as RailwayOptions,

  base: {
    RAILWAY_ENVIRONMENT: z.string().optional(),
    RAILWAY_ENVIRONMENT_ID: z.string().optional(),
    RAILWAY_ENVIRONMENT_NAME: z.string().optional(),
    RAILWAY_SERVICE_ID: z.string().optional(),
    RAILWAY_SERVICE_NAME: z.string().optional(),
    RAILWAY_PROJECT_ID: z.string().optional(),
    RAILWAY_PROJECT_NAME: z.string().optional(),
    RAILWAY_DEPLOYMENT_ID: z.string().optional(),
    RAILWAY_REPLICA_ID: z.string().optional(),
    RAILWAY_PUBLIC_DOMAIN: z.string().optional(),
    RAILWAY_PRIVATE_DOMAIN: z.string().optional(),
    RAILWAY_STATIC_URL: z.string().optional(),
  },

  when: {
    includeGit: {
      RAILWAY_GIT_COMMIT_SHA: z.string().optional(),
      RAILWAY_GIT_AUTHOR: z.string().optional(),
      RAILWAY_GIT_BRANCH: z.string().optional(),
      RAILWAY_GIT_REPO_NAME: z.string().optional(),
      RAILWAY_GIT_REPO_OWNER: z.string().optional(),
      RAILWAY_GIT_COMMIT_MESSAGE: z.string().optional(),
    },
  },

  runtimeSchema: (opts, schema) => {
    if (opts.requireProduction) {
      schema.RAILWAY_ENVIRONMENT = z.literal("production");
    }
  },

  cli: () => ({
    docs: "https://docs.railway.app/reference/variables#railway-provided-variables",
    helpText: "Railway automatically injects these variables in deployed services",
  }),
});

// ── Helper functions ─────────────────────────────────────────

/**
 * Check if running on Railway
 */
export function isRailway(): boolean {
  return !!process.env.RAILWAY_ENVIRONMENT;
}

/**
 * Check if running in Railway production environment
 */
export function isRailwayProduction(): boolean {
  return process.env.RAILWAY_ENVIRONMENT === "production";
}

/**
 * Get the public deployment URL with protocol
 */
export function getRailwayUrl(): string | undefined {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  return undefined;
}

export default railway;
