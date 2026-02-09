/**
 * `nevr init` command
 * 
 * Initialize nevr-env configuration in a project
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import {
  findConfigFile,
  detectFramework,
  getFrameworkPrefix,
} from "../utils/config";

interface InitOptions {
  cwd: string;
  force?: boolean;
}

const CONFIG_TEMPLATE = (options: {
  framework: string | null;
  clientPrefix: string;
  hasPostgres: boolean;
  hasStripe: boolean;
}) => `/**
 * Environment configuration
 * 
 * @see https://github.com/nevr-ts/nevr-env
 */
import { createEnv } from "@nevr-env/core";
${options.hasPostgres ? 'import { postgres } from "@nevr-env/postgres";\n' : ""}${options.hasStripe ? 'import { stripe } from "@nevr-env/stripe";\n' : ""}import { z } from "zod";

export const env = createEnv({
  /**
   * Plugins provide pre-built schemas for common services
   */
  plugins: [
${options.hasPostgres ? "    postgres(),\n" : ""}${options.hasStripe ? "    stripe({ webhook: true }),\n" : ""}  ],

  /**
   * Server-side environment variables (not exposed to the client)
   */
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    // Add your server-side variables here
  },

  /**
   * Client-side environment variables (exposed to the browser)
   * Must be prefixed with ${options.clientPrefix}
   */
  client: {
    ${options.clientPrefix}APP_URL: z.string().url().optional(),
  },

  /**
   * Client-side variable prefix for your framework
   */
  clientPrefix: "${options.clientPrefix}",

  /**
   * Runtime environment source
   * For Next.js 13.4.4+, you can use experimental__runtimeEnv
   */
  runtimeEnv: process.env,

  /**
   * Treat empty strings as undefined
   */
  emptyStringAsUndefined: true,
});

// Type export for use in your app
export type Env = typeof env;
`;

async function initAction(opts: InitOptions) {
  const cwd = opts.cwd || process.cwd();

  if (!process.stdout.isTTY) {
    console.error("Error: `nevr-env init` requires an interactive terminal.");
    console.error("Run this command directly in your terminal (not piped or in CI).");
    process.exit(1);
  }

  console.log("");
  p.intro(pc.bgBlue(pc.white(" 🚀 nevr-env init ")));

  // Check if config already exists
  const existingConfig = findConfigFile(cwd);
  
  if (existingConfig && !opts.force) {
    const overwrite = await p.confirm({
      message: `Config already exists at ${existingConfig}. Overwrite?`,
      initialValue: false,
    });
    
    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel("Initialization cancelled");
      process.exit(0);
    }
  }

  // Detect framework
  const framework = detectFramework(cwd);
  const clientPrefix = getFrameworkPrefix(framework);

  if (framework) {
    p.log.info(`Detected framework: ${pc.cyan(framework)}`);
    p.log.info(`Using client prefix: ${pc.cyan(clientPrefix)}`);
  }

  // Ask about plugins
  const plugins = await p.multiselect({
    message: "Which plugins would you like to use?",
    options: [
      {
        value: "postgres",
        label: "PostgreSQL",
        hint: "Database connection with Docker auto-discovery",
      },
      {
        value: "stripe",
        label: "Stripe",
        hint: "Payment processing with key validation",
      },
    ],
    required: false,
  });

  if (p.isCancel(plugins)) {
    p.cancel("Initialization cancelled");
    process.exit(0);
  }

  const hasPostgres = plugins.includes("postgres");
  const hasStripe = plugins.includes("stripe");

  // Ask where to create the config
  const configLocation = await p.select({
    message: "Where should we create the config file?",
    options: [
      { value: "src/env.ts", label: "src/env.ts", hint: "Recommended for most projects" },
      { value: "lib/env.ts", label: "lib/env.ts", hint: "Common for Next.js" },
      { value: "nevr.config.ts", label: "nevr.config.ts", hint: "Root level config" },
    ],
  });

  if (p.isCancel(configLocation)) {
    p.cancel("Initialization cancelled");
    process.exit(0);
  }

  // Generate config content
  const configContent = CONFIG_TEMPLATE({
    framework,
    clientPrefix,
    hasPostgres,
    hasStripe,
  });

  // Create the config file
  const configLocationStr = configLocation as string;
  const configPath = join(cwd, configLocationStr);
  
  // Ensure directory exists
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const s = p.spinner();
  s.start("Creating configuration...");
  
  writeFileSync(configPath, configContent, "utf-8");
  
  s.stop(`Created ${pc.cyan(configLocationStr)}`);

  // Create .env file if it doesn't exist
  const envPath = join(cwd, ".env");
  if (!existsSync(envPath)) {
    const createEnv = await p.confirm({
      message: "Create a .env file?",
      initialValue: true,
    });
    
    if (!p.isCancel(createEnv) && createEnv) {
      const envContent = `# Environment variables
# Run \`npx nevr-env fix\` to configure these interactively

NODE_ENV=development
${hasPostgres ? "# DATABASE_URL=\n" : ""}${hasStripe ? "# STRIPE_SECRET_KEY=\n# STRIPE_PUBLISHABLE_KEY=\n" : ""}`;
      
      writeFileSync(envPath, envContent, "utf-8");
      p.log.success(`Created ${pc.cyan(".env")}`);
    }
  }

  // Show next steps
  console.log("");
  p.note(
    `${pc.bold("Next steps:")}\n\n` +
      `1. Install dependencies:\n` +
      `   ${pc.cyan(`pnpm add @nevr-env/core${hasPostgres ? " @nevr-env/postgres" : ""}${hasStripe ? " @nevr-env/stripe" : ""} zod`)}\n\n` +
      `2. Configure missing variables:\n` +
      `   ${pc.cyan("npx nevr-env fix")}\n\n` +
      `3. Import in your app:\n` +
      `   ${pc.dim(`import { env } from "${configLocationStr.replace(".ts", "")}";`)}`
  );

  p.outro(pc.green("✅ nevr-env initialized successfully!"));
}

export const init = new Command("init")
  .description("Initialize nevr-env configuration")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("-f, --force", "Overwrite existing config", false)
  .action(initAction);

export default init;
