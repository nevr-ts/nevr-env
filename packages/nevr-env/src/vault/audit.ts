/**
 * Vault Audit Logging
 * 
 * Track who changed what in the vault, when, and from where.
 * Provides tamper-evident audit trail for compliance and debugging.
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import * as crypto from "crypto";

/**
 * Audit log entry
 */
export interface AuditEntry {
  /** Unique entry ID */
  id: string;
  /** ISO timestamp */
  timestamp: string;
  /** Action performed */
  action: AuditAction;
  /** Who performed the action */
  actor: AuditActor;
  /** What was affected */
  target: AuditTarget;
  /** Additional context */
  context: AuditContext;
  /** SHA-256 hash of previous entry (chain integrity) */
  previousHash?: string;
  /** Entry signature (for verification) */
  hash: string;
}

/**
 * Possible audit actions
 */
export type AuditAction = 
  | "vault.push"
  | "vault.pull"
  | "vault.sync"
  | "vault.diff"
  | "secret.add"
  | "secret.update"
  | "secret.remove"
  | "secret.rotate"
  | "key.generate"
  | "key.rotate"
  | "access.granted"
  | "access.denied"
  | "config.change";

/**
 * Actor (who performed the action)
 */
export interface AuditActor {
  /** Username or service account */
  name: string;
  /** Email (if available) */
  email?: string;
  /** Type of actor */
  type: "user" | "service" | "ci" | "unknown";
  /** Machine hostname */
  machine?: string;
  /** IP address (if available) */
  ip?: string;
}

/**
 * Target (what was affected)
 */
export interface AuditTarget {
  /** Target type */
  type: "vault" | "secret" | "key" | "config";
  /** Vault file path */
  vaultPath?: string;
  /** Affected secret keys (never values!) */
  secretKeys?: string[];
  /** Previous state hash */
  beforeHash?: string;
  /** New state hash */
  afterHash?: string;
}

/**
 * Additional context
 */
export interface AuditContext {
  /** Environment (production, staging, etc.) */
  environment?: string;
  /** Git branch */
  branch?: string;
  /** Git commit */
  commit?: string;
  /** CI/CD run ID */
  ciRunId?: string;
  /** Additional metadata */
  metadata?: Record<string, string>;
}

/**
 * Audit log configuration
 */
export interface AuditConfig {
  /** Path to audit log file */
  logPath?: string;
  /** Enable logging */
  enabled?: boolean;
  /** Maximum entries before rotation */
  maxEntries?: number;
  /** Whether to sign entries */
  signEntries?: boolean;
  /** Custom key for signing */
  signingKey?: string;
}

const DEFAULT_AUDIT_PATH = ".nevr-env.audit.log";
const DEFAULT_MAX_ENTRIES = 10000;

/**
 * Generate a unique entry ID
 */
