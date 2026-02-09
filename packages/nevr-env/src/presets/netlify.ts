/**
 * Netlify preset plugin for nevr-env
 *
 * Pre-built environment preset for Netlify deployments using createPlugin pattern
 */

import { z } from "zod";
import { createPlugin } from "@nevr-env/core";

/**
 * Netlify environment variables
 * @see https://docs.netlify.com/configure-builds/environment-variables/#read-only-variables
 */
export interface NetlifyEnv {
  NETLIFY?: string;
  BUILD_ID?: string;
  CONTEXT?: "production" | "deploy-preview" | "branch-deploy" | "dev";
  DEPLOY_ID?: string;
  DEPLOY_PRIME_URL?: string;
  DEPLOY_URL?: string;
  URL?: string;
  SITE_ID?: string;
  SITE_NAME?: string;
  REPOSITORY_URL?: string;
  BRANCH?: string;
  HEAD?: string;
  COMMIT_REF?: string;
  CACHED_COMMIT_REF?: string;
  PULL_REQUEST?: string;
  REVIEW_ID?: string;
}

/**
 * Netlify preset options
 */
export interface NetlifyOptions {
  /**
   * Include Git/build related variables
   * @default true
   */
  includeBuildInfo?: boolean;

  /**
   * Require production context
   * @default false
   */
  requireProduction?: boolean;
}

/**
 * Netlify preset - provides all Netlify system environment variables
 *
 * @example
 * ```ts
 * import { createEnv } from "nevr-env";
 * import { netlify } from "nevr-env/presets";
 *
 * export const env = createEnv({
 *   plugins: [netlify()],
 *   server: {
 *     // your custom variables
 *   },
 * });
 * ```
 */
export const netlify = createPlugin({
  id: "netlify",
  name: "Netlify",
  prefix: "NETLIFY_",

  $options: {} as NetlifyOptions,

  base: {
    NETLIFY: z.string().optional(),
    CONTEXT: z.enum(["production", "deploy-preview", "branch-deploy", "dev"]).optional(),
    DEPLOY_PRIME_URL: z.string().optional(),
    DEPLOY_URL: z.string().optional(),
    URL: z.string().optional(),
    SITE_ID: z.string().optional(),
    SITE_NAME: z.string().optional(),
  },

  when: {
    includeBuildInfo: {
      BUILD_ID: z.string().optional(),
      DEPLOY_ID: z.string().optional(),
      REPOSITORY_URL: z.string().optional(),
      BRANCH: z.string().optional(),
      HEAD: z.string().optional(),
      COMMIT_REF: z.string().optional(),
      CACHED_COMMIT_REF: z.string().optional(),
      PULL_REQUEST: z.string().optional(),
      REVIEW_ID: z.string().optional(),
    },
  },

  runtimeSchema: (opts, schema) => {
    if (opts.requireProduction) {
      schema.CONTEXT = z.literal("production");
    }
  },

  cli: () => ({
    docs: "https://docs.netlify.com/configure-builds/environment-variables/#read-only-variables",
    helpText: "Netlify automatically provides these variables in deployed environments",
  }),
});

/**
 * Check if running on Netlify
 */
export function isNetlify(): boolean {
  return !!process.env.NETLIFY;
}

/**
 * Check if running in Netlify production context
 */
export function isNetlifyProduction(): boolean {
  return process.env.CONTEXT === "production";
}

/**
 * Check if running in Netlify deploy preview
 */
export function isNetlifyPreview(): boolean {
  return process.env.CONTEXT === "deploy-preview";
}

/**
 * Get the deployment URL
 */
export function getNetlifyUrl(): string | undefined {
  return process.env.DEPLOY_PRIME_URL || process.env.URL;
}

export default netlify;
