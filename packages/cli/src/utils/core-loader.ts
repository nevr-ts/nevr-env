/**
 * Typed loader for @nevr-env/core functions.
 *
 * Loads the core package once via dynamic import and returns properly typed
 * function references. This is the single entry point for all CLI commands
 * that need core functionality.
 *
 * WHY dynamic import?
 * ─────────────────
 * @nevr-env/core is ESM-only (no CJS "require" export). The CLI is also ESM,
 * but tsup's __require shim uses CJS require() at runtime which fails against
 * ESM-only packages. Additionally, TypeScript's DTS build follows static
 * import("@nevr-env/core") and resolves to the source files via the workspace
 * symlink, violating rootDir. Using a variable for the package name prevents
 * TypeScript from resolving the module at build time.
 *
 * The types below are the CLI's interface contract with @nevr-env/core.
 * They mirror the core exports but are declared locally to avoid DTS issues.
 */

// ─── Secret Scanner Types ──────────────────────────────────────────

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
}

export interface SecretMatch {
  file: string;
  line: number;
  column: number;
  pattern: SecretPattern;
  match: string;
  lineContent: string;
}

export interface ScanResult {
  hasSecrets: boolean;
  filesScanned: number;
  matches: SecretMatch[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface ScanOptions {
  directory?: string;
  include?: string[];
  exclude?: string[];
  additionalPatterns?: SecretPattern[];
  redact?: boolean;
  maxFileSize?: number;
}

// ─── Schema Diff Types ─────────────────────────────────────────────

export interface TypeInfo {
  type: string;
  optional: boolean;
  hasDefault: boolean;
  enumValues?: string[];
}

export interface VariableChange {
  key: string;
  oldType?: TypeInfo;
  newType?: TypeInfo;
  breaking: boolean;
  breakingReason?: string;
}

export interface SchemaDiff {
  added: VariableChange[];
  removed: VariableChange[];
  changed: VariableChange[];
  renamed: { from: string; to: string; confidence: number }[];
  isBreaking: boolean;
  summary: string;
}

// ─── Rotation Types ────────────────────────────────────────────────

export interface RotationRecord {
  key: string;
  lastRotated: string;
  rotatedBy?: string;
  maxAgeDays: number;
  notes?: string;
}

export interface RotationStatus {
  key: string;
  lastRotated: string | null;
  daysSinceRotation: number | null;
  maxAgeDays: number;
  needsRotation: boolean;
  status: "fresh" | "warning" | "expired" | "unknown";
}

export interface RotationConfig {
  trackingFile?: string;
  defaultMaxAgeDays?: number;
  trackedKeys?: string[];
  onStaleSecret?: (record: RotationRecord, ageDays: number) => void;
}

// ─── Vault Types ────────────────────────────────────────────────────

export interface VaultFile {
  version: number;
  salt: string;
  iv: string;
  authTag: string;
  encrypted: string;
  hmac: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    variables: number;
  };
}

// ─── CI Types ──────────────────────────────────────────────────────

export interface SchemaConfig {
  server?: Record<string, unknown>;
  client?: Record<string, unknown>;
  shared?: Record<string, unknown>;
}

export type CIPlatform = "github" | "vercel" | "railway" | "gitlab" | "circleci";

// ─── Core Function Signatures ──────────────────────────────────────

export interface CoreFunctions {
  // Secret scanner
  scanForSecrets: (options?: ScanOptions) => ScanResult;
  formatScanResults: (result: ScanResult, cwd?: string) => string;

  // Schema diff
  diffSchemas: (
    oldSchema: Record<string, unknown>,
    newSchema: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => SchemaDiff;
  generateMigrationGuide: (diff: SchemaDiff) => string;

  // Rotation
  checkRotationStatus: (
    keys: string[],
    options?: RotationConfig
  ) => RotationStatus[];
  recordRotation: (
    key: string,
    options?: {
      trackingFile?: string;
      maxAgeDays?: number;
      rotatedBy?: string;
      notes?: string;
    }
  ) => RotationRecord;

  // CI integration
  generateCIConfig: (
    schema: SchemaConfig,
    platform: CIPlatform,
    options?: Record<string, unknown>
  ) => string;

  // Vault crypto
  generateKey: () => string;
  encrypt: (
    envContent: string,
    password: string,
    existingMetadata?: VaultFile["metadata"]
  ) => Promise<VaultFile>;
  decrypt: (vault: VaultFile, password: string) => Promise<string>;
}

// ─── Loader ────────────────────────────────────────────────────────

let _cached: CoreFunctions | null = null;

/**
 * Load @nevr-env/core and return typed function references.
 * Caches the module after the first load.
 *
 * @throws Error if @nevr-env/core is not installed
 */
export async function loadCore(): Promise<CoreFunctions> {
  if (_cached) return _cached;

  // Variable indirection prevents TypeScript DTS from resolving the module
  // path statically, which would fail due to rootDir constraints.
  const pkg = "@nevr-env/core";
  const mod = await import(pkg);

  _cached = {
    scanForSecrets: mod.scanForSecrets,
    formatScanResults: mod.formatScanResults,
    diffSchemas: mod.diffSchemas,
    generateMigrationGuide: mod.generateMigrationGuide,
    checkRotationStatus: mod.checkRotationStatus,
    recordRotation: mod.recordRotation,
    generateCIConfig: mod.generateCIConfig,
    generateKey: mod.generateKey,
    encrypt: mod.encrypt,
    decrypt: mod.decrypt,
  };

  return _cached;
}
