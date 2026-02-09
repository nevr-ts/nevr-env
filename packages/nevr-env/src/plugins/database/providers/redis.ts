/**
 * Redis plugin for nevr-env with Docker/Podman auto-discovery
 * and connection string validation.
 */

import { z } from "zod";
import { createPlugin } from "@nevr-env/core";
import type { DiscoveryResult, PromptConfig } from "@nevr-env/core";
import { containerExec } from "../container-runtime";

/**
 * Redis plugin options (non-flag options only)
 */
export interface RedisOptions {
  /**
   * Custom variable names
   */
  variableNames?: {
    url?: string;
    host?: string;
    port?: string;
    password?: string;
    database?: string;
    tlsUrl?: string;
    clusterNodes?: string;
    upstashUrl?: string;
    upstashToken?: string;
    keyPrefix?: string;
    sentinelMaster?: string;
    maxConnections?: string;
    minConnections?: string;
  };
}

/**
 * Discover Redis containers via Docker
 */
async function discoverRedisDocker(): Promise<DiscoveryResult[]> {
  const results: DiscoveryResult[] = [];

  try {
    const stdout = await containerExec(
      'ps --filter "ancestor=redis" --filter "ancestor=bitnami/redis" --format "{{.Names}}|{{.Ports}}"'
    );

    const lines = stdout.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      const [name, ports] = line.split("|");
      const portMatch = ports?.match(/(\d+)->6379\/tcp/);
      const port = portMatch?.[1] || "6379";

      results.push({
        value: `redis://localhost:${port}`,
        source: `Docker container: ${name}`,
        confidence: 0.9,
        description: `Redis running on port ${port}`,
      });
    }
  } catch {
    // Docker/Podman not available or no containers found
  }

  const cloudProviders = [
    { env: "UPSTASH_REDIS_REST_URL", name: "Upstash Redis" },
    { env: "REDIS_TLS_URL", name: "Heroku Redis" },
    { env: "REDISCLOUD_URL", name: "Redis Cloud" },
  ];

  for (const provider of cloudProviders) {
    if (process.env[provider.env]) {
      results.push({
        value: process.env[provider.env]!,
        source: provider.name,
        confidence: 0.95,
        description: `Found ${provider.name} connection`,
      });
    }
  }

  return results;
}

/**
 * Create a Redis URL schema
 */
function createRedisUrlSchema(tls?: boolean): z.ZodEffects<z.ZodString, string, string> {
  return z
    .string()
    .min(1, "Redis URL is required")
    .refine(
      (val) => {
        try {
          const url = new URL(val);
          const validProtocols = tls
            ? ["rediss:"]
            : ["redis:", "rediss:"];
          return validProtocols.includes(url.protocol);
        } catch {
          return false;
        }
      },
      {
        message: tls
          ? "Invalid Redis URL. Must use rediss:// protocol for TLS"
          : "Invalid Redis URL. Must use redis:// or rediss:// protocol",
      }
    );
}

/**
 * Redis plugin for nevr-env
 *
 * @example Basic usage
 * ```ts
 * import { createEnv } from "nevr-env";
 * import { redis } from "nevr-env/plugins";
 *
 * export const env = createEnv({
 *   plugins: [redis()],
 * });
 *
 * // Access: env.REDIS_URL
 * ```
 *
 * @example With cluster support
 * ```ts
 * redis({ cluster: true })
 * // Access: env.REDIS_URL, env.REDIS_CLUSTER_NODES
 * ```
 */
