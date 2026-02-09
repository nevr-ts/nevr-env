/**
 * Stripe plugin for nevr-env with dashboard links and key validation
 */

import { z } from "zod";
import { createPlugin } from "@nevr-env/core";
import type { PromptConfig } from "@nevr-env/core";

/**
 * Stripe plugin options (non-flag options only)
 */
export interface StripeOptions {
  /**
   * Use test mode keys (sk_test_, pk_test_)
   * @default true for development
   */
  testMode?: boolean;

  /**
   * Custom variable names
   */
  variableNames?: {
    secretKey?: string;
    publishableKey?: string;
    webhookSecret?: string;
    customerPortalConfigId?: string;
    connectClientId?: string;
    successUrl?: string;
    cancelUrl?: string;
    pricingTableId?: string;
    monthlyPriceId?: string;
    yearlyPriceId?: string;
  };
}

/**
 * Create a Stripe key schema with prefix validation
 */
function createKeySchema(
  prefix: string[],
  description: string
): z.ZodEffects<z.ZodString, string, string> {
  return z
    .string()
    .min(1, `${description} is required`)
    .refine(
      (val) => prefix.some((p) => val.startsWith(p)),
      {
        message: `${description} must start with ${prefix.join(" or ")}`,
      }
    );
}

/**
 * Stripe plugin for nevr-env
 *
 * @example Basic usage
 * ```ts
 * import { createEnv } from "nevr-env";
 * import { stripe } from "nevr-env/plugins";
 *
 * export const env = createEnv({
 *   plugins: [stripe()],
 * });
 *
 * // Access: env.STRIPE_SECRET_KEY, env.STRIPE_PUBLISHABLE_KEY
 * ```
 *
 * @example With webhook
 * ```ts
 * stripe({ webhook: true })
 * // Access: env.STRIPE_WEBHOOK_SECRET
 * ```
 *
 * @example Production keys only
 * ```ts
 * stripe({ testMode: false })
 * // Only accepts sk_live_ and pk_live_ keys
 * ```
 */
