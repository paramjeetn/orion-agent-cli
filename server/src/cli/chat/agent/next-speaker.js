/**
 * Next Speaker Checker
 * Determines whether the model should continue speaking or wait for user input
 * This is the KEY mechanism that ensures the AI always explains after tool calls
 *
 * Inspired by gemini-cli's nextSpeakerChecker.ts
 */

/**
 * Check if a message contains function/tool responses
 * @param {object} message - Message to check
 * @returns {boolean}
 */
export function isFunctionResponse(message) {
  if (!message) return false;

  // Check if message has tool results marker
  if (message.toolResults && message.toolResults.length > 0) {
    return true;
  }

  // Check if content indicates function response
  if (typeof message.content === "string") {
    return message.content.includes("[Tool Result]") ||
           message.content.includes("functionResponse") ||
           message.content.startsWith("[System:");
  }

  // Check for array content with function responses
  if (Array.isArray(message.content)) {
    return message.content.some(
      (part) => part.functionResponse || part.toolResult
    );
  }

  return false;
}

/**
 * Check if the last assistant message seems incomplete
 * @param {string} text - The assistant's text response
 * @returns {boolean}
 */
export function seemsIncomplete(text) {
  if (!text || text.trim().length === 0) return true;

  const trimmed = text.trim().toLowerCase();

  // Check for incomplete indicators
  const incompletePatterns = [
    /^(first|next|then|now),?\s*i('ll|'m|\s+will)/i,
    /let me (start|begin|check|look)/i,
    /i('ll| will) (now|first|start)/i,
    /starting with/i,
    /step \d+:/i,
  ];

  for (const pattern of incompletePatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  // Very short responses after tool calls are likely incomplete
  if (text.trim().length < 50) {
    return true;
  }

  return false;
}

/**
 * Check if the response asks the user a question (indicating user should respond)
 * @param {string} text - The assistant's text response
 * @returns {boolean}
 */
export function asksUserQuestion(text) {
  if (!text) return false;

  const trimmed = text.trim();

  // Check for question patterns
  const questionPatterns = [
    /would you like/i,
    /do you want/i,
    /shall i/i,
    /should i/i,
    /\?$/,
    /which (one|option|approach)/i,
    /what would you prefer/i,
    /let me know/i,
  ];

  for (const pattern of questionPatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Determine who should speak next in the conversation
 *
 * Decision Rules:
 * 1. If last message is a function/tool response → model MUST speak to explain
 * 2. If model's response seems incomplete → model should continue
 * 3. If model asked a question → user should respond
 * 4. Otherwise → user's turn
 *
 * @param {Array} messages - Conversation history
 * @param {object} turnResult - Result from the last turn (optional)
 * @returns {object} { nextSpeaker: 'model' | 'user', reason: string }
 */
export function checkNextSpeaker(messages, turnResult = null) {
  if (!messages || messages.length === 0) {
    return { nextSpeaker: "user", reason: "No messages yet" };
  }

  const lastMessage = messages[messages.length - 1];

  // Rule 1: If last message is a function response, model must explain
  if (isFunctionResponse(lastMessage)) {
    return {
      nextSpeaker: "model",
      reason: "Tool results need explanation",
    };
  }

  // Check turn result if provided
  if (turnResult) {
    // If tools were called but no/little text, model should explain
    if (turnResult.hasToolCalls && !turnResult.hasText) {
      return {
        nextSpeaker: "model",
        reason: "Tool calls made but no explanation provided",
      };
    }

    // If text seems incomplete
    if (turnResult.hasText && seemsIncomplete(turnResult.text)) {
      return {
        nextSpeaker: "model",
        reason: "Response seems incomplete",
      };
    }

    // If response asks user a question
    if (turnResult.hasText && asksUserQuestion(turnResult.text)) {
      return {
        nextSpeaker: "user",
        reason: "Model asked a question",
      };
    }
  }

  // Rule 2: Check if last assistant message is incomplete
  if (lastMessage.role === "assistant") {
    const content = typeof lastMessage.content === "string"
      ? lastMessage.content
      : "";

    if (seemsIncomplete(content)) {
      return {
        nextSpeaker: "model",
        reason: "Last response seems incomplete",
      };
    }

    if (asksUserQuestion(content)) {
      return {
        nextSpeaker: "user",
        reason: "Model asked a question",
      };
    }
  }

  // Default: user's turn
  return {
    nextSpeaker: "user",
    reason: "Awaiting user input",
  };
}

/**
 * Create a continuation prompt to force model to explain
 * @param {object} turnResult - The turn result with tool information
 * @returns {string} The continuation prompt
 */
export function createContinuationPrompt(turnResult) {
  if (!turnResult || !turnResult.toolResults || turnResult.toolResults.length === 0) {
    return "Please continue and explain what you found.";
  }

  // Build context from tool results
  const toolSummaries = turnResult.toolResults.map((tr) => {
    const result = tr.result;
    if (!result) return `${tr.toolName}: completed`;

    if (tr.toolName === "listDirectory" && result.entries) {
      const dirs = result.entries.filter((e) => e.type === "directory").length;
      const files = result.entries.filter((e) => e.type === "file").length;
      return `listDirectory: found ${dirs} directories, ${files} files`;
    }

    if (tr.toolName === "readFile" && result.content) {
      return `readFile (${result.path}): ${result.lines || "?"} lines`;
    }

    if (tr.toolName === "createFile" && result.success) {
      return `createFile: created ${result.path}`;
    }

    if (tr.toolName === "runCommand") {
      return `runCommand: exit code ${result.exitCode}`;
    }

    return `${tr.toolName}: ${result.success ? "success" : "failed"}`;
  });

  return `[System: You executed the following tools:\n${toolSummaries.join("\n")}\n\nNow explain to the user what you found/did. Summarize the results, share your observations, and ask what they would like to do next. Be helpful and conversational.]`;
}

/**
 * Format tool results for inclusion in conversation
 * @param {Array} toolResults - Array of tool results
 * @returns {string} Formatted string for conversation context
 */
export function formatToolResultsForContext(toolResults) {
  if (!toolResults || toolResults.length === 0) {
    return "";
  }

  const formatted = toolResults.map((tr) => {
    const result = tr.result;
    let summary = `Tool: ${tr.toolName}\n`;

    if (!result) {
      summary += "Result: No result returned\n";
      return summary;
    }

    if (tr.toolName === "listDirectory" && result.entries) {
      const dirs = result.entries.filter((e) => e.type === "directory");
      const files = result.entries.filter((e) => e.type === "file");
      summary += `Directories: ${dirs.map((d) => d.name).join(", ") || "none"}\n`;
      summary += `Files: ${files.map((f) => f.name).join(", ") || "none"}\n`;
    } else if (tr.toolName === "readFile" && result.content) {
      summary += `File: ${result.path}\n`;
      summary += `Lines: ${result.lines}\n`;
      summary += `Content preview:\n${result.content.substring(0, 500)}${result.content.length > 500 ? "..." : ""}\n`;
    } else if (tr.toolName === "createFile") {
      summary += `Created: ${result.path}\n`;
      summary += `Size: ${result.bytesWritten} bytes\n`;
    } else if (tr.toolName === "editFile") {
      summary += `Edited: ${result.path}\n`;
      summary += `Replacements: ${result.occurrencesReplaced}\n`;
    } else if (tr.toolName === "runCommand") {
      summary += `Command: ${result.command}\n`;
      summary += `Exit code: ${result.exitCode}\n`;
      if (result.stdout) summary += `Output: ${result.stdout.substring(0, 300)}${result.stdout.length > 300 ? "..." : ""}\n`;
    } else if (tr.toolName === "searchCode") {
      summary += `Pattern: searched for matches\n`;
      summary += `Found: ${result.totalMatches} matches in ${result.filesWithMatches} files\n`;
    } else {
      summary += `Result: ${JSON.stringify(result).substring(0, 200)}\n`;
    }

    return summary;
  });

  return formatted.join("\n---\n");
}

export default {
  checkNextSpeaker,
  isFunctionResponse,
  seemsIncomplete,
  asksUserQuestion,
  createContinuationPrompt,
  formatToolResultsForContext,
};
