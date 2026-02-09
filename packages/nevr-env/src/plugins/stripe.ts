/**
 * Standalone Stripe plugin export.
 *
 * Use this entry point for optimal tree-shaking:
 *   import { stripe } from "nevr-env/plugins/stripe";
 */
export { stripe } from "./payment/providers/stripe";
export type { StripeOptions } from "./payment/providers/stripe";
