/**
 * Tests for plugin hooks, autoDiscover, and createPlugin factory
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import { createEnv } from "./create-env";
import { createPlugin } from "./plugin-helpers";

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

describe("plugin beforeValidation hook", () => {
  it("should transform values before validation", () => {
    process.env.RAW_PORT = "8080";

    const plugin = {
      id: "transform",
      name: "Transform",
      schema: { PORT: z.coerce.number() },
      hooks: {
        beforeValidation: (values: Record<string, unknown>) => {
          return { ...values, PORT: values.RAW_PORT };
        },
      },
    };

    const env = createEnv({
      plugins: [plugin],
      runtimeEnv: process.env,
    });

    expect((env as Record<string, unknown>).PORT).toBe(8080);
  });

  it("should chain multiple plugin hooks", () => {
    process.env.X = "hello";

    const plugin1 = {
      id: "p1",
      name: "P1",
      schema: { X: z.string() },
      hooks: {
        beforeValidation: (v: Record<string, unknown>) => ({
          ...v,
          X: (v.X as string) + "-p1",
        }),
      },
    };

    const plugin2 = {
      id: "p2",
      name: "P2",
      schema: {},
      hooks: {
        beforeValidation: (v: Record<string, unknown>) => ({
          ...v,
          X: (v.X as string) + "-p2",
        }),
      },
    };

    const env = createEnv({
      plugins: [plugin1, plugin2],
      runtimeEnv: process.env,
    });

    expect((env as Record<string, unknown>).X).toBe("hello-p1-p2");
  });
});

describe("onSuccess callback", () => {
  it("should be called after successful validation", () => {
    process.env.FOO = "bar";
    const onSuccess = vi.fn();

    createEnv({
      server: { FOO: z.string() },
      runtimeEnv: process.env,
      onSuccess,
    });

    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ FOO: "bar" })
    );
  });

  it("should not be called on validation failure", () => {
    const onSuccess = vi.fn();

    try {
      createEnv({
        server: { MISSING: z.string().min(1) },
        runtimeEnv: process.env,
        onSuccess,
      });
    } catch {
      // expected
    }

    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe("autoDiscover", () => {
  it("should default to true from createPlugin", () => {
    const factory = createPlugin({
      id: "test",
      name: "Test",
      base: { X: z.string() },
      discover: () => async () => ({}),
    });
    const plugin = factory();
    expect(plugin.autoDiscover).toBe(true);
  });

  it("should respect explicit false", () => {
    const factory = createPlugin({
      id: "test",
      name: "Test",
      base: { X: z.string() },
      discover: () => async () => ({}),
      autoDiscover: false,
    });
    const plugin = factory();
    expect(plugin.autoDiscover).toBe(false);
  });

  it("should support function form", () => {
    const factory = createPlugin({
      id: "test",
      name: "Test",
      base: { X: z.string() },
      $options: {} as { enableDiscovery?: boolean },
      discover: () => async () => ({}),
      autoDiscover: (opts) => opts.enableDiscovery !== false,
    });

    expect(factory({ enableDiscovery: true }).autoDiscover).toBe(true);
    expect(factory({ enableDiscovery: false }).autoDiscover).toBe(false);
  });

  it("should default autoDiscover to true when not specified in createPlugin", () => {
    const factory = createPlugin({
      id: "nodiscover",
      name: "No Discover",
      base: { Y: z.string() },
    });
    const plugin = factory();
    expect(plugin.autoDiscover).toBe(true);
  });

  it("should allow user to override autoDiscover via options", () => {
    const factory = createPlugin({
      id: "test",
      name: "Test",
      base: { X: z.string() },
      $options: {} as { someOpt?: boolean },
      discover: () => async () => ({}),
    });

    // Without override — default true
    expect(factory().autoDiscover).toBe(true);
    expect(factory({ someOpt: true }).autoDiscover).toBe(true);

    // User overrides to false
    expect(factory({ autoDiscover: false }).autoDiscover).toBe(false);

    // User explicitly sets true (no-op but valid)
    expect(factory({ autoDiscover: true }).autoDiscover).toBe(true);
  });

  it("should let user override even when config sets autoDiscover to true", () => {
    const factory = createPlugin({
      id: "test",
      name: "Test",
      base: { X: z.string() },
      autoDiscover: true,
    });

    expect(factory({ autoDiscover: false }).autoDiscover).toBe(false);
  });
});

describe("createPlugin declarative patterns", () => {
  it("should build schema from base only", () => {
    const factory = createPlugin({
      id: "test",
      name: "Test",
      base: { A: z.string(), B: z.number() },
    });
    const plugin = factory();
    expect(Object.keys(plugin.schema)).toEqual(["A", "B"]);
  });

  it("should include when-branch schemas when flag is true", () => {
    const factory = createPlugin({
      id: "test",
      name: "Test",
      base: { BASE: z.string() },
      when: {
        extra: { EXTRA: z.string() },
        pool: { POOL_A: z.number(), POOL_B: z.number() },
      },
    });

    const noFlags = factory();
    expect(Object.keys(noFlags.schema)).toEqual(["BASE"]);

    const withExtra = factory({ extra: true });
    expect(Object.keys(withExtra.schema).sort()).toEqual(["BASE", "EXTRA"]);

    const withBoth = factory({ extra: true, pool: true });
    expect(Object.keys(withBoth.schema).sort()).toEqual(["BASE", "EXTRA", "POOL_A", "POOL_B"]);
  });

  it("should handle either-branches correctly", () => {
    const factory = createPlugin({
      id: "test",
      name: "Test",
      base: {},
      either: {
        azure: {
          true: { AZURE_KEY: z.string() },
          false: { STANDARD_KEY: z.string() },
        },
      },
    });

    const defaultMode = factory();
    expect(Object.keys(defaultMode.schema)).toEqual(["STANDARD_KEY"]);

    const azureMode = factory({ azure: true });
    expect(Object.keys(azureMode.schema)).toEqual(["AZURE_KEY"]);

    const explicitFalse = factory({ azure: false });
    expect(Object.keys(explicitFalse.schema)).toEqual(["STANDARD_KEY"]);
  });

  it("should merge extend option at runtime", () => {
    const factory = createPlugin({
      id: "test",
      name: "Test",
      base: { BASE: z.string() },
    });

    const plugin = factory({ extend: { CUSTOM: z.string() } });
    expect(Object.keys(plugin.schema).sort()).toEqual(["BASE", "CUSTOM"]);
  });

  it("should call runtimeSchema for adjustments", () => {
    const factory = createPlugin({
      id: "test",
      name: "Test",
      base: { DEFAULT_KEY: z.string() },
      $options: {} as { customKey?: string },
      runtimeSchema: (opts, schema) => {
        if (opts.customKey) {
          schema[opts.customKey] = schema.DEFAULT_KEY;
          delete schema.DEFAULT_KEY;
        }
      },
    });

    const defaultPlugin = factory();
    expect(defaultPlugin.schema).toHaveProperty("DEFAULT_KEY");

    const customPlugin = factory({ customKey: "MY_KEY" });
    expect(customPlugin.schema).not.toHaveProperty("DEFAULT_KEY");
    expect(customPlugin.schema).toHaveProperty("MY_KEY");
  });

  it("should call dynamicSchema and merge result", () => {
    const factory = createPlugin({
      id: "test",
      name: "Test",
      base: { BASE: z.string() },
      $options: {} as { items?: string[] },
      dynamicSchema: (opts) => {
        const schema: Record<string, any> = {};
        for (const item of opts.items ?? []) {
          schema[`ITEM_${item.toUpperCase()}`] = z.string();
        }
        return schema;
      },
    });

    const plugin = factory({ items: ["foo", "bar"] });
    expect(Object.keys(plugin.schema).sort()).toEqual(["BASE", "ITEM_BAR", "ITEM_FOO"]);
  });

  it("should pass options to cli, hooks, and discover", () => {
    const factory = createPlugin({
      id: "test",
      name: "Test",
      base: { KEY: z.string() },
      $options: {} as { mode?: string },
      when: { extra: { EXTRA: z.string() } },
      cli: (opts) => ({
        docs: `https://example.com/${opts.mode ?? "default"}`,
      }),
      hooks: (opts) => ({
        afterValidation: () => {},
      }),
      discover: (opts) => async () => ({
        KEY: { value: `v-${opts.mode}`, source: "test", description: "Test", confidence: 1 },
      }),
    });

    const instance = factory({ mode: "prod", extra: true });
    expect(instance.cli?.docs).toBe("https://example.com/prod");
    expect(instance.hooks).toBeDefined();
    expect(instance.discover).toBeDefined();
    expect(Object.keys(instance.schema).sort()).toEqual(["EXTRA", "KEY"]);
  });
});