function generateEntryId(): string {
  return `audit_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

/**
 * Hash an entry for integrity verification
 */
function hashEntry(entry: Omit<AuditEntry, "hash">): string {
  const content = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    action: entry.action,
    actor: entry.actor,
    target: entry.target,
    context: entry.context,
    previousHash: entry.previousHash,
  });
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Get the current actor from environment
 */
function getCurrentActor(): AuditActor {
  // Check for CI environment
  if (process.env.CI) {
    return {
      name: process.env.GITHUB_ACTOR || 
            process.env.GITLAB_USER_LOGIN || 
            process.env.CIRCLE_USERNAME ||
            "ci-service",
      type: "ci",
      machine: process.env.HOSTNAME || process.env.COMPUTERNAME,
    };
  }

  // Regular user
  return {
    name: process.env.USER || process.env.USERNAME || "unknown",
    email: process.env.GIT_AUTHOR_EMAIL || process.env.EMAIL,
    type: "user",
    machine: process.env.HOSTNAME || process.env.COMPUTERNAME,
  };
}

/**
 * Get current context from environment
 */
function getCurrentContext(): AuditContext {
  return {
    environment: process.env.NODE_ENV || process.env.ENVIRONMENT,
    branch: process.env.GITHUB_REF_NAME || 
            process.env.CI_COMMIT_REF_NAME || 
            process.env.CIRCLE_BRANCH,
    commit: process.env.GITHUB_SHA || 
            process.env.CI_COMMIT_SHA || 
            process.env.CIRCLE_SHA1,
    ciRunId: process.env.GITHUB_RUN_ID || 
             process.env.CI_PIPELINE_ID || 
             process.env.CIRCLE_BUILD_NUM,
  };
}

/**
 * Load existing audit log
 */
export function loadAuditLog(path?: string): AuditEntry[] {
  const logPath = path ?? DEFAULT_AUDIT_PATH;
  
  if (!existsSync(logPath)) {
    return [];
  }

  try {
    const content = readFileSync(logPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    return lines.map(line => JSON.parse(line) as AuditEntry);
  } catch {
    return [];
  }
}

/**
 * Get the last entry hash for chaining
 */
function getLastEntryHash(path?: string): string | undefined {
  const entries = loadAuditLog(path);
  if (entries.length === 0) return undefined;
  return entries[entries.length - 1].hash;
}

/**
 * Log an audit entry
 */
export function logAuditEntry(
  action: AuditAction,
  target: AuditTarget,
  options?: {
    actor?: Partial<AuditActor>;
    context?: Partial<AuditContext>;
    config?: AuditConfig;
  }
): AuditEntry {
  const config = options?.config ?? {};
  const logPath = config.logPath ?? DEFAULT_AUDIT_PATH;

  if (config.enabled === false) {
    // Return a dummy entry if logging is disabled
    return {
      id: "disabled",
      timestamp: new Date().toISOString(),
      action,
      actor: getCurrentActor(),
      target,
      context: {},
      hash: "disabled",
    };
  }

  const entry: Omit<AuditEntry, "hash"> = {
    id: generateEntryId(),
    timestamp: new Date().toISOString(),
    action,
    actor: { ...getCurrentActor(), ...options?.actor },
    target,
    context: { ...getCurrentContext(), ...options?.context },
    previousHash: getLastEntryHash(logPath),
  };

  const fullEntry: AuditEntry = {
    ...entry,
    hash: hashEntry(entry),
  };

  // Append to log file (NDJSON format)
  appendFileSync(logPath, JSON.stringify(fullEntry) + "\n");

  return fullEntry;
}

/**
 * Verify audit log integrity
 */
export function verifyAuditLog(path?: string): {
  valid: boolean;
  entries: number;
  errors: Array<{ index: number; error: string }>;
} {
  const logPath = path ?? DEFAULT_AUDIT_PATH;
  const entries = loadAuditLog(logPath);
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    // Verify hash
    const { hash, ...rest } = entry;
    const computedHash = hashEntry(rest);
    if (computedHash !== hash) {
      errors.push({ index: i, error: `Hash mismatch: expected ${hash}, got ${computedHash}` });
    }

    // Verify chain (skip first entry)
    if (i > 0) {
      const prevEntry = entries[i - 1];
      if (entry.previousHash !== prevEntry.hash) {
        errors.push({ 
          index: i, 
          error: `Chain broken: previous hash ${entry.previousHash} doesn't match ${prevEntry.hash}` 
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    entries: entries.length,
    errors,
  };
}

/**
 * Query audit log entries
 */
export function queryAuditLog(
  filter: {
    action?: AuditAction | AuditAction[];
    actor?: string;
    secretKey?: string;
    fromDate?: Date | string;
    toDate?: Date | string;
    limit?: number;
  },
  path?: string
): AuditEntry[] {
  let entries = loadAuditLog(path);

  // Filter by action
  if (filter.action) {
    const actions = Array.isArray(filter.action) ? filter.action : [filter.action];
    entries = entries.filter(e => actions.includes(e.action));
  }

  // Filter by actor
  if (filter.actor) {
    entries = entries.filter(e => 
      e.actor.name.toLowerCase().includes(filter.actor!.toLowerCase())
    );
  }

  // Filter by secret key
  if (filter.secretKey) {
    entries = entries.filter(e => 
      e.target.secretKeys?.includes(filter.secretKey!)
    );
  }

  // Filter by date range
  if (filter.fromDate) {
    const from = new Date(filter.fromDate);
    entries = entries.filter(e => new Date(e.timestamp) >= from);
  }
  if (filter.toDate) {
    const to = new Date(filter.toDate);
    entries = entries.filter(e => new Date(e.timestamp) <= to);
  }

  // Apply limit (most recent first)
  if (filter.limit) {
    entries = entries.slice(-filter.limit);
  }

  return entries;
}

