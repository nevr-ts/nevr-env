/**
 * Generate .env.example from schema
 * 
 * This utility creates a documented .env.example file from your nevr-env configuration
 */

import type { StandardSchemaDictionary, StandardSchemaV1 } from "./standard";
import type { NevrEnvPlugin } from "./types/plugin";

interface GenerateExampleOptions {
  /** Server schema */
  server?: StandardSchemaDictionary;
  /** Client schema */
  client?: StandardSchemaDictionary;
  /** Shared schema */
  shared?: StandardSchemaDictionary;
  /** Plugins */
  plugins?: NevrEnvPlugin[];
  /** Include comments/documentation */
  includeComments?: boolean;
  /** Include example values */
  includeExamples?: boolean;
  /** Group by plugin */
  groupByPlugin?: boolean;
}

interface EnvVariable {
  key: string;
  required: boolean;
  type: string;
  description?: string;
  example?: string;
  source: "server" | "client" | "shared" | string;
  sensitive?: boolean;
}

/**
 * Infer type information from a Zod-like schema
 */
function inferTypeInfo(schema: StandardSchemaV1): { type: string; required: boolean; example?: string } {
  const standard = schema["~standard"];
  
  // Try to get type info from ~standard.types
  let type = "string";
  let required = true;
  let example: string | undefined;
  
  // Check for Zod-specific patterns
  const zodSchema = schema as { _def?: { typeName?: string; innerType?: unknown; checks?: Array<{ kind: string; value?: unknown }> } };
  
  if (zodSchema._def) {
    const typeName = zodSchema._def.typeName;
    
    switch (typeName) {
      case "ZodString":
        type = "string";
        // Check for URL, email, etc.
        if (zodSchema._def.checks) {
          for (const check of zodSchema._def.checks) {
            if (check.kind === "url") {
              type = "url";
              example = "https://example.com";
            } else if (check.kind === "email") {
              type = "email";
              example = "user@example.com";
            }
          }
        }
        break;
      case "ZodNumber":
        type = "number";
        example = "3000";
        break;
      case "ZodBoolean":
        type = "boolean";
        example = "true";
        break;
      case "ZodEnum":
        const enumValues = (zodSchema as { _def: { values: string[] } })._def.values;
        type = enumValues ? enumValues.join(" | ") : "enum";
        example = enumValues?.[0];
        break;
      case "ZodOptional":
        required = false;
        break;
      case "ZodDefault":
        required = false;
        break;
    }
  }
  
  return { type, required, example };
}

/**
 * Extract variables from a schema dictionary
 */
function extractVariables(
  schema: StandardSchemaDictionary,
  source: string,
  plugins?: NevrEnvPlugin[]
): EnvVariable[] {
  const variables: EnvVariable[] = [];
  const pluginMap = new Map<string, NevrEnvPlugin>();
  
  // Build plugin lookup
  if (plugins) {
    for (const plugin of plugins) {
      for (const key of Object.keys(plugin.schema)) {
        pluginMap.set(key, plugin);
      }
    }
  }
  
  for (const [key, value] of Object.entries(schema)) {
    const { type, required, example } = inferTypeInfo(value);
    const plugin = pluginMap.get(key);
    
    variables.push({
      key,
      required,
      type,
      example,
      source: plugin ? `plugin:${plugin.id}` : source,
      sensitive: plugin?.sensitive === true || 
        (typeof plugin?.sensitive === "object" && plugin.sensitive[key]) ||
        key.toLowerCase().includes("secret") ||
        key.toLowerCase().includes("key") ||
        key.toLowerCase().includes("password") ||
        key.toLowerCase().includes("token"),
    });
  }
  
  return variables;
}

/**
 * Generate .env.example content
 */
export function generateEnvExample(options: GenerateExampleOptions): string {
  const {
    server = {},
    client = {},
    shared = {},
    plugins = [],
    includeComments = true,
    includeExamples = true,
    groupByPlugin = true,
  } = options;
  
  // Merge plugin schemas
  const pluginSchemas = plugins.reduce<StandardSchemaDictionary>((acc, plugin) => {
    return { ...acc, ...plugin.schema };
  }, {});
  
  // Extract all variables
  const serverVars = extractVariables(server, "server", plugins);
  const clientVars = extractVariables(client, "client", plugins);
  const sharedVars = extractVariables(shared, "shared", plugins);
  const pluginVars = extractVariables(pluginSchemas, "plugin", plugins);
  
  // Combine and dedupe
  const allVarsMap = new Map<string, EnvVariable>();
  for (const v of [...serverVars, ...clientVars, ...sharedVars, ...pluginVars]) {
    if (!allVarsMap.has(v.key)) {
      allVarsMap.set(v.key, v);
    }
  }
  
  const allVars = Array.from(allVarsMap.values());
  
  // Group variables
  const groups: Map<string, EnvVariable[]> = new Map();
  
  if (groupByPlugin) {
    for (const v of allVars) {
      const group = v.source.startsWith("plugin:") ? v.source : v.source;
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(v);
    }
  } else {
    groups.set("all", allVars);
  }
  
  // Generate output
  const lines: string[] = [];
  
  lines.push("# Environment Variables");
  lines.push("# Generated by nevr-env");
  lines.push(`# ${new Date().toISOString()}`);
  lines.push("");
  
  for (const [groupName, vars] of groups) {
    if (groupByPlugin && groupName !== "all") {
      lines.push(`# ============================================`);
      lines.push(`# ${groupName.replace("plugin:", "").toUpperCase()}`);
      lines.push(`# ============================================`);
      lines.push("");
    }
    
    for (const v of vars) {
      if (includeComments) {
        lines.push(`# ${v.key}`);
        lines.push(`# Type: ${v.type}`);
        lines.push(`# Required: ${v.required ? "Yes" : "No"}`);
        if (v.sensitive) {
          lines.push(`# ⚠️ SENSITIVE - Do not commit actual values`);
        }
      }
      
      const value = includeExamples && v.example 
        ? v.sensitive ? "your-secret-here" : v.example
        : "";
      
      lines.push(`${v.key}=${value}`);
      lines.push("");
    }
  }
  
  return lines.join("\n");
}

/**
 * Get schema info for documentation
 */
export function getSchemaInfo(options: GenerateExampleOptions): EnvVariable[] {
  const {
    server = {},
    client = {},
    shared = {},
    plugins = [],
  } = options;
  
  const pluginSchemas = plugins.reduce<StandardSchemaDictionary>((acc, plugin) => {
    return { ...acc, ...plugin.schema };
  }, {});
  
  const serverVars = extractVariables(server, "server", plugins);
  const clientVars = extractVariables(client, "client", plugins);
  const sharedVars = extractVariables(shared, "shared", plugins);
  const pluginVars = extractVariables(pluginSchemas, "plugin", plugins);
  
  const allVarsMap = new Map<string, EnvVariable>();
  for (const v of [...serverVars, ...clientVars, ...sharedVars, ...pluginVars]) {
    if (!allVarsMap.has(v.key)) {
      allVarsMap.set(v.key, v);
    }
  }
  
  return Array.from(allVarsMap.values());
}
