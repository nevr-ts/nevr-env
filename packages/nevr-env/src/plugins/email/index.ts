/**
 * Email namespace - All email providers
 * 
 * @example Namespace usage (recommended)
 * ```ts
 * import { email } from "nevr-env/plugins";
 * 
 * createEnv({
 *   plugins: [
 *     email.resend({ domains: true }),
 *   ]
 * })
 * ```
 */

import resend, { type ResendOptions } from "./providers/resend";

// Export types
export type { ResendOptions } from "./providers/resend";

// Export individual providers
export { resend };

/**
 * Email namespace containing all email providers
 * 
 * @example
 * ```ts
 * import { email } from "nevr-env/plugins";
 * 
 * // Resend
 * email.resend({ domains: true })
 * ```
 */
export const email = {
  /**
   * Resend - Modern email API
   * @see https://resend.com
   */
  resend,
} as const;

export type EmailNamespace = typeof email;
