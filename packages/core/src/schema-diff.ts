/**
 * Schema Diffing Utilities
 * 
 * Compare env schemas between versions to detect breaking changes,
 * generate migration guides, and track schema evolution.
 */

import type { StandardSchemaDictionary, StandardSchemaV1 } from "./standard";
import type { NevrEnvPlugin } from "./types/plugin";

export interface SchemaDiff {
  /** Variables added */
  added: VariableChange[];
  /** Variables removed */
  removed: VariableChange[];
  /** Variables with changed types/constraints */
  changed: VariableChange[];
  /** Variables renamed (detected by similarity) */
  renamed: { from: string; to: string; confidence: number }[];
  /** Whether this is a breaking change */
  isBreaking: boolean;
  /** Summary of changes */
  summary: string;
}

export interface VariableChange {
  /** Variable name */
  key: string;
  /** Previous type info */
  oldType?: TypeInfo;
  /** New type info */
  newType?: TypeInfo;
  /** Whether this is breaking */
  breaking: boolean;
  /** Reason for breaking */
  breakingReason?: string;
}

export interface TypeInfo {
  /** Base type (string, number, etc.) */
  type: string;
  /** Whether it's optional */
  optional: boolean;
  /** Whether it has a default */
  hasDefault: boolean;
  /** Enum values if applicable */
  enumValues?: string[];
  /** Min length/value */
  min?: number;
  /** Max length/value */
  max?: number;
  /** Pattern/format */
  format?: string;
}

export interface DiffOptions {
  /** Detect potential renames */
  detectRenames?: boolean;
  /** Minimum similarity for rename detection (0-1) */
  renameSimilarityThreshold?: number;
  /** Consider adding required vars as breaking */
  newRequiredIsBreaking?: boolean;
}

/**
 * Extract type info from a Zod-like schema
 */
function extractTypeInfo(schema: StandardSchemaV1): TypeInfo {
  const info: TypeInfo = {
    type: "unknown",
    optional: false,
    hasDefault: false,
  };
  
  // Try to extract Zod-specific info
  const zodSchema = schema as {
    _def?: {
      typeName?: string;
      innerType?: StandardSchemaV1;
      defaultValue?: () => unknown;
      values?: string[];
      checks?: Array<{ kind: string; value?: unknown }>;
    };
  };
  
  if (!zodSchema._def) {
    return info;
  }
  
  const def = zodSchema._def;
  
  // Handle wrapper types
  if (def.typeName === "ZodOptional") {
    info.optional = true;
    if (def.innerType) {
      const inner = extractTypeInfo(def.innerType);
      return { ...inner, optional: true };
    }
  }
  
  if (def.typeName === "ZodDefault") {
    info.hasDefault = true;
    info.optional = true; // Default implies optional
    if (def.innerType) {
      const inner = extractTypeInfo(def.innerType);
      return { ...inner, hasDefault: true, optional: true };
    }
  }
  
  // Base types
  switch (def.typeName) {
    case "ZodString":
      info.type = "string";
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === "min") info.min = check.value as number;
          if (check.kind === "max") info.max = check.value as number;
          if (check.kind === "url") info.format = "url";
          if (check.kind === "email") info.format = "email";
          if (check.kind === "uuid") info.format = "uuid";
        }
      }
      break;
    case "ZodNumber":
      info.type = "number";
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === "min") info.min = check.value as number;
          if (check.kind === "max") info.max = check.value as number;
          if (check.kind === "int") info.format = "integer";
        }
      }
      break;
    case "ZodBoolean":
      info.type = "boolean";
      break;
    case "ZodEnum":
      info.type = "enum";
      info.enumValues = def.values;
      break;
    case "ZodLiteral":
      info.type = "literal";
      break;
  }
  
  return info;
}

/**
 * Calculate string similarity (Levenshtein-based)
 */
function calculateSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Check if a type change is breaking
 */
