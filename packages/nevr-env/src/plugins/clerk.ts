/**
 * Standalone Clerk plugin export.
 *
 * Use this entry point for optimal tree-shaking:
 *   import { clerk } from "nevr-env/plugins/clerk";
 *
 * Instead of the barrel which pulls every plugin:
 *   import { auth } from "nevr-env/plugins";
 */
export { clerk } from "./auth/providers/clerk";
export type { ClerkOptions } from "./auth/providers/clerk";
