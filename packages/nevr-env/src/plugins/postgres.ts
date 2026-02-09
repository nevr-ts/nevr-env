/**
 * Standalone PostgreSQL plugin export.
 *
 * Use this entry point for optimal tree-shaking:
 *   import { postgres } from "nevr-env/plugins/postgres";
 *
 * Instead of the barrel which pulls every plugin:
 *   import { database } from "nevr-env/plugins";
 */
export { postgres } from "./database/providers/postgres";
export type { PostgresOptions } from "./database/providers/postgres";
