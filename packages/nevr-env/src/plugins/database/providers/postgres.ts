/**
 * PostgreSQL plugin for nevr-env with Docker/Podman auto-discovery
 */

import { z } from "zod";
import { createPlugin } from "@nevr-env/core";
import type { DiscoveryResult, PromptConfig } from "@nevr-env/core";
import { containerExec } from "../container-runtime";

/**
 * PostgreSQL plugin options (non-flag options only — flags are in `when`)
 */
export interface PostgresOptions {
  variableNames?: {
    url?: string;
    directUrl?: string;
    readReplicaUrl?: string;
    shadowUrl?: string;
    poolSize?: string;
    poolMin?: string;
    poolMax?: string;
    connectionTimeout?: string;
    idleTimeout?: string;
    sslMode?: string;
  };
  defaultPort?: number;
  dockerContainerName?: string;
}

/**
 * Postgres connection string schema
 */
const postgresUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
      } catch {
        return false;
      }
    },
    { message: "Must be a valid PostgreSQL connection URL (postgres:// or postgresql://)" }
  );

/**
 * Discover PostgreSQL databases from Docker containers
 */
async function discoverPostgresDocker(
  options: Record<string, unknown>
): Promise<DiscoveryResult[]> {
  const results: DiscoveryResult[] = [];

  try {
    const stdout = await containerExec(
      'ps --format "{{.ID}}|{{.Names}}|{{.Ports}}"',
      { timeout: 5000 }
    );

    const lines = stdout.trim().split("\n").filter(Boolean);
    const dockerContainerName = options.dockerContainerName as string | undefined;
    const defaultPort = (options.defaultPort as number) || 5432;

    for (const line of lines) {
      const [id, name, ports] = line.split("|");

      const isPostgres =
        name?.toLowerCase().includes("postgres") ||
        name?.toLowerCase().includes("pg") ||
        (dockerContainerName && name?.includes(dockerContainerName));

      const portMatch = ports?.match(/(\d+)->5432/);
      const exposedPort = portMatch ? portMatch[1] : null;

      if (isPostgres || exposedPort) {
        const port = exposedPort || String(defaultPort);

        let user = "postgres";
        let password = "postgres";
        let database = "postgres";

        try {
          const envOutput = await containerExec(
            `inspect --format '{{range .Config.Env}}{{println .}}{{end}}' ${id}`,
            { timeout: 3000 }
          );

          const envLines = envOutput.split("\n");
          for (const envLine of envLines) {
            if (envLine.startsWith("POSTGRES_USER=")) {
              user = envLine.split("=")[1] || user;
            }
            if (envLine.startsWith("POSTGRES_PASSWORD=")) {
              password = envLine.split("=")[1] || password;
            }
            if (envLine.startsWith("POSTGRES_DB=")) {
              database = envLine.split("=")[1] || database;
            }
          }
        } catch {
          // Ignore errors, use defaults
        }

        const connectionUrl = `postgresql://${user}:${password}@localhost:${port}/${database}`;

        results.push({
          value: connectionUrl,
          source: "docker",
          description: `Docker container "${name}" (${id.slice(0, 12)})`,
          confidence: 0.9,
        });
      }
    }
  } catch {
    // Docker/Podman not available or not running
  }

  return results;
}

/**
 * Discover PostgreSQL from common local defaults
 */
function discoverLocalDefaults(defaultPort: number): DiscoveryResult[] {
  return [
    {
      value: `postgresql://postgres:postgres@localhost:${defaultPort}/postgres`,
      source: "local-default",
      description: "Local PostgreSQL with default credentials",
      confidence: 0.5,
    },
  ];
}

/**
 * PostgreSQL plugin for nevr-env
 *
 * @example
 * ```ts
 * import { createEnv } from "nevr-env";
 * import { postgres } from "nevr-env/plugins";
 *
 * export const env = createEnv({
 *   plugins: [postgres()],
 * });
 * // env.DATABASE_URL
 * ```
 *
 * @example With options
 * ```ts
 * postgres({ directUrl: true, pool: true })
 * // env.DATABASE_URL, env.DIRECT_URL, env.DATABASE_POOL_SIZE, ...
 * ```
 */
