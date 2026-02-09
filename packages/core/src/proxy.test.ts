/**
 * Tests for Proxy server/client protection
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

describe("Proxy server/client protection", () => {
  it("should throw when accessing server var on client", () => {
    process.env.SECRET_KEY = "s3cret";
    process.env.NEXT_PUBLIC_URL = "https://app.com";

    const env = createEnv({
      server: { SECRET_KEY: z.string() },
      client: { NEXT_PUBLIC_URL: z.string().url() },
      clientPrefix: "NEXT_PUBLIC_",
      runtimeEnv: process.env,
      isServer: false,
    });

    expect(() => (env as Record<string, unknown>).SECRET_KEY).toThrow(
      /server-side/
    );
    expect(env.NEXT_PUBLIC_URL).toBe("https://app.com");
  });

  it("should allow server var access on server", () => {
    process.env.SECRET_KEY = "s3cret";
    process.env.NEXT_PUBLIC_URL = "https://app.com";

    const env = createEnv({
      server: { SECRET_KEY: z.string() },
      client: { NEXT_PUBLIC_URL: z.string().url() },
      clientPrefix: "NEXT_PUBLIC_",
      runtimeEnv: process.env,
      isServer: true,
    });

    expect(env.SECRET_KEY).toBe("s3cret");
    expect(env.NEXT_PUBLIC_URL).toBe("https://app.com");
  });

  it("should allow shared vars on client", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_URL = "https://app.com";

    const env = createEnv({
      client: { NEXT_PUBLIC_URL: z.string().url() },
      shared: { NODE_ENV: z.enum(["development", "production", "test"]) },
      clientPrefix: "NEXT_PUBLIC_",
      runtimeEnv: process.env,
      isServer: false,
    });

    expect(env.NODE_ENV).toBe("production");
  });

  it("should call custom onInvalidAccess handler", () => {
    process.env.SECRET = "hidden";
    process.env.NEXT_PUBLIC_URL = "https://app.com";

    const onInvalidAccess = vi.fn((): never => {
      throw new Error("blocked");
    });

    const env = createEnv({
      server: { SECRET: z.string() },
      client: { NEXT_PUBLIC_URL: z.string().url() },
      clientPrefix: "NEXT_PUBLIC_",
      runtimeEnv: process.env,
      isServer: false,
      onInvalidAccess,
    });

    expect(() => (env as Record<string, unknown>).SECRET).toThrow("blocked");
    expect(onInvalidAccess).toHaveBeenCalledWith("SECRET");
  });
});

describe("Proxy ownKeys", () => {
  it("should hide server keys from Object.keys on client", () => {
    process.env.DB_URL = "postgres://localhost/db";
    process.env.NEXT_PUBLIC_URL = "https://app.com";

    const env = createEnv({
      server: { DB_URL: z.string() },
      client: { NEXT_PUBLIC_URL: z.string().url() },
      clientPrefix: "NEXT_PUBLIC_",
      runtimeEnv: process.env,
      isServer: false,
    });

    const keys = Object.keys(env);
    expect(keys).toContain("NEXT_PUBLIC_URL");
    expect(keys).not.toContain("DB_URL");
  });

  it("should show all keys on server", () => {
    process.env.DB_URL = "postgres://localhost/db";
    process.env.NEXT_PUBLIC_URL = "https://app.com";

    const env = createEnv({
      server: { DB_URL: z.string() },
      client: { NEXT_PUBLIC_URL: z.string().url() },
      clientPrefix: "NEXT_PUBLIC_",
      runtimeEnv: process.env,
      isServer: true,
    });

    const keys = Object.keys(env);
    expect(keys).toContain("NEXT_PUBLIC_URL");
    expect(keys).toContain("DB_URL");
  });
});

describe("Proxy getOwnPropertyDescriptor", () => {
  it("should hide server key descriptors on client", () => {
    process.env.DB_URL = "postgres://localhost/db";
    process.env.NEXT_PUBLIC_URL = "https://app.com";

    const env = createEnv({
      server: { DB_URL: z.string() },
      client: { NEXT_PUBLIC_URL: z.string().url() },
      clientPrefix: "NEXT_PUBLIC_",
      runtimeEnv: process.env,
      isServer: false,
    });

    expect(
      Object.getOwnPropertyDescriptor(env, "DB_URL")
    ).toBeUndefined();
    expect(
      Object.getOwnPropertyDescriptor(env, "NEXT_PUBLIC_URL")
    ).toBeDefined();
  });
});

describe("IGNORED_PROPS", () => {
  it("should return undefined for __esModule", () => {
    process.env.X = "val";
    const env = createEnv({
      server: { X: z.string() },
      runtimeEnv: process.env,
    });
    expect((env as Record<string, unknown>).__esModule).toBeUndefined();
  });

  it("should return undefined for $$typeof", () => {
    process.env.X = "val";
    const env = createEnv({
      server: { X: z.string() },
      runtimeEnv: process.env,
    });
    expect((env as Record<string, unknown>).$$typeof).toBeUndefined();
  });

  it("should return undefined for then (prevents Promise-like behavior)", () => {
    process.env.X = "val";
    const env = createEnv({
      server: { X: z.string() },
      runtimeEnv: process.env,
    });
    expect((env as Record<string, unknown>).then).toBeUndefined();
  });

  it("should return undefined for toJSON", () => {
    process.env.X = "val";
    const env = createEnv({
      server: { X: z.string() },
      runtimeEnv: process.env,
    });
    expect((env as Record<string, unknown>).toJSON).toBeUndefined();
  });
});
