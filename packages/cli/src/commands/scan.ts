/**
 * `nevr scan` command
 *
 * Scan the codebase for accidentally committed secrets.
 * Uses the secret scanner from @nevr-env/core.
 *
 * @example
 * ```bash
 * nevr scan
 * nevr scan --path ./src
 * nevr scan --format json
 * ```
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { loadCore } from "../utils/core-loader";

interface ScanOptions {
  path?: string;
  format?: "text" | "json";
  exclude?: string[];
}

async function scanAction(opts: ScanOptions): Promise<void> {
  const scanPath = opts.path || process.cwd();
  const format = opts.format || "text";

  if (format === "text") {
    console.log("");
    p.intro(pc.bgRed(pc.white(" 🔍 nevr-env scan ")));
    p.log.info(`Scanning: ${pc.dim(scanPath)}`);
  }

  let core;
  try {
    core = await loadCore();
  } catch {
    p.log.error("Failed to load @nevr-env/core. Make sure it's installed.");
    process.exit(1);
  }

  const s = format === "text" ? p.spinner() : null;
  s?.start("Scanning for secrets...");

  let results;
  try {
    results = core.scanForSecrets({
      directory: scanPath,
      exclude: opts.exclude,
    });
  } catch (error) {
    s?.stop("Scan failed");
    p.log.error(String(error));
    process.exit(1);
  }

  s?.stop("Scan complete");

  if (format === "json") {
    console.log(JSON.stringify(results, null, 2));
  } else {
    const formatted = core.formatScanResults(results);
    console.log("");
    console.log(formatted);

    if (results.matches.length > 0) {
      console.log("");
      p.outro(
        pc.red(`Found ${results.matches.length} potential secret(s). Please review and fix.`)
      );
      process.exit(1);
    } else {
      console.log("");
      p.outro(pc.green("✅ No secrets found!"));
    }
  }
}

export const scan = new Command("scan")
  .description("Scan codebase for accidentally committed secrets")
  .option("-p, --path <path>", "Directory to scan")
  .option("-f, --format <format>", "Output format (text, json)", "text")
  .option("-e, --exclude <patterns...>", "Glob patterns to exclude")
  .action(scanAction);

export default scan;
