/**
 * Standalone Auth0 plugin export.
 *
 * Use this entry point for optimal tree-shaking:
 *   import { auth0 } from "nevr-env/plugins/auth0";
 *
 * Instead of the barrel which pulls every plugin:
 *   import { auth } from "nevr-env/plugins";
 */
export { auth0 } from "./auth/providers/auth0";
export type { Auth0Options } from "./auth/providers/auth0";
