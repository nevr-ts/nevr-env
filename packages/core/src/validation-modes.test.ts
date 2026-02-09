/**
 * Tests for validationMode, debug, createFinalSchema, experimental__runtimeEnv, runtimeEnvStrict
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import { createEnv } from "./create-env";

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

describe("validationMode: warn", () => {
  it("should warn instead of throwing on missing vars", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const env = createEnv({
      server: { MISSING_VAR: z.string().min(1) },
      runtimeEnv: process.env,
      validationMode: "warn",
    });

    expect(warnSpy).toHaveBeenCalled();
    // Should not throw
    expect(env).toBeDefined();
    warnSpy.mockRestore();
  });
});

describe("debug mode", () => {
  it("should log debug info when enabled", () => {
    process.env.X = "val";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    createEnv({
      server: { X: z.string() },
      runtimeEnv: process.env,
      debug: true,
    });

    const debugCalls = logSpy.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("[nevr-env]")
    );
    expect(debugCalls.length).toBeGreaterThanOrEqual(3);
    logSpy.mockRestore();
  });

  it("should not log when debug is false", () => {
    process.env.X = "val";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    createEnv({
      server: { X: z.string() },
      runtimeEnv: process.env,
      debug: false,
    });

    const debugCalls = logSpy.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("[nevr-env]")
    );
    expect(debugCalls.length).toBe(0);
    logSpy.mockRestore();
  });
});

describe("runtimeEnvStrict", () => {
  it("should accept explicit env values via runtimeEnvStrict", () => {
    const env = createEnv({
      server: {
        DB_URL: z.string().url(),
      },
      runtimeEnvStrict: {
        DB_URL: "postgres://localhost/db",
      },
    });

    expect(env.DB_URL).toBe("postgres://localhost/db");
  });
});

describe("experimental__runtimeEnv", () => {
  it("should merge experimental runtime env with process.env", () => {
    process.env.SERVER_VAR = "from-process";

    const env = createEnv({
      server: { SERVER_VAR: z.string() },
      client: { NEXT_PUBLIC_URL: z.string().url() },
      clientPrefix: "NEXT_PUBLIC_",
      experimental__runtimeEnv: {
        NEXT_PUBLIC_URL: "https://app.com",
      },
      isServer: true,
    } as Record<string, unknown>);

    expect(env.SERVER_VAR).toBe("from-process");
    expect(env.NEXT_PUBLIC_URL).toBe("https://app.com");
  });
});

describe("extends override precedence", () => {
  it("should let local values override extended ones", () => {
    process.env.SHARED_VAR = "local";
    process.env.BASE_VAR = "base";

    const base = createEnv({
      server: { BASE_VAR: z.string(), SHARED_VAR: z.string() },
      runtimeEnv: process.env,
    });

    // Override SHARED_VAR in local
    process.env.SHARED_VAR = "overridden";

    const env = createEnv({
      server: { SHARED_VAR: z.string() },
      extends: [base],
      runtimeEnv: process.env,
    });

    expect(env.SHARED_VAR).toBe("overridden");
    expect(env.BASE_VAR).toBe("base");
  });
});

describe("skipValidation propagation", () => {
  it("should propagate skipValidation to extends", () => {
    const base = { DATABASE_URL: "test" } as Record<string, unknown>;

    const env = createEnv({
      server: { APP_KEY: z.string() },
      extends: [base],
      runtimeEnv: process.env,
      skipValidation: true,
    });

    // Should not throw even though APP_KEY is missing
    expect(env).toBeDefined();
  });
});

describe("isServer override", () => {
  it("should force server context with isServer: true", () => {
    process.env.SECRET = "hidden";
    process.env.NEXT_PUBLIC_URL = "https://app.com";

    const env = createEnv({
      server: { SECRET: z.string() },
      client: { NEXT_PUBLIC_URL: z.string().url() },
      clientPrefix: "NEXT_PUBLIC_",
      runtimeEnv: process.env,
      isServer: true,
    });

    // Should not throw — we're on "server"
    expect(env.SECRET).toBe("hidden");
  });

  it("should force client context with isServer: false", () => {
    process.env.SECRET = "hidden";
    process.env.NEXT_PUBLIC_URL = "https://app.com";

    const env = createEnv({
      server: { SECRET: z.string() },
      client: { NEXT_PUBLIC_URL: z.string().url() },
      clientPrefix: "NEXT_PUBLIC_",
      runtimeEnv: process.env,
      isServer: false,
    });

    // Client access to server var should throw
    expect(() => (env as Record<string, unknown>).SECRET).toThrow();
    expect(env.NEXT_PUBLIC_URL).toBe("https://app.com");
  });
});

describe("emptyStringAsUndefined default false", () => {
  it("should keep empty strings by default", () => {
    process.env.EMPTY = "";

    const env = createEnv({
      server: { EMPTY: z.string() },
      runtimeEnv: process.env,
    });

    expect(env.EMPTY).toBe("");
  });

  it("should strip empty strings when enabled", () => {
    process.env.EMPTY = "";

    const env = createEnv({
      server: { EMPTY: z.string().optional() },
      runtimeEnv: process.env,
      emptyStringAsUndefined: true,
    });

    expect(env.EMPTY).toBeUndefined();
  });
});
