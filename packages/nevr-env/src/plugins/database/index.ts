/**
 * Database namespace - All database providers
 * 
 * @example Namespace usage (recommended)
 * ```ts
 * import { database } from "nevr-env/plugins";
 * 
 * createEnv({
 *   plugins: [
 *     database.postgres({ pool: true }),
 *     database.redis({ cluster: true }),
 *     database.supabase({ database: true }),
 *   ]
 * })
 * ```
 */

// Import providers
import postgres, { type PostgresOptions } from "./providers/postgres";
import redis, { type RedisOptions } from "./providers/redis";
import supabase, { type SupabaseOptions } from "./providers/supabase";

// Export types
export type { PostgresOptions } from "./providers/postgres";
export type { RedisOptions } from "./providers/redis";
export type { SupabaseOptions } from "./providers/supabase";

// Export individual providers
export { postgres, redis, supabase };

/**
 * Database namespace containing all database providers
 * 
 * @example
 * ```ts
 * import { database } from "nevr-env/plugins";
 * 
 * // PostgreSQL with pooling
 * database.postgres({ pool: true, ssl: true })
 * 
 * // Redis with cluster
 * database.redis({ cluster: true, sentinel: true })
 * 
 * // Supabase
 * database.supabase({ database: true, storage: true })
 * ```
 */
export const database = {
  /**
   * PostgreSQL - Relational database with Docker auto-discovery
   * @see https://www.postgresql.org
   */
  postgres,
  
  /**
   * Redis - In-memory data store
   * @see https://redis.io
   */
  redis,
  
  /**
   * Supabase - PostgreSQL-based BaaS
   * @see https://supabase.com
   */
  supabase,
} as const;

export type DatabaseNamespace = typeof database;
