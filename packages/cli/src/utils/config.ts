/**
 * CLI utilities for finding and loading configuration files
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join, dirname, resolve } from "path";
/**
 * Plugin interface for CLI (matches @nevr-env/core NevrEnvPlugin)
 * Re-declared here to avoid cross-package source resolution issues during DTS build.
 */
interface NevrEnvPlugin {
  id: string;
  name: string;
  schema: Record<string, unknown>;
  prefix?: string;
  discover?: () => Promise<Record<string, unknown>>;
  autoDiscover?: boolean;
  cli?: {
    docs?: string;
    helpText?: string;
    prompts?: Record<string, { message?: string; placeholder?: string; validate?: (value: string) => string | undefined }>;
  };
  hooks?: {
    beforeValidation?: (values: Record<string, unknown>) => Record<string, unknown>;
    afterValidation?: (values: Record<string, unknown>) => void;
  };
  sensitive?: boolean | Record<string, boolean>;
  runtime?: string;
}

/**
 * Possible configuration file names
 */
export const CONFIG_FILES = [
  "nevr.config.ts",
  "nevr.config.js",
  "nevr.config.mjs",
  "env.config.ts",
  "env.config.js",
  "env.config.mjs",
  "src/env.ts",
  "src/env.js",
  "lib/env.ts",
  "lib/env.js",
  "app/env.ts",
  "app/env.js",
];

/**
 * Possible .env file names in order of priority
 */
export const ENV_FILES = [
  ".env.local",
  ".env.development.local",
  ".env.development",
  ".env",
];

/**
 * Find a configuration file in the given directory
 */
