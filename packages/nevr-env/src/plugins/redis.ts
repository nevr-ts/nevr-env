/**
 * Standalone Redis plugin export.
 *
 * Use this entry point for optimal tree-shaking:
 *   import { redis } from "nevr-env/plugins/redis";
 */
export { redis } from "./database/providers/redis";
export type { RedisOptions } from "./database/providers/redis";
