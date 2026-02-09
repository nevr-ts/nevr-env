import type { StandardSchemaV1, StandardSchemaDictionary, InferDictionary } from "./standard";
import type { NevrEnvPlugin, MergePluginSchemas } from "./types/plugin";
import type { EnvOptions, CreateEnvResult } from "./types/options";
import { parseWithDictionary, ensureSynchronous } from "./standard";
import { isServerRuntime, runtimeEnv } from "./runtime";

/**
 * Symbol for storing schema metadata on the env proxy result.
 * Used by CLI commands to extract schema information from a loaded config.
 */
export const __NEVR_ENV_METADATA__ = Symbol.for("__NEVR_ENV_METADATA__");

/**
 * Schema metadata stored on the createEnv() result object.
 * Accessible via getEnvMetadata().
 */
export interface EnvConfigMetadata {
  server: StandardSchemaDictionary;
  client: StandardSchemaDictionary;
  shared: StandardSchemaDictionary;
  plugins: readonly NevrEnvPlugin[];
  clientPrefix?: string;
  isServer: boolean;
  validated: boolean;
}

/**
 * Properties to ignore in the Proxy (module system internals)
 */
const IGNORED_PROPS = new Set(["__esModule", "$$typeof", "then", "toJSON"]);

/**
 * Merge plugin schemas into a single dictionary
 */
function mergePluginSchemas(
  plugins: readonly NevrEnvPlugin[] | undefined
): StandardSchemaDictionary {
  if (!plugins || plugins.length === 0) {
    return {};
  }

  return plugins.reduce<StandardSchemaDictionary>((acc, plugin) => {
    return { ...acc, ...plugin.schema };
  }, {});
}

/**
 * Get plugin metadata (for CLI integration)
 */
export function getPluginMetadata(plugins: readonly NevrEnvPlugin[] | undefined): Map<string, NevrEnvPlugin> {
  const map = new Map<string, NevrEnvPlugin>();
  if (!plugins) return map;
  
  for (const plugin of plugins) {
    for (const key of Object.keys(plugin.schema)) {
      map.set(key, plugin);
    }
  }
  return map;
}

/**
 * Run beforeValidation hooks from plugins
 */
function runBeforeValidationHooks(
  plugins: readonly NevrEnvPlugin[] | undefined,
  values: Record<string, unknown>
): Record<string, unknown> {
  if (!plugins) return values;

  let result = values;
  for (const plugin of plugins) {
    if (plugin.hooks?.beforeValidation) {
      result = plugin.hooks.beforeValidation(result);
    }
  }
  return result;
}

/**
 * Run afterValidation hooks from plugins
 */
function runAfterValidationHooks(
  plugins: readonly NevrEnvPlugin[] | undefined,
  values: Record<string, unknown>
): void {
  if (!plugins) return;

  for (const plugin of plugins) {
    if (plugin.hooks?.afterValidation) {
      plugin.hooks.afterValidation(values as Record<string, unknown>);
    }
  }
}

/**
 * Default validation error handler
 */
function defaultOnValidationError(issues: readonly StandardSchemaV1.Issue[]): never {
  console.error("❌ Invalid environment variables:");
  console.error("");
  
  for (const issue of issues) {
    const path = issue.path?.join(".") ?? "unknown";
    console.error(`  • ${path}: ${issue.message}`);
  }
  
  console.error("");
  console.error("💡 Tip: Run `npx nevr-env fix` to interactively fix missing variables.");
  
  throw new Error("Invalid environment variables");
}

/**
 * Default invalid access handler
 */
function defaultOnInvalidAccess(variableName: string): never {
  throw new Error(
    `❌ Attempted to access server-side environment variable "${variableName}" on the client.\n` +
    `This is a security risk. Server secrets should never be exposed to the browser.\n\n` +
    `💡 If you need this value on the client, add it to the "client" schema with the appropriate prefix.`
  );
}

/**
 * Create a type-safe environment configuration
 * 
 * @example
 * ```ts
 * import { createEnv } from "@nevr-env/core";
 * import { postgres } from "@nevr-env/postgres";
 * import { z } from "zod";
 * 
 * export const env = createEnv({
 *   plugins: [postgres()],
 *   server: {
 *     NODE_ENV: z.enum(["development", "production", "test"]),
 *   },
 *   client: {
 *     NEXT_PUBLIC_API_URL: z.string().url(),
 *   },
 *   clientPrefix: "NEXT_PUBLIC_",
 *   runtimeEnv: process.env,
 * });
 * ```
 */
export function createEnv<
  TPrefix extends string | undefined = undefined,
  TServer extends StandardSchemaDictionary = NonNullable<unknown>,
  TClient extends StandardSchemaDictionary = NonNullable<unknown>,
  TShared extends StandardSchemaDictionary = NonNullable<unknown>,
  const TExtends extends Record<string, unknown>[] = [],
  const TPlugins extends readonly NevrEnvPlugin[] = readonly []
