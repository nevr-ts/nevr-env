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
 * - The vault file is useless without the key
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync, createHmac, timingSafeEqual } from "crypto";

// Constants
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 600_000; // OWASP recommended for 2024+
const PBKDF2_DIGEST = "sha512";

// Vault file format version
const VAULT_VERSION = 1;

/**
 * Vault file structure
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
 * Derive a key from password using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST
  );
}

/**
 * Generate a secure random key for the vault
 * Returns a base64-encoded 32-byte key prefixed with "nevr_"
 */
export function generateKey(): string {
  const randomPart = randomBytes(32).toString("base64url");
  return `nevr_${randomPart}`;
}

/**
 * Encrypt environment variables into a vault file
 */
export function encrypt(
  envContent: string,
  password: string,
  existingMetadata?: VaultFile["metadata"]
): VaultFile {
  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive key from password
  const key = deriveKey(password, salt);

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(envContent, "utf8"),
    cipher.final(),
  ]);

  // Get auth tag for authenticated encryption
  const authTag = cipher.getAuthTag();

  // HMAC over ciphertext — verifies integrity without leaking any plaintext info
  const hmac = createHmac("sha256", key).update(encrypted).digest("hex");

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
export function decrypt(vault: VaultFile, password: string): string {
  // Check version
  if (vault.version !== VAULT_VERSION) {
    throw new VaultError(
      `Unsupported vault version: ${vault.version}. Expected: ${VAULT_VERSION}`,
      "VERSION_MISMATCH"
    );
  }

  // Parse hex strings back to buffers
  const salt = Buffer.from(vault.salt, "hex");
  const iv = Buffer.from(vault.iv, "hex");
  const authTag = Buffer.from(vault.authTag, "hex");
  const encrypted = Buffer.from(vault.encrypted, "hex");

  // Derive key from password
  const key = deriveKey(password, salt);

  // Verify HMAC before attempting decryption (fast-fail on tampered files)
  if (vault.hmac) {
    const expectedHmac = createHmac("sha256", key).update(encrypted).digest("hex");
    const a = Buffer.from(vault.hmac, "hex");
    const b = Buffer.from(expectedHmac, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new VaultError(
        "HMAC verification failed — vault may be tampered or wrong key.",
        "INTEGRITY_FAILED"
      );
    }
  }

  // Create decipher
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    if (error instanceof VaultError) throw error;

    // Auth tag verification failed = wrong password
    throw new VaultError(
      "Failed to decrypt vault. Wrong password or corrupted file.",
      "DECRYPT_FAILED"
    );
  }
}

/**
 * Parse .env content into key-value pairs
 */
export function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Find first = sign
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
    // Quote values with spaces or special characters
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
 * Vault error class
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

/**
 * Key validation
 */
export function validateKey(key: string): boolean {
  // Key should start with nevr_ prefix
  if (!key.startsWith("nevr_")) return false;

  // Rest should be base64url encoded and at least 32 chars
  const keyPart = key.slice(5);
  if (keyPart.length < 32) return false;

  // Check if it's valid base64url
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  return base64urlRegex.test(keyPart);
}

/**
 * Get key from environment or error
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
