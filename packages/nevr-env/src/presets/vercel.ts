/**
 * Vercel preset plugin for nevr-env
 *
 * Pre-built environment preset for Vercel deployments using createPlugin pattern
 */

import { z } from "zod";
import { createPlugin } from "@nevr-env/core";

/**
 * Vercel environment variables
 * @see https://vercel.com/docs/concepts/projects/environment-variables/system-environment-variables
 */
export interface VercelEnv {
  VERCEL?: string;
  VERCEL_ENV?: "development" | "preview" | "production";
  VERCEL_URL?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_REGION?: string;
  VERCEL_AUTOMATION_BYPASS_SECRET?: string;
  VERCEL_GIT_PROVIDER?: string;
  VERCEL_GIT_REPO_SLUG?: string;
  VERCEL_GIT_REPO_OWNER?: string;
  VERCEL_GIT_REPO_ID?: string;
  VERCEL_GIT_COMMIT_REF?: string;
  VERCEL_GIT_COMMIT_SHA?: string;
  VERCEL_GIT_COMMIT_MESSAGE?: string;
  VERCEL_GIT_COMMIT_AUTHOR_LOGIN?: string;
  VERCEL_GIT_COMMIT_AUTHOR_NAME?: string;
  VERCEL_GIT_PREVIOUS_SHA?: string;
  VERCEL_GIT_PULL_REQUEST_ID?: string;
}

/**
 * Vercel preset options
 */
export interface VercelOptions {
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
 * Vercel preset - provides all Vercel system environment variables
 *
 * @example
 * ```ts
 * import { createEnv } from "nevr-env";
 * import { vercel } from "nevr-env/presets";
 *
 * export const env = createEnv({
 *   plugins: [vercel()],
 *   server: {
 *     // your custom variables
 *   },
 * });
 * ```
 */
export const vercel = createPlugin({
  id: "vercel",
  name: "Vercel",
  prefix: "VERCEL_",

  $options: {} as VercelOptions,

  base: {
    VERCEL: z.string().optional(),
    VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
    VERCEL_URL: z.string().optional(),
    VERCEL_BRANCH_URL: z.string().optional(),
    VERCEL_REGION: z.string().optional(),
    VERCEL_AUTOMATION_BYPASS_SECRET: z.string().optional(),
  },

  when: {
    includeGit: {
      VERCEL_GIT_PROVIDER: z.string().optional(),
      VERCEL_GIT_REPO_SLUG: z.string().optional(),
      VERCEL_GIT_REPO_OWNER: z.string().optional(),
      VERCEL_GIT_REPO_ID: z.string().optional(),
      VERCEL_GIT_COMMIT_REF: z.string().optional(),
      VERCEL_GIT_COMMIT_SHA: z.string().optional(),
      VERCEL_GIT_COMMIT_MESSAGE: z.string().optional(),
      VERCEL_GIT_COMMIT_AUTHOR_LOGIN: z.string().optional(),
      VERCEL_GIT_COMMIT_AUTHOR_NAME: z.string().optional(),
      VERCEL_GIT_PREVIOUS_SHA: z.string().optional(),
      VERCEL_GIT_PULL_REQUEST_ID: z.string().optional(),
    },
  },

  runtimeSchema: (opts, schema) => {
    if (opts.requireProduction) {
      schema.VERCEL_ENV = z.literal("production");
    }
  },

  cli: () => ({
    docs: "https://vercel.com/docs/concepts/projects/environment-variables/system-environment-variables",
    helpText: "Vercel automatically provides these variables in deployed environments",
  }),
});

/**
 * Check if running on Vercel
 */
export function isVercel(): boolean {
  return !!process.env.VERCEL;
}

/**
 * Check if running in Vercel preview environment
 */
export function isVercelPreview(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

/**
 * Check if running in Vercel production environment
 */
export function isVercelProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/**
 * Get the deployment URL (works in all Vercel environments)
 */
export function getVercelUrl(): string | undefined {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return undefined;
}

export default vercel;
