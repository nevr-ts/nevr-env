/**
 * Standalone Better Auth plugin export.
 *
 * Use this entry point for optimal tree-shaking:
 *   import { betterAuth } from "nevr-env/plugins/better-auth";
 *
 * Instead of the barrel which pulls every plugin:
 *   import { auth } from "nevr-env/plugins";
 */
export { betterAuth } from "./auth/providers/better-auth";
export type { BetterAuthOptions } from "./auth/providers/better-auth";
