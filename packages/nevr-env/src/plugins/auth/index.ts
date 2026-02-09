/**
 * Auth namespace - All authentication providers
 * 
 * @example Namespace usage (recommended)
 * ```ts
 * import { auth } from "nevr-env/plugins";
 * 
 * createEnv({
 *   plugins: [
 *     auth.betterAuth({ providers: ["google", "github"] }),
 *     // or auth.clerk(), auth.auth0(), auth.nextauth()
 *   ]
 * })
 * ```
 * 
 * @example Direct import
 * ```ts
 * import { betterAuth } from "nevr-env/plugins/auth";
 * ```
 */

// Export individual providers
export { betterAuth, type BetterAuthOptions } from "./providers/better-auth";
export { clerk, type ClerkOptions } from "./providers/clerk";
export { auth0, type Auth0Options } from "./providers/auth0";
export { nextauth, type NextAuthOptions } from "./providers/nextauth";

// Export shared utilities
export {
  type OAuthProvider,
  type OAuthProviderSchema,
  type ExtractProviders,
  OAUTH_PROVIDER_INFO,
  createOAuthSchema,
  createOAuthPrompts,
  getOAuthDocsText,
} from "./shared/oauth";

// Import for namespace object
import { betterAuth } from "./providers/better-auth";
import { clerk } from "./providers/clerk";
import { auth0 } from "./providers/auth0";
import { nextauth } from "./providers/nextauth";

/**
 * Auth namespace containing all authentication providers
 * 
 * @example
 * ```ts
 * import { auth } from "nevr-env/plugins";
 * 
 * // Better-Auth with OAuth
 * auth.betterAuth({ providers: ["google", "github"], twoFactor: true })
 * 
 * // Clerk
 * auth.clerk({ webhook: true, urls: true })
 * 
 * // Auth0 with API
 * auth.auth0({ api: true, management: true })
 * 
 * // NextAuth.js
 * auth.nextauth({ providers: ["google"], database: true })
 * ```
 */
export const auth = {
  /**
   * Better-Auth - Full-featured TypeScript auth library
   * @see https://www.better-auth.com
   */
  betterAuth,
  
  /**
   * Clerk - Drop-in authentication UI
   * @see https://clerk.com
   */
  clerk,
  
  /**
   * Auth0 - Enterprise identity platform
   * @see https://auth0.com
   */
  auth0,
  
  /**
   * NextAuth.js (Auth.js) - Authentication for Next.js
   * @see https://authjs.dev
   */
  nextauth,
} as const;

export type AuthNamespace = typeof auth;
