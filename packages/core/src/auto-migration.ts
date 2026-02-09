/**
 * Auto-Migration
 * 
 * Automatically rename/transform environment variables during schema changes.
 * Provides safe, reversible migrations with rollback support.
 */

import type { StandardSchemaV1, StandardSchemaDictionary } from "./standard";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { join } from "path";

/**
 * Migration rule definition
 */
export interface MigrationRule {
  /** Rule ID for tracking */
  id: string;
  /** Human-readable description */
  description: string;
  /** Rule type */
  type: "rename" | "transform" | "split" | "merge" | "delete" | "add";
  /** Source variable(s) */
  from?: string | string[];
  /** Target variable(s) */
  to?: string | string[];
  /** Transform function for complex migrations */
  transform?: (value: string, allVars: Record<string, string>) => string | Record<string, string>;
  /** Default value for new variables */
  defaultValue?: string | (() => string);
  /** Whether this is a breaking change */
  breaking?: boolean;
  /** Condition to apply rule */
  condition?: (vars: Record<string, string>) => boolean;
}

/**
 * Migration plan
 */
export interface MigrationPlan {
  /** Unique plan ID */
  id: string;
  /** From version/schema */
  fromVersion: string;
  /** To version/schema */
  toVersion: string;
  /** Migration rules to apply */
  rules: MigrationRule[];
  /** Created timestamp */
  createdAt: string;
  /** Whether plan has breaking changes */
  hasBreakingChanges: boolean;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  applied: number;
  skipped: number;
  errors: Array<{ rule: string; error: string }>;
  changes: Array<{
    rule: string;
    type: MigrationRule["type"];
    from?: Record<string, string>;
    to?: Record<string, string>;
  }>;
  backup?: string;
}

/**
 * Create a rename migration rule
 */
export function renameVar(
  from: string,
  to: string,
  options?: { description?: string; breaking?: boolean }
): MigrationRule {
  return {
    id: `rename_${from}_to_${to}`,
    description: options?.description ?? `Rename ${from} to ${to}`,
    type: "rename",
    from,
    to,
    breaking: options?.breaking ?? false,
  };
}

/**
 * Create a transform migration rule
 */
export function transformVar(
  variable: string,
  transform: (value: string) => string,
  options?: { description?: string; id?: string }
): MigrationRule {
  return {
    id: options?.id ?? `transform_${variable}`,
    description: options?.description ?? `Transform ${variable}`,
    type: "transform",
    from: variable,
    to: variable,
    transform,
  };
}

/**
 * Create a split migration rule (one var -> multiple vars)
 */
export function splitVar(
  from: string,
  to: string[],
  splitter: (value: string) => Record<string, string>,
  options?: { description?: string }
): MigrationRule {
  return {
    id: `split_${from}`,
    description: options?.description ?? `Split ${from} into ${to.join(", ")}`,
    type: "split",
    from,
    to,
    transform: splitter,
  };
}

/**
 * Create a merge migration rule (multiple vars -> one var)
 */
export function mergeVars(
  from: string[],
  to: string,
  merger: (values: Record<string, string>) => string,
  options?: { description?: string }
): MigrationRule {
  return {
    id: `merge_to_${to}`,
    description: options?.description ?? `Merge ${from.join(", ")} into ${to}`,
    type: "merge",
    from,
    to,
    transform: (_, all) => {
      const picked: Record<string, string> = {};
      for (const key of from) {
        if (all[key]) picked[key] = all[key];
      }
      return merger(picked);
    },
  };
}

/**
 * Create a delete migration rule
 */
export function deleteVar(
  variable: string,
  options?: { description?: string; breaking?: boolean }
): MigrationRule {
  return {
    id: `delete_${variable}`,
    description: options?.description ?? `Delete ${variable}`,
    type: "delete",
    from: variable,
    breaking: options?.breaking ?? true,
  };
}

/**
 * Create an add migration rule
 */
export function addVar(
  variable: string,
  defaultValue: string | (() => string),
  options?: { description?: string; condition?: MigrationRule["condition"] }
): MigrationRule {
  return {
    id: `add_${variable}`,
    description: options?.description ?? `Add ${variable}`,
    type: "add",
    to: variable,
    defaultValue,
    condition: options?.condition,
  };
}

/**
 * Parse .env file content
 */
function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Stringify env vars to .env format
 */
function stringifyEnvContent(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([key, value]) => {
      // Quote values with spaces or special chars
      if (/[\s"'#]/.test(value)) {
        return `${key}="${value.replace(/"/g, '\\"')}"`;
      }
      return `${key}=${value}`;
    })
    .join("\n");
}

