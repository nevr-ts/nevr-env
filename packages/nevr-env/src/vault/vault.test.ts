/**
 * Tests for vault operations including auto-gitignore
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  push,
  pull,
  sync,
  status,
  diff,
  ensureGitignore,
  generateKey,
  encrypt,
  decrypt,
  VaultError,
} from "./index";

// Create a temporary test directory
const testDir = join(tmpdir(), `nevr-env-test-${Date.now()}`);
const testEnvPath = join(testDir, ".env");
const testVaultPath = join(testDir, ".nevr-env.vault");
const testGitignorePath = join(testDir, ".gitignore");

// Generate a test key
const testKey = generateKey();

beforeEach(() => {
  // Create test directory
  mkdirSync(testDir, { recursive: true });
  
  // Set the test key in environment
  process.env.NEVR_ENV_KEY = testKey;
});

afterEach(() => {
  // Clean up test directory
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
  
  // Clean up env key
  delete process.env.NEVR_ENV_KEY;
});

describe("ensureGitignore", () => {
  it("should create .gitignore if it does not exist", () => {
    const added = ensureGitignore({ root: testDir });

    expect(existsSync(testGitignorePath)).toBe(true);
    expect(added.length).toBeGreaterThan(0);
    expect(added).toContain(".env");
  });

  it("should add env patterns to existing .gitignore", () => {
    // Create existing .gitignore
    writeFileSync(testGitignorePath, "node_modules/\n.DS_Store\n");

    const added = ensureGitignore({ root: testDir });

    const content = readFileSync(testGitignorePath, "utf8");
    expect(content).toContain("node_modules/");
    expect(content).toContain(".env");
    expect(content).toContain(".env.local");
  });

  it("should not duplicate existing patterns", () => {
    // Create .gitignore with some env patterns
    writeFileSync(testGitignorePath, ".env\n.env.local\n");

    const added = ensureGitignore({ root: testDir });

    const content = readFileSync(testGitignorePath, "utf8");
    const envCount = (content.match(/^\.env$/gm) || []).length;
    
    // Should only have one .env entry
    expect(envCount).toBe(1);
  });

  it("should add specific env path if provided", () => {
    const added = ensureGitignore({
      root: testDir,
      envPath: ".env.production",
    });

    const content = readFileSync(testGitignorePath, "utf8");
    expect(content).toContain(".env.production");
  });

  it("should not re-add patterns if section already exists", () => {
    // Create .gitignore with our section
    writeFileSync(
      testGitignorePath,
      "# Environment files (added by nevr-env vault)\n.env\n.env.local\n"
    );

    const added = ensureGitignore({ root: testDir });

    // Should return empty array since section exists
    expect(added).toEqual([]);
  });

  it("should include negation patterns for examples", () => {
    const added = ensureGitignore({ root: testDir });

    const content = readFileSync(testGitignorePath, "utf8");
    expect(content).toContain("!.env.example");
  });
});

describe("push with auto-gitignore", () => {
  it("should add env files to .gitignore by default", async () => {
    // Create test .env file
    writeFileSync(testEnvPath, "API_KEY=test123\n");

    const result = await push({
      root: testDir,
      envPath: testEnvPath,
      vaultPath: testVaultPath,
      key: testKey,
    });

    expect(result.success).toBe(true);
    expect(result.gitignoreAdded.length).toBeGreaterThan(0);
    expect(existsSync(testGitignorePath)).toBe(true);
  });

  it("should skip gitignore when autoGitignore is false", async () => {
    // Create test .env file
    writeFileSync(testEnvPath, "API_KEY=test123\n");

    const result = await push({
      root: testDir,
      envPath: testEnvPath,
      vaultPath: testVaultPath,
      key: testKey,
      autoGitignore: false,
    });

    expect(result.success).toBe(true);
    expect(result.gitignoreAdded).toEqual([]);
    expect(existsSync(testGitignorePath)).toBe(false);
  });

  it("should return empty array if patterns already exist", async () => {
    // Create .env and .gitignore
    writeFileSync(testEnvPath, "API_KEY=test123\n");
    writeFileSync(
      testGitignorePath,
      "# Environment files (added by nevr-env vault)\n.env\n"
    );

    const result = await push({
      root: testDir,
      envPath: testEnvPath,
      vaultPath: testVaultPath,
      key: testKey,
    });

    expect(result.success).toBe(true);
    expect(result.gitignoreAdded).toEqual([]);
  });
});

describe("push and pull", () => {
  it("should push .env to vault", async () => {
    writeFileSync(testEnvPath, "API_KEY=secret123\nDB_URL=postgres://localhost\n");

    const result = await push({
      root: testDir,
      envPath: testEnvPath,
      vaultPath: testVaultPath,
      key: testKey,
    });

    expect(result.success).toBe(true);
    expect(result.variables).toBe(2);
    expect(existsSync(testVaultPath)).toBe(true);
  });

  it("should pull from vault to .env", async () => {
    // First push
    writeFileSync(testEnvPath, "API_KEY=secret123\n");
    await push({
      root: testDir,
      envPath: testEnvPath,
      vaultPath: testVaultPath,
      key: testKey,
    });

    // Delete .env
    unlinkSync(testEnvPath);
    expect(existsSync(testEnvPath)).toBe(false);

    // Pull
    const result = await pull({
      root: testDir,
      envPath: testEnvPath,
      vaultPath: testVaultPath,
      key: testKey,
    });

    expect(result.success).toBe(true);
    expect(existsSync(testEnvPath)).toBe(true);

    const content = readFileSync(testEnvPath, "utf8");
    expect(content).toContain("API_KEY=secret123");
  });

  it("should throw error if .env does not exist for push", async () => {
    await expect(
      push({
        root: testDir,
        envPath: testEnvPath,
        vaultPath: testVaultPath,
        key: testKey,
      })
    ).rejects.toThrow(VaultError);
  });

  it("should throw error if vault does not exist for pull", async () => {
    await expect(
      pull({
        root: testDir,
        envPath: testEnvPath,
        vaultPath: testVaultPath,
        key: testKey,
      })
    ).rejects.toThrow(VaultError);
  });
});

describe("sync", () => {
  it("should merge local and vault changes", { timeout: 30000 }, async () => {
    // Create initial .env and push
    writeFileSync(testEnvPath, "VAR1=value1\nVAR2=value2\n");
    await push({
      root: testDir,
      envPath: testEnvPath,
      vaultPath: testVaultPath,
      key: testKey,
    });

    // Modify local .env
    writeFileSync(testEnvPath, "VAR1=value1\nVAR3=value3\n");

    // Sync
    const result = await sync({
      root: testDir,
      envPath: testEnvPath,
      vaultPath: testVaultPath,
      key: testKey,
    });

    expect(result.added).toContain("VAR3");
    expect(result.fromVault).toContain("VAR2");

    // Local should have all vars
    const content = readFileSync(testEnvPath, "utf8");
    expect(content).toContain("VAR1=value1");
    expect(content).toContain("VAR2=value2");
    expect(content).toContain("VAR3=value3");
  });
});

describe("status", () => {
  it("should return vault status", async () => {
    writeFileSync(testEnvPath, "API_KEY=test\n");
    await push({
      root: testDir,
      envPath: testEnvPath,
      vaultPath: testVaultPath,
      key: testKey,
    });

    const result = await status({
      root: testDir,
      vaultPath: testVaultPath,
      envPath: testEnvPath,
    });

    expect(result.exists).toBe(true);
    expect(result.localEnvExists).toBe(true);
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.variables).toBe(1);
  });

  it("should report missing vault", async () => {
    const result = await status({
      root: testDir,
      vaultPath: testVaultPath,
      envPath: testEnvPath,
    });

    expect(result.exists).toBe(false);
    expect(result.metadata).toBeUndefined();
  });
});

describe("diff", () => {
  it("should show differences between local and vault", async () => {
    // Create and push initial
    writeFileSync(testEnvPath, "VAR1=value1\nVAR2=value2\n");
    await push({
      root: testDir,
      envPath: testEnvPath,
      vaultPath: testVaultPath,
      key: testKey,
    });

    // Modify local
    writeFileSync(testEnvPath, "VAR1=changed\nVAR3=new\n");

    const result = await diff({
      root: testDir,
      envPath: testEnvPath,
      vaultPath: testVaultPath,
      key: testKey,
    });

    expect(result.onlyInLocal).toContain("VAR3");
    expect(result.onlyInVault).toContain("VAR2");
    expect(result.different).toContain("VAR1");
  });
});

describe("encrypt and decrypt", () => {
  it("should encrypt and decrypt content", () => {
    const content = "API_KEY=secret\nDB_URL=postgres://localhost";
    const key = generateKey();

    const vault = encrypt(content, key);
    const decrypted = decrypt(vault, key);

    expect(decrypted).toBe(content);
  });

  it("should fail decryption with wrong key", () => {
    const content = "API_KEY=secret";
    const key = generateKey();
    const wrongKey = generateKey();

    const vault = encrypt(content, key);

    expect(() => decrypt(vault, wrongKey)).toThrow();
  });

  it("should detect HMAC tampering", () => {
    const content = "API_KEY=secret";
    const key = generateKey();

    const vault = encrypt(content, key);
    // Tamper with the HMAC
    vault.hmac = "a".repeat(64);

    expect(() => decrypt(vault, key)).toThrow(/HMAC|tamper/i);
  });

  it("should detect ciphertext tampering via HMAC", () => {
    const content = "API_KEY=secret";
    const key = generateKey();

    const vault = encrypt(content, key);
    // Tamper with encrypted data
    const enc = Buffer.from(vault.encrypted, "hex");
    enc[0] ^= 0xff;
    vault.encrypted = enc.toString("hex");

    expect(() => decrypt(vault, key)).toThrow();
  });
});

describe("generateKey", () => {
  it("should generate a valid key", () => {
    const key = generateKey();

    expect(key).toMatch(/^nevr_[A-Za-z0-9_-]{32,}$/);
  });

  it("should generate unique keys", () => {
    const key1 = generateKey();
    const key2 = generateKey();

    expect(key1).not.toBe(key2);
  });
});
