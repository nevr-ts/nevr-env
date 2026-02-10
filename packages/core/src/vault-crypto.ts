/**
 * Vault Cryptography
 *
 * Local-first encrypted vault for team secrets.
 *
 * The vault file (.nevr-env.vault) can be committed to git.
 * The encryption key (NEVR_ENV_KEY) is NEVER committed.
 *
 * Security Model:
 * - AES-256-GCM encryption (authenticated encryption)
 * - Key derivation using PBKDF2 with 600,000 iterations
 * - Random salt and IV per encryption
 * - HMAC-SHA256 integrity verification
 * - The vault file is useless without the key
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2,
  createHmac,
  timingSafeEqual,
} from "crypto";
import { promisify } from "util";

const pbkdf2Async = promisify(pbkdf2);

// ── Constants ────────────────────────────────────────────────────
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 600_000; // OWASP recommended for 2024+
const PBKDF2_DIGEST = "sha512";
const VAULT_VERSION = 1;

// ── Types ────────────────────────────────────────────────────────

/**
 * Vault file structure — the JSON stored in .nevr-env.vault
 */
export interface VaultFile {
  version: number;
  salt: string; // hex
  iv: string; // hex
  authTag: string; // hex
  encrypted: string; // hex
  /** HMAC-SHA256 of encrypted payload, keyed with derived key. Verifies integrity without leaking plaintext info. */
  hmac: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    variables: number;
  };
}

/**
 * Vault error class with typed error codes
 */
export class VaultError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "VERSION_MISMATCH"
      | "DECRYPT_FAILED"
      | "INTEGRITY_FAILED"
      | "FILE_NOT_FOUND"
      | "INVALID_KEY"
      | "PERMISSION_DENIED"
  ) {
    super(message);
    this.name = "VaultError";
  }
}

// ── Internal helpers ─────────────────────────────────────────────

/**
 * Derive a key from password using PBKDF2 (async — runs in libuv thread pool)
 */
async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return pbkdf2Async(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST
  );
}

/**
 * Compute HMAC-SHA256 over data
 */
function computeHmac(key: Buffer, data: Buffer): string {
  return createHmac("sha256", key).update(data).digest("hex");
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Generate a secure random key for the vault.
 * Returns a base64url-encoded 32-byte key prefixed with "nevr_"
 */
export function generateKey(): string {
  const randomPart = randomBytes(32).toString("base64url");
  return `nevr_${randomPart}`;
}

/**
 * Encrypt environment variables into a vault file
 */
export async function encrypt(
  envContent: string,
  password: string,
  existingMetadata?: VaultFile["metadata"]
): Promise<VaultFile> {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = await deriveKey(password, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(envContent, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // HMAC over ciphertext — verifies integrity without leaking any plaintext info
  const hmac = computeHmac(key, encrypted);

  // Count variables
  const variableCount = envContent
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#") && line.includes("="))
    .length;

  const now = new Date().toISOString();

  return {
    version: VAULT_VERSION,
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    encrypted: encrypted.toString("hex"),
    hmac,
    metadata: {
      createdAt: existingMetadata?.createdAt ?? now,
      updatedAt: now,
      createdBy: existingMetadata?.createdBy,
      variables: variableCount,
    },
  };
}

/**
 * Decrypt a vault file back to environment content
 */
export async function decrypt(
  vault: VaultFile,
  password: string
): Promise<string> {
  if (vault.version !== VAULT_VERSION) {
    throw new VaultError(
      `Unsupported vault version: ${vault.version}. Expected: ${VAULT_VERSION}`,
      "VERSION_MISMATCH"
    );
  }

  const salt = Buffer.from(vault.salt, "hex");
  const iv = Buffer.from(vault.iv, "hex");
  const authTag = Buffer.from(vault.authTag, "hex");
  const encrypted = Buffer.from(vault.encrypted, "hex");
  const key = await deriveKey(password, salt);

  // Verify HMAC before attempting decryption (fast-fail on tampered files)
  if (vault.hmac) {
    const expectedHmac = computeHmac(key, encrypted);
    const a = Buffer.from(vault.hmac, "hex");
    const b = Buffer.from(expectedHmac, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new VaultError(
        "HMAC verification failed — vault may be tampered or wrong key.",
        "INTEGRITY_FAILED"
      );
    }
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (error) {
    if (error instanceof VaultError) throw error;
    throw new VaultError(
      "Failed to decrypt vault. Wrong password or corrupted file.",
      "DECRYPT_FAILED"
    );
  }
}

// ── Env file utilities ───────────────────────────────────────────

/**
 * Parse .env content into key-value pairs
 */
export function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Handle quoted values
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Stringify key-value pairs into .env format
 */
export function stringifyEnv(env: Record<string, string>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(env)) {
    const needsQuotes = /[\s#"'=]/.test(value);
    const quotedValue = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;
    lines.push(`${key}=${quotedValue}`);
  }

  return lines.join("\n");
}

/**
 * Merge two env objects, with updates taking precedence
 */
export function mergeEnv(
  existing: Record<string, string>,
  updates: Record<string, string>
): Record<string, string> {
  return { ...existing, ...updates };
}

/**
 * Key validation — checks format only
 */
export function validateKey(key: string): boolean {
  if (!key.startsWith("nevr_")) return false;
  const keyPart = key.slice(5);
  if (keyPart.length < 32) return false;
  return /^[A-Za-z0-9_-]+$/.test(keyPart);
}

/**
 * Get key from environment or throw
 */
export function getKeyFromEnv(): string {
  const key = process.env.NEVR_ENV_KEY;

  if (!key) {
    throw new VaultError(
      "NEVR_ENV_KEY environment variable is not set.\n" +
        "Generate a key with: npx nevr-env vault keygen\n" +
        "Then set it: export NEVR_ENV_KEY=nevr_...",
      "INVALID_KEY"
    );
  }

  if (!validateKey(key)) {
    throw new VaultError(
      "NEVR_ENV_KEY is invalid. It should start with 'nevr_' followed by a base64url string.\n" +
        "Generate a new key with: npx nevr-env vault keygen",
      "INVALID_KEY"
    );
  }

  return key;
}
