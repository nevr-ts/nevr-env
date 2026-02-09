/**
 * Health Check Utilities
 * 
 * Helpers for building health check endpoints that validate environment
 * without exposing sensitive values.
 */

import type { StandardSchemaDictionary, StandardSchemaV1 } from "./standard";
import type { NevrEnvPlugin } from "./types/plugin";
import { parseWithDictionary } from "./standard";

export interface HealthCheckResult {
  /** Overall health status */
  status: "healthy" | "degraded" | "unhealthy";
  /** Timestamp of the check */
  timestamp: string;
  /** Results for each variable */
  variables: VariableHealthResult[];
  /** Summary statistics */
  summary: {
    total: number;
    valid: number;
    invalid: number;
    missing: number;
  };
}

export interface VariableHealthResult {
  /** Variable name */
  name: string;
  /** Whether it's valid */
  valid: boolean;
  /** Whether it's present */
  present: boolean;
  /** Error message if invalid */
  error?: string;
  /** Source (plugin name or "custom") */
  source: string;
  /** Whether to redact value in output */
  sensitive: boolean;
}

export interface HealthCheckOptions {
  /** Server schema */
  server?: StandardSchemaDictionary;
  /** Client schema */
  client?: StandardSchemaDictionary;
  /** Shared schema */
  shared?: StandardSchemaDictionary;
  /** Plugins */
  plugins?: NevrEnvPlugin[];
  /** Runtime environment source */
  runtimeEnv?: Record<string, unknown>;
  /** Variables to consider sensitive (masked in output) */
  sensitiveKeys?: string[];
  /** Include non-sensitive values in output (for debugging) */
  includeValues?: boolean;
}

/**
 * Perform a health check on environment variables
 * 
 * @example
 * ```ts
 * // In an API route
 * app.get("/health", (req, res) => {
 *   const result = healthCheck({
 *     server: envSchema.server,
 *     plugins: [postgres(), stripe()],
 *     runtimeEnv: process.env,
 *   });
 *   
 *   const statusCode = result.status === "healthy" ? 200 : 503;
 *   res.status(statusCode).json(result);
 * });
 * ```
 */
export function healthCheck(options: HealthCheckOptions): HealthCheckResult {
  const {
    server = {},
    client = {},
    shared = {},
    plugins = [],
    runtimeEnv = {},
    sensitiveKeys = [],
    includeValues = false,
  } = options;
  
  // Build combined schema
  const pluginSchemas = plugins.reduce<StandardSchemaDictionary>((acc, plugin) => {
    return { ...acc, ...plugin.schema };
  }, {});
  
  const allSchemas = {
    ...server,
    ...client,
    ...shared,
    ...pluginSchemas,
  };
  
  // Build plugin lookup
  const pluginMap = new Map<string, NevrEnvPlugin>();
  for (const plugin of plugins) {
    for (const key of Object.keys(plugin.schema)) {
      pluginMap.set(key, plugin);
    }
  }
  
  // Default sensitive patterns
  const defaultSensitivePatterns = [
    /secret/i,
    /password/i,
    /key/i,
    /token/i,
    /auth/i,
    /private/i,
  ];
  
  const isSensitive = (key: string): boolean => {
    if (sensitiveKeys.includes(key)) return true;
    
    // Check plugin sensitive settings
    const plugin = pluginMap.get(key);
    if (plugin?.sensitive === true) return true;
    if (typeof plugin?.sensitive === "object" && plugin.sensitive[key]) return true;
    
    // Check patterns
    return defaultSensitivePatterns.some(pattern => pattern.test(key));
  };
  
  // Validate each variable individually
  const results: VariableHealthResult[] = [];
  
  for (const [key, schema] of Object.entries(allSchemas)) {
    const value = runtimeEnv[key];
    const present = value !== undefined && value !== "";
    const plugin = pluginMap.get(key);
    const sensitive = isSensitive(key);
    
    // Validate this single variable
    let valid = true;
    let error: string | undefined;
    
    if (present) {
      const validationResult = schema["~standard"].validate(value);
      if ("issues" in validationResult && validationResult.issues) {
        valid = false;
        error = validationResult.issues[0]?.message ?? "Invalid value";
      }
    } else {
      // Check if it's required (no default, not optional)
      // This is a heuristic - ideally we'd check the schema
      const zodSchema = schema as { _def?: { typeName?: string } };
      const isOptional = zodSchema._def?.typeName === "ZodOptional" || 
                        zodSchema._def?.typeName === "ZodDefault";
      
      if (!isOptional) {
        valid = false;
        error = "Missing required variable";
      }
    }
    
    const result: VariableHealthResult = {
      name: key,
      valid,
      present,
      error,
      source: plugin ? plugin.name : "custom",
      sensitive,
    };
    
    // Include value if requested and not sensitive
    if (includeValues && present && !sensitive) {
      (result as VariableHealthResult & { value?: unknown }).value = value;
    }
    
    results.push(result);
  }
  
  // Calculate summary
  const summary = {
    total: results.length,
    valid: results.filter(r => r.valid).length,
    invalid: results.filter(r => !r.valid && r.present).length,
    missing: results.filter(r => !r.present && !r.valid).length,
  };
  
  // Determine overall status
  let status: "healthy" | "degraded" | "unhealthy";
  if (summary.valid === summary.total) {
    status = "healthy";
  } else if (summary.invalid > 0) {
    status = "unhealthy";
  } else {
    status = "degraded";
  }
  
  return {
    status,
    timestamp: new Date().toISOString(),
    variables: results,
    summary,
  };
}

/**
 * Create a simple health check endpoint handler
 * 
 * @example
 * ```ts
 * // Express
 * app.get("/health/env", createHealthEndpoint({ plugins: [postgres()] }));
 * 
 * // Next.js API Route
 * export const GET = createHealthEndpoint({ plugins: [postgres()] });
 * ```
 */
export function createHealthEndpoint(options: Omit<HealthCheckOptions, "runtimeEnv">): (req?: unknown, res?: { status: (code: number) => { json: (data: unknown) => void } }) => void | globalThis.Response {
  return (req?: unknown, res?: { status: (code: number) => { json: (data: unknown) => void } }): void | globalThis.Response => {
    const result = healthCheck({
      ...options,
      runtimeEnv: typeof process !== "undefined" ? process.env : {},
    });
    
    const statusCode = result.status === "healthy" ? 200 : 503;
    
    if (res) {
      // Express-style
      res.status(statusCode).json(result);
    } else {
      // Next.js/Web API style
      return new Response(JSON.stringify(result), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}
