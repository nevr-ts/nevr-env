/**
 * Runtime environment utilities
 * Provides cross-runtime support for Node.js, Deno, and Bun
 */

// Declare browser window for type checking (minimal interface)
declare const window: { [key: string]: unknown } | undefined;

// Declare Deno runtime types
declare const Deno: { env: { toObject(): Record<string, string> } } | undefined;

// Declare Bun runtime types
declare const Bun: { env: Record<string, string | undefined> } | undefined;

/**
 * Environment variable storage shim for unknown runtimes
 */
const _envShim: Record<string, string | undefined> = Object.create(null);

/**
 * Get the environment object based on the current runtime
 */
function getEnvObject(useShim = false): Record<string, string | undefined> {
  // Node.js
  if (typeof globalThis.process?.env === "object") {
    return globalThis.process.env as Record<string, string | undefined>;
  }

  // Deno
  if (typeof Deno !== "undefined" && typeof Deno.env?.toObject === "function") {
    return Deno.env.toObject();
  }

  // Bun
  if (typeof Bun !== "undefined" && typeof Bun.env === "object") {
    return Bun.env;
  }

  // Fallback to shim or empty object
  if (useShim) {
    return _envShim;
  }
  
  return _envShim;
}

/**
 * Proxy-based environment object that works across runtimes
 */
export const runtimeEnv = new Proxy<Record<string, string | undefined>>(_envShim, {
  get(_, prop: string) {
    const env = getEnvObject();
    return env[prop] ?? _envShim[prop];
  },
  has(_, prop: string) {
    const env = getEnvObject();
    return prop in env || prop in _envShim;
  },
  set(_, prop: string, value: string | undefined) {
    const env = getEnvObject(true);
    env[prop] = value;
    return true;
  },
  deleteProperty(_, prop: string) {
    const env = getEnvObject(true);
    delete env[prop];
    return true;
  },
  ownKeys() {
    const env = getEnvObject();
    return [...new Set([...Object.keys(env), ...Object.keys(_envShim)])];
  },
  getOwnPropertyDescriptor(_, prop: string) {
    const env = getEnvObject();
    const value = env[prop] ?? _envShim[prop];
    if (value !== undefined) {
      return { value, writable: true, enumerable: true, configurable: true };
    }
    return undefined;
  },
});

/**
 * Detect if we're running on the server (not in a browser)
 */
export function isServerRuntime(): boolean {
  // Check for browser environment
  if (typeof window !== "undefined") {
    // Exception: Deno can have window defined
    if (typeof Deno !== "undefined") {
      return true;
    }
    return false;
  }
  return true;
}

/**
 * Detect the current JavaScript runtime
 */
export function detectRuntime(): "node" | "deno" | "bun" | "browser" | "unknown" {
  if (typeof window !== "undefined" && typeof Deno === "undefined") {
    return "browser";
  }
  if (typeof Deno !== "undefined") {
    return "deno";
  }
  if (typeof Bun !== "undefined") {
    return "bun";
  }
  if (typeof globalThis.process?.versions?.node !== "undefined") {
    return "node";
  }
  return "unknown";
}

/**
 * Get a single environment variable
 */
export function getEnvVar<T extends string = string>(
  key: string,
  fallback?: T
): string | T | undefined {
  const env = getEnvObject();
  return env[key] ?? fallback;
}

/**
 * Get a boolean environment variable
 * Handles "0", "false", "no", "" as false
 */
export function getBooleanEnvVar(key: string, fallback = true): boolean {
  const value = getEnvVar(key);
  if (value === undefined) {
    return fallback;
  }
  const falsy = ["0", "false", "no", ""];
  return !falsy.includes(value.toLowerCase());
}

/**
 * Common environment helpers
 */
export const ENV = Object.freeze({
  get NODE_ENV() {
    return getEnvVar("NODE_ENV", "development");
  },
  get isProduction() {
    return this.NODE_ENV === "production";
  },
  get isDevelopment() {
    return this.NODE_ENV === "development" || this.NODE_ENV === "dev";
  },
  get isTest() {
    return this.NODE_ENV === "test";
  },
  get isCI() {
    return getBooleanEnvVar("CI", false);
  },
});