export function findConfigFile(cwd: string): string | null {
  for (const file of CONFIG_FILES) {
    const path = join(cwd, file);
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

/**
 * Find all .env files in the given directory
 */
export function findEnvFiles(cwd: string): string[] {
  const found: string[] = [];
  
  for (const file of ENV_FILES) {
    const path = join(cwd, file);
    if (existsSync(path)) {
      found.push(path);
    }
  }
  
  return found;
}

/**
 * Parse a .env file into key-value pairs
 */
export function parseEnvFile(path: string): Map<string, string> {
  const result = new Map<string, string>();
  
  if (!existsSync(path)) {
    return result;
  }
  
  const content = readFileSync(path, "utf-8");
  const lines = content.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    
    // Find the first = sign
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    
    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    
    result.set(key, value);
  }
  
  return result;
}

/**
 * Write key-value pairs to a .env file
 */
export function writeEnvFile(
  path: string,
  values: Map<string, string>,
  options?: { append?: boolean }
): void {
  // Build content
  const lines: string[] = [];
  
  for (const [key, value] of values) {
    // Quote value if it contains spaces or special characters
    const needsQuotes = /[\s#=]/.test(value);
    const quotedValue = needsQuotes ? `"${value}"` : value;
    lines.push(`${key}=${quotedValue}`);
  }
  
  const content = lines.join("\n") + "\n";
  
  if (options?.append) {
    appendFileSync(path, content);
  } else {
    writeFileSync(path, content);
  }
}

/**
 * Add or update a single variable in a .env file
 */
export function setEnvVariable(
  path: string,
  key: string,
  value: string
): void {
  let content = "";
  let found = false;
  
  if (existsSync(path)) {
    content = readFileSync(path, "utf-8");
    const lines = content.split("\n");
    
    const newLines = lines.map((line) => {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) {
        return line;
      }
      
      // Check if this line sets the key we're looking for
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex !== -1) {
        const lineKey = trimmed.slice(0, eqIndex).trim();
        if (lineKey === key) {
          found = true;
          const needsQuotes = /[\s#=]/.test(value);
          const quotedValue = needsQuotes ? `"${value}"` : value;
          return `${key}=${quotedValue}`;
        }
      }
      
      return line;
    });
    
    content = newLines.join("\n");
  }
  
  // If key wasn't found, append it
  if (!found) {
    const needsQuotes = /[\s#=]/.test(value);
    const quotedValue = needsQuotes ? `"${value}"` : value;
    const newLine = `${key}=${quotedValue}`;
    
    if (content && !content.endsWith("\n")) {
      content += "\n";
    }
    content += newLine + "\n";
  }
  
  writeFileSync(path, content);
}

/**
 * Load .env files into process.env for the given working directory.
 * Must be called before loading user config files, because config files
 * typically call createEnv() at import time which validates against process.env.
 *
 * Parses .env files directly instead of relying on the dotenv package import
 * to avoid ESM/CJS interop issues.
 */
export function loadDotenvFiles(cwd: string): void {
  // Load in priority order — later files override earlier ones.
  // .env is lowest priority, .env.local is highest.
  const filesToLoad = [
    ".env",
    ".env.development",
    ".env.development.local",
    ".env.local",
  ];

  for (const file of filesToLoad) {
    const filePath = join(cwd, file);
    if (existsSync(filePath)) {
      const entries = parseEnvFile(filePath);
      for (const [key, value] of entries) {
        process.env[key] = value;
      }
    }
  }
}

/**
 * Load TypeScript config file using jiti.
 *
 * Automatically loads .env files into process.env first so that
 * createEnv() calls inside the config don't fail on missing variables.
 * Also sets NEVR_ENV_SKIP_VALIDATION so createEnv() skips validation
 * while still attaching schema metadata for CLI introspection.
 */
export async function loadConfigFile(
  configPath: string,
  options?: { cwd?: string; skipDotenv?: boolean }
): Promise<unknown> {
  const cwd = options?.cwd ?? dirname(resolve(configPath));

  // Load .env into process.env before the config file executes
  if (!options?.skipDotenv) {
    loadDotenvFiles(cwd);
  }

  // Skip validation so createEnv() doesn't throw on missing vars —
  // CLI commands need the schema metadata, not a validated env object.
  const prevSkip = process.env.NEVR_ENV_SKIP_VALIDATION;
  process.env.NEVR_ENV_SKIP_VALIDATION = "true";

  try {
    const jiti = (await import("jiti")).default;
    const loader = jiti(dirname(resolve(configPath)), {
      interopDefault: true,
    });

    const config = loader(resolve(configPath));
    return config?.default ?? config;
  } catch (error) {
    throw new Error(`Failed to load config file: ${configPath}\n${error}`);
  } finally {
    // Restore previous value
    if (prevSkip === undefined) {
      delete process.env.NEVR_ENV_SKIP_VALIDATION;
    } else {
      process.env.NEVR_ENV_SKIP_VALIDATION = prevSkip;
    }
  }
}

/**
 * Detect the framework used in the project
 */
export function detectFramework(cwd: string): string | null {
  const pkgPath = join(cwd, "package.json");
  
  if (!existsSync(pkgPath)) {
    return null;
  }
  
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    
    if (deps.next) return "nextjs";
    if (deps.nuxt) return "nuxt";
    if (deps["@remix-run/react"]) return "remix";
    if (deps.astro) return "astro";
    if (deps.svelte || deps["@sveltejs/kit"]) return "svelte";
    if (deps.vite) return "vite";
    if (deps.express) return "express";
    if (deps.hono) return "hono";
    if (deps.fastify) return "fastify";
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the recommended client prefix for a framework
 */
export function getFrameworkPrefix(framework: string | null): string {
  switch (framework) {
    case "nextjs":
      return "NEXT_PUBLIC_";
    case "nuxt":
      return "NUXT_PUBLIC_";
    case "vite":
    case "svelte":
      return "VITE_";
    case "remix":
      return "PUBLIC_";
    case "astro":
      return "PUBLIC_";
    default:
      return "PUBLIC_";
  }
}

/**
 * Extracted schema information from a createEnv() result or config object.
 * Unified interface used by all CLI commands.
 */
export interface ExtractedSchema {
  /** All variable keys in the schema (server + client + shared + plugins) */
  requiredKeys: Set<string>;
  /** Keys that are optional or have defaults (subset of requiredKeys) */
  optionalKeys: Set<string>;
  /** Server-only variable keys */
  serverKeys: Set<string>;
  /** Client variable keys */
  clientKeys: Set<string>;
  /** Shared variable keys */
  sharedKeys: Set<string>;
  /** Plugin variable keys */
  pluginKeys: Set<string>;
  /** Map of variable key → plugin that owns it */
  pluginInfo: Map<string, NevrEnvPlugin>;
  /** Plugin instances (for discovery, CLI prompts, etc.) */
  plugins: NevrEnvPlugin[];
  /** Client prefix if set */
  clientPrefix?: string;
  /** Raw schema dictionaries (for type inference in `types` command) */
  schemas: {
    server: Record<string, unknown>;
    client: Record<string, unknown>;
    shared: Record<string, unknown>;
  };
}

/**
 * Check if a Zod schema is optional or has a default value.
 * Inspects the Zod internal _def to detect ZodOptional and ZodDefault wrappers.
 */
function isSchemaOptional(schema: unknown): boolean {
  const s = schema as { _def?: { typeName?: string; innerType?: unknown } };
  if (!s?._def) return false;
  const { typeName } = s._def;
  if (typeName === "ZodOptional" || typeName === "ZodDefault") return true;
  // Check inner type for chained wrappers (e.g., z.string().optional().default(...))
  if (s._def.innerType) return isSchemaOptional(s._def.innerType);
  return false;
}

/**
 * Extract schema information from a loaded config.
 *
 * Strategy 1: Read metadata Symbol from createEnv() Proxy result.
 * Strategy 2: Fall back to legacy object property inspection
 *             (works when skipValidation returns a plain object).
 */
export function extractSchemaFromConfig(config: unknown): ExtractedSchema {
  const result: ExtractedSchema = {
    requiredKeys: new Set(),
    optionalKeys: new Set(),
    serverKeys: new Set(),
    clientKeys: new Set(),
    sharedKeys: new Set(),
    pluginKeys: new Set(),
    pluginInfo: new Map(),
    plugins: [],
    schemas: { server: {}, client: {}, shared: {} },
  };

  // Strategy 1: Try the metadata Symbol (preferred path)
  // Use Symbol.for() to access the metadata directly — avoids needing to
  // require("@nevr-env/core") at runtime (which fails due to ESM-only exports).
  // When jiti loads `export const env = createEnv(...)`, the module object
  // is `{ env: <Proxy> }`. We check config directly first, then check each
  // exported property for the metadata Symbol.
  const metadataSymbol = Symbol.for("__NEVR_ENV_METADATA__");

  function readMeta(obj: unknown): Record<string, unknown> | null {
    if (obj && typeof obj === "object") {
      try {
        const val = (obj as Record<symbol, unknown>)[metadataSymbol];
        if (val && typeof val === "object") return val as Record<string, unknown>;
      } catch { /* ignore */ }
    }
    return null;
  }

  // Try config directly, then try each property of the module object
  let meta = readMeta(config);
  if (!meta && config && typeof config === "object") {
    for (const value of Object.values(config as Record<string, unknown>)) {
      meta = readMeta(value);
      if (meta) break;
    }
  }

  if (meta) {
    // Cast to expected shape from EnvConfigMetadata
    const m = meta as {
      server: Record<string, unknown>;
      client: Record<string, unknown>;
      shared: Record<string, unknown>;
      plugins: NevrEnvPlugin[];
      clientPrefix?: string;
    };

    // Server keys
    for (const [key, schema] of Object.entries(m.server)) {
      result.serverKeys.add(key);
      result.requiredKeys.add(key);
      if (isSchemaOptional(schema)) result.optionalKeys.add(key);
    }
    // Client keys
    for (const [key, schema] of Object.entries(m.client)) {
      result.clientKeys.add(key);
      result.requiredKeys.add(key);
      if (isSchemaOptional(schema)) result.optionalKeys.add(key);
    }
    // Shared keys
    for (const [key, schema] of Object.entries(m.shared)) {
      result.sharedKeys.add(key);
      result.requiredKeys.add(key);
      if (isSchemaOptional(schema)) result.optionalKeys.add(key);
    }
    // Plugin keys
    if (m.plugins && Array.isArray(m.plugins)) {
      result.plugins = m.plugins;
      for (const plugin of m.plugins) {
        if (plugin.schema) {
          for (const [key, schema] of Object.entries(plugin.schema)) {
            result.pluginKeys.add(key);
            result.requiredKeys.add(key);
            result.pluginInfo.set(key, plugin);
            if (isSchemaOptional(schema)) result.optionalKeys.add(key);
          }
        }
      }
    }
    result.clientPrefix = m.clientPrefix;
    result.schemas = {
      server: m.server,
      client: m.client,
      shared: m.shared,
    };
    return result;
  }

  // Strategy 2: Legacy object inspection (skipValidation mode returns plain object)
  if (config && typeof config === "object") {
    const c = config as Record<string, unknown>;

    // Check for plugins array
    if ("plugins" in c && Array.isArray(c.plugins)) {
      for (const plugin of c.plugins as NevrEnvPlugin[]) {
        if (plugin && plugin.schema) {
          result.plugins.push(plugin);
          for (const [key, schema] of Object.entries(plugin.schema)) {
            result.pluginKeys.add(key);
            result.requiredKeys.add(key);
            result.pluginInfo.set(key, plugin);
            if (isSchemaOptional(schema)) result.optionalKeys.add(key);
          }
        }
      }
    }

    // Check for server/client/shared schemas
    for (const [section, keySet] of [
      ["server", result.serverKeys],
      ["client", result.clientKeys],
      ["shared", result.sharedKeys],
    ] as const) {
      if (c[section] && typeof c[section] === "object") {
        const schemas = c[section] as Record<string, unknown>;
        result.schemas[section] = schemas;
        for (const [key, schema] of Object.entries(schemas)) {
          (keySet as Set<string>).add(key);
          result.requiredKeys.add(key);
          if (isSchemaOptional(schema)) result.optionalKeys.add(key);
        }
      }
    }

    if (typeof c.clientPrefix === "string") {
      result.clientPrefix = c.clientPrefix;
    }
  }

  return result;
}
