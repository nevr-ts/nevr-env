/**
 * Payment namespace - All payment providers
 * 
 * @example Namespace usage (recommended)
 * ```ts
 * import { payment } from "nevr-env/plugins";
 * 
 * createEnv({
 *   plugins: [
 *     payment.stripe({ webhook: true, connect: true }),
 *   ]
 * })
 * ```
 */

import stripe, { type StripeOptions } from "./providers/stripe";

// Export types
export type { StripeOptions } from "./providers/stripe";

// Export individual providers
export { stripe };

/**
 * Payment namespace containing all payment providers
 * 
 * @example
 * ```ts
 * import { payment } from "nevr-env/plugins";
 * 
 * // Stripe with webhooks
 * payment.stripe({ webhook: true, connect: true })
 * ```
 */
export const payment = {
  /**
   * Stripe - Payment processing platform
   * @see https://stripe.com
   */
  stripe,
} as const;

export type PaymentNamespace = typeof payment;
