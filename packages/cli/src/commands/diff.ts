/**
 * `nevr diff` command
 *
 * Compare environment schemas between two config files or branches.
 * Shows added, removed, and changed variables.
 *
 * @example
 * ```bash
 * nevr diff --from ./old-env.ts --to ./src/env.ts
 * nevr diff --format json
 * ```
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  findConfigFile,
  loadConfigFile,
  extractSchemaFromConfig,
} from "../utils/config";
import { loadCore } from "../utils/core-loader";

interface DiffOptions {
  from?: string;
  to?: string;
  format?: "text" | "json" | "markdown";
  cwd?: string;
}

async function diffAction(opts: DiffOptions): Promise<void> {
  const cwd = opts.cwd || process.cwd();
  const format = opts.format || "text";

  if (format === "text") {
    console.log("");
    p.intro(pc.bgBlue(pc.white(" 🔀 nevr-env diff ")));
  }

  // Load "from" config
  const fromPath = opts.from || findConfigFile(cwd);
  if (!fromPath) {
    p.log.error("No config found. Use --from to specify the source config.");
    process.exit(1);
  }

  const toPath = opts.to || findConfigFile(cwd);
  if (!toPath) {
    p.log.error("No config found. Use --to to specify the target config.");
    process.exit(1);
  }

  if (fromPath === toPath && !opts.from && !opts.to) {
    p.log.warn("Both --from and --to resolve to the same file. Specify both explicitly.");
    process.exit(0);
  }

  let core;
  try {
    core = await loadCore();
  } catch {
    p.log.error("Failed to load @nevr-env/core. Make sure it's installed.");
    process.exit(1);
  }

  const s = format === "text" ? p.spinner() : null;
  s?.start("Loading configurations...");

  let fromConfig: unknown;
  let toConfig: unknown;

  try {
    fromConfig = await loadConfigFile(fromPath, { cwd });
    toConfig = await loadConfigFile(toPath, { cwd });
  } catch (error) {
    s?.stop("Failed to load configurations");
    p.log.error(String(error));
    process.exit(1);
  }

  s?.stop("Configurations loaded");

  const fromSchema = extractSchemaFromConfig(fromConfig);
  const toSchema = extractSchemaFromConfig(toConfig);

  // Flatten all schemas (server + client + shared + plugin) into single dicts
  const flattenSchemas = (s: typeof fromSchema) => {
    const flat: Record<string, unknown> = {};
    for (const dict of [s.schemas.server, s.schemas.client, s.schemas.shared]) {
      Object.assign(flat, dict);
    }
    // Include plugin schemas
    for (const plugin of s.plugins) {
      if (plugin.schema) {
        Object.assign(flat, plugin.schema);
      }
    }
    return flat;
  };

  const result = core.diffSchemas(flattenSchemas(fromSchema), flattenSchemas(toSchema));

  if (format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (format === "markdown") {
    const guide = core.generateMigrationGuide(result);
    console.log(guide);
    return;
  }

  // Text format
  console.log("");

  const added = result.added || [];
  const removed = result.removed || [];
  const changed = result.changed || [];
  const renamed = result.renamed || [];

  if (renamed.length > 0) {
    p.log.info(`${pc.cyan("→")} ${renamed.length} variable(s) renamed`);
    for (const r of renamed) {
      console.log(`  ${pc.cyan("→")} ${r.from} → ${r.to} ${pc.dim(`(${Math.round(r.confidence * 100)}% match)`)}`);
    }
  }

  if (added.length > 0) {
    if (renamed.length > 0) console.log("");
    p.log.success(`${pc.green("+")} ${added.length} variable(s) added`);
    for (const v of added) {
      console.log(`  ${pc.green("+")} ${v.key}`);
    }
  }

  if (removed.length > 0) {
    console.log("");
    p.log.error(`${pc.red("-")} ${removed.length} variable(s) removed`);
    for (const v of removed) {
      console.log(`  ${pc.red("-")} ${v.key}`);
    }
  }

  if (changed.length > 0) {
    console.log("");
    p.log.warn(`${pc.yellow("~")} ${changed.length} variable(s) changed`);
    for (const v of changed) {
      console.log(`  ${pc.yellow("~")} ${v.key}`);
    }
  }

  if (added.length === 0 && removed.length === 0 && changed.length === 0 && renamed.length === 0) {
    p.log.success("No differences found.");
  }

  const hasBreaking = result.isBreaking;

  console.log("");
  if (hasBreaking) {
    p.outro(pc.red("Breaking changes detected!"));
    process.exit(1);
  } else {
    p.outro(pc.green("✅ Diff complete."));
  }
}

export const diff = new Command("diff")
  .description("Compare environment schemas between configs")
  .option("--from <path>", "Source config file")
  .option("--to <path>", "Target config file")
  .option("-f, --format <format>", "Output format (text, json, markdown)", "text")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(diffAction);

export default diff;
