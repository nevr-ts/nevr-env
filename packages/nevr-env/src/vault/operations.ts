/**
 * Vault file operations
 * 
 * Handles reading and writing the .nevr-env.vault file
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { join, dirname, basename } from "path";
import {
  encrypt,
  decrypt,
  parseEnv,
  stringifyEnv,
  mergeEnv,
  VaultError,
  getKeyFromEnv,
  type VaultFile,
} from "./crypto";

// Default vault filename
const VAULT_FILENAME = ".nevr-env.vault";
const ENV_FILENAME = ".env";

// Files to add to .gitignore when using vault
const GITIGNORE_ENV_PATTERNS = [
  ".env",
  ".env.local",
  ".env.*.local",
  ".env.development",
  ".env.production",
  "!.env.example",
  "!.env.template",
];

/**
 * Vault options
 */
export interface VaultOptions {
  /**
   * Path to the vault file
   * @default ".nevr-env.vault"
   */
  vaultPath?: string;

  /**
   * Path to the .env file
   * @default ".env"
   */
  envPath?: string;

  /**
   * Root directory (defaults to process.cwd())
   */
  root?: string;

  /**
   * Encryption key (defaults to NEVR_ENV_KEY env var)
   */
  key?: string;

  /**
   * Automatically add env files to .gitignore
   * @default true
   */
  autoGitignore?: boolean;
}

/**
 * Find the project root by looking for common markers
 */
function findProjectRoot(startDir: string): string {
  let current = startDir;

  while (current !== dirname(current)) {
    // Check for common project markers
    const markers = [
      "package.json",
      "nevr.config.ts",
      "nevr.config.js",
      ".git",
      "pnpm-workspace.yaml",
    ];

    for (const marker of markers) {
      if (existsSync(join(current, marker))) {
        return current;
      }
    }

    current = dirname(current);
  }

  // Fallback to start directory
  return startDir;
}

/**
 * Ensure env files are in .gitignore
 * Returns the patterns that were added
 * 
 * @example
 * ```ts
 * import { ensureGitignore } from "nevr-env/vault";
 * 
 * // Add default env patterns to .gitignore
 * const added = ensureGitignore();
 * console.log("Added to .gitignore:", added);
 * 
 * // Add a specific env file
 * ensureGitignore({ envPath: ".env.production" });
 * ```
 */
export function ensureGitignore(options: { root?: string; envPath?: string } = {}): string[] {
  const root = options.root ?? findProjectRoot(process.cwd());
  const gitignorePath = join(root, ".gitignore");
  const addedPatterns: string[] = [];

  // Read existing .gitignore content
  let existingContent = "";
  if (existsSync(gitignorePath)) {
    existingContent = readFileSync(gitignorePath, "utf8");
  }

  // Parse existing patterns (trim whitespace and ignore empty lines/comments)
  const existingPatterns = new Set(
    existingContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
  );

  // Determine which patterns to add
  const patternsToAdd: string[] = [];

  // Always check the default patterns
  for (const pattern of GITIGNORE_ENV_PATTERNS) {
    if (!existingPatterns.has(pattern)) {
      // For negation patterns (starting with !), add if positive patterns exist or are being added
      if (pattern.startsWith("!")) {
        const positivePattern = pattern.slice(1);
        const hasPositive = existingPatterns.has(positivePattern)
          || patternsToAdd.some((p) => !p.startsWith("!"))
          || GITIGNORE_ENV_PATTERNS.includes(positivePattern.replace("*", "local"));
        if (hasPositive) {
          patternsToAdd.push(pattern);
        }
      } else {
        patternsToAdd.push(pattern);
      }
    }
  }

  // If a specific env path was given, add it too
  if (options.envPath) {
    const envBasename = basename(options.envPath);
    if (!existingPatterns.has(envBasename) && !GITIGNORE_ENV_PATTERNS.includes(envBasename)) {
      patternsToAdd.push(envBasename);
    }
  }

  // Add patterns to .gitignore
  if (patternsToAdd.length > 0) {
    const section = `\n# Environment files (added by nevr-env vault)\n${patternsToAdd.join("\n")}\n`;

    if (existsSync(gitignorePath)) {
      // Check if our section already exists
      if (!existingContent.includes("# Environment files (added by nevr-env vault)")) {
        appendFileSync(gitignorePath, section);
        addedPatterns.push(...patternsToAdd);
      }
    } else {
      // Create new .gitignore
      writeFileSync(gitignorePath, section.trimStart());
      addedPatterns.push(...patternsToAdd);
    }
  }

  return addedPatterns;
}

