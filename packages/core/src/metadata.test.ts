/**
 * Tests for Schema Registry (getEnvMetadata / __NEVR_ENV_METADATA__)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { createEnv, getEnvMetadata, __NEVR_ENV_METADATA__ } from "./create-env";

const originalEnv = { ...process.env };

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!["PATH", "SYSTEMROOT", "COMSPEC", "WINDIR", "NODE"].includes(key)) {
      delete process.env[key];
    }
  }
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("getEnvMetadata", () => {
  it("should return metadata from createEnv result", () => {
    process.env.DB = "postgres://localhost/db";
    process.env.NEXT_PUBLIC_URL = "https://app.com";
    process.env.NODE_ENV = "test";

    const env = createEnv({
      server: { DB: z.string() },
      client: { NEXT_PUBLIC_URL: z.string().url() },
      shared: { NODE_ENV: z.enum(["development", "production", "test"]) },
      clientPrefix: "NEXT_PUBLIC_",
      runtimeEnv: process.env,
    });

    const meta = getEnvMetadata(env);
    expect(meta).not.toBeNull();
    expect(Object.keys(meta!.server)).toContain("DB");
    expect(Object.keys(meta!.client)).toContain("NEXT_PUBLIC_URL");
    expect(Object.keys(meta!.shared)).toContain("NODE_ENV");
    expect(meta!.clientPrefix).toBe("NEXT_PUBLIC_");
    expect(meta!.isServer).toBe(true); // Node.js = server
    expect(meta!.validated).toBe(true);
  });

  it("should include plugin metadata", () => {
    process.env.PLUGIN_VAR = "val";

    const plugin = {
      id: "test",
      name: "Test Plugin",
      schema: { PLUGIN_VAR: z.string() },
    };

    const env = createEnv({
      plugins: [plugin],
      runtimeEnv: process.env,
    });

    const meta = getEnvMetadata(env);
    expect(meta).not.toBeNull();
    expect(meta!.plugins).toHaveLength(1);
    expect(meta!.plugins[0].id).toBe("test");
  });

  it("should return null for non-env objects", () => {
    expect(getEnvMetadata(null)).toBeNull();
    expect(getEnvMetadata(undefined)).toBeNull();
    expect(getEnvMetadata({})).toBeNull();
    expect(getEnvMetadata("string")).toBeNull();
    expect(getEnvMetadata(42)).toBeNull();
  });

  it("should return metadata for skipValidation result (validated: false)", () => {
    const env = createEnv({
      server: { X: z.string() },
      runtimeEnv: process.env,
      skipValidation: true,
    });

    // skipValidation still attaches metadata (needed by CLI commands)
    const meta = getEnvMetadata(env);
    expect(meta).not.toBeNull();
    expect(meta!.validated).toBe(false);
    expect(meta!.server).toHaveProperty("X");
  });

  it("metadata should not appear in Object.keys", () => {
    process.env.X = "val";

    const env = createEnv({
      server: { X: z.string() },
      runtimeEnv: process.env,
    });

    const keys = Object.keys(env);
    expect(keys).not.toContain("__NEVR_ENV_METADATA__");
    // Symbol keys aren't in Object.keys anyway, but confirm
    expect(keys).toEqual(["X"]);
  });

  it("should be accessible via the Symbol directly", () => {
    process.env.X = "val";

    const env = createEnv({
      server: { X: z.string() },
      runtimeEnv: process.env,
    });

    const meta = (env as Record<symbol, unknown>)[__NEVR_ENV_METADATA__];
    expect(meta).toBeDefined();
    expect((meta as Record<string, unknown>).validated).toBe(true);
  });

  it("should mark validated: false when in warn mode with issues", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const env = createEnv({
      server: { MISSING: z.string().min(1) },
      runtimeEnv: process.env,
      validationMode: "warn",
    });

    const meta = getEnvMetadata(env);
    expect(meta).not.toBeNull();
    expect(meta!.validated).toBe(false);

    warnSpy.mockRestore();
  });
});

// Need vi import for the warn spy
import { vi } from "vitest";
