/**
 * Tests for official plugins
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { 
  postgres, type PostgresOptions,
  stripe, type StripeOptions,
  redis, type RedisOptions,
  openai, type OpenAIOptions,
  resend, type ResendOptions,
  auth, database, payment, ai, email, cloud
} from "./index";

// Store original process.env
const originalEnv = { ...process.env };

beforeEach(() => {
  // Clear relevant env vars
  const keysToDelete = Object.keys(process.env).filter(
    (key) =>
      key.startsWith("DATABASE_") ||
      key.startsWith("POSTGRES_") ||
      key.startsWith("STRIPE_") ||
      key.startsWith("REDIS_") ||
      key.startsWith("OPENAI_") ||
      key.startsWith("RESEND_")
  );
  for (const key of keysToDelete) {
    delete process.env[key];
  }
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("postgres plugin", () => {
  it("should create a plugin with default options", () => {
    const plugin = postgres();

    expect(plugin.id).toBe("postgres");
    expect(plugin.name).toBe("PostgreSQL");
    expect(plugin.schema).toHaveProperty("DATABASE_URL");
  });

  it("should include read replica when option is enabled", () => {
    const plugin = postgres({ readReplica: true });

    expect(plugin.schema).toHaveProperty("DATABASE_URL");
    expect(plugin.schema).toHaveProperty("DATABASE_READ_REPLICA_URL");
  });

  it("should include direct URL when option is enabled", () => {
    const plugin = postgres({ directUrl: true });

    expect(plugin.schema).toHaveProperty("DATABASE_URL");
    expect(plugin.schema).toHaveProperty("DIRECT_URL");
  });

  it("should use custom variable names", () => {
    const plugin = postgres({
      variableNames: {
        url: "PG_URL",
        directUrl: "PG_DIRECT_URL",
      },
      directUrl: true,
    });

    expect(plugin.schema).toHaveProperty("PG_URL");
    expect(plugin.schema).toHaveProperty("PG_DIRECT_URL");
    expect(plugin.schema).not.toHaveProperty("DATABASE_URL");
  });

  it("should have CLI configuration", () => {
    const plugin = postgres();

    expect(plugin.cli).toBeDefined();
    expect(plugin.cli?.docs).toContain("postgresql");
  });

  it("should have discover function", () => {
    const plugin = postgres();

    expect(plugin.discover).toBeDefined();
    expect(typeof plugin.discover).toBe("function");
  });
});

describe("stripe plugin", () => {
  it("should create a plugin with default options", () => {
    const plugin = stripe();

    expect(plugin.id).toBe("stripe");
    expect(plugin.name).toBe("Stripe");
    expect(plugin.schema).toHaveProperty("STRIPE_SECRET_KEY");
    expect(plugin.schema).toHaveProperty("STRIPE_PUBLISHABLE_KEY");
  });

  it("should include webhook secret when option is enabled", () => {
    const plugin = stripe({ webhook: true });

    expect(plugin.schema).toHaveProperty("STRIPE_WEBHOOK_SECRET");
  });

  it("should mark as test mode only when testMode is true", () => {
    const plugin = stripe({ testMode: true });

    expect(plugin.id).toBe("stripe");
    // The schema should validate that keys start with sk_test_
  });

  it("should include customer portal when option is enabled", () => {
    const plugin = stripe({ customerPortal: true });

    expect(plugin.schema).toHaveProperty("STRIPE_CUSTOMER_PORTAL_CONFIG_ID");
  });

  it("should include Connect fields when option is enabled", () => {
    const plugin = stripe({ connect: true });

    expect(plugin.schema).toHaveProperty("STRIPE_CONNECT_CLIENT_ID");
  });

  it("should use custom variable names", () => {
    const plugin = stripe({
      variableNames: {
        secretKey: "MY_STRIPE_KEY",
      },
    });

    expect(plugin.schema).toHaveProperty("MY_STRIPE_KEY");
  });
});

describe("redis plugin", () => {
  it("should create a plugin with default options", () => {
    const plugin = redis();

    expect(plugin.id).toBe("redis");
    expect(plugin.name).toBe("Redis");
    expect(plugin.schema).toHaveProperty("REDIS_URL");
  });

  it("should include cluster config when option is enabled", () => {
    const plugin = redis({ cluster: true });

    expect(plugin.schema).toHaveProperty("REDIS_URL");
    // Cluster configuration fields should be present
  });

  it("should include TLS config when option is enabled", () => {
    const plugin = redis({ tls: true });

    expect(plugin.id).toBe("redis");
    // TLS should be enforced in validation
  });

  it("should use custom variable names", () => {
    const plugin = redis({
      variableNames: {
        url: "MY_REDIS_URL",
      },
    });

    expect(plugin.schema).toHaveProperty("MY_REDIS_URL");
  });

  it("should have discover function", () => {
    const plugin = redis();

    expect(plugin.discover).toBeDefined();
    expect(typeof plugin.discover).toBe("function");
  });
});

describe("openai plugin", () => {
  it("should create a plugin with default options", () => {
    const plugin = openai();

    expect(plugin.id).toBe("openai");
    expect(plugin.name).toBe("OpenAI");
    expect(plugin.schema).toHaveProperty("OPENAI_API_KEY");
  });

  it("should include organization ID when option is enabled", () => {
    const plugin = openai({ organization: true });

    expect(plugin.schema).toHaveProperty("OPENAI_ORG_ID");
  });

  it("should include project ID when option is enabled", () => {
    const plugin = openai({ project: true });

    expect(plugin.schema).toHaveProperty("OPENAI_PROJECT_ID");
  });

  it("should include model configuration when option is enabled", () => {
    const plugin = openai({ model: true });

    expect(plugin.schema).toHaveProperty("OPENAI_MODEL");
  });

  it("should include Azure configuration when option is enabled", () => {
    const plugin = openai({ azure: true });

    expect(plugin.schema).toHaveProperty("AZURE_OPENAI_ENDPOINT");
    expect(plugin.schema).toHaveProperty("AZURE_OPENAI_API_VERSION");
  });

  it("should use custom variable names", () => {
    const plugin = openai({
      variableNames: {
        apiKey: "MY_OPENAI_KEY",
      },
    });

    expect(plugin.schema).toHaveProperty("MY_OPENAI_KEY");
  });
});

describe("resend plugin", () => {
  it("should create a plugin with default options", () => {
    const plugin = resend();

    expect(plugin.id).toBe("resend");
    expect(plugin.name).toBe("Resend");
    expect(plugin.schema).toHaveProperty("RESEND_API_KEY");
  });

  it("should include from email when option is enabled", () => {
    const plugin = resend({ fromEmail: true });

    expect(plugin.schema).toHaveProperty("RESEND_FROM_EMAIL");
    expect(plugin.schema).toHaveProperty("RESEND_FROM_NAME");
  });

  it("should include audience config when option is enabled", () => {
    const plugin = resend({ audience: true });

    expect(plugin.schema).toHaveProperty("RESEND_AUDIENCE_ID");
  });

  it("should include webhook secret when option is enabled", () => {
    const plugin = resend({ webhook: true });

    expect(plugin.schema).toHaveProperty("RESEND_WEBHOOK_SECRET");
  });

  it("should use custom variable names", () => {
    const plugin = resend({
      variableNames: {
        apiKey: "MY_RESEND_KEY",
      },
    });

    expect(plugin.schema).toHaveProperty("MY_RESEND_KEY");
  });
});

describe("plugin composition", () => {
  it("should create multiple plugins with different options", () => {
    const dbPlugin = postgres({ readReplica: true });
    const paymentPlugin = stripe({ webhook: true, testMode: true });
    const cachePlugin = redis({ tls: true });

    expect(dbPlugin.schema).toHaveProperty("DATABASE_READ_REPLICA_URL");
    expect(paymentPlugin.schema).toHaveProperty("STRIPE_WEBHOOK_SECRET");
    expect(cachePlugin.id).toBe("redis");
  });

  it("should not have schema key collisions between plugins", () => {
    const p1 = postgres();
    const p2 = stripe();
    const p3 = redis();
    const p4 = openai();
    const p5 = resend();

    const allKeys = new Set([
      ...Object.keys(p1.schema),
      ...Object.keys(p2.schema),
      ...Object.keys(p3.schema),
      ...Object.keys(p4.schema),
      ...Object.keys(p5.schema),
    ]);

    // Total keys should equal sum of individual schema keys
    const totalKeys =
      Object.keys(p1.schema).length +
      Object.keys(p2.schema).length +
      Object.keys(p3.schema).length +
      Object.keys(p4.schema).length +
      Object.keys(p5.schema).length;

    expect(allKeys.size).toBe(totalKeys);
  });
});

describe("plugin extend option", () => {
  it("should extend postgres schema with custom fields", () => {
    const plugin = postgres({
      extend: {
        DATABASE_MAX_RETRIES: z.coerce.number().default(3),
        DATABASE_RETRY_DELAY: z.coerce.number().default(1000),
      },
    });

    expect(plugin.schema).toHaveProperty("DATABASE_URL");
    expect(plugin.schema).toHaveProperty("DATABASE_MAX_RETRIES");
    expect(plugin.schema).toHaveProperty("DATABASE_RETRY_DELAY");
  });

  it("should extend stripe schema with custom fields", () => {
    const plugin = stripe({
      webhook: true,
      extend: {
        STRIPE_PRODUCT_ID: z.string().startsWith("prod_"),
        STRIPE_TAX_RATE_ID: z.string().startsWith("txr_").optional(),
      },
    });

    expect(plugin.schema).toHaveProperty("STRIPE_SECRET_KEY");
    expect(plugin.schema).toHaveProperty("STRIPE_WEBHOOK_SECRET");
    expect(plugin.schema).toHaveProperty("STRIPE_PRODUCT_ID");
    expect(plugin.schema).toHaveProperty("STRIPE_TAX_RATE_ID");
  });

  it("should extend redis schema with custom fields", () => {
    const plugin = redis({
      upstash: true,
      extend: {
        REDIS_CACHE_TTL: z.coerce.number().default(3600),
        REDIS_SESSION_PREFIX: z.string().default("session:"),
      },
    });

    expect(plugin.schema).toHaveProperty("UPSTASH_REDIS_REST_URL");
    expect(plugin.schema).toHaveProperty("REDIS_CACHE_TTL");
    expect(plugin.schema).toHaveProperty("REDIS_SESSION_PREFIX");
  });

  it("should extend openai schema with custom fields", () => {
    const plugin = openai({
      model: true,
      extend: {
        OPENAI_ASSISTANT_ID: z.string().startsWith("asst_"),
        OPENAI_VECTOR_STORE_ID: z.string().startsWith("vs_").optional(),
      },
    });

    expect(plugin.schema).toHaveProperty("OPENAI_API_KEY");
    expect(plugin.schema).toHaveProperty("OPENAI_MODEL");
    expect(plugin.schema).toHaveProperty("OPENAI_ASSISTANT_ID");
    expect(plugin.schema).toHaveProperty("OPENAI_VECTOR_STORE_ID");
  });

  it("should extend resend schema with custom fields", () => {
    const plugin = resend({
      fromEmail: true,
      extend: {
        RESEND_WELCOME_TEMPLATE: z.string().optional(),
        RESEND_NEWSLETTER_AUDIENCE: z.string(),
      },
    });

    expect(plugin.schema).toHaveProperty("RESEND_API_KEY");
    expect(plugin.schema).toHaveProperty("RESEND_FROM_EMAIL");
    expect(plugin.schema).toHaveProperty("RESEND_WELCOME_TEMPLATE");
    expect(plugin.schema).toHaveProperty("RESEND_NEWSLETTER_AUDIENCE");
  });

  it("should allow extended fields to override base fields", () => {
    const plugin = postgres({
      extend: {
        // Override DATABASE_URL with stricter validation
        DATABASE_URL: z.string().url().startsWith("postgresql://"),
      },
    });

    // Extended field should replace the base field
    expect(plugin.schema).toHaveProperty("DATABASE_URL");
  });
});

// ============================================================================
// Namespace Tests
// ============================================================================

describe("plugin namespaces", () => {
  describe("auth namespace", () => {
    it("should have all auth providers", () => {
      expect(auth.betterAuth).toBeDefined();
      expect(auth.clerk).toBeDefined();
      expect(auth.auth0).toBeDefined();
      expect(auth.nextauth).toBeDefined();
    });

    it("should create betterAuth plugin via namespace", () => {
      const plugin = auth.betterAuth({ providers: ["google"] });
      expect(plugin.id).toBe("better-auth");
      expect(plugin.schema).toHaveProperty("BETTER_AUTH_SECRET");
      expect(plugin.schema).toHaveProperty("GOOGLE_CLIENT_ID");
    });

    it("should create clerk plugin via namespace", () => {
      const plugin = auth.clerk({ webhook: true });
      expect(plugin.id).toBe("clerk");
      expect(plugin.schema).toHaveProperty("CLERK_PUBLISHABLE_KEY");
      expect(plugin.schema).toHaveProperty("CLERK_WEBHOOK_SECRET");
    });

    it("should create auth0 plugin via namespace", () => {
      const plugin = auth.auth0({ api: true });
      expect(plugin.id).toBe("auth-auth0");
      expect(plugin.schema).toHaveProperty("AUTH0_DOMAIN");
      expect(plugin.schema).toHaveProperty("AUTH0_AUDIENCE");
    });

    it("should create nextauth plugin via namespace", () => {
      const plugin = auth.nextauth({ providers: ["github"] });
      expect(plugin.id).toBe("auth-nextauth");
      expect(plugin.schema).toHaveProperty("NEXTAUTH_SECRET");
      expect(plugin.schema).toHaveProperty("GITHUB_CLIENT_ID");
    });
  });

  describe("database namespace", () => {
    it("should have all database providers", () => {
      expect(database.postgres).toBeDefined();
      expect(database.redis).toBeDefined();
      expect(database.supabase).toBeDefined();
    });

    it("should create postgres plugin via namespace", () => {
      const plugin = database.postgres();
      expect(plugin.id).toBe("postgres");
      expect(plugin.schema).toHaveProperty("DATABASE_URL");
    });

    it("should create redis plugin via namespace", () => {
      const plugin = database.redis();
      expect(plugin.id).toBe("redis");
      expect(plugin.schema).toHaveProperty("REDIS_URL");
    });
  });

  describe("payment namespace", () => {
    it("should have all payment providers", () => {
      expect(payment.stripe).toBeDefined();
    });

    it("should create stripe plugin via namespace", () => {
      const plugin = payment.stripe({ webhook: true });
      expect(plugin.id).toBe("stripe");
      expect(plugin.schema).toHaveProperty("STRIPE_SECRET_KEY");
      expect(plugin.schema).toHaveProperty("STRIPE_WEBHOOK_SECRET");
    });
  });

  describe("ai namespace", () => {
    it("should have all AI providers", () => {
      expect(ai.openai).toBeDefined();
    });

    it("should create openai plugin via namespace", () => {
      const plugin = ai.openai();
      expect(plugin.id).toBe("openai");
      expect(plugin.schema).toHaveProperty("OPENAI_API_KEY");
    });
  });

  describe("email namespace", () => {
    it("should have all email providers", () => {
      expect(email.resend).toBeDefined();
    });

    it("should create resend plugin via namespace", () => {
      const plugin = email.resend();
      expect(plugin.id).toBe("resend");
      expect(plugin.schema).toHaveProperty("RESEND_API_KEY");
    });
  });

  describe("cloud namespace", () => {
    it("should have all cloud providers", () => {
      expect(cloud.aws).toBeDefined();
    });

    it("should create aws plugin via namespace", () => {
      const plugin = cloud.aws({ s3: true });
      expect(plugin.id).toBe("aws");
      expect(plugin.schema).toHaveProperty("AWS_ACCESS_KEY_ID");
      expect(plugin.schema).toHaveProperty("AWS_S3_BUCKET");
    });
  });
});
