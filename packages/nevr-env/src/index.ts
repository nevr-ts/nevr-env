/**
 * nevr-env - The Environment Lifecycle Framework
 * 
 * One package, everything included:
 * - Type-safe validation
 * - Official plugins (postgres, stripe, redis, openai, resend)
 * - Encrypted vault for team secrets
 * - Interactive CLI
 * 
 * @example
 * ```ts
 * import { createEnv, postgres, stripe } from "nevr-env";
 * import { z } from "zod";
 * 
 * export const env = createEnv({
 *   plugins: [postgres(), stripe()],
 *   server: {
 *     NODE_ENV: z.enum(["development", "production", "test"]),
 *   },
 *   runtimeEnv: process.env,
 * });
 * ```
 */

// ============================================
// Core - Re-export from @nevr-env/core
// ============================================
export {
  createEnv,
  getPluginMetadata,
  getEnvMetadata,
  __NEVR_ENV_METADATA__,
  createPlugin,
  urlSchema,
  portSchema,
  booleanSchema,
  optionalSchema,
  stringSchema,
  enumSchema,
  createPrompts,
  mergeSchemas,
  makeOptional,
  parseWithDictionary,
  ensureSynchronous,
  runtimeEnv,
  isServerRuntime,
  detectRuntime,
  getEnvVar,
  getBooleanEnvVar,
  ENV,
  // .env.example generator
  generateEnvExample,
  getSchemaInfo,
  // Health check
  healthCheck,
  createHealthEndpoint,
  // Secret rotation
  loadRotationRecords,
  saveRotationRecords,
  recordRotation,
  getRotationStatus,
  checkRotationStatus,
  createRotationChecker,
  // Secret scanning
  scanForSecrets,
  generatePreCommitHook,
  formatScanResults,
  DEFAULT_SECRET_PATTERNS,
  // Schema diffing
  diffSchemas,
  diffPlugins,
  generateMigrationGuide,
} from "@nevr-env/core";

export type {
  EnvConfigMetadata,
  NevrEnvPlugin,
  PromptConfig,
  DiscoveryResult,
  PluginCliConfig,
  PluginHooks,
  ExtractPluginSchema,
  MergePluginSchemas,
  DefinePluginConfig,
  EnvOptions,
  CreateEnvResult,
  StandardSchemaV1,
  StandardSchemaDictionary,
  InferDictionary,
  // Health check types
  HealthCheckResult,
  HealthCheckOptions,
  VariableHealthResult,
  // Rotation types
  RotationRecord,
  RotationConfig,
  RotationStatus,
  // Scanner types
  SecretPattern,
  SecretMatch,
  ScanResult,
  ScanOptions,
  // Schema diff types
  SchemaDiff,
  VariableChange,
  TypeInfo,
  DiffOptions,
} from "@nevr-env/core";

// ============================================
// Official Plugins - Bundled with nevr-env
// ============================================
export { postgres } from "./plugins";
export type { PostgresOptions } from "./plugins";

export { stripe } from "./plugins";
export type { StripeOptions } from "./plugins";

export { redis } from "./plugins";
export type { RedisOptions } from "./plugins";

export { openai } from "./plugins";
export type { OpenAIOptions } from "./plugins";

export { resend } from "./plugins";
export type { ResendOptions } from "./plugins";

// Namespaces
export { auth, database, payment, ai, email, cloud } from "./plugins";
export type { AuthNamespace, DatabaseNamespace, PaymentNamespace, AINamespace, EmailNamespace, CloudNamespace } from "./plugins";

// ============================================
// Vault - Re-export from @nevr-env/vault
// ============================================
export {
  generateKey,
  encrypt,
  decrypt,
  parseEnv,
  stringifyEnv,
  mergeEnv,
  validateKey,
  getKeyFromEnv,
  VaultError,
  push,
  pull,
  sync,
  status,
  diff,
  ensureGitignore,
  hasVaultAccess,
} from "./vault";

export type {
  VaultFile,
  VaultOptions,
} from "./vault";