/**
 * Create a migration plan
 */
export function createMigrationPlan(
  rules: MigrationRule[],
  options?: { fromVersion?: string; toVersion?: string }
): MigrationPlan {
  return {
    id: `migration_${Date.now()}`,
    fromVersion: options?.fromVersion ?? "unknown",
    toVersion: options?.toVersion ?? "unknown",
    rules,
    createdAt: new Date().toISOString(),
    hasBreakingChanges: rules.some(r => r.breaking),
  };
}

/**
 * Preview migration without applying
 */
export function previewMigration(
  plan: MigrationPlan,
  envContent: string | Record<string, string>
): MigrationResult {
  const vars = typeof envContent === "string" ? parseEnvContent(envContent) : { ...envContent };
  return applyRules(plan.rules, vars, true);
}

/**
 * Apply migration rules to env vars
 */
function applyRules(
  rules: MigrationRule[],
  vars: Record<string, string>,
  dryRun: boolean = false
): MigrationResult {
  const result: MigrationResult = {
    success: true,
    applied: 0,
    skipped: 0,
    errors: [],
    changes: [],
  };

  const workingVars = dryRun ? { ...vars } : vars;

  for (const rule of rules) {
    try {
      // Check condition
      if (rule.condition && !rule.condition(workingVars)) {
        result.skipped++;
        continue;
      }

      switch (rule.type) {
        case "rename": {
          const from = rule.from as string;
          const to = rule.to as string;
          if (workingVars[from] !== undefined) {
            result.changes.push({
              rule: rule.id,
              type: "rename",
              from: { [from]: workingVars[from] },
              to: { [to]: workingVars[from] },
            });
            workingVars[to] = workingVars[from];
            delete workingVars[from];
            result.applied++;
          } else {
            result.skipped++;
          }
          break;
        }

        case "transform": {
          const key = rule.from as string;
          if (workingVars[key] !== undefined && rule.transform) {
            const oldValue = workingVars[key];
            const newValue = rule.transform(oldValue, workingVars);
            if (typeof newValue === "string") {
              result.changes.push({
                rule: rule.id,
                type: "transform",
                from: { [key]: oldValue },
                to: { [key]: newValue },
              });
              workingVars[key] = newValue;
              result.applied++;
            }
          } else {
            result.skipped++;
          }
          break;
        }

        case "split": {
          const from = rule.from as string;
          if (workingVars[from] !== undefined && rule.transform) {
            const splitResult = rule.transform(workingVars[from], workingVars);
            if (typeof splitResult === "object") {
              result.changes.push({
                rule: rule.id,
                type: "split",
                from: { [from]: workingVars[from] },
                to: splitResult,
              });
              Object.assign(workingVars, splitResult);
              delete workingVars[from];
              result.applied++;
            }
          } else {
            result.skipped++;
          }
          break;
        }

        case "merge": {
          const fromKeys = rule.from as string[];
          const toKey = rule.to as string;
          if (fromKeys.every(k => workingVars[k] !== undefined) && rule.transform) {
            const fromValues: Record<string, string> = {};
            for (const k of fromKeys) {
              fromValues[k] = workingVars[k];
            }
            const merged = rule.transform("", workingVars);
            if (typeof merged === "string") {
              result.changes.push({
                rule: rule.id,
                type: "merge",
                from: fromValues,
                to: { [toKey]: merged },
              });
              workingVars[toKey] = merged;
              for (const k of fromKeys) {
                delete workingVars[k];
              }
              result.applied++;
            }
          } else {
            result.skipped++;
          }
          break;
        }

        case "delete": {
          const key = rule.from as string;
          if (workingVars[key] !== undefined) {
            result.changes.push({
              rule: rule.id,
              type: "delete",
              from: { [key]: workingVars[key] },
            });
            delete workingVars[key];
            result.applied++;
          } else {
            result.skipped++;
          }
          break;
        }

        case "add": {
          const key = rule.to as string;
          if (workingVars[key] === undefined) {
            const value = typeof rule.defaultValue === "function"
              ? rule.defaultValue()
              : rule.defaultValue ?? "";
            result.changes.push({
              rule: rule.id,
              type: "add",
              to: { [key]: value },
            });
            workingVars[key] = value;
            result.applied++;
          } else {
            result.skipped++;
          }
          break;
        }
      }
    } catch (error) {
      result.errors.push({
        rule: rule.id,
        error: error instanceof Error ? error.message : String(error),
      });
      result.success = false;
    }
  }

  return result;
}