/**
 * Resolve paths from options
 */
function resolvePaths(options: VaultOptions = {}): {
  vaultPath: string;
  envPath: string;
  key: string;
} {
  const root = options.root ?? findProjectRoot(process.cwd());
  const vaultPath = options.vaultPath ?? join(root, VAULT_FILENAME);
  const envPath = options.envPath ?? join(root, ENV_FILENAME);
  const key = options.key ?? getKeyFromEnv();

  return { vaultPath, envPath, key };
}

/**
 * Push local .env to vault (encrypt and save)
 * 
 * @example
 * ```ts
 * import { push } from "nevr-env/vault";
 * 
 * // Using NEVR_ENV_KEY from environment
 * await push();
 * 
 * // Or with options
 * await push({
 *   envPath: ".env.production",
 *   vaultPath: ".nevr-env.production.vault",
 *   autoGitignore: true, // Default: true - adds env files to .gitignore
 * });
 * ```
 */
export async function push(options: VaultOptions = {}): Promise<{
  success: boolean;
  variables: number;
  vaultPath: string;
  gitignoreAdded: string[];
}> {
  const root = options.root ?? findProjectRoot(process.cwd());
  const { vaultPath, envPath, key } = resolvePaths(options);

  // Check .env exists
  if (!existsSync(envPath)) {
    throw new VaultError(
      `Environment file not found: ${envPath}\nCreate a .env file first.`,
      "FILE_NOT_FOUND"
    );
  }

  // Read .env content
  const envContent = readFileSync(envPath, "utf8");

  // Check if vault already exists (for metadata preservation)
  let existingMetadata: VaultFile["metadata"] | undefined;
  if (existsSync(vaultPath)) {
    try {
      const existingVault = JSON.parse(readFileSync(vaultPath, "utf8")) as VaultFile;
      existingMetadata = existingVault.metadata;
    } catch {
      // Ignore parse errors, will create new
    }
  }

  // Encrypt
  const vault = encrypt(envContent, key, existingMetadata);

  // Add creator info if available
  if (!vault.metadata.createdBy) {
    const username = process.env.USER || process.env.USERNAME || "unknown";
    vault.metadata.createdBy = username;
  }

  // Write vault file
  writeFileSync(vaultPath, JSON.stringify(vault, null, 2), "utf8");

  // Auto-add env files to .gitignore (default: true)
  let gitignoreAdded: string[] = [];
  if (options.autoGitignore !== false) {
    gitignoreAdded = ensureGitignore({ root, envPath });
  }

  return {
    success: true,
    variables: vault.metadata.variables,
    vaultPath,
    gitignoreAdded,
  };
}

/**
 * Pull from vault to local .env (decrypt and save)
 * 
 * @example
 * ```ts
 * import { pull } from "nevr-env/vault";
 * 
 * // Using NEVR_ENV_KEY from environment
 * await pull();
 * 
 * // Or with options
 * await pull({
 *   vaultPath: ".nevr-env.production.vault",
 *   envPath: ".env.local",
 * });
 * ```
 */
export async function pull(options: VaultOptions = {}): Promise<{
  success: boolean;
  variables: number;
  envPath: string;
}> {
  const { vaultPath, envPath, key } = resolvePaths(options);

  // Check vault exists
  if (!existsSync(vaultPath)) {
    throw new VaultError(
      `Vault file not found: ${vaultPath}\n` +
        "Ask a team member to push the vault or check if you're in the right directory.",
      "FILE_NOT_FOUND"
    );
  }

  // Read and parse vault file
  const vaultContent = readFileSync(vaultPath, "utf8");
  let vault: VaultFile;

  try {
    vault = JSON.parse(vaultContent);
  } catch {
    throw new VaultError(
      `Invalid vault file: ${vaultPath}\nThe file may be corrupted.`,
      "INTEGRITY_FAILED"
    );
  }

  // Decrypt
  const envContent = decrypt(vault, key);

  // Write .env file
  writeFileSync(envPath, envContent, "utf8");

  return {
    success: true,
    variables: vault.metadata.variables,
    envPath,
  };
}

