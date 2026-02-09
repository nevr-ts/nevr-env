/**
 * `nevr fix` command - THE WIZARD
 *
 * Interactive fixer that helps configure missing environment variables
 * with auto-discovery, prompts, and documentation links
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { join } from "path";
import {
  findConfigFile,
  findEnvFiles,
  parseEnvFile,
  setEnvVariable,
  loadConfigFile,
  extractSchemaFromConfig,
  type ExtractedSchema,
} from "../utils/config";

interface FixOptions {
  cwd: string;
  config?: string;
  envFile?: string;
  yes?: boolean;
}

interface DiscoveryResult {
  value: string;
  source: string;
  confidence: number;
  description?: string;
}

interface MissingVariable {
  key: string;
  plugin?: ExtractedSchema["plugins"][number];
  discoveries?: DiscoveryResult[];
}

async function fixAction(opts: FixOptions) {
  const cwd = opts.cwd || process.cwd();

  if (!process.stdout.isTTY) {
    console.error("Error: `nevr-env fix` requires an interactive terminal.");
    console.error("Run this command directly in your terminal (not piped or in CI).");
    console.error("Use `nevr-env check` for non-interactive validation.");
    process.exit(1);
  }

  console.log("");
  p.intro(pc.bgMagenta(pc.white(" 🧙 nevr-env fix ")));

  // Step 1: Find config file
  const configPath = opts.config || findConfigFile(cwd);

  if (!configPath) {
    p.log.error(
      "No configuration file found. Run `npx nevr-env init` first."
    );
    process.exit(1);
  }

  // Step 2: Find or create .env file
  const envFiles = findEnvFiles(cwd);
  const targetEnvFile = opts.envFile || envFiles[0] || join(cwd, ".env");

  p.log.info(`Target: ${pc.cyan(targetEnvFile)}`);

  // Step 3: Load current env values
  const currentEnv = parseEnvFile(targetEnvFile);

  // Step 4: Load config
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

  // Step 5: Extract schema via metadata registry
  const schema = extractSchemaFromConfig(config);

  // Step 6: Find missing variables
  const missing: MissingVariable[] = [];

  for (const key of schema.requiredKeys) {
    if (!currentEnv.has(key)) {
      missing.push({ key, plugin: schema.pluginInfo.get(key) });
    }
  }

  if (missing.length === 0) {
    p.outro(pc.green("✅ All environment variables are already configured!"));
    process.exit(0);
  }

  p.log.warn(`Found ${pc.bold(missing.length)} missing variable(s)`);
  console.log("");

  // Step 7: Run auto-discovery for plugins
  s.start("Running auto-discovery...");

  for (const item of missing) {
    if (item.plugin?.discover && item.plugin.autoDiscover !== false) {
      try {
        const discoveries = await item.plugin.discover();
        const keyDiscoveries = discoveries[item.key];

        if (keyDiscoveries) {
          item.discoveries = Array.isArray(keyDiscoveries)
            ? keyDiscoveries
            : [keyDiscoveries];
        }
      } catch {
        // Discovery failed, continue without it
      }
    }
  }

  s.stop("Auto-discovery complete");
  console.log("");

  // Step 8: Interactive wizard for each missing variable
  let configured = 0;
  let skipped = 0;

  for (const item of missing) {
    const { key, plugin, discoveries } = item;

    // Build header
    const pluginName = plugin ? pc.dim(` (${plugin.name})`) : "";
    console.log(pc.bold(`📝 ${key}${pluginName}`));

    // Show documentation link if available
    if (plugin?.cli?.docs) {
      console.log(pc.dim(`   Docs: ${plugin.cli.docs}`));
    }

    // Show help text if available
    if (plugin?.cli?.helpText) {
      console.log(pc.dim(`   ${plugin.cli.helpText}`));
    }

    console.log("");

    // Build options
    interface SelectOption {
      value: string;
      label: string;
      hint?: string;
    }

    const options: SelectOption[] = [];

    // Add discovered options
    if (discoveries && discoveries.length > 0) {
      for (const discovery of discoveries) {
        const confidenceIcon =
          discovery.confidence > 0.8
            ? pc.green("🟢")
            : discovery.confidence > 0.5
              ? pc.yellow("🟡")
              : pc.red("🔴");

        options.push({
          value: `discovery:${discovery.value}`,
          label: `${confidenceIcon} Use ${discovery.source}`,
          hint: discovery.description,
        });
      }
    }

    // Add manual entry option
    options.push({
      value: "manual",
      label: "✏️  Enter value manually",
    });

    // Add skip option
    options.push({
      value: "skip",
      label: "⏭️  Skip for now",
    });

    // Show selection prompt
    const selection = await p.select({
      message: `How would you like to configure ${pc.cyan(key)}?`,
      options,
    });

    if (p.isCancel(selection)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    let value: string | undefined;

    if (selection === "skip") {
      skipped++;
      console.log(pc.dim(`   Skipped ${key}`));
      console.log("");
      continue;
    }

    if (selection === "manual") {
      // Get prompt config from plugin
      const promptConfig = plugin?.cli?.prompts?.[key];

      const inputValue = await p.text({
        message: promptConfig?.message || `Enter value for ${key}:`,
        placeholder: promptConfig?.placeholder,
        validate: promptConfig?.validate
          ? (val: string): string | undefined => {
              const result = promptConfig.validate!(val);
              if (typeof result === "string") return result;
              return undefined;
            }
          : undefined,
      });

      if (p.isCancel(inputValue)) {
        p.cancel("Operation cancelled");
        process.exit(0);
      }

      value = inputValue;
    } else if (typeof selection === "string" && selection.startsWith("discovery:")) {
      value = selection.replace("discovery:", "");
    }

    if (value) {
      // Write to .env file
      setEnvVariable(targetEnvFile, key, value);
      configured++;
      console.log(pc.green(`   ✅ Saved ${key} to ${targetEnvFile}`));
    }

    console.log("");
  }

  // Step 9: Summary
  console.log("");
  console.log(pc.bold("📊 Summary"));
  console.log(`   ${pc.green("✓")} Configured: ${configured}`);
  if (skipped > 0) {
    console.log(`   ${pc.yellow("⏭")} Skipped: ${skipped}`);
  }
  console.log("");

  if (skipped > 0) {
    p.outro(
      pc.yellow(
        `${configured} variables configured. Run again to configure skipped variables.`
      )
    );
  } else {
    p.outro(pc.green("🎉 All variables configured! You're ready to go."));
  }
}

export const fix = new Command("fix")
  .description("Interactive wizard to fix missing environment variables")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("-c, --config <path>", "Path to config file")
  .option("-e, --env-file <path>", "Target .env file")
  .option("-y, --yes", "Skip confirmations", false)
  .action(fixAction);

export default fix;
