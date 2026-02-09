/**
 * Comprehensive test suite for all nevr-env features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";

import { createEnv } from "./create-env";
import { healthCheck, createHealthEndpoint } from "./health-check";
import { recordRotation, getRotationStatus, loadRotationRecords, saveRotationRecords } from "./rotation";
import { scanForSecrets, generatePreCommitHook, formatScanResults, DEFAULT_SECRET_PATTERNS } from "./secret-scanner";
import { diffSchemas, generateMigrationGuide } from "./schema-diff";
import { generateEnvExample, getSchemaInfo } from "./generate-example";
import { createPlugin } from "./plugin-helpers";
import { isServerRuntime, detectRuntime, getEnvVar, getBooleanEnvVar } from "./runtime";

describe("Health Check", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://localhost/db";
    process.env.API_KEY = "sk-test-key-123456789";
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.API_KEY;
  });

  it("should return healthy status when all vars are valid", () => {
    const result = healthCheck({
      server: { DATABASE_URL: z.string().url(), API_KEY: z.string().min(10) },
      runtimeEnv: process.env,
    });
    expect(result.status).toBe("healthy");
  });

  it("createHealthEndpoint returns handler function", () => {
    const handler = createHealthEndpoint({
      server: { DATABASE_URL: z.string().url() },
    });
    expect(typeof handler).toBe("function");
  });
});

describe("Secret Rotation", () => {
  const testRotationFile = path.join(process.cwd(), ".test-rotation.json");

  afterEach(() => {
    if (fs.existsSync(testRotationFile)) fs.unlinkSync(testRotationFile);
  });

  it("should record rotation timestamp", () => {
    const record = recordRotation("API_KEY", { trackingFile: testRotationFile });
    expect(record.key).toBe("API_KEY");
  });

  it("should get rotation status for unknown key", () => {
    const status = getRotationStatus("UNKNOWN_KEY", { trackingFile: testRotationFile });
    expect(status.status).toBe("unknown");
  });
});

describe("Secret Scanner", () => {
  it("should generate pre-commit hook", () => {
    const hook = generatePreCommitHook();
    expect(hook).toContain("#!/bin/sh");
  });

  it("should have comprehensive default patterns", () => {
    expect(DEFAULT_SECRET_PATTERNS.length).toBeGreaterThan(10);
  });

  it("should format empty scan results", () => {
    const result = { hasSecrets: false, filesScanned: 10, matches: [], summary: { critical: 0, high: 0, medium: 0, low: 0 } };
    const formatted = formatScanResults(result);
    expect(formatted).toContain("No secrets found");
  });
});

describe("Schema Diff", () => {
  it("should detect added variables", () => {
    const diff = diffSchemas({ A: z.string() }, { A: z.string(), B: z.string() });
    expect(diff.added.some(a => a.key === "B")).toBe(true);
  });

  it("should detect removed variables as breaking", () => {
    const diff = diffSchemas({ A: z.string(), B: z.string() }, { A: z.string() });
    expect(diff.removed.some(r => r.key === "B")).toBe(true);
    expect(diff.isBreaking).toBe(true);
  });

  it("should generate migration guide", () => {
    const diff = diffSchemas({ A: z.string() }, { B: z.string() });
    const guide = generateMigrationGuide(diff);
    expect(typeof guide).toBe("string");
  });
});

describe("Generate Example", () => {
  it("should generate .env.example content", () => {
    const example = generateEnvExample({ server: { DATABASE_URL: z.string().url() } });
    expect(example).toContain("DATABASE_URL");
  });

  it("should get schema info as array", () => {
    const info = getSchemaInfo({ server: { PORT: z.number(), API_KEY: z.string() } });
    expect(Array.isArray(info)).toBe(true);
    expect(info.length).toBe(2);
  });
});

describe("Plugin Helpers", () => {
  it("createPlugin returns a factory function", () => {
    const myPlugin = createPlugin({ id: "test", name: "Test", schema: () => ({ X: z.string() }) });
    expect(typeof myPlugin).toBe("function");
    const plugin = myPlugin();
    expect(plugin.id).toBe("test");
  });
});

describe("Runtime Utilities", () => {
  it("detectRuntime identifies node", () => {
    expect(detectRuntime()).toBe("node");
  });

  it("isServerRuntime returns true in node", () => {
    expect(isServerRuntime()).toBe(true);
  });

  it("getEnvVar returns env var", () => {
    process.env.TEST_VAR = "test";
    expect(getEnvVar("TEST_VAR")).toBe("test");
    delete process.env.TEST_VAR;
  });

  it("getBooleanEnvVar parses boolean", () => {
    process.env.BOOL = "true";
    expect(getBooleanEnvVar("BOOL")).toBe(true);
    delete process.env.BOOL;
  });
});

describe("createEnv Advanced", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://localhost/db";
    process.env.API_KEY = "sk-test-12345";
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.API_KEY;
  });

  it("should work with validation mode strict", () => {
    delete process.env.API_KEY;
    expect(() => createEnv({
      server: { DATABASE_URL: z.string().url(), API_KEY: z.string() },
      runtimeEnv: process.env,
      validationMode: "strict",
    })).toThrow();
  });

  it("should use proxy for lazy access", () => {
    const env = createEnv({
      server: { DATABASE_URL: z.string().url(), API_KEY: z.string() },
      runtimeEnv: process.env,
    });
    expect(env.DATABASE_URL).toBe("postgres://localhost/db");
  });
});

describe("Integration", () => {
  const testFile = path.join(process.cwd(), ".test-int.json");

  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://localhost/testdb";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.NODE_ENV;
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  it("full workflow", () => {
    const schema = { DATABASE_URL: z.string().url(), NODE_ENV: z.enum(["development", "test", "production"]) };

    const env = createEnv({ server: schema, runtimeEnv: process.env });
    expect(env.DATABASE_URL).toBe("postgres://localhost/testdb");

    const health = healthCheck({ server: schema, runtimeEnv: process.env });
    expect(health.status).toBe("healthy");

    const example = generateEnvExample({ server: schema });
    expect(example).toContain("DATABASE_URL");

    const record = recordRotation("DATABASE_URL", { trackingFile: testFile });
    expect(record.key).toBe("DATABASE_URL");

    const diff = diffSchemas(schema, { ...schema, API_KEY: z.string().optional() });
    expect(diff.added.length).toBeGreaterThanOrEqual(1);
  });
});