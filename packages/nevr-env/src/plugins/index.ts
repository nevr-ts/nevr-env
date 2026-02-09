/**
 * nevr-env Official Plugins
 * 
 * Pre-built schemas for common services with auto-discovery,
 * CLI integration, and validation.
 * 
 * @example Namespace usage (recommended)
 * ```ts
 * import { auth, database, payment, ai, email, cloud } from "nevr-env/plugins";
 * 
 * createEnv({
 *   plugins: [
 *     auth.betterAuth({ providers: ["google", "github"] }),
 *     database.postgres({ pool: true }),
 *     payment.stripe({ webhook: true }),
 *     ai.openai(),
 *     email.resend(),
 *     cloud.aws({ s3: true }),
 *   ]
 * })
 * ```
 */

// ============================================================================
// NAMESPACES
// ============================================================================

// Auth namespace
export { auth } from "./auth";
export type { AuthNamespace } from "./auth";

// Database namespace  
export { database } from "./database";
export type { DatabaseNamespace } from "./database";

// Payment namespace
export { payment } from "./payment";
export type { PaymentNamespace } from "./payment";

// AI namespace
export { ai } from "./ai";
export type { AINamespace } from "./ai";

// Email namespace
export { email } from "./email";
export type { EmailNamespace } from "./email";

// Cloud namespace
export { cloud } from "./cloud";
export type { CloudNamespace } from "./cloud";

// ============================================================================
// INDIVIDUAL PROVIDERS (re-exported from namespaces)
// ============================================================================

// Auth providers
export { betterAuth, clerk, auth0, nextauth } from "./auth";
export type { BetterAuthOptions, ClerkOptions, Auth0Options, NextAuthOptions } from "./auth";

// Database providers
export { postgres, redis, supabase } from "./database";
export type { PostgresOptions, RedisOptions, SupabaseOptions } from "./database";

// Payment providers
export { stripe } from "./payment";
export type { StripeOptions } from "./payment";

// AI providers
export { openai } from "./ai";
export type { OpenAIOptions } from "./ai";

// Email providers
export { resend } from "./email";
export type { ResendOptions } from "./email";

// Cloud providers
export { aws } from "./cloud";
export type { AWSOptions } from "./cloud";

// ============================================================================
// SHARED UTILITIES
// ============================================================================

export {
  type OAuthProvider,
  OAUTH_PROVIDER_INFO,
  createOAuthSchema,
  createOAuthPrompts,
} from "./auth";