>(
  opts: EnvOptions<TPrefix, TServer, TClient, TShared, TExtends, TPlugins>
): CreateEnvResult<TServer, TClient, TShared, TExtends, TPlugins> {
  // Step 1: Get runtime environment
  // Support experimental__runtimeEnv for Next.js 13.4.4+
  // This allows destructuring only client vars while server vars come from process.env
  const experimentalRuntimeEnv = (opts as { experimental__runtimeEnv?: Record<string, unknown> }).experimental__runtimeEnv;
  const envSource = experimentalRuntimeEnv 
    ? { ...runtimeEnv, ...experimentalRuntimeEnv }
    : (opts.runtimeEnvStrict ?? opts.runtimeEnv ?? runtimeEnv);

  // Step 2: Handle empty strings as undefined
  // Default: false (matches t3-env behavior for migration compatibility)
  const processedEnv: Record<string, unknown> = { ...envSource };
  if (opts.emptyStringAsUndefined) {
    for (const [key, value] of Object.entries(processedEnv)) {
      if (value === "") {
        delete processedEnv[key];
      }
    }
  }

  // Step 3: Skip validation mode (for build time or CLI introspection)
  // Supports both `opts.skipValidation` and `NEVR_ENV_SKIP_VALIDATION` env var.
  // The env var is used by CLI commands (fix, check) to load the config without validation.
  const shouldSkipValidation = opts.skipValidation || process.env.NEVR_ENV_SKIP_VALIDATION === "true";

  if (shouldSkipValidation) {
    // Propagate skipValidation to all extended presets (matches t3-env behavior)
    if (opts.extends) {
      for (const preset of opts.extends) {
        (preset as Record<string, unknown>).skipValidation = true;
      }
    }

    // Still attach metadata so CLI commands can introspect the schema
    const _server = (typeof opts.server === "object" ? opts.server : {}) as TServer;
    const _client = (typeof opts.client === "object" ? opts.client : {}) as TClient;
    const _shared = (typeof opts.shared === "object" ? opts.shared : {}) as TShared;
    const isServer = opts.isServer ?? isServerRuntime();

    // Collect metadata from extended configs
    const extendedMetas: EnvConfigMetadata[] = [];
    if (opts.extends) {
      for (const ext of opts.extends) {
        const meta = (ext as Record<symbol, unknown>)?.[__NEVR_ENV_METADATA__] as EnvConfigMetadata | undefined;
        if (meta) extendedMetas.push(meta);
      }
    }

    const result = { ...processedEnv };
    Object.defineProperty(result, __NEVR_ENV_METADATA__, {
      value: {
        server: Object.assign({}, ...extendedMetas.map(m => m.server), _server),
        client: Object.assign({}, ...extendedMetas.map(m => m.client), _client),
        shared: Object.assign({}, ...extendedMetas.map(m => m.shared), _shared),
        plugins: [...extendedMetas.flatMap(m => m.plugins), ...(opts.plugins ?? [])],
        clientPrefix: opts.clientPrefix as string | undefined,
        isServer,
        validated: false,
      } satisfies EnvConfigMetadata,
      enumerable: false,
      writable: false,
      configurable: false,
    });

    return result as CreateEnvResult<TServer, TClient, TShared, TExtends, TPlugins>;
  }

  // Step 4: Normalize schema objects
  const _server = (typeof opts.server === "object" ? opts.server : {}) as TServer;
  const _client = (typeof opts.client === "object" ? opts.client : {}) as TClient;
  const _shared = (typeof opts.shared === "object" ? opts.shared : {}) as TShared;
  const _plugins = mergePluginSchemas(opts.plugins);

  // Step 5: Detect server vs client context
  const isServer = opts.isServer ?? isServerRuntime();

  // Step 6: Build validation schema based on context
  // Server: validate ALL variables
  // Client: only validate client + shared (security)
  const validationSchema: StandardSchemaDictionary = isServer
    ? { ..._server, ..._shared, ..._client, ..._plugins }
    : { ..._client, ..._shared };

  // Step 7: Run beforeValidation hooks
  const transformedEnv = runBeforeValidationHooks(opts.plugins, processedEnv);

  // Step 8: Validate with Standard Schema
  // Support createFinalSchema for custom schema combination (e.g., cross-field validation)
  let parsed: StandardSchemaV1.Result<Record<string, unknown>>;
  if (opts.createFinalSchema) {
    const finalSchema = opts.createFinalSchema(validationSchema, isServer);
    const result = finalSchema["~standard"].validate(transformedEnv);
    ensureSynchronous(result, "Validation must be synchronous");
    parsed = result as StandardSchemaV1.Result<Record<string, unknown>>;
  } else {
    const result = parseWithDictionary(validationSchema, transformedEnv);
    ensureSynchronous(result, "Validation must be synchronous");
    parsed = result;
  }

  // Step 9: Error handlers
  const onValidationError = opts.onValidationError ?? defaultOnValidationError;
  const onInvalidAccess = opts.onInvalidAccess ?? defaultOnInvalidAccess;
  const validationMode = opts.validationMode ?? "strict";
  const debug = opts.debug ?? false;

  // Debug logging
  if (debug) {
    console.log("[nevr-env] Debug mode enabled");
    console.log("[nevr-env] Is server:", isServer);
    console.log("[nevr-env] Schema keys:", Object.keys(validationSchema));
    console.log("[nevr-env] Available env keys:", Object.keys(transformedEnv));
  }

  // Step 10: Handle validation failures
  let validatedValues: Record<string, unknown>;
  
  if (parsed.issues) {
    if (validationMode === "warn") {
      console.warn("⚠️ Environment validation warnings:");
      for (const issue of parsed.issues) {
        const path = issue.path?.join(".") ?? "unknown";
        console.warn(`  • ${path}: ${issue.message}`);
      }
      console.warn("Continuing with potentially invalid environment...");
      // In warn mode, use transformed env directly (partial validation)
      validatedValues = transformedEnv;
    } else {
      return onValidationError(parsed.issues);
    }
  } else {
    validatedValues = parsed.value;
  }

  // Step 11: Run afterValidation hooks
  runAfterValidationHooks(opts.plugins, validatedValues);

  // Call onSuccess callback if provided
  if (opts.onSuccess && !parsed.issues) {
    opts.onSuccess(validatedValues);
  }

  // Step 12: Merge extended configurations
  const extendedObj = (opts.extends ?? []).reduce<Record<string, unknown>>(
    (acc, curr) => Object.assign(acc, curr),
    {}
  );
  const fullObj = { ...extendedObj, ...validatedValues };

  // Step 12b: Collect metadata from extended configurations
  const extendedMetas: EnvConfigMetadata[] = [];
  if (opts.extends) {
    for (const ext of opts.extends) {
      const meta = (ext as Record<symbol, unknown>)?.[__NEVR_ENV_METADATA__] as EnvConfigMetadata | undefined;
      if (meta) extendedMetas.push(meta);
    }
  }

  // Step 12c: Attach schema metadata for CLI introspection (includes extended)
  Object.defineProperty(fullObj, __NEVR_ENV_METADATA__, {
    value: {
      server: Object.assign({}, ...extendedMetas.map(m => m.server), _server),
      client: Object.assign({}, ...extendedMetas.map(m => m.client), _client),
      shared: Object.assign({}, ...extendedMetas.map(m => m.shared), _shared),
      plugins: [...extendedMetas.flatMap(m => m.plugins), ...(opts.plugins ?? [])],
      clientPrefix: opts.clientPrefix as string | undefined,
      isServer,
      validated: !parsed.issues,
    } satisfies EnvConfigMetadata,
    enumerable: false,
    writable: false,
    configurable: false,
  });

  // Step 13: Server access validation helpers
  const clientPrefix = opts.clientPrefix as string | undefined;
  
  const isServerOnlyKey = (prop: string): boolean => {
    if (!clientPrefix) return false;
    // If it starts with clientPrefix, it's a client key
    if (prop.startsWith(clientPrefix)) return false;
    // If it's in shared, it's accessible everywhere
    if (prop in _shared) return false;
    // Otherwise, it's server-only
    return true;
  };

  const isValidAccess = (prop: string): boolean => {
    if (isServer) return true;
    return !isServerOnlyKey(prop);
  };

  // Step 14: Create the Proxy
  // This is the magic that prevents client-side access to server secrets
  const env = new Proxy(fullObj, {
    get(target, prop) {
      // Allow metadata Symbol through for CLI introspection
      if (prop === __NEVR_ENV_METADATA__) return Reflect.get(target, prop);

      // Ignore non-string props
      if (typeof prop !== "string") return undefined;

      // Ignore module system internals
      if (IGNORED_PROPS.has(prop)) return undefined;

      // Check for valid access
      if (!isValidAccess(prop)) {
        return onInvalidAccess(prop);
      }

      return Reflect.get(target, prop);
    },
    
    // Prevent enumeration of server keys on client
    ownKeys(target) {
      const keys = Reflect.ownKeys(target);
      if (isServer) return keys;
      return keys.filter((key) => {
        if (typeof key !== "string") return true;
        return !isServerOnlyKey(key);
      });
    },
    
    getOwnPropertyDescriptor(target, prop) {
      if (typeof prop === "string" && !isServer && isServerOnlyKey(prop)) {
        return undefined;
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });

  return env as CreateEnvResult<TServer, TClient, TShared, TExtends, TPlugins>;
}

/**
 * Retrieve schema metadata from a createEnv() result.
 * Returns null if the object was not created by createEnv() or was created
 * with skipValidation (which bypasses the Proxy).
 *
 * @example
 * ```ts
 * import { createEnv, getEnvMetadata } from "nevr-env";
 *
 * const env = createEnv({ ... });
 * const meta = getEnvMetadata(env);
 * if (meta) {
 *   console.log("Server keys:", Object.keys(meta.server));
 * }
 * ```
 */
export function getEnvMetadata(env: unknown): EnvConfigMetadata | null {
  if (env == null || typeof env !== "object") return null;
  const meta = (env as Record<symbol, unknown>)[__NEVR_ENV_METADATA__];
  if (!meta || typeof meta !== "object") return null;
  return meta as EnvConfigMetadata;
}
