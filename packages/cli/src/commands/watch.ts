/**
 * `nevr watch` command
 *
 * Watch mode that monitors .env files and validates on changes.
 * Useful for development when frequently editing environment files.
 *
 * @example
 * ```bash
 * nevr watch
 * nevr watch --config ./src/env.ts
 * ```
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import * as fs from "fs";
import * as path from "path";
import {
  findConfigFile,
  findEnvFiles,
  parseEnvFile,
  loadConfigFile,
  extractSchemaFromConfig,
} from "../utils/config";

interface WatchOptions {
  cwd: string;
  config?: string;
  interval?: number;
}

/**
 * Debounce function to prevent rapid re-validation
 */
function debounce<T extends (...args: string[]) => void>(
  fn: T,
  delay: number
): T {
  let timeout: NodeJS.Timeout | null = null;
  return ((...args: string[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  }) as T;
}

/**
 * Validate environment against required keys
 */
function validateEnvironment(
  cwd: string,
  requiredKeys: Set<string>
): { valid: boolean; missing: string[]; found: Map<string, string> } {
  const envFiles = findEnvFiles(cwd);
  const currentEnv = new Map<string, string>();

  for (const file of [...envFiles].reverse()) {
    const values = parseEnvFile(file);
    for (const [key, value] of values) {
      currentEnv.set(key, value);
    }
  }

  const missing: string[] = [];
  for (const key of requiredKeys) {
    if (!currentEnv.has(key)) {
      missing.push(key);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    found: currentEnv,
  };
}

async function watchAction(opts: WatchOptions): Promise<void> {
  const cwd = opts.cwd || process.cwd();

  console.log("");
  p.intro(pc.bgMagenta(pc.white(" 👁 nevr-env watch ")));

  // Find config file
  const configPath = opts.config || findConfigFile(cwd);

  if (!configPath) {
    p.log.error(
      "No nevr-env config found.\n" +
        pc.dim("Run `npx nevr-env init` to set up environment validation.")
    );
    process.exit(1);
  }

  p.log.info(`Config: ${pc.dim(configPath)}`);

  // Load config
  let config: unknown;
  try {
    config = await loadConfigFile(configPath, { cwd });
  } catch (error) {
    p.log.error(`Failed to load config: ${error}`);
    process.exit(1);
  }

  // Extract schema via metadata registry
  const schema = extractSchemaFromConfig(config);
  const requiredKeys = schema.requiredKeys;

  p.log.info(`Watching ${pc.cyan(requiredKeys.size)} environment variables`);

  // Find .env files to watch
  const envFiles = findEnvFiles(cwd);
  const watchedFiles = new Set<string>();

  // Also watch common env file locations
  const possibleEnvFiles = [
    ".env",
    ".env.local",
    ".env.development",
    ".env.development.local",
    ".env.test",
    ".env.production",
  ].map((f) => path.join(cwd, f));

  for (const file of [...envFiles, ...possibleEnvFiles]) {
    if (fs.existsSync(file)) {
      watchedFiles.add(file);
    }
  }

  p.log.info(
    `Watching files:\n${[...watchedFiles]
      .map((f) => `  ${pc.dim(path.relative(cwd, f))}`)
      .join("\n")}`
  );

  // Initial validation
  const initialResult = validateEnvironment(cwd, requiredKeys);
  if (initialResult.valid) {
    console.log("");
    p.log.success(pc.green("✓ All environment variables configured"));
  } else {
    console.log("");
    p.log.warn(
      `${pc.yellow("⚠")} ${initialResult.missing.length} variable(s) missing:\n` +
        initialResult.missing.map((k) => `  ${pc.yellow("•")} ${k}`).join("\n")
    );
  }

  console.log("");
  p.log.info(pc.dim("Watching for changes... (press Ctrl+C to stop)"));
  console.log("");

  // Debounced validation
  const onFileChange = debounce((filename: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `${pc.dim(`[${timestamp}]`)} ${pc.blue("↻")} File changed: ${pc.dim(path.basename(filename))}`
    );

    const result = validateEnvironment(cwd, requiredKeys);

    if (result.valid) {
      console.log(
        `${pc.dim(`[${timestamp}]`)} ${pc.green("✓")} All ${requiredKeys.size} variables configured`
      );
    } else {
      console.log(
        `${pc.dim(`[${timestamp}]`)} ${pc.yellow("⚠")} Missing: ${result.missing.join(", ")}`
      );
    }
    console.log("");
  }, 300);

  // Set up file watchers
  const watchers: fs.FSWatcher[] = [];

  for (const file of watchedFiles) {
    try {
      const watcher = fs.watch(file, (eventType) => {
        if (eventType === "change") {
          onFileChange(file);
        }
      });
      watchers.push(watcher);
    } catch {
      // File might not exist yet
    }
  }

  // Watch for new .env files
  const cwdWatcher = fs.watch(cwd, (eventType, filename) => {
    if (filename && filename.startsWith(".env")) {
      const fullPath = path.join(cwd, filename);
      if (!watchedFiles.has(fullPath) && fs.existsSync(fullPath)) {
        watchedFiles.add(fullPath);
        console.log(
          `${pc.dim(`[${new Date().toLocaleTimeString()}]`)} ${pc.blue("+")} New file detected: ${pc.dim(filename)}`
        );

        try {
          const watcher = fs.watch(fullPath, (event) => {
            if (event === "change") {
              onFileChange(fullPath);
            }
          });
          watchers.push(watcher);
          onFileChange(fullPath);
        } catch {
          // Ignore
        }
      }
    }
  });
  watchers.push(cwdWatcher);

  // Handle cleanup
  const cleanup = () => {
    console.log("");
    p.log.info("Stopping watch mode...");
    for (const watcher of watchers) {
      watcher.close();
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Keep the process alive
  await new Promise(() => {
    // Never resolves - keeps watching
  });
}

export const watch = new Command("watch")
  .description("Watch .env files and validate on changes")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("-c, --config <path>", "Path to config file")
  .option("-i, --interval <ms>", "Debounce interval in ms", "300")
  .action(watchAction);

export default watch;
