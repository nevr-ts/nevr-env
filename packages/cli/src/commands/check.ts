/**
 * `nevr check` command
 *
 * Validates the current .env against the schema and shows a pretty diff
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  findConfigFile,
  findEnvFiles,
  parseEnvFile,
  loadConfigFile,
  extractSchemaFromConfig,
} from "../utils/config";

interface CheckOptions {
  cwd: string;
  config?: string;
}

async function checkAction(opts: CheckOptions) {
  const cwd = opts.cwd || process.cwd();

  p.intro(pc.bgCyan(pc.black(" nevr-env check ")));

  // Step 1: Find config file
  const configPath = opts.config || findConfigFile(cwd);

  if (!configPath) {
    p.log.error(
      "No configuration file found. Create one of:\n" +
        "  • nevr.config.ts\n" +
        "  • src/env.ts\n" +
        "  • Run `npx nevr-env init` to generate one"
    );
    process.exit(1);
  }

  p.log.info(`Found config: ${pc.dim(configPath)}`);

  // Step 2: Find .env files
  const envFiles = findEnvFiles(cwd);

  if (envFiles.length === 0) {
    p.log.warn("No .env files found. Run `npx nevr-env fix` to create one.");
  } else {
    p.log.info(`Found env files: ${pc.dim(envFiles.join(", "))}`);
  }

  // Step 3: Load current env values
  const currentEnv = new Map<string, string>();

  // Load in reverse order so higher priority files override
  for (const file of [...envFiles].reverse()) {
    const values = parseEnvFile(file);
    for (const [key, value] of values) {
      currentEnv.set(key, value);
    }
  }

  // Step 4: Load config and extract schema
  const s = p.spinner();
  s.start("Loading configuration...");

  let config: unknown;
  try {
    config = await loadConfigFile(configPath, { cwd });
  } catch (error) {
    s.stop("Failed to load configuration");
    p.log.error(String(error));
    process.exit(1);
  }

  s.stop("Configuration loaded");

  // Step 5: Extract required keys via metadata registry
  const schema = extractSchemaFromConfig(config);

  // Step 6: Check which keys are missing, optional, or unknown
  const missing: string[] = [];
  const optional: string[] = [];
  const present: string[] = [];
  const unknown: string[] = [];

  for (const key of schema.requiredKeys) {
    if (currentEnv.has(key)) {
      present.push(key);
    } else if (schema.optionalKeys.has(key)) {
      optional.push(key);
    } else {
      missing.push(key);
    }
  }

  for (const key of currentEnv.keys()) {
    if (!schema.requiredKeys.has(key)) {
      unknown.push(key);
    }
  }

  // Step 7: Display results
  console.log("");

  if (present.length > 0) {
    p.log.success(`${pc.green("✓")} ${present.length} variables configured`);
    for (const key of present) {
      const plugin = schema.pluginInfo.get(key);
      const source = plugin ? pc.dim(` (${plugin.name})`) : "";
      console.log(`  ${pc.green("•")} ${key}${source}`);
    }
  }

  if (missing.length > 0) {
    console.log("");
    p.log.error(`${pc.red("✗")} ${missing.length} required variables missing`);
    for (const key of missing) {
      const plugin = schema.pluginInfo.get(key);
      const source = plugin ? pc.dim(` (${plugin.name})`) : "";
      const docs = plugin?.cli?.docs ? pc.dim(` → ${plugin.cli.docs}`) : "";
      console.log(`  ${pc.red("•")} ${key}${source}${docs}`);
    }
  }

  if (optional.length > 0) {
    console.log("");
    p.log.info(`${pc.dim("○")} ${optional.length} optional variables not set`);
    for (const key of optional) {
      const plugin = schema.pluginInfo.get(key);
      const source = plugin ? pc.dim(` (${plugin.name})`) : "";
      console.log(`  ${pc.dim("○")} ${key}${source}`);
    }
  }

  if (unknown.length > 0) {
    console.log("");
    p.log.warn(`${pc.yellow("?")} ${unknown.length} unknown variables in .env`);
    for (const key of unknown) {
      console.log(`  ${pc.yellow("•")} ${key}`);
    }
  }

  console.log("");

  // Step 8: Summary — only fail on truly required missing vars
  if (missing.length === 0) {
    p.outro(pc.green("✅ All required environment variables are configured!"));
    process.exit(0);
  } else {
    p.outro(
      pc.yellow(`Run ${pc.bold("npx nevr-env fix")} to configure missing variables`)
    );
    process.exit(1);
  }
}

export const check = new Command("check")
  .description("Validate environment variables against the schema")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("-c, --config <path>", "Path to config file")
  .action(checkAction);

export default check;
