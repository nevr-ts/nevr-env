/**
 * `nevr ci` command
 *
 * Generate CI/CD configuration for various platforms.
 * Outputs to stdout for easy piping.
 *
 * @example
 * ```bash
 * nevr ci github > .github/workflows/env.yml
 * nevr ci vercel > vercel.json
 * nevr ci gitlab > .gitlab-ci.yml
 * nevr ci circleci > .circleci/config.yml
 * nevr ci railway > railway.json
 * ```
 */

import { Command } from "commander";
import {
  findConfigFile,
  loadConfigFile,
  extractSchemaFromConfig,
} from "../utils/config";
import { loadCore, type CIPlatform } from "../utils/core-loader";

const SUPPORTED_PLATFORMS: readonly CIPlatform[] = [
  "github", "vercel", "railway", "gitlab", "circleci",
];

interface CIOptions {
  cwd: string;
  config?: string;
  nodeVersion?: string;
  packageManager?: "npm" | "yarn" | "pnpm";
}

async function ciAction(platform: string, opts: CIOptions): Promise<void> {
  const cwd = opts.cwd || process.cwd();

  if (!SUPPORTED_PLATFORMS.includes(platform as CIPlatform)) {
    console.error(
      `Unknown platform: ${platform}\n` +
        `Supported platforms: ${SUPPORTED_PLATFORMS.join(", ")}`
    );
    process.exit(1);
  }

  let core;
  try {
    core = await loadCore();
  } catch {
    console.error("Failed to load @nevr-env/core. Make sure it's installed.");
    process.exit(1);
  }

  // Load config to get schema
  const configPath = opts.config || findConfigFile(cwd);

  if (!configPath) {
    console.error("No configuration file found. Run `npx nevr-env init` first.");
    process.exit(1);
  }

  let config: unknown;
  try {
    config = await loadConfigFile(configPath, { cwd });
  } catch (error) {
    console.error(`Failed to load configuration: ${error}`);
    process.exit(1);
  }

  const schema = extractSchemaFromConfig(config);

  const ciOptions: Record<string, unknown> = {};
  if (opts.nodeVersion) ciOptions.nodeVersion = opts.nodeVersion;
  if (opts.packageManager) ciOptions.packageManager = opts.packageManager;

  const output = core.generateCIConfig(
    schema.schemas,
    platform as CIPlatform,
    Object.keys(ciOptions).length > 0 ? ciOptions : undefined
  );

  // Output to stdout (pipeable)
  console.log(output);
}

export const ci = new Command("ci")
  .description("Generate CI/CD configuration for a platform")
  .argument("<platform>", `Platform (${SUPPORTED_PLATFORMS.join(", ")})`)
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("-c, --config <path>", "Path to config file")
  .option("--node-version <version>", "Node.js version for CI")
  .option("--package-manager <pm>", "Package manager (npm, yarn, pnpm)")
  .action(ciAction);

export default ci;
