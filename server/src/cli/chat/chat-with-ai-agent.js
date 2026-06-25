/**
 * Agent Mode - Claude Code-like Continuous Chat
 * Clean, minimal startup - straight to the prompt
 */

import chalk from "chalk";
import { ChatService } from "../../services/chat.services.js";
import { getStoredToken } from "../commands/auth/login.js";
import prisma from "../../lib/db.js";
import { AgentSession } from "./agent/agent-session.js";
import { agentLoop } from "./agent/agent-loop.js";

const chatService = new ChatService();

/**
 * Get user from stored authentication token
 */
async function getUserFromToken() {
  const token = await getStoredToken();

  if (!token?.access_token) {
    throw new Error("Not authenticated. Please run 'orion login' first.");
  }

  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: { token: token.access_token },
      },
    },
  });

  if (!user) {
    throw new Error("User not found. Please login again.");
  }

  return user;
}

/**
 * Initialize or load a conversation
 */
async function initConversation(userId, conversationId = null) {
  const conversation = await chatService.getOrCreateConversation(
    userId,
    conversationId,
    "agent"
  );

  return conversation;
}

/**
 * Main entry point for agent mode
 * @param {string} conversationId - Optional existing conversation ID
 */
export async function startAgentChat(conversationId = null) {
  try {
    // Authenticate user silently
    const user = await getUserFromToken();

    // Initialize conversation
    const conversation = await initConversation(user.id, conversationId);

    // Create agent session
    const session = new AgentSession(conversation.id, process.cwd());
    await session.initialize();

    // Load previous messages if resuming conversation
    if (conversationId && conversation.messages && conversation.messages.length > 0) {
      const previousMessages = conversation.messages;

      // Restore messages to session
      for (const msg of previousMessages) {
        const parsed = chatService.parseContent(msg.content);
        if (parsed && typeof parsed === "object" && parsed.content !== undefined) {
          session.addMessage(msg.role, parsed.content);
        } else {
          session.addMessage(msg.role, parsed);
        }
      }

      console.log(chalk.dim(`  Resumed session with ${previousMessages.length} messages\n`));
    }

    // Start the continuous agent loop
    await agentLoop(session, user.id);

  } catch (error) {
    console.log(chalk.red(`\n  Error: ${error.message}\n`));

    if (process.env.DEBUG) {
      console.error(chalk.dim(error.stack));
    }

    process.exit(1);
  }
}

export default startAgentChat;