function isBreakingTypeChange(
  oldType: TypeInfo,
  newType: TypeInfo
): { breaking: boolean; reason?: string } {
  // Optional became required
  if (oldType.optional && !newType.optional && !newType.hasDefault) {
    return { breaking: true, reason: "Variable became required" };
  }
  
  // Type changed
  if (oldType.type !== newType.type) {
    return { breaking: true, reason: `Type changed from ${oldType.type} to ${newType.type}` };
  }
  
  // Enum values removed
  if (oldType.enumValues && newType.enumValues) {
    const removed = oldType.enumValues.filter(
      (v) => !newType.enumValues!.includes(v)
    );
    if (removed.length > 0) {
      return { breaking: true, reason: `Enum values removed: ${removed.join(", ")}` };
    }
  }
  
  // Constraints became stricter
  if (newType.min !== undefined && oldType.min !== undefined && newType.min > oldType.min) {
    return { breaking: true, reason: `Minimum constraint increased from ${oldType.min} to ${newType.min}` };
  }
  
  if (newType.max !== undefined && oldType.max !== undefined && newType.max < oldType.max) {
    return { breaking: true, reason: `Maximum constraint decreased from ${oldType.max} to ${newType.max}` };
  }
  
  return { breaking: false };
}

/**
 * Compare two schemas and return the differences
 * 
 * @example
 * ```ts
 * import { diffSchemas } from "nevr-env";
 * 
 * const oldSchema = { DATABASE_URL: z.string().url() };
 * const newSchema = { 
 *   DATABASE_URL: z.string().url(),
 *   REDIS_URL: z.string().url(),  // Added
 * };
 * 
 * const diff = diffSchemas(oldSchema, newSchema);
 * console.log(diff.summary);
 * // "Added 1 variable, removed 0, changed 0. Not a breaking change."
 * ```
 */
export function diffSchemas(
  oldSchema: StandardSchemaDictionary,
  newSchema: StandardSchemaDictionary,
  options: DiffOptions = {}
): SchemaDiff {
  const {
    detectRenames = true,
    renameSimilarityThreshold = 0.7,
    newRequiredIsBreaking = true,
  } = options;
  
  const oldKeys = new Set(Object.keys(oldSchema));
  const newKeys = new Set(Object.keys(newSchema));
  
  const added: VariableChange[] = [];
  const removed: VariableChange[] = [];
  const changed: VariableChange[] = [];
  const renamed: SchemaDiff["renamed"] = [];
  
  // Find removed keys
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      const oldType = extractTypeInfo(oldSchema[key]);
      removed.push({
        key,
        oldType,
        breaking: !oldType.optional,
        breakingReason: oldType.optional ? undefined : "Required variable removed",
      });
    }
  }
  
  // Find added keys
  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      const newType = extractTypeInfo(newSchema[key]);
      const isRequired = !newType.optional && !newType.hasDefault;
      added.push({
        key,
        newType,
        breaking: newRequiredIsBreaking && isRequired,
        breakingReason: isRequired ? "New required variable added" : undefined,
      });
    }
  }
  
  // Detect renames (removed + added with similar names)
  if (detectRenames && removed.length > 0 && added.length > 0) {
    for (const rem of [...removed]) {
      for (const add of [...added]) {
        const similarity = calculateSimilarity(
          rem.key.toLowerCase(),
          add.key.toLowerCase()
        );
        
        if (similarity >= renameSimilarityThreshold) {
          renamed.push({
            from: rem.key,
            to: add.key,
            confidence: similarity,
          });
          
          // Remove from added/removed lists
          removed.splice(removed.indexOf(rem), 1);
          added.splice(added.indexOf(add), 1);
          break;
        }
      }
    }
  }
  
  // Find changed keys
  for (const key of oldKeys) {
    if (newKeys.has(key)) {
      const oldType = extractTypeInfo(oldSchema[key]);
      const newType = extractTypeInfo(newSchema[key]);
      
      const { breaking, reason } = isBreakingTypeChange(oldType, newType);
      
      // Check if there's actually a change
      const hasChange = 
        oldType.type !== newType.type ||
        oldType.optional !== newType.optional ||
        oldType.hasDefault !== newType.hasDefault ||
        JSON.stringify(oldType.enumValues) !== JSON.stringify(newType.enumValues) ||
        oldType.min !== newType.min ||
        oldType.max !== newType.max ||
        oldType.format !== newType.format;
      
      if (hasChange) {
        changed.push({
          key,
          oldType,
          newType,
          breaking,
          breakingReason: reason,
        });
      }
    }
  }
  
  // Determine if breaking
  const isBreaking = 
    removed.some((r) => r.breaking) ||
    added.some((a) => a.breaking) ||
    changed.some((c) => c.breaking) ||
    renamed.length > 0;
  
  // Generate summary
  const parts: string[] = [];
  if (added.length > 0) parts.push(`Added ${added.length} variable(s)`);
  if (removed.length > 0) parts.push(`Removed ${removed.length} variable(s)`);
  if (changed.length > 0) parts.push(`Changed ${changed.length} variable(s)`);
  if (renamed.length > 0) parts.push(`Renamed ${renamed.length} variable(s)`);
  
  const summary = parts.length > 0
    ? `${parts.join(", ")}. ${isBreaking ? "⚠️ BREAKING CHANGE" : "Not a breaking change"}.`
    : "No changes detected.";
  
  return {
    added,
    removed,
    changed,
    renamed,
    isBreaking,
    summary,
  };
}

