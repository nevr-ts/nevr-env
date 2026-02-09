/**
 * Tests for createEnv function
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import { createEnv } from "./create-env";

// Store original process.env and NODE_ENV
const originalEnv = { ...process.env };

beforeEach(() => {
  // Clear all env vars except essential ones
  for (const key of Object.keys(process.env)) {
    if (!["PATH", "SYSTEMROOT", "COMSPEC", "WINDIR", "NODE"].includes(key)) {
      delete process.env[key];
    }
  }
});

afterEach(() => {
  // Restore original
  process.env = { ...originalEnv };
});

describe("createEnv", () => {
  describe("basic validation", () => {
    it("should validate and return server variables", () => {
      process.env.DATABASE_URL = "postgres://localhost:5432/db";
      process.env.SECRET_KEY = "my-secret";

      const env = createEnv({
        server: {
          DATABASE_URL: z.string().url(),
          SECRET_KEY: z.string().min(1),
        },
        runtimeEnv: process.env,
      });

      expect(env.DATABASE_URL).toBe("postgres://localhost:5432/db");
      expect(env.SECRET_KEY).toBe("my-secret");
    });

    it("should validate and return client variables", () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";

      const env = createEnv({
        client: {
          NEXT_PUBLIC_API_URL: z.string().url(),
        },
        clientPrefix: "NEXT_PUBLIC_",
        runtimeEnv: process.env,
      });

      expect(env.NEXT_PUBLIC_API_URL).toBe("https://api.example.com");
    });

    it("should handle shared variables", () => {
      process.env.NODE_ENV = "production";

      const env = createEnv({
        server: {},
        shared: {
          NODE_ENV: z.enum(["development", "production", "test"]),
        },
        runtimeEnv: process.env,
      });

      expect(env.NODE_ENV).toBe("production");
    });
  });

  describe("default values", () => {
    it("should use default values when variable is missing", () => {
      const env = createEnv({
        server: {
          PORT: z.coerce.number().default(3000),
        },
        runtimeEnv: process.env,
      });

      expect(env.PORT).toBe(3000);
    });

    it("should override defaults with actual values", () => {
      process.env.PORT = "8080";

      const env = createEnv({
        server: {
          PORT: z.coerce.number().default(3000),
        },
        runtimeEnv: process.env,
      });

      expect(env.PORT).toBe(8080);
    });
  });

  describe("validation errors", () => {
    it("should throw on missing required variable", () => {
      expect(() => {
        createEnv({
          server: {
            REQUIRED_VAR: z.string().min(1),
          },
          runtimeEnv: process.env,
        });
      }).toThrow();
    });

    it("should throw on invalid value", () => {
      process.env.PORT = "not-a-number";

      expect(() => {
        createEnv({
          server: {
            PORT: z.coerce.number().int().positive(),
          },
          runtimeEnv: process.env,
        });
      }).toThrow();
    });

    it("should call custom onValidationError handler", () => {
      const onError = vi.fn(() => {
        throw new Error("Validation failed");
      });

      try {
        createEnv({
          server: {
            REQUIRED_VAR: z.string().min(1),
          },
          runtimeEnv: process.env,
          onValidationError: onError,
        });
      } catch {
        // Expected
      }

      expect(onError).toHaveBeenCalled();
    });
  });

  describe("emptyStringAsUndefined", () => {
    it("should treat empty strings as undefined when enabled", () => {
      process.env.OPTIONAL_VAR = "";

      const env = createEnv({
        server: {
          OPTIONAL_VAR: z.string().optional(),
        },
        runtimeEnv: process.env,
        emptyStringAsUndefined: true,
      });

      expect(env.OPTIONAL_VAR).toBeUndefined();
    });

    it("should keep empty strings when disabled", () => {
      process.env.EMPTY_VAR = "";

      const env = createEnv({
        server: {
          EMPTY_VAR: z.string(),
        },
        runtimeEnv: process.env,
        emptyStringAsUndefined: false,
      });

      expect(env.EMPTY_VAR).toBe("");
    });
  });

  describe("skipValidation", () => {
    it("should skip validation when enabled", () => {
      const env = createEnv({
        server: {
          REQUIRED_VAR: z.string().min(1),
        },
        runtimeEnv: process.env,
        skipValidation: true,
      });

      expect(env.REQUIRED_VAR).toBeUndefined();
    });
  });

  describe("Proxy behavior", () => {
    it("should only expose defined keys", () => {
      process.env.TEST_VAR = "value";
      process.env.UNKNOWN_VAR = "unknown";

      const env = createEnv({
        server: {
          TEST_VAR: z.string(),
        },
        runtimeEnv: process.env,
      });

      expect(env.TEST_VAR).toBe("value");
      expect((env as Record<string, unknown>).UNKNOWN_VAR).toBeUndefined();
    });
  });

  describe("extends", () => {
    it("should merge with extended env objects", () => {
      process.env.BASE_VAR = "base";
      process.env.EXTENDED_VAR = "extended";

      const baseEnv = createEnv({
        server: {
          BASE_VAR: z.string(),
        },
        runtimeEnv: process.env,
      });

      const extendedEnv = createEnv({
        server: {
          EXTENDED_VAR: z.string(),
        },
        extends: [baseEnv],
        runtimeEnv: process.env,
      });

      expect(extendedEnv.BASE_VAR).toBe("base");
      expect(extendedEnv.EXTENDED_VAR).toBe("extended");
    });

    it("should extend with plugins in base and child configs", () => {
      process.env.BASE_PLUGIN_VAR = "base-plugin";
      process.env.BASE_SERVER_VAR = "base-server";
      process.env.CHILD_PLUGIN_VAR = "child-plugin";
      process.env.CHILD_SERVER_VAR = "child-server";
      process.env.CHILD_CLIENT_VAR = "child-client";

      const basePlugin = {
        id: "base-plugin",
        name: "Base Plugin",
        schema: { BASE_PLUGIN_VAR: z.string() },
      };

      const childPlugin = {
        id: "child-plugin",
        name: "Child Plugin",
        schema: { CHILD_PLUGIN_VAR: z.string() },
      };

      const baseEnv = createEnv({
        plugins: [basePlugin],
        server: { BASE_SERVER_VAR: z.string() },
        runtimeEnv: process.env,
      });

      const childEnv = createEnv({
        extends: [baseEnv],
        plugins: [childPlugin],
        server: { CHILD_SERVER_VAR: z.string() },
        client: { CHILD_CLIENT_VAR: z.string() },
        clientPrefix: "CHILD_",
        runtimeEnv: process.env,
      });

      // Base plugin + server vars should be inherited
      expect((childEnv as Record<string, unknown>).BASE_PLUGIN_VAR).toBe("base-plugin");
      expect((childEnv as Record<string, unknown>).BASE_SERVER_VAR).toBe("base-server");
      // Child's own plugin + server + client vars should work
      expect((childEnv as Record<string, unknown>).CHILD_PLUGIN_VAR).toBe("child-plugin");
      expect(childEnv.CHILD_SERVER_VAR).toBe("child-server");
      expect(childEnv.CHILD_CLIENT_VAR).toBe("child-client");
    });

    it("should extend with multiple base configs", () => {
      process.env.DB_URL = "postgres://localhost/test";
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.APP_KEY = "my-key";

      const dbEnv = createEnv({
        server: { DB_URL: z.string() },
        runtimeEnv: process.env,
      });

      const cacheEnv = createEnv({
        server: { REDIS_URL: z.string() },
        runtimeEnv: process.env,
      });

      const appEnv = createEnv({
        extends: [dbEnv, cacheEnv],
        server: { APP_KEY: z.string() },
        runtimeEnv: process.env,
      });

      expect((appEnv as Record<string, unknown>).DB_URL).toBe("postgres://localhost/test");
      expect((appEnv as Record<string, unknown>).REDIS_URL).toBe("redis://localhost:6379");
      expect(appEnv.APP_KEY).toBe("my-key");
    });

    it("should preserve metadata from extended configs", () => {
      process.env.EXT_META_BASE = "base";
      process.env.EXT_META_CHILD = "child";

      const basePlugin = {
        id: "meta-base-plugin",
        name: "Meta Base Plugin",
        schema: { EXT_META_BASE: z.string() },
      };

      const baseEnv = createEnv({
        plugins: [basePlugin],
        server: {},
        runtimeEnv: process.env,
      });

      const childEnv = createEnv({
        extends: [baseEnv],
        server: { EXT_META_CHILD: z.string() },
        runtimeEnv: process.env,
      });

      // Metadata symbol should be present
      const metaSym = Symbol.for("__NEVR_ENV_METADATA__");
      const meta = (childEnv as Record<symbol, unknown>)[metaSym] as Record<string, unknown>;
      expect(meta).toBeDefined();
      // Plugins from base should be included in metadata
      expect((meta.plugins as unknown[]).length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("plugin system", () => {
  it("should merge plugin schemas", () => {
    process.env.PLUGIN_VAR = "plugin-value";
    process.env.APP_VAR = "app-value";

    const mockPlugin = {
      id: "test-plugin",
      name: "Test Plugin",
      schema: {
        PLUGIN_VAR: z.string(),
      },
    };

    const env = createEnv({
      plugins: [mockPlugin],
      server: {
        APP_VAR: z.string(),
      },
      runtimeEnv: process.env,
    });

    expect((env as Record<string, unknown>).PLUGIN_VAR).toBe("plugin-value");
    expect(env.APP_VAR).toBe("app-value");
  });

  it("should run plugin afterValidation hook", () => {
    process.env.TEST_VAR = "value";

    const afterHook = vi.fn();

    const mockPlugin = {
      id: "after-plugin",
      name: "After Plugin",
      schema: {
        TEST_VAR: z.string(),
      },
      hooks: {
        afterValidation: afterHook,
      },
    };

    createEnv({
      plugins: [mockPlugin],
      server: {},
      runtimeEnv: process.env,
    });

    expect(afterHook).toHaveBeenCalledWith(
      expect.objectContaining({
        TEST_VAR: "value",
      })
    );
  });
});
