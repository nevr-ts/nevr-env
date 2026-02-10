/**
 * `nevr vault` commands
 *
 * Local-first encrypted vault for team secrets.
 *
 * Crypto primitives (encrypt, decrypt, generateKey) live in @nevr-env/core
 * and are loaded via core-loader to avoid duplicating implementation.
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { loadCore, type VaultFile } from "../utils/core-loader";

const VAULT_FILENAME = ".nevr-env.vault";

// ── Key discovery ──────────────────────────────────────────────
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

// Keygen command
const keygen = new Command("keygen")
  .description("Generate a new encryption key for the vault")
  .option("--no-save", "Only print the key without saving to .env")
  .option("-f, --file <path>", "Path to env file to save the key", ".env")
  .action(async (opts) => {
    p.intro(pc.bgMagenta(pc.black(" nevr-env vault keygen ")));

    const core = await loadCore();
    const key = core.generateKey();
    const envFile = opts.file ?? ".env";

    p.log.success("Generated new encryption key:");
    console.log("");
    console.log(pc.cyan(`  NEVR_ENV_KEY=${key}`));
    console.log("");

    if (opts.save === false) {
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
        const updated = content.replace(/^NEVR_ENV_KEY\s*=.*/m, keyLine);
        writeFileSync(envPath, updated);
        p.log.success(`Updated ${pc.cyan("NEVR_ENV_KEY")} in ${pc.cyan(envFile)}`);
      } else {
        const separator = content.endsWith("\n") ? "" : "\n";
        writeFileSync(envPath, content + separator + keyLine + "\n");
        p.log.success(`Saved ${pc.cyan("NEVR_ENV_KEY")} to ${pc.cyan(envFile)}`);
      }
    } else {
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

// Push command
const pushCmd = new Command("push")
  .description("Encrypt .env and save to .nevr-env.vault")
  .option("-e, --env <path>", "Path to .env file", ".env")
  .option("-o, --output <path>", "Output vault path", VAULT_FILENAME)
  .action(async (opts) => {
    p.intro(pc.bgMagenta(pc.black(" nevr-env vault push ")));

    const core = await loadCore();
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

    const vault = await core.encrypt(content, key, existingMeta);
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
const pullCmd = new Command("pull")
  .description("Decrypt .nevr-env.vault to .env")
  .option("-i, --input <path>", "Vault file path", VAULT_FILENAME)
  .option("-o, --output <path>", "Output .env path", ".env")
  .action(async (opts) => {
    p.intro(pc.bgMagenta(pc.black(" nevr-env vault pull ")));

    const core = await loadCore();
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
      const content = await core.decrypt(vault, key);

      // Preserve NEVR_ENV_KEY: re-append the key so the user doesn't lose it
      let finalContent = content;
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
const statusCmd = new Command("status")
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
  .addCommand(pushCmd)
  .addCommand(pullCmd)
  .addCommand(statusCmd);

// Export individual commands for direct registration
export { keygen as vaultKeygen, pushCmd as vaultPush, pullCmd as vaultPull, statusCmd as vaultStatus };
