/**
 * @nevr-env/cli
 *
 * Interactive CLI for nevr-env with the Wizard fixer
 */

import { Command } from "commander";
import { check, ci, dev, diff, fix, init, generate, rotate, scan, watch, types, vault } from "./commands";

const program = new Command("nevr-env");

program
  .name("nevr-env")
  .description("The Environment Lifecycle Framework - Interactive CLI")
  .version("0.1.0");

// Register commands
program.addCommand(init);
program.addCommand(check);
program.addCommand(fix);
program.addCommand(generate);
program.addCommand(types);
program.addCommand(watch);
program.addCommand(dev);
program.addCommand(scan);
program.addCommand(diff);
program.addCommand(rotate);
program.addCommand(ci);
program.addCommand(vault);

// Default action: show help
program.action(() => {
  program.help();
});

// Parse arguments
program.parse(process.argv);

export { program };
export * from "./commands";
export * from "./utils";