export const stripe = createPlugin({
  id: "stripe",
  name: "Stripe",
  prefix: "STRIPE_",

  $options: {} as StripeOptions,

  base: {
    STRIPE_SECRET_KEY: createKeySchema(
      ["sk_test_", "sk_live_", "rk_test_", "rk_live_"],
      "Stripe secret key"
    ),
    STRIPE_PUBLISHABLE_KEY: createKeySchema(
      ["pk_test_", "pk_live_"],
      "Stripe publishable key"
    ),
  },

  when: {
    webhook: {
      STRIPE_WEBHOOK_SECRET: z
        .string()
        .min(1, "Webhook secret is required")
        .refine(
          (val) => val.startsWith("whsec_"),
          { message: "Webhook secret must start with whsec_" }
        ),
    },
    customerPortal: {
      STRIPE_CUSTOMER_PORTAL_CONFIG_ID: z
        .string()
        .min(1, "Customer portal config ID is required")
        .refine(
          (val) => val.startsWith("bpc_"),
          { message: "Customer portal config ID must start with bpc_" }
        ),
    },
    connect: {
      STRIPE_CONNECT_CLIENT_ID: z
        .string()
        .min(1, "Connect client ID is required")
        .refine(
          (val) => val.startsWith("ca_"),
          { message: "Connect client ID must start with ca_" }
        ),
    },
    checkout: {
      STRIPE_SUCCESS_URL: z.string().url(),
      STRIPE_CANCEL_URL: z.string().url(),
    },
    pricingTable: {
      STRIPE_PRICING_TABLE_ID: z
        .string()
        .min(1)
        .refine(
          (val) => val.startsWith("prctbl_"),
          { message: "Pricing table ID must start with prctbl_" }
        ),
    },
    pricing: {
      STRIPE_MONTHLY_PRICE_ID: z
        .string()
        .refine(
          (val) => val.startsWith("price_"),
          { message: "Price ID must start with price_" }
        )
        .optional(),
      STRIPE_YEARLY_PRICE_ID: z
        .string()
        .refine(
          (val) => val.startsWith("price_"),
          { message: "Price ID must start with price_" }
        )
        .optional(),
    },
  },

  runtimeSchema: (opts, schema) => {
    const testMode = opts.testMode ?? process.env.NODE_ENV !== "production";
    if (!testMode) {
      // Override with production-only key schemas
      schema.STRIPE_SECRET_KEY = createKeySchema(
        ["sk_live_", "rk_live_"],
        "Stripe secret key"
      );
      schema.STRIPE_PUBLISHABLE_KEY = createKeySchema(
        ["pk_live_"],
        "Stripe publishable key"
      );
    }

    // Handle variable name remapping
    const varNames = opts.variableNames;
    if (!varNames) return;

    const remappings: [string, string | undefined][] = [
      ["STRIPE_SECRET_KEY", varNames.secretKey],
      ["STRIPE_PUBLISHABLE_KEY", varNames.publishableKey],
      ["STRIPE_WEBHOOK_SECRET", varNames.webhookSecret],
      ["STRIPE_CUSTOMER_PORTAL_CONFIG_ID", varNames.customerPortalConfigId],
      ["STRIPE_CONNECT_CLIENT_ID", varNames.connectClientId],
      ["STRIPE_SUCCESS_URL", varNames.successUrl],
      ["STRIPE_CANCEL_URL", varNames.cancelUrl],
      ["STRIPE_PRICING_TABLE_ID", varNames.pricingTableId],
      ["STRIPE_MONTHLY_PRICE_ID", varNames.monthlyPriceId],
      ["STRIPE_YEARLY_PRICE_ID", varNames.yearlyPriceId],
    ];

    for (const [defaultKey, customKey] of remappings) {
      if (customKey && customKey !== defaultKey && schema[defaultKey]) {
        schema[customKey] = schema[defaultKey];
        delete schema[defaultKey];
      }
    }
  },

  cli: (opts) => {
    const testMode = opts.testMode ?? process.env.NODE_ENV !== "production";

    const varNames = {
      secretKey: opts.variableNames?.secretKey ?? "STRIPE_SECRET_KEY",
      publishableKey: opts.variableNames?.publishableKey ?? "STRIPE_PUBLISHABLE_KEY",
      webhookSecret: opts.variableNames?.webhookSecret ?? "STRIPE_WEBHOOK_SECRET",
      customerPortalConfigId: opts.variableNames?.customerPortalConfigId ?? "STRIPE_CUSTOMER_PORTAL_CONFIG_ID",
      connectClientId: opts.variableNames?.connectClientId ?? "STRIPE_CONNECT_CLIENT_ID",
    };

    const secretPrefixes = testMode
      ? ["sk_test_", "sk_live_", "rk_test_", "rk_live_"]
      : ["sk_live_", "rk_live_"];

    const publishablePrefixes = testMode
      ? ["pk_test_", "pk_live_"]
      : ["pk_live_"];

    const prompts: Record<string, PromptConfig> = {
      [varNames.secretKey]: {
        message: `Enter your Stripe Secret Key ${testMode ? "(test or live)" : "(live only)"}`,
        type: "password",
        placeholder: testMode ? "sk_test_..." : "sk_live_...",
        validate: (value) => {
          if (!secretPrefixes.some((p) => value.startsWith(p))) {
            return `Must start with ${secretPrefixes.join(" or ")}`;
          }
          return undefined;
        },
      },
      [varNames.publishableKey]: {
        message: `Enter your Stripe Publishable Key ${testMode ? "(test or live)" : "(live only)"}`,
        type: "text",
        placeholder: testMode ? "pk_test_..." : "pk_live_...",
        validate: (value) => {
          if (!publishablePrefixes.some((p) => value.startsWith(p))) {
            return `Must start with ${publishablePrefixes.join(" or ")}`;
          }
          return undefined;
        },
      },
    };

    if (opts.webhook) {
      prompts[varNames.webhookSecret] = {
        message: "Enter your Stripe Webhook Secret",
        type: "password",
        placeholder: "whsec_...",
        validate: (value) => {
          if (!value.startsWith("whsec_")) {
            return "Must start with whsec_";
          }
          return undefined;
        },
      };
    }

    if (opts.customerPortal) {
      prompts[varNames.customerPortalConfigId] = {
        message: "Enter your Stripe Customer Portal Config ID",
        type: "text",
        placeholder: "bpc_...",
      };
    }

    if (opts.connect) {
      prompts[varNames.connectClientId] = {
        message: "Enter your Stripe Connect Client ID",
        type: "text",
        placeholder: "ca_...",
      };
    }

    return {
      docs: testMode
        ? "https://dashboard.stripe.com/test/apikeys"
        : "https://dashboard.stripe.com/apikeys",
      helpText: `Get your Stripe API keys from the dashboard.\n${
        opts.webhook
          ? "For webhook secrets, go to Developers > Webhooks > Select endpoint > Signing secret"
          : ""
      }`,
      prompts,
    };
  },

  hooks: (opts) => {
    const varNames = {
      secretKey: opts.variableNames?.secretKey ?? "STRIPE_SECRET_KEY",
    };

    return {
      afterValidation: (values: Record<string, unknown>) => {
        const secretKey = values[varNames.secretKey] as string;
        if (
          process.env.NODE_ENV === "production" &&
          secretKey?.startsWith("sk_test_")
        ) {
          console.warn(
            "Warning: Using Stripe test keys in production environment!"
          );
        }
      },
    };
  },
});

export default stripe;
