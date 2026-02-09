/**
 * Standalone NextAuth plugin export.
 *
 * Use this entry point for optimal tree-shaking:
 *   import { nextauth } from "nevr-env/plugins/nextauth";
 *
 * Instead of the barrel which pulls every plugin:
 *   import { auth } from "nevr-env/plugins";
 */
export { nextauth } from "./auth/providers/nextauth";
export type { NextAuthOptions } from "./auth/providers/nextauth";
