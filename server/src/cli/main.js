#!/usr/bin/env node

// Suppress dotenv tips BEFORE importing
process.env.DOTENV_CONFIG_QUIET = "true";

import dotenv from "dotenv";
import chalk from "chalk";
import figlet from "figlet";
import { Command } from "commander";

import { login, logout, whoami } from "./commands/auth/login.js";
import { wakeUp } from "./commands/ai/wakeUp.js";
import { startAgentChat } from "./chat/chat-with-ai-agent.js";
import { getStoredToken } from "./commands/auth/login.js";

// Load env silently
dotenv.config({ quiet: true });

/**
 * Display splash screen briefly then clear
 */
async function showSplash() {
  // Clear screen first
  process.stdout.write("\x1b[2J\x1b[H");

  // Show banner
  console.log(
    chalk.hex('#7C3AED')(
      figlet.textSync("Orion", {
        font: "Standard",
        horizontalLayout: "default",
      })
    )
  );
  console.log(chalk.dim("AI Coding Agent\n"));

  // Wait briefly
  await new Promise(r => setTimeout(r, 1200));

  // Clear screen
  process.stdout.write("\x1b[2J\x1b[H");
}

async function main() {
  // Clear any startup noise immediately
  process.stdout.write("\x1b[2J\x1b[H");

  const program = new Command("orion");

  program
    .version("1.0.0")
    .description("Orion CLI - AI-powered coding assistant");

  // Add commands
  program.addCommand(wakeUp);
  program.addCommand(login);
  program.addCommand(logout);
  program.addCommand(whoami);

  // Default action: start agent mode if authenticated, otherwise show help
  program.action(async () => {
    const token = await getStoredToken();

    if (token?.access_token) {
      // Show splash then start agent
      await showSplash();
      await startAgentChat();
    } else {
      // Not authenticated - show help
      console.log(chalk.yellow("\nNot logged in.\n"));
      console.log(chalk.cyan("  orion login") + chalk.dim("  Authenticate with GitHub\n"));
    }
  });

  program.parse();
}

main().catch((error) => {
  console.error(chalk.red("Error running Orion CLI:"), error);
  process.exit(1);
});
