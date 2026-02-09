/**
 * `nevr vault` commands
 * 
 * Local-first encrypted vault for team secrets
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync, createHmac, timingSafeEqual } from "crypto";

// Constants
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 600_000;
const VAULT_FILENAME = ".nevr-env.vault";

interface VaultFile {
  version: number;
  salt: string;
  iv: string;
  authTag: string;
  encrypted: string;
  /** HMAC-SHA256 of encrypted payload, keyed with derived key. Verifies integrity without leaking plaintext info. */
  hmac: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    variables: number;
  };
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha512");
}

function generateKey(): string {
  return `nevr_${randomBytes(32).toString("base64url")}`;
}

function computeHmac(key: Buffer, data: Buffer): string {
  return createHmac("sha256", key).update(data).digest("hex");
}

function encrypt(content: string, password: string, existingMeta?: VaultFile["metadata"]): VaultFile {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(content, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // HMAC over ciphertext — verifies integrity without leaking any plaintext info
  const hmac = computeHmac(key, encrypted);
  const varCount = content.split("\n").filter(l => l.trim() && !l.startsWith("#") && l.includes("=")).length;
  const now = new Date().toISOString();

  return {
    version: 1,
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    encrypted: encrypted.toString("hex"),
    hmac,
    metadata: {
      createdAt: existingMeta?.createdAt ?? now,
      updatedAt: now,
      createdBy: existingMeta?.createdBy ?? (process.env.USER || process.env.USERNAME),
      variables: varCount,
    },
  };
}

function decrypt(vault: VaultFile, password: string): string {
  // Validate vault version
  if (vault.version !== 1) {
    throw new Error(`Unsupported vault version: ${vault.version}`);
  }

  const salt = Buffer.from(vault.salt, "hex");
  const iv = Buffer.from(vault.iv, "hex");
  const authTag = Buffer.from(vault.authTag, "hex");
  const encrypted = Buffer.from(vault.encrypted, "hex");
  const key = deriveKey(password, salt);

  // Verify HMAC before attempting decryption (fast-fail on tampered files)
  if (vault.hmac) {
    const expectedHmac = computeHmac(key, encrypted);
    const a = Buffer.from(vault.hmac, "hex");
    const b = Buffer.from(expectedHmac, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("HMAC verification failed — vault may be tampered or wrong key.");
    }
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

// ── Key discovery ──────────────────────────────────────────────
const KEY_VAR = "NEVR_ENV_KEY";
const ENV_SEARCH_FILES = [".env", ".env.local", ".env.development.local", ".env.development"];

/**
 * Discover NEVR_ENV_KEY from common .env files on disk.
 * Returns the key value or null.
 */
function discoverKeyFromFiles(cwd: string = process.cwd()): { key: string; source: string } | null {
  for (const file of ENV_SEARCH_FILES) {
    const filePath = join(cwd, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf8");
      const match = content.match(/^NEVR_ENV_KEY\s*=\s*(.+)$/m);
      if (match) {
        return { key: match[1].trim(), source: file };
      }
    }
  }
  return null;
}

/**
 * Filter out NEVR_ENV_KEY from .env content so it's not encrypted into the vault.
 */
function filterVaultKey(content: string): string {
  return content
    .split("\n")
    .filter(line => !/^NEVR_ENV_KEY\s*=/.test(line))
    .join("\n");
}

// Keygen command
const keygen = new Command("keygen")
  .description("Generate a new encryption key for the vault")
  .option("--no-save", "Only print the key without saving to .env")
  .option("-f, --file <path>", "Path to env file to save the key", ".env")
  .action(async (opts) => {
    p.intro(pc.bgMagenta(pc.black(" nevr-env vault keygen ")));

    const key = generateKey();
    const envFile = opts.file ?? ".env";

    p.log.success("Generated new encryption key:");
    console.log("");
    console.log(pc.cyan(`  NEVR_ENV_KEY=${key}`));
    console.log("");

    if (opts.save === false) {
      // --no-save: just print and exit
      p.log.warn("⚠️  Save this key securely! It won't be recoverable.");
      p.outro("Key generated (not saved).");
      return;
    }

    // ── 1. Save key to .env file ────────────────────────────────
    const envPath = join(process.cwd(), envFile);
    const keyLine = `NEVR_ENV_KEY=${key}`;

    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf8");
      if (/^NEVR_ENV_KEY\s*=/m.test(content)) {
        // Replace existing key
        const updated = content.replace(/^NEVR_ENV_KEY\s*=.*/m, keyLine);
        writeFileSync(envPath, updated);
        p.log.success(`Updated ${pc.cyan("NEVR_ENV_KEY")} in ${pc.cyan(envFile)}`);
      } else {
        // Append to existing file
        const separator = content.endsWith("\n") ? "" : "\n";
        writeFileSync(envPath, content + separator + keyLine + "\n");
        p.log.success(`Saved ${pc.cyan("NEVR_ENV_KEY")} to ${pc.cyan(envFile)}`);
      }
    } else {
      // Create new file
      writeFileSync(envPath, keyLine + "\n");
      p.log.success(`Created ${pc.cyan(envFile)} with ${pc.cyan("NEVR_ENV_KEY")}`);
    }

    // ── 2. Ensure .env is in .gitignore ─────────────────────────
    const gitignorePath = join(process.cwd(), ".gitignore");
    const envBasename = envFile.replace(/^\.\//, "");
    let gitignoreAction: "created" | "added" | "already" = "already";

    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, "utf8");
      const lines = gitignore.split("\n").map(l => l.trim());
      const isIgnored = lines.some(
        (l) => l === envBasename || l === `/${envBasename}` || l === `${envBasename}/`
      );
      if (!isIgnored) {
        const sep = gitignore.endsWith("\n") ? "" : "\n";
        writeFileSync(gitignorePath, gitignore + sep + envBasename + "\n");
        gitignoreAction = "added";
      }
    } else {
      writeFileSync(gitignorePath, `# Environment files\n${envBasename}\n`);
      gitignoreAction = "created";
    }

    if (gitignoreAction === "created") {
      p.log.success(`Created ${pc.cyan(".gitignore")} with ${pc.cyan(envBasename)}`);
    } else if (gitignoreAction === "added") {
      p.log.success(`Added ${pc.cyan(envBasename)} to ${pc.cyan(".gitignore")}`);
    } else {
      p.log.info(pc.dim(`${envBasename} already in .gitignore`));
    }

    p.log.warn("⚠️  Share this key with your team securely (NOT via git/slack).");
    p.outro("Vault key ready! Run `nevr-env vault push` next.");
  });

// Helper to get key from env, .env files, or prompt
async function getKey(promptMessage: string = "Enter your encryption key:"): Promise<string> {
  // 1. Check process.env (e.g. CI, exported shell var)
  if (process.env.NEVR_ENV_KEY) {
    p.log.info(pc.dim("Using key from NEVR_ENV_KEY environment variable"));
    return process.env.NEVR_ENV_KEY;
  }

  // 2. Discover from .env / .env.local / .env.development.local / .env.development
  const discovered = discoverKeyFromFiles();
  if (discovered) {
    p.log.info(pc.dim(`Using key from ${discovered.source}`));
    return discovered.key;
  }

  // 3. In non-TTY, fail with a clear message instead of crashing
  if (!process.stdout.isTTY) {
    console.error("Error: NEVR_ENV_KEY not found. Set it via:");
    console.error("  - NEVR_ENV_KEY environment variable");
    console.error("  - .env file (run `npx nevr-env vault keygen`)");
    process.exit(1);
  }

  // 4. Prompt the user as fallback
  p.log.warn("NEVR_ENV_KEY not found in environment or .env files.");

  const result = await p.password({
    message: promptMessage,
    validate: (value) => {
      if (!value) return "Key is required";
      if (!value.startsWith("nevr_")) return "Invalid key format (should start with 'nevr_')";
      return undefined;
    },
  });

  if (p.isCancel(result)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  return result;
}

// Push command
const push = new Command("push")
  .description("Encrypt .env and save to .nevr-env.vault")
  .option("-e, --env <path>", "Path to .env file", ".env")
  .option("-o, --output <path>", "Output vault path", VAULT_FILENAME)
  .action(async (opts) => {
    p.intro(pc.bgMagenta(pc.black(" nevr-env vault push ")));
    
    const key = await getKey("Enter encryption key to push secrets:");
    
    if (!existsSync(opts.env)) {
      p.log.error(`File not found: ${opts.env}`);
      process.exit(1);
    }
    
    const s = p.spinner();
    s.start("Encrypting...");
    
    const rawContent = readFileSync(opts.env, "utf8");
    // Filter out NEVR_ENV_KEY — it should never be stored in the vault
    const content = filterVaultKey(rawContent);
    
    let existingMeta: VaultFile["metadata"] | undefined;
    if (existsSync(opts.output)) {
      try {
        existingMeta = JSON.parse(readFileSync(opts.output, "utf8")).metadata;
      } catch {}
    }
    
    const vault = encrypt(content, key, existingMeta);
    writeFileSync(opts.output, JSON.stringify(vault, null, 2));
    
    s.stop("Encrypted!");
    
    p.log.success(`Vault saved: ${pc.cyan(opts.output)}`);
    p.log.info(`Variables: ${vault.metadata.variables}`);
    if (rawContent !== content) {
      p.log.info(pc.dim("NEVR_ENV_KEY excluded from vault (kept in .env only)"));
    }
    p.log.info(pc.dim("You can now commit .nevr-env.vault to git"));
    
    p.outro("Push complete!");
  });

// Pull command
const pull = new Command("pull")
  .description("Decrypt .nevr-env.vault to .env")
  .option("-i, --input <path>", "Vault file path", VAULT_FILENAME)
  .option("-o, --output <path>", "Output .env path", ".env")
  .action(async (opts) => {
    p.intro(pc.bgMagenta(pc.black(" nevr-env vault pull ")));
    
    const key = await getKey("Enter decryption key to pull secrets:");
    
    if (!existsSync(opts.input)) {
      p.log.error(`Vault not found: ${opts.input}`);
      p.log.info("Ask a team member to run `nevr-env vault push` first.");
      process.exit(1);
    }
    
    const s = p.spinner();
    s.start("Decrypting...");
    
    try {
      const vault: VaultFile = JSON.parse(readFileSync(opts.input, "utf8"));
      const content = decrypt(vault, key);
      
      // Preserve NEVR_ENV_KEY: re-append the key so the user doesn't lose it
      let finalContent = content;
      // The key we used (from env, .env file, or prompt) — save it back
      if (!content.match(/^NEVR_ENV_KEY\s*=/m)) {
        const separator = content.endsWith("\n") ? "" : "\n";
        finalContent = content + separator + `NEVR_ENV_KEY=${key}\n`;
      }
      
      writeFileSync(opts.output, finalContent);
      
      s.stop("Decrypted!");
      
      p.log.success(`Created: ${pc.cyan(opts.output)}`);
      p.log.info(`Variables: ${vault.metadata.variables}`);
      p.log.info(pc.dim(`NEVR_ENV_KEY preserved in ${opts.output}`));
      p.log.info(`Last updated: ${vault.metadata.updatedAt}`);
      
      p.outro("Pull complete!");
    } catch (error) {
      s.stop("Failed!");
      p.log.error("Wrong key or corrupted vault file.");
      process.exit(1);
    }
  });

// Status command
const status = new Command("status")
  .description("Show vault status")
  .option("-v, --vault <path>", "Vault file path", VAULT_FILENAME)
  .action(async (opts) => {
    p.intro(pc.bgMagenta(pc.black(" nevr-env vault status ")));
    
    const hasEnvKey = !!process.env.NEVR_ENV_KEY;
    const fileKey = discoverKeyFromFiles();
    const hasKey = hasEnvKey || !!fileKey;
    const hasVault = existsSync(opts.vault);
    const hasEnv = existsSync(".env");
    
    const keySource = hasEnvKey ? "environment" : fileKey ? fileKey.source : null;
    console.log("");
    console.log(`  ${hasKey ? pc.green("✓") : pc.red("✗")} NEVR_ENV_KEY ${hasKey ? `found (${keySource})` : "not found"}`);
    console.log(`  ${hasVault ? pc.green("✓") : pc.yellow("○")} ${opts.vault} ${hasVault ? "exists" : "not found"}`);
    console.log(`  ${hasEnv ? pc.green("✓") : pc.yellow("○")} .env ${hasEnv ? "exists" : "not found"}`);
    console.log("");
    
    if (hasVault) {
      try {
        const vault: VaultFile = JSON.parse(readFileSync(opts.vault, "utf8"));
        console.log(pc.dim("  Vault metadata:"));
        console.log(`    Variables: ${vault.metadata.variables}`);
        console.log(`    Updated: ${vault.metadata.updatedAt}`);
        if (vault.metadata.createdBy) {
          console.log(`    By: ${vault.metadata.createdBy}`);
        }
        console.log("");
      } catch {}
    }
    
    if (!hasKey) {
      p.log.warn("Run `nevr-env vault keygen` to generate a key.");
    } else if (!hasVault && hasEnv) {
      p.log.info("Run `nevr-env vault push` to create the vault.");
    } else if (hasVault && !hasEnv) {
      p.log.info("Run `nevr-env vault pull` to get your .env.");
    }
    
    p.outro("");
  });

// Main vault command group
export const vault = new Command("vault")
  .description("Manage encrypted environment vault")
  .addCommand(keygen)
  .addCommand(push)
  .addCommand(pull)
  .addCommand(status);

// Export individual commands for direct registration
export { keygen as vaultKeygen, push as vaultPush, pull as vaultPull, status as vaultStatus };