export const postgres = createPlugin({
  id: "postgres",
  name: "PostgreSQL",
  prefix: "DATABASE_",

  $options: {} as PostgresOptions,

  base: {
    DATABASE_URL: postgresUrlSchema,
  },

  when: {
    directUrl: {
      DIRECT_URL: postgresUrlSchema,
    },
    readReplica: {
      DATABASE_READ_REPLICA_URL: postgresUrlSchema,
    },
    shadowDatabase: {
      SHADOW_DATABASE_URL: postgresUrlSchema.optional(),
    },
    pool: {
      DATABASE_POOL_SIZE: z.coerce.number().min(1).max(100).optional(),
      DATABASE_POOL_MIN: z.coerce.number().min(0).optional(),
      DATABASE_POOL_MAX: z.coerce.number().min(1).optional(),
      DATABASE_CONNECTION_TIMEOUT: z.coerce.number().min(0).optional(),
      DATABASE_IDLE_TIMEOUT: z.coerce.number().min(0).optional(),
    },
    ssl: {
      DATABASE_SSL_MODE: z.enum([
        "disable", "allow", "prefer", "require", "verify-ca", "verify-full",
      ]).optional(),
    },
  },

  runtimeSchema: (opts, schema) => {
    const varNames = opts.variableNames;
    if (!varNames) return;

    const remappings: [string, string | undefined][] = [
      ["DATABASE_URL", varNames.url],
      ["DIRECT_URL", varNames.directUrl],
      ["DATABASE_READ_REPLICA_URL", varNames.readReplicaUrl],
      ["SHADOW_DATABASE_URL", varNames.shadowUrl],
      ["DATABASE_POOL_SIZE", varNames.poolSize],
      ["DATABASE_POOL_MIN", varNames.poolMin],
      ["DATABASE_POOL_MAX", varNames.poolMax],
      ["DATABASE_CONNECTION_TIMEOUT", varNames.connectionTimeout],
      ["DATABASE_IDLE_TIMEOUT", varNames.idleTimeout],
      ["DATABASE_SSL_MODE", varNames.sslMode],
    ];

    for (const [defaultKey, customKey] of remappings) {
      if (customKey && customKey !== defaultKey && schema[defaultKey]) {
        schema[customKey] = schema[defaultKey];
        delete schema[defaultKey];
      }
    }
  },

  cli: (opts) => {
    const varNames = {
      url: opts.variableNames?.url ?? "DATABASE_URL",
      directUrl: opts.variableNames?.directUrl ?? "DIRECT_URL",
      readReplicaUrl: opts.variableNames?.readReplicaUrl ?? "DATABASE_READ_REPLICA_URL",
    };

    const prompts: Record<string, PromptConfig> = {
      [varNames.url]: {
        message: "Enter your PostgreSQL connection URL",
        type: "password",
        placeholder: "postgresql://user:password@localhost:5432/mydb",
        validate: (value) => {
          try {
            postgresUrlSchema.parse(value);
            return undefined;
          } catch {
            return "Invalid PostgreSQL URL format";
          }
        },
      },
    };

    if (opts.directUrl) {
      prompts[varNames.directUrl] = {
        message: "Enter your PostgreSQL direct URL (for Prisma)",
        type: "password",
        placeholder: "postgresql://user:password@localhost:5432/mydb",
      };
    }

    if (opts.readReplica) {
      prompts[varNames.readReplicaUrl] = {
        message: "Enter your PostgreSQL read replica URL",
        type: "password",
        placeholder: "postgresql://user:password@replica:5432/mydb",
      };
    }

    return {
      docs: "https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING",
      helpText: "PostgreSQL connection string in the format: postgresql://user:password@host:port/database",
      prompts,
    };
  },

  discover: (opts) => async () => {
    const varNames = {
      url: opts.variableNames?.url ?? "DATABASE_URL",
    };

    const results: Partial<Record<string, DiscoveryResult | DiscoveryResult[]>> = {};
    const defaultPort = opts.defaultPort || 5432;

    const dockerResults = await discoverPostgresDocker(opts as Record<string, unknown>);
    const localResults = discoverLocalDefaults(defaultPort);
    const allResults = [...dockerResults, ...localResults];

    if (allResults.length > 0) {
      results[varNames.url] = allResults;
    }

    return results;
  },
});

export default postgres;
