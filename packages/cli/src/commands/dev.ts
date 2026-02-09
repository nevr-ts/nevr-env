/**
 * `nevr dev` command
 *
 * Wrapper that validates environment and then runs your framework's dev server.
 * Provides the "never crash on missing env" experience.
 *
 * @example
 * ```bash
 * # Instead of: pnpm next dev
 * nevr dev next dev
 *
 * # Instead of: npm run dev
 * nevr dev npm run dev
 * ```
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { spawn } from "child_process";
import {
  findConfigFile,
  findEnvFiles,
  parseEnvFile,
  loadConfigFile,
  extractSchemaFromConfig,
} from "../utils/config";

interface DevOptions {
  cwd: string;
  config?: string;
  skipCheck?: boolean;
}

async function devAction(
  command: string[],
  opts: DevOptions
): Promise<void> {
  const cwd = opts.cwd || process.cwd();

  console.log("");
  p.intro(pc.bgGreen(pc.black(" 🚀 nevr-env dev ")));

  if (command.length === 0) {
    p.log.error(
      "No command specified. Usage: nevr dev <command>\n" +
        "  Example: nevr dev next dev\n" +
        "  Example: nevr dev npm run dev"
    );
    process.exit(1);
  }

  // Skip check if requested
  if (opts.skipCheck) {
    p.log.info("Skipping environment check (--skip-check)");
    runCommand(command, cwd);
    return;
  }

  // Step 1: Find config file
  const configPath = opts.config || findConfigFile(cwd);

  if (!configPath) {
    p.log.warn(
      "No nevr-env config found. Running command without validation.\n" +
        pc.dim("Run `npx nevr-env init` to set up environment validation.")
    );
    console.log("");
    runCommand(command, cwd);
    return;
  }

  p.log.info(`Config: ${pc.dim(configPath)}`);

  // Step 2: Load current env values
  const envFiles = findEnvFiles(cwd);
  const currentEnv = new Map<string, string>();

  for (const file of [...envFiles].reverse()) {
    const values = parseEnvFile(file);
    for (const [key, value] of values) {
      currentEnv.set(key, value);
    }
  }

  // Step 3: Load config and extract required keys
  const s = p.spinner();
  s.start("Validating environment...");

  let config: unknown;
  try {
    config = await loadConfigFile(configPath, { cwd });
  } catch (error) {
    s.stop("Failed to load configuration");
    p.log.error(String(error));
    process.exit(1);
  }

  // Extract schema via metadata registry
  const schema = extractSchemaFromConfig(config);

  // Check for missing variables
  const missing: string[] = [];
  for (const key of schema.requiredKeys) {
    if (!currentEnv.has(key) && !process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    s.stop(pc.yellow("Missing environment variables detected"));

    console.log("");
    p.log.error(
      `${pc.red("✗")} ${missing.length} required variable(s) missing:\n` +
        missing.map((k) => `  ${pc.red("•")} ${k}`).join("\n")
    );
    console.log("");

    // In non-TTY mode, just warn and run the command anyway
    if (!process.stdout.isTTY) {
      p.log.warn("Missing variables detected. Running command anyway...");
    } else {
      // Ask if user wants to run the fix wizard
      const runFix = await p.confirm({
        message: "Would you like to configure them now?",
        initialValue: true,
      });

      if (p.isCancel(runFix)) {
        p.cancel("Operation cancelled");
        process.exit(0);
      }

      if (runFix) {
        console.log("");
        p.log.info("Starting interactive configuration wizard...\n");

        const fixProcess = spawn("npx", ["nevr-env", "fix"], {
          cwd,
          stdio: "inherit",
          shell: true,
        });

        await new Promise<void>((resolve, reject) => {
          fixProcess.on("close", (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Fix command exited with code ${code}`));
            }
          });
          fixProcess.on("error", reject);
        });

        // Re-check after fix
        const newEnvFiles = findEnvFiles(cwd);
        const newEnv = new Map<string, string>();

        for (const file of [...newEnvFiles].reverse()) {
          const values = parseEnvFile(file);
          for (const [key, value] of values) {
            newEnv.set(key, value);
          }
        }

        const stillMissing = [...schema.requiredKeys].filter(
          (k) => !newEnv.has(k) && !process.env[k]
        );

        if (stillMissing.length > 0) {
          console.log("");
          p.log.warn(
            `${stillMissing.length} variable(s) still missing. ` +
              "You may need to configure them later."
          );
        }
      } else {
        const proceed = await p.confirm({
          message: "Continue anyway? (App may crash)",
          initialValue: false,
        });

        if (p.isCancel(proceed) || !proceed) {
          p.cancel("Development cancelled");
          process.exit(1);
        }
      }
    }
  } else {
    s.stop(pc.green("✓ All environment variables configured"));
  }

  // Step 4: Run the actual command
  console.log("");
  p.log.info(`Running: ${pc.cyan(command.join(" "))}`);
  console.log("");

  runCommand(command, cwd);
}

/**
 * Run a command with inherited stdio
 */
function runCommand(command: string[], cwd: string): void {
  const [cmd, ...args] = command;

  const childProcess = spawn(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      // Mark that we've validated
      NEVR_ENV_VALIDATED: "true",
    },
  });

  childProcess.on("close", (code) => {
    process.exit(code ?? 0);
  });

  childProcess.on("error", (error) => {
    console.error(pc.red(`Failed to start command: ${error.message}`));
    process.exit(1);
  });

  // Handle termination signals
  process.on("SIGINT", () => {
    childProcess.kill("SIGINT");
  });

  process.on("SIGTERM", () => {
    childProcess.kill("SIGTERM");
  });
}

export const dev = new Command("dev")
  .description("Run your dev server with environment validation")
  .argument("<command...>", "Command to run (e.g., next dev, npm run dev)")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("-c, --config <path>", "Path to config file")
  .option("--skip-check", "Skip environment validation", false)
  .allowUnknownOption() // Allow framework-specific flags
  .action(devAction);

export default dev;