export const redis = createPlugin({
  id: "redis",
  name: "Redis",
  prefix: "REDIS_",

  $options: {} as RedisOptions,

  base: {
    REDIS_URL: createRedisUrlSchema(),
  },

  when: {
    tls: {
      REDIS_TLS_URL: createRedisUrlSchema(true).optional(),
    },
    cluster: {
      REDIS_CLUSTER_NODES: z
        .string()
        .optional()
        .describe("Comma-separated list of cluster node URLs"),
    },
    upstash: {
      UPSTASH_REDIS_REST_URL: z.string().url(),
      UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
    },
    pool: {
      REDIS_MAX_CONNECTIONS: z.coerce.number().min(1).max(1000).optional(),
      REDIS_MIN_CONNECTIONS: z.coerce.number().min(0).optional(),
    },
    keyPrefix: {
      REDIS_KEY_PREFIX: z.string().optional(),
    },
    sentinel: {
      REDIS_SENTINEL_MASTER: z.string().optional(),
    },
  },

  runtimeSchema: (opts, schema) => {
    const varNames = opts.variableNames;
    if (!varNames) return;

    const remappings: [string, string | undefined][] = [
      ["REDIS_URL", varNames.url],
      ["REDIS_TLS_URL", varNames.tlsUrl],
      ["REDIS_CLUSTER_NODES", varNames.clusterNodes],
      ["UPSTASH_REDIS_REST_URL", varNames.upstashUrl],
      ["UPSTASH_REDIS_REST_TOKEN", varNames.upstashToken],
      ["REDIS_KEY_PREFIX", varNames.keyPrefix],
      ["REDIS_SENTINEL_MASTER", varNames.sentinelMaster],
      ["REDIS_MAX_CONNECTIONS", varNames.maxConnections],
      ["REDIS_MIN_CONNECTIONS", varNames.minConnections],
    ];

    for (const [defaultKey, customKey] of remappings) {
      if (customKey && customKey !== defaultKey && schema[defaultKey]) {
        schema[customKey] = schema[defaultKey];
        delete schema[defaultKey];
      }
    }
  },

  cli: (opts) => {
    const variableNames = opts.variableNames ?? {};

    const urlVar = variableNames.url || "REDIS_URL";
    const hostVar = variableNames.host || "REDIS_HOST";
    const portVar = variableNames.port || "REDIS_PORT";
    const passwordVar = variableNames.password || "REDIS_PASSWORD";

    const prompts: Record<string, PromptConfig> = {
      [urlVar]: {
        message: "Enter your Redis connection URL",
        placeholder: "redis://localhost:6379",
        type: "password",
        validate: (val) => {
          try {
            const url = new URL(val);
            if (!["redis:", "rediss:"].includes(url.protocol)) {
              return "URL must use redis:// or rediss:// protocol";
            }
            return undefined;
          } catch {
            return "Invalid URL format";
          }
        },
      },
      [hostVar]: {
        message: "Enter your Redis host",
        placeholder: "localhost",
        type: "text",
      },
      [portVar]: {
        message: "Enter your Redis port",
        placeholder: "6379",
        type: "text",
        validate: (val) => {
          const port = parseInt(val, 10);
          if (isNaN(port) || port < 1 || port > 65535) {
            return "Port must be between 1 and 65535";
          }
          return undefined;
        },
      },
      [passwordVar]: {
        message: "Enter your Redis password (optional)",
        type: "password",
      },
    };

    return {
      docs: "https://redis.io/docs/connect/",
      helpText: "Redis is used for caching and pub/sub messaging",
      prompts,
    };
  },

  discover: (opts) => async () => {
    const variableNames = opts.variableNames ?? {};
    const urlVar = variableNames.url || "REDIS_URL";

    const discoveries = await discoverRedisDocker();

    if (discoveries.length === 0) {
      return {};
    }

    return {
      [urlVar]: discoveries,
    };
  },

  hooks: (opts) => {
    const variableNames = opts.variableNames ?? {};
    const urlVar = variableNames.url || "REDIS_URL";

    return {
      afterValidation(values) {
        const url = values[urlVar];
        if (url && typeof url === "string") {
          console.log(`✓ Redis: Connected to ${new URL(url).host}`);
        }
      },
    };
  },
});

export default redis;
