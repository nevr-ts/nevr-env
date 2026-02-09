/**
 * CLI Integration Tests (compressed)
 *
 * Runs the built CLI binary against the test-all-features fixture.
 * Tests non-interactive commands: check, generate, types, scan, diff, rotate, ci, vault.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, cpSync, rmSync } from "fs";
import { join } from "path";

// ── Helpers ──────────────────────────────────────────────────────

const ROOT = join(import.meta.dirname, "../../..");
const FIXTURE_SRC = join(ROOT, "examples/test-all-features");
const FIXTURE = join(ROOT, ".test-cli-fixture");
const CLI = join(ROOT, "packages/cli/dist/index.js");

function cli(args: string, opts: { cwd?: string; env?: Record<string, string> } = {}): string {
  try {
    return execSync(`node "${CLI}" ${args}`, {
      cwd: opts.cwd ?? FIXTURE,
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, ...opts.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e: any) {
    // Some commands exit(1) intentionally — return combined output
    return (e.stdout ?? "") + (e.stderr ?? "");
  }
}

// ── Setup / Teardown ─────────────────────────────────────────────

beforeAll(() => {
  // Copy fixture to temp dir to avoid mutating the original
  if (existsSync(FIXTURE)) rmSync(FIXTURE, { recursive: true, force: true });
  mkdirSync(FIXTURE, { recursive: true });
  cpSync(FIXTURE_SRC, FIXTURE, { recursive: true });

  // Ensure CLI is built
  if (!existsSync(CLI)) {
    throw new Error("CLI not built. Run `pnpm build` first.");
  }
});

afterAll(() => {
  rmSync(FIXTURE, { recursive: true, force: true });
});

// ── Tests ────────────────────────────────────────────────────────

describe("nevr-env CLI", () => {
  // ── check ──
  describe("check", () => {
    it("validates configured variables", () => {
      const out = cli("check");
      expect(out).toMatch(/variables? configured/i);
      // Should list known vars
      expect(out).toMatch(/NODE_ENV|DATABASE_URL/);
    });
  });

  // ── generate ──
  describe("generate", () => {
    it("creates .env.example", () => {
      const outFile = join(FIXTURE, ".env.example.test");
      cli(`generate --output ${outFile}`);
      expect(existsSync(outFile)).toBe(true);
      const content = readFileSync(outFile, "utf8");
      expect(content).toMatch(/DATABASE_URL/);
      expect(content).toMatch(/NODE_ENV/);
      unlinkSync(outFile);
    });
  });

  // ── types ──
  describe("types", () => {
    it("generates env.d.ts", () => {
      const outFile = join(FIXTURE, "env.d.ts.test");
      cli(`types --output ${outFile}`);
      expect(existsSync(outFile)).toBe(true);
      const content = readFileSync(outFile, "utf8");
      expect(content).toMatch(/ProcessEnv/);
      expect(content).toMatch(/DATABASE_URL/);
      unlinkSync(outFile);
    });
  });

  // ── scan ──
  describe("scan", () => {
    it("scans for secrets", () => {
      const out = cli(`scan --path "${FIXTURE}"`);
      // Should complete without crashing
      expect(out).toMatch(/scan/i);
    });
  });

  // ── diff ──
  describe("diff", () => {
    it("warns when comparing same file", () => {
      const configPath = join(FIXTURE, "src/env.ts");
      const out = cli(`diff --from "${configPath}" --to "${configPath}"`);
      expect(out).toMatch(/no differences|same|identical/i);
    });
  });

  // ── rotate ──
  describe("rotate", () => {
    it("detects sensitive variables", () => {
      const out = cli("rotate");
      // Should find secrets by name pattern
      expect(out).toMatch(/secret|key|rotation/i);
    });
  });

  // ── ci ──
  describe("ci", () => {
    it("generates GitHub Actions YAML", () => {
      const out = cli("ci github");
      expect(out).toMatch(/name:/);
      expect(out).toMatch(/nevr-env|env.*check/i);
    });
  });

  // ── vault ──
  describe("vault", () => {
    const vaultPath = join(FIXTURE, ".nevr-env.vault");
    const envPath = join(FIXTURE, ".env");
    let testKey: string;

    it("keygen --no-save prints key", () => {
      const out = cli("vault keygen --no-save");
      expect(out).toMatch(/nevr_/);
      const match = out.match(/nevr_[A-Za-z0-9_-]+/);
      expect(match).toBeTruthy();
      testKey = match![0];
    });

    it("push encrypts .env", () => {
      // Write a test key into fixture .env
      const envContent = readFileSync(envPath, "utf8");
      if (!envContent.includes("NEVR_ENV_KEY=")) {
        writeFileSync(envPath, envContent + `\nNEVR_ENV_KEY=${testKey}\n`);
      } else {
        // Update existing key
        writeFileSync(
          envPath,
          envContent.replace(/NEVR_ENV_KEY=.+/, `NEVR_ENV_KEY=${testKey}`)
        );
      }

      const out = cli("vault push");
      expect(out).toMatch(/encrypted|vault.*saved/i);
      expect(existsSync(vaultPath)).toBe(true);

      // Verify vault JSON structure
      const vault = JSON.parse(readFileSync(vaultPath, "utf8"));
      expect(vault.version).toBe(1);
      expect(vault.hmac).toBeDefined();
      expect(vault.salt).toBeDefined();
      expect(vault.encrypted).toBeDefined();
      expect(vault.metadata.variables).toBeGreaterThan(0);
    });

    it("status shows vault info", () => {
      const out = cli("vault status");
      expect(out).toMatch(/NEVR_ENV_KEY/);
      expect(out).toMatch(/\.nevr-env\.vault/);
    });

    it("pull decrypts vault", () => {
      // Save original .env
      const originalEnv = readFileSync(envPath, "utf8");

      // Overwrite .env with just the key
      writeFileSync(envPath, `NEVR_ENV_KEY=${testKey}\n`);

      const out = cli("vault pull");
      expect(out).toMatch(/decrypted|created/i);

      // Verify decrypted content has the original vars
      const restored = readFileSync(envPath, "utf8");
      expect(restored).toMatch(/DATABASE_URL/);
      expect(restored).toMatch(/NODE_ENV/);
      // NEVR_ENV_KEY should be preserved
      expect(restored).toMatch(/NEVR_ENV_KEY/);
    });

    it("vault roundtrip preserves content", () => {
      // Read current .env (from pull)
      const envBefore = readFileSync(envPath, "utf8");
      const varsBefore = envBefore
        .split("\n")
        .filter(l => l.trim() && !l.startsWith("#") && l.includes("=") && !l.startsWith("NEVR_ENV_KEY"))
        .sort();

      // Push again
      cli("vault push");

      // Clear .env, keep only key
      writeFileSync(envPath, `NEVR_ENV_KEY=${testKey}\n`);

      // Pull again
      cli("vault pull");

      const envAfter = readFileSync(envPath, "utf8");
      const varsAfter = envAfter
        .split("\n")
        .filter(l => l.trim() && !l.startsWith("#") && l.includes("=") && !l.startsWith("NEVR_ENV_KEY"))
        .sort();

      expect(varsAfter).toEqual(varsBefore);
    });

    it("HMAC tamper detection", () => {
      // Tamper with the vault
      const vault: Record<string, any> = JSON.parse(readFileSync(vaultPath, "utf8"));
      vault.hmac = "0".repeat(64); // invalid HMAC
      writeFileSync(vaultPath, JSON.stringify(vault, null, 2));

      const out = cli("vault pull");
      expect(out).toMatch(/hmac|tamper|failed|wrong key/i);
    });
  });
});
