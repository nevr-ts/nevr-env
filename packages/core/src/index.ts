/**
 * @nevr-env/core
 * 
 * Type-safe environment validation with plugin system and Proxy pattern
 */

// Core function
export { createEnv, getPluginMetadata, getEnvMetadata, __NEVR_ENV_METADATA__ } from "./create-env";
export type { EnvConfigMetadata } from "./create-env";

// Types
export type {
  NevrEnvPlugin,
  PromptConfig,
  DiscoveryResult,
  PluginCliConfig,
  PluginHooks,
  ExtractPluginSchema,
  MergePluginSchemas,
} from "./types/plugin";

// Plugin helpers
export {
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
} from "./plugin-helpers";

export type {
  DefinePluginConfig,
  OAuthProvider,
  OAuthProviderSchema,
  ExtractProviders,
} from "./plugin-helpers";

export type {
  EnvOptions,
  CreateEnvResult,
} from "./types/options";

// Standard Schema
export type {
  StandardSchemaV1,
  StandardSchemaDictionary,
  InferDictionary,
} from "./standard";

export {
  parseWithDictionary,
  ensureSynchronous,
} from "./standard";

// Runtime utilities
export {
  runtimeEnv,
  isServerRuntime,
  detectRuntime,
  getEnvVar,
  getBooleanEnvVar,
  ENV,
} from "./runtime";

// .env.example generator
export {
  generateEnvExample,
  getSchemaInfo,
} from "./generate-example";

// Health check utilities
export {
  healthCheck,
  createHealthEndpoint,
} from "./health-check";

export type {
  HealthCheckResult,
  HealthCheckOptions,
  VariableHealthResult,
} from "./health-check";

// Secret rotation tracking
export {
  loadRotationRecords,
  saveRotationRecords,
  recordRotation,
  getRotationStatus,
  checkRotationStatus,
  createRotationChecker,
} from "./rotation";

export type {
  RotationRecord,
  RotationConfig,
  RotationStatus,
} from "./rotation";

// Secret scanning
export {
  scanForSecrets,
  generatePreCommitHook,
  formatScanResults,
  DEFAULT_SECRET_PATTERNS,
} from "./secret-scanner";

export type {
  SecretPattern,
  SecretMatch,
  ScanResult,
  ScanOptions,
} from "./secret-scanner";

// Schema diffing
export {
  diffSchemas,
  diffPlugins,
  generateMigrationGuide,
} from "./schema-diff";

export type {
  SchemaDiff,
  VariableChange,
  TypeInfo,
  DiffOptions,
} from "./schema-diff";

// CI/CD integration
export {
  extractCIConfig,
  generateGitHubActionsWorkflow,
  generateVercelConfig,
  generateRailwayConfig,
  generateGitLabCI,
  generateCircleCI,
  generateCIConfig,
} from "./ci-integration";

export type {
  CIConfig,
  SchemaConfig,
} from "./ci-integration";

// Vault cryptography
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
} from "./vault-crypto";

export type { VaultFile } from "./vault-crypto";

// Auto-migration
export {
  renameVar,
  transformVar,
  splitVar,
  mergeVars,
  deleteVar,
  addVar,
  createMigrationPlan,
  previewMigration,
  migrate,
  rollback,
  generateMigrationFromDiff,
  patterns as migrationPatterns,
} from "./auto-migration";

export type {
  MigrationRule,
  MigrationPlan,
  MigrationResult,
} from "./auto-migration";