/**
 * Apply migration to a .env file
 */
export function migrate(
  plan: MigrationPlan,
  options?: {
    envPath?: string;
    backup?: boolean;
    dryRun?: boolean;
  }
): MigrationResult {
  const envPath = options?.envPath ?? ".env";
  const backup = options?.backup ?? true;
  const dryRun = options?.dryRun ?? false;

  if (!existsSync(envPath)) {
    return {
      success: false,
      applied: 0,
      skipped: 0,
      errors: [{ rule: "init", error: `File not found: ${envPath}` }],
      changes: [],
    };
  }

  // Read current content
  const content = readFileSync(envPath, "utf8");
  const vars = parseEnvContent(content);

  // Create backup
  let backupPath: string | undefined;
  if (backup && !dryRun) {
    backupPath = `${envPath}.backup.${Date.now()}`;
    copyFileSync(envPath, backupPath);
  }

  // Apply rules
  const result = applyRules(plan.rules, vars, dryRun);
  result.backup = backupPath;

  // Write result
  if (!dryRun && result.success) {
    const newContent = stringifyEnvContent(vars);
    writeFileSync(envPath, newContent);
  }

  return result;
}

/**
 * Rollback a migration using backup
 */
export function rollback(backupPath: string, targetPath?: string): boolean {
  if (!existsSync(backupPath)) {
    return false;
  }

  const target = targetPath ?? backupPath.replace(/\.backup\.\d+$/, "");
  copyFileSync(backupPath, target);
  return true;
}

/**
 * Generate migration plan from schema diff
 */
export function generateMigrationFromDiff(
  oldSchema: StandardSchemaDictionary,
  newSchema: StandardSchemaDictionary,
  options?: {
    renameMap?: Record<string, string>;
    defaultValues?: Record<string, string>;
  }
): MigrationPlan {
  const rules: MigrationRule[] = [];
  const renameMap = options?.renameMap ?? {};
  const defaultValues = options?.defaultValues ?? {};

  const oldKeys = new Set(Object.keys(oldSchema));
  const newKeys = new Set(Object.keys(newSchema));

  // Handle renames
  for (const [from, to] of Object.entries(renameMap)) {
    if (oldKeys.has(from) && newKeys.has(to)) {
      rules.push(renameVar(from, to));
      oldKeys.delete(from);
      newKeys.delete(to);
    }
  }

  // Handle deletions (remaining old keys not in new)
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      rules.push(deleteVar(key, { breaking: true }));
    }
  }

  // Handle additions (remaining new keys not in old)
  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      const defaultVal = defaultValues[key] ?? "";
      rules.push(addVar(key, defaultVal));
    }
  }

  return createMigrationPlan(rules, {
    fromVersion: "old",
    toVersion: "new",
  });
}

/**
 * Common migration patterns
 */
export const patterns = {
  /** Rename with prefix */
  addPrefix: (prefix: string, variables: string[]) =>
    variables.map(v => renameVar(v, `${prefix}${v}`)),

  /** Rename with suffix */
  addSuffix: (suffix: string, variables: string[]) =>
    variables.map(v => renameVar(v, `${v}${suffix}`)),

  /** Remove prefix */
  removePrefix: (prefix: string, variables: string[]) =>
    variables.map(v => renameVar(v, v.replace(new RegExp(`^${prefix}`), ""))),

  /** Convert to uppercase */
  toUpperCase: (variables: string[]) =>
    variables.map(v =>
      transformVar(v, val => val.toUpperCase(), { id: `uppercase_${v}` })
    ),

  /** Parse URL into components */
  parseUrl: (urlVar: string, components: string[]) =>
    splitVar(urlVar, components, (url) => {
      try {
        const parsed = new URL(url);
        const result: Record<string, string> = {};
        if (components.includes("host")) result.host = parsed.hostname;
        if (components.includes("port")) result.port = parsed.port;
        if (components.includes("protocol")) result.protocol = parsed.protocol.replace(":", "");
        if (components.includes("path")) result.path = parsed.pathname;
        if (components.includes("username")) result.username = parsed.username;
        if (components.includes("password")) result.password = parsed.password;
        return result;
      } catch {
        return {};
      }
    }),

  /** Combine URL components */
  buildUrl: (components: string[], urlVar: string) =>
    mergeVars(components, urlVar, (vals) => {
      const protocol = vals.protocol || "https";
      const host = vals.host || "localhost";
      const port = vals.port ? `:${vals.port}` : "";
      const path = vals.path || "";
      return `${protocol}://${host}${port}${path}`;
    }),
};