/**
 * Sync mode: merge local changes with vault
 * 
 * If .env has new variables, add them to vault.
 * If vault has variables not in .env, add them to .env.
 * Conflicts: local .env wins (you're the developer making changes)
 */
export async function sync(options: VaultOptions = {}): Promise<{
  added: string[];
  updated: string[];
  fromVault: string[];
}> {
  const { vaultPath, envPath, key } = resolvePaths(options);

  // Read local .env
  let localEnv: Record<string, string> = {};
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, "utf8");
    localEnv = parseEnv(envContent);
  }

  // Read vault if exists
  let vaultEnv: Record<string, string> = {};
  let existingMetadata: VaultFile["metadata"] | undefined;

  if (existsSync(vaultPath)) {
    const vaultContent = readFileSync(vaultPath, "utf8");
    const vault = JSON.parse(vaultContent) as VaultFile;
    existingMetadata = vault.metadata;

    try {
      const decrypted = decrypt(vault, key);
      vaultEnv = parseEnv(decrypted);
    } catch {
      // Can't decrypt vault, just use local
    }
  }

  // Track changes
  const added: string[] = [];
  const updated: string[] = [];
  const fromVault: string[] = [];

  // Find new/updated in local
  for (const [localKey, value] of Object.entries(localEnv)) {
    if (!(localKey in vaultEnv)) {
      added.push(localKey);
    } else if (vaultEnv[localKey] !== value) {
      updated.push(localKey);
    }
  }

  // Find variables only in vault
  for (const vaultKey of Object.keys(vaultEnv)) {
    if (!(vaultKey in localEnv)) {
      fromVault.push(vaultKey);
    }
  }

  // Merge: local wins for conflicts
  const merged = mergeEnv(vaultEnv, localEnv);

  // Write merged .env
  const envContent = stringifyEnv(merged);
  writeFileSync(envPath, envContent, "utf8");

  // Push merged to vault
  const vault = encrypt(envContent, key, existingMetadata);
  writeFileSync(vaultPath, JSON.stringify(vault, null, 2), "utf8");

  return { added, updated, fromVault };
}

/**
 * Get vault status without decrypting
 */
export async function status(options: VaultOptions = {}): Promise<{
  exists: boolean;
  vaultPath: string;
  metadata?: VaultFile["metadata"];
  localEnvExists: boolean;
  envPath: string;
}> {
  const { vaultPath, envPath } = resolvePaths({
    ...options,
    key: options.key ?? "dummy", // Don't require key for status
  });

  const exists = existsSync(vaultPath);
  const localEnvExists = existsSync(envPath);

  let metadata: VaultFile["metadata"] | undefined;

  if (exists) {
    try {
      const vault = JSON.parse(readFileSync(vaultPath, "utf8")) as VaultFile;
      metadata = vault.metadata;
    } catch {
      // Ignore
    }
  }

  return {
    exists,
    vaultPath,
    metadata,
    localEnvExists,
    envPath,
  };
}

/**
 * Diff: show what variables are in vault vs local .env
 * Does NOT show values (security)
 */
export async function diff(options: VaultOptions = {}): Promise<{
  onlyInVault: string[];
  onlyInLocal: string[];
  inBoth: string[];
  different: string[]; // Same key, different value
}> {
  const { vaultPath, envPath, key } = resolvePaths(options);

  // Read local .env
  let localEnv: Record<string, string> = {};
  if (existsSync(envPath)) {
    localEnv = parseEnv(readFileSync(envPath, "utf8"));
  }

  // Read vault
  let vaultEnv: Record<string, string> = {};
  if (existsSync(vaultPath)) {
    const vault = JSON.parse(readFileSync(vaultPath, "utf8")) as VaultFile;
    const decrypted = decrypt(vault, key);
    vaultEnv = parseEnv(decrypted);
  }

  const localKeys = new Set(Object.keys(localEnv));
  const vaultKeys = new Set(Object.keys(vaultEnv));

  const onlyInVault = [...vaultKeys].filter((k) => !localKeys.has(k));
  const onlyInLocal = [...localKeys].filter((k) => !vaultKeys.has(k));
  const inBoth = [...localKeys].filter((k) => vaultKeys.has(k));
  const different = inBoth.filter((k) => localEnv[k] !== vaultEnv[k]);

  return { onlyInVault, onlyInLocal, inBoth, different };
}
