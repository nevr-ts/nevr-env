/**
 * `nevr rotate` command
 *
 * Check rotation status of secrets and record rotations.
 *
 * @example
 * ```bash
 * nevr rotate                    # Show rotation status
 * nevr rotate --max-age 90       # Flag secrets older than 90 days
 * nevr rotate --record API_KEY   # Record that API_KEY was rotated
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
import { loadCore, type RotationStatus } from "../utils/core-loader";

interface RotateOptions {
  cwd: string;
  config?: string;
  maxAge?: string;
  format?: "text" | "json";
  record?: string;
}

async function rotateAction(opts: RotateOptions): Promise<void> {
  const cwd = opts.cwd || process.cwd();
  const format = opts.format || "text";
  const maxAgeDays = parseInt(opts.maxAge || "90", 10);

  if (isNaN(maxAgeDays) || maxAgeDays <= 0) {
    if (format === "text") {
      console.log("");
      p.log.error(`Invalid --max-age value: "${opts.maxAge}". Must be a positive number.`);
    }
    process.exit(1);
  }

  let core;
  try {
    core = await loadCore();
  } catch {
    if (format === "text") {
      p.log.error("Failed to load @nevr-env/core. Make sure it's installed.");
    }
    process.exit(1);
  }

  // Record a rotation
  if (opts.record) {
    try {
      core.recordRotation(opts.record);
      if (format === "text") {
        console.log("");
        p.intro(pc.bgGreen(pc.black(" 🔄 nevr-env rotate ")));
        p.log.success(`Recorded rotation for ${pc.cyan(opts.record)}`);
        p.outro(pc.green("✅ Rotation recorded."));
      } else {
        console.log(JSON.stringify({ recorded: opts.record, timestamp: new Date().toISOString() }));
      }
      return;
    } catch (error) {
      if (format === "text") {
        p.log.error(`Failed to record rotation: ${error}`);
      }
      process.exit(1);
    }
  }

  // Show rotation status
  if (format === "text") {
    console.log("");
    p.intro(pc.bgYellow(pc.black(" 🔄 nevr-env rotate ")));
  }

  // Load config to get secret keys
  const configPath = opts.config || findConfigFile(cwd);

  if (!configPath) {
    if (format === "text") {
      p.log.error("No configuration file found.");
    }
    process.exit(1);
  }

  let config: unknown;
  try {
    config = await loadConfigFile(configPath, { cwd });
  } catch (error) {
    if (format === "text") {
      p.log.error(`Failed to load configuration: ${error}`);
    }
    process.exit(1);
  }

  const schema = extractSchemaFromConfig(config);

  // Auto-detect sensitive keys
  const sensitiveKeys = [...schema.requiredKeys].filter((key) => {
    const lower = key.toLowerCase();
    return (
      lower.includes("secret") ||
      lower.includes("password") ||
      lower.includes("key") ||
      lower.includes("token") ||
      lower.includes("api_key")
    );
  });

  if (sensitiveKeys.length === 0) {
    if (format === "text") {
      p.log.info("No sensitive keys detected in schema.");
      p.outro(pc.green("✅ Nothing to rotate."));
    } else {
      console.log(JSON.stringify({ sensitiveKeys: [], status: [] }));
    }
    return;
  }

  // Check rotation status — pass keys array + options object (correct signature)
  let statuses: RotationStatus[];
  try {
    statuses = core.checkRotationStatus(sensitiveKeys, {
      defaultMaxAgeDays: maxAgeDays,
    });
  } catch {
    // If rotation records don't exist yet, all keys are "never rotated"
    statuses = sensitiveKeys.map((key) => ({
      key,
      status: "unknown" as const,
      lastRotated: null,
      daysSinceRotation: null,
      maxAgeDays,
      needsRotation: true,
    }));
  }

  if (format === "json") {
    console.log(JSON.stringify({ sensitiveKeys, statuses, maxAgeDays }, null, 2));
    return;
  }

  // Text output
  console.log("");
  p.log.info(`Checking ${pc.bold(String(sensitiveKeys.length))} sensitive variable(s) (max age: ${maxAgeDays} days)`);
  console.log("");

  let needsRotation = 0;

  for (const status of statuses) {
    const icon = status.needsRotation ? pc.red("●") : pc.green("●");
    const age = status.daysSinceRotation != null
      ? `${status.daysSinceRotation} days ago`
      : "never rotated";
    const ageColor = status.needsRotation ? pc.red(age) : pc.green(age);

    console.log(`  ${icon} ${pc.bold(status.key)} — ${ageColor}`);

    if (status.needsRotation) {
      needsRotation++;
    }
  }

  console.log("");

  if (needsRotation > 0) {
    p.outro(
      pc.yellow(`${needsRotation} secret(s) need rotation. Use ${pc.bold("--record <key>")} after rotating.`)
    );
    process.exit(1);
  } else {
    p.outro(pc.green("✅ All secrets are within rotation policy."));
  }
}

export const rotate = new Command("rotate")
  .description("Check and record secret rotation status")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("-c, --config <path>", "Path to config file")
  .option("--max-age <days>", "Max age in days before flagging", "90")
  .option("-f, --format <format>", "Output format (text, json)", "text")
  .option("--record <key>", "Record that a key was rotated")
  .action(rotateAction);

export default rotate;
