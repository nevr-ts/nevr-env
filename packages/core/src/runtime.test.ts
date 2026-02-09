/**
 * Tests for runtime environment utilities
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runtimeEnv, detectRuntime } from "./runtime";

// Store original process.env
const originalEnv = { ...process.env };

beforeEach(() => {
  // Clear test vars
  delete process.env.TEST_VAR;
  delete process.env.NEW_VAR;
  delete process.env.KEY_1;
  delete process.env.KEY_2;
});

afterEach(() => {
  // Restore
  process.env = { ...originalEnv };
});

describe("runtimeEnv", () => {
  it("should read from process.env", () => {
    process.env.TEST_VAR = "test-value";
    expect(runtimeEnv.TEST_VAR).toBe("test-value");
  });

  it("should return undefined for missing vars", () => {
    expect(runtimeEnv.NONEXISTENT_VAR_12345).toBeUndefined();
  });

  it("should allow setting values", () => {
    runtimeEnv.NEW_VAR = "new-value";
    expect(process.env.NEW_VAR).toBe("new-value");
  });

  it("should list keys via Object.keys", () => {
    process.env.KEY_1 = "value1";
    process.env.KEY_2 = "value2";
    
    const keys = Object.keys(runtimeEnv);
    expect(keys).toContain("KEY_1");
    expect(keys).toContain("KEY_2");
  });
});

describe("detectRuntime", () => {
  it("should detect Node.js runtime", () => {
    const runtime = detectRuntime();
    expect(runtime).toBe("node");
  });
});
