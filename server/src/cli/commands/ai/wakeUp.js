import chalk from "chalk";
import { Command } from "commander";
import yoctoSpinner from "yocto-spinner";
import { getStoredToken } from "../auth/login.js";
import prisma from "../../../lib/db.js";
import { startAgentChat } from "../../chat/chat-with-ai-agent.js";

const wakeUpAction = async () => {
  const token = await getStoredToken();

  if (!token?.access_token) {
    console.log(chalk.red("Not authenticated. Please run 'orion login' first."));
    return;
  }

  const spinner = yoctoSpinner({ text: "Connecting..." });
  spinner.start();

  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: { token: token.access_token },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });

  spinner.stop();

  if (!user) {
    console.log(chalk.red("Session expired. Please run 'orion login' again."));
    return;
  }

  console.log(chalk.green(`\nWelcome back, ${user.name}!\n`));

  // Go directly to agent mode
  await startAgentChat();
};

export const wakeUp = new Command("wakeup")
  .alias("w")
  .description("Start Orion AI Agent Mode")
  .action(wakeUpAction);