/**
 * Get audit summary for a time period
 */
export function getAuditSummary(
  period?: { from?: Date | string; to?: Date | string },
  path?: string
): {
  totalEntries: number;
  byAction: Record<string, number>;
  byActor: Record<string, number>;
  secretsModified: string[];
  firstEntry?: string;
  lastEntry?: string;
} {
  let entries = loadAuditLog(path);

  // Apply date filter
  if (period?.from) {
    const from = new Date(period.from);
    entries = entries.filter(e => new Date(e.timestamp) >= from);
  }
  if (period?.to) {
    const to = new Date(period.to);
    entries = entries.filter(e => new Date(e.timestamp) <= to);
  }

  const byAction: Record<string, number> = {};
  const byActor: Record<string, number> = {};
  const secretsModified = new Set<string>();

  for (const entry of entries) {
    byAction[entry.action] = (byAction[entry.action] || 0) + 1;
    byActor[entry.actor.name] = (byActor[entry.actor.name] || 0) + 1;
    entry.target.secretKeys?.forEach(k => secretsModified.add(k));
  }

  return {
    totalEntries: entries.length,
    byAction,
    byActor,
    secretsModified: Array.from(secretsModified),
    firstEntry: entries[0]?.timestamp,
    lastEntry: entries[entries.length - 1]?.timestamp,
  };
}

/**
 * Format audit entry for display
 */
export function formatAuditEntry(entry: AuditEntry): string {
  const date = new Date(entry.timestamp).toLocaleString();
  const actor = entry.actor.email ? `${entry.actor.name} <${entry.actor.email}>` : entry.actor.name;
  const secrets = entry.target.secretKeys?.join(", ") || "none";
  
  return `[${date}] ${entry.action.padEnd(15)} by ${actor.padEnd(30)} | Secrets: ${secrets}`;
}

/**
 * Export audit log to various formats
 */
export function exportAuditLog(
  format: "json" | "csv" | "plaintext",
  path?: string
): string {
  const entries = loadAuditLog(path);

  switch (format) {
    case "json":
      return JSON.stringify(entries, null, 2);
    
    case "csv": {
      const headers = ["timestamp", "action", "actor", "actor_type", "secrets", "environment", "branch"];
      const rows = entries.map(e => [
        e.timestamp,
        e.action,
        e.actor.name,
        e.actor.type,
        e.target.secretKeys?.join(";") || "",
        e.context.environment || "",
        e.context.branch || "",
      ]);
      return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    }
    
    case "plaintext":
      return entries.map(formatAuditEntry).join("\n");
    
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

/**
 * Rotate audit log (archive old entries)
 */
export function rotateAuditLog(options?: {
  keepEntries?: number;
  archivePath?: string;
  path?: string;
}): { 
  archived: number; 
  remaining: number;
  archivePath?: string;
} {
  const { 
    keepEntries = DEFAULT_MAX_ENTRIES, 
    archivePath,
    path = DEFAULT_AUDIT_PATH 
  } = options ?? {};

  const entries = loadAuditLog(path);
  
  if (entries.length <= keepEntries) {
    return { archived: 0, remaining: entries.length };
  }

  const toArchive = entries.slice(0, entries.length - keepEntries);
  const toKeep = entries.slice(-keepEntries);

  // Archive old entries
  const archive = archivePath ?? `${path}.${Date.now()}.archive`;
  writeFileSync(archive, toArchive.map(e => JSON.stringify(e)).join("\n") + "\n");

  // Rewrite main log with kept entries
  writeFileSync(path, toKeep.map(e => JSON.stringify(e)).join("\n") + "\n");

  return {
    archived: toArchive.length,
    remaining: toKeep.length,
    archivePath: archive,
  };
}