/**
 * Generate a migration guide from schema diff
 */
export function generateMigrationGuide(diff: SchemaDiff): string {
  const lines: string[] = [];
  
  lines.push("# Environment Migration Guide");
  lines.push("");
  lines.push(`**Status:** ${diff.isBreaking ? "⚠️ Breaking Change" : "✅ Non-breaking"}`);
  lines.push("");
  
  if (diff.renamed.length > 0) {
    lines.push("## Renamed Variables");
    lines.push("");
    for (const rename of diff.renamed) {
      lines.push(`- \`${rename.from}\` → \`${rename.to}\` (${Math.round(rename.confidence * 100)}% confidence)`);
    }
    lines.push("");
  }
  
  if (diff.added.length > 0) {
    lines.push("## New Variables");
    lines.push("");
    for (const add of diff.added) {
      const required = add.breaking ? " **(required)**" : " (optional)";
      lines.push(`- \`${add.key}\`${required}`);
      if (add.newType) {
        lines.push(`  - Type: ${add.newType.type}`);
        if (add.newType.format) lines.push(`  - Format: ${add.newType.format}`);
      }
    }
    lines.push("");
  }
  
  if (diff.removed.length > 0) {
    lines.push("## Removed Variables");
    lines.push("");
    for (const rem of diff.removed) {
      const breaking = rem.breaking ? " ⚠️" : "";
      lines.push(`- \`${rem.key}\`${breaking}`);
    }
    lines.push("");
  }
  
  if (diff.changed.length > 0) {
    lines.push("## Changed Variables");
    lines.push("");
    for (const change of diff.changed) {
      lines.push(`### \`${change.key}\`${change.breaking ? " ⚠️" : ""}`);
      if (change.breakingReason) {
        lines.push(`> ${change.breakingReason}`);
      }
      lines.push("");
      if (change.oldType && change.newType) {
        lines.push("| Property | Before | After |");
        lines.push("|----------|--------|-------|");
        lines.push(`| Type | ${change.oldType.type} | ${change.newType.type} |`);
        lines.push(`| Optional | ${change.oldType.optional} | ${change.newType.optional} |`);
        lines.push(`| Has Default | ${change.oldType.hasDefault} | ${change.newType.hasDefault} |`);
      }
      lines.push("");
    }
  }
  
  if (!diff.isBreaking && diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
    lines.push("No migration needed. Schemas are identical.");
  }
  
  return lines.join("\n");
}

/**
 * Compare two sets of plugins and return schema diff
 */
export function diffPlugins(
  oldPlugins: NevrEnvPlugin[],
  newPlugins: NevrEnvPlugin[]
): SchemaDiff {
  const oldSchema = oldPlugins.reduce<StandardSchemaDictionary>((acc, p) => {
    return { ...acc, ...p.schema };
  }, {});
  
  const newSchema = newPlugins.reduce<StandardSchemaDictionary>((acc, p) => {
    return { ...acc, ...p.schema };
  }, {});
  
  return diffSchemas(oldSchema, newSchema);
}
