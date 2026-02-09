/**
 * nevr-env Vault
 * 
 * Local-first encrypted vault for team secrets.
 * The vault file can be safely committed to git.
 * The encryption key stays with developers (never committed).
 * 
 * @example
 * ```ts
 * // Push local .env to encrypted vault
 * import { push } from "nevr-env/vault";
 * await push();
 * // Creates .nevr-env.vault (safe to commit)
 * 
 * // Pull from vault to local .env
 * import { pull } from "nevr-env/vault";
 * await pull();
 * // Creates .env from vault (never commit this)
 * 
 * // Generate a new encryption key
 * import { generateKey } from "nevr-env/vault";
 * const key = generateKey();
 * // Share this with your team securely (not via git/slack)
 * ```
 */

// Crypto utilities
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
  type VaultFile,
} from "./crypto";

// File operations
export {
  push,
  pull,
  sync,
  status,
  diff,
  ensureGitignore,
  type VaultOptions,
} from "./operations";

// Audit logging
export {
  logAuditEntry,
  loadAuditLog,
  verifyAuditLog,
  queryAuditLog,
  getAuditSummary,
  formatAuditEntry,
  exportAuditLog,
  rotateAuditLog,
  type AuditEntry,
  type AuditAction,
  type AuditActor,
  type AuditTarget,
  type AuditContext,
  type AuditConfig,
} from "./audit";

/**
 * Quick check if running with vault access
 */
export function hasVaultAccess(): boolean {
  const key = process.env.NEVR_ENV_KEY;
  if (!key) return false;
  if (!key.startsWith("nevr_")) return false;
  return key.length > 37; // nevr_ + 32 chars minimum
}
