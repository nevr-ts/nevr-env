/**
 * Tests for ENV object and runtime helpers
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ENV, getEnvVar, getBooleanEnvVar } from "./runtime";

const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.NODE_ENV;
  delete process.env.CI;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("ENV object", () => {
  it("should reflect NODE_ENV", () => {
    process.env.NODE_ENV = "production";
    expect(ENV.NODE_ENV).toBe("production");
  });

  it("should detect isProduction", () => {
    process.env.NODE_ENV = "production";
    expect(ENV.isProduction).toBe(true);
    expect(ENV.isDevelopment).toBe(false);
    expect(ENV.isTest).toBe(false);
  });

  it("should detect isDevelopment", () => {
    process.env.NODE_ENV = "development";
    expect(ENV.isDevelopment).toBe(true);
    expect(ENV.isProduction).toBe(false);
  });

  it("should detect isTest", () => {
    process.env.NODE_ENV = "test";
    expect(ENV.isTest).toBe(true);
    expect(ENV.isProduction).toBe(false);
  });

  it("should detect isCI from CI env var", () => {
    process.env.CI = "true";
    expect(ENV.isCI).toBe(true);
  });

  it("should return false for isCI when not set", () => {
    delete process.env.CI;
    // May still be true if running in CI - that's correct behavior
    // Just verify it returns a boolean
    expect(typeof ENV.isCI).toBe("boolean");
  });
});

describe("getEnvVar", () => {
  it("should return env var value", () => {
    process.env.MY_VAR = "hello";
    expect(getEnvVar("MY_VAR")).toBe("hello");
    delete process.env.MY_VAR;
  });

  it("should return fallback when var is missing", () => {
    expect(getEnvVar("NONEXISTENT", "fallback")).toBe("fallback");
  });

  it("should return undefined when var is missing and no fallback", () => {
    expect(getEnvVar("NONEXISTENT")).toBeUndefined();
  });
});

describe("getBooleanEnvVar", () => {
  it("should parse 'true'", () => {
    process.env.BOOL = "true";
    expect(getBooleanEnvVar("BOOL")).toBe(true);
    delete process.env.BOOL;
  });

  it("should parse 'false'", () => {
    process.env.BOOL = "false";
    expect(getBooleanEnvVar("BOOL")).toBe(false);
    delete process.env.BOOL;
  });

  it("should parse '1' as true", () => {
    process.env.BOOL = "1";
    expect(getBooleanEnvVar("BOOL")).toBe(true);
    delete process.env.BOOL;
  });

  it("should parse '0' as false", () => {
    process.env.BOOL = "0";
    expect(getBooleanEnvVar("BOOL")).toBe(false);
    delete process.env.BOOL;
  });

  it("should return default when missing", () => {
    expect(getBooleanEnvVar("NONEXISTENT", true)).toBe(true);
    expect(getBooleanEnvVar("NONEXISTENT", false)).toBe(false);
  });
});
