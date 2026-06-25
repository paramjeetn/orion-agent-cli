/**
 * Agent Loop - v5
 *
 * Claude Code-inspired architecture:
 * - Turn-based execution with proper streaming
 * - Next-speaker checker ensures model ALWAYS explains after tool calls
 * - ReAct pattern: Reason → Act → Observe → Respond
 * - Clean separation of concerns
 */

import { text, isCancel, confirm } from "@clack/prompts";
import chalk from "chalk";
import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import cliMarkdown from "cli-markdown";
import { createAgentTools, toolConfig } from "../../../config/agent-tools.config.js";
import { generateSystemPrompt } from "../../../config/agent-system-prompt.js";
import { ChatService } from "../../../services/chat.services.js";
import { Turn, executeTurn } from "./turn.js";
import { checkNextSpeaker, createContinuationPrompt } from "./next-speaker.js";
import { createFunctionResponseMessage, getToolResultsSummary } from "./function-response.js";
import {
  displaySessionHeader,
  displaySessionSummary,
  displayFilesChanged,
  displayPlan,
  displayHelp,
  displayError,
  displayInterrupt,
  displayMiniStatus,
  displayWelcome,
  displayGoodbye,
  getPrompt,
} from "./agent-display.js";
import { statusBar } from "./status-bar.js";

// Use status bar for progress - no separate spinner needed
function startSpinner(text = "Thinking...") {
  statusBar.setActiveTask(text);
}

function updateSpinner(text) {
  statusBar.setActiveTask(text);
}

function stopSpinner() {
  // Don't clear - keep showing what we're doing
}

// Initialize Google AI
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const model = google(process.env.ORION_MODEL || "gemini-2.5-flash-preview-05-20");

const MAX_ITERATIONS = 30; // Allow more iterations for complex tasks with plans
const MAX_CONSECUTIVE_TOOL_TURNS = 15; // With maxSteps=1, each tool call is a turn, so need more
const MAX_SAME_TOOL_CALLS = 2; // Max times same tool+path can be called (createFile is stricter: 1)

// Debug helper
function log(...args) {
  if (process.env.ORION_DEBUG) {
    console.log(chalk.magenta("[DEBUG]"), ...args);
  }
}

/**
 * Handle slash commands
 */
async function handleSlashCommand(input, session) {
  const cmd = input.trim().toLowerCase();

  if (cmd === "/help") { displayHelp(); return false; }
  if (cmd === "/files") { displayFilesChanged(session); return false; }
  if (cmd === "/plan") { displayPlan(session); return false; }
  if (cmd === "/summary") { displaySessionSummary(session); return false; }
  if (cmd === "/debug") {
    process.env.ORION_DEBUG = process.env.ORION_DEBUG ? "" : "1";
    console.log(chalk.cyan(`Debug: ${process.env.ORION_DEBUG ? "ON" : "OFF"}`));
    return false;
  }
  if (cmd === "/clear") {
    session.messages = [];
    session.toolMemory.clear();
    console.log(chalk.green("Cleared."));
    return false;
  }
  if (cmd === "/exit" || cmd === "/quit") return true;
  if (input.startsWith("/")) {
    console.log(chalk.yellow(`Unknown: ${input}. Try /help`));
    return false;
  }
  return null;
}

/**
 * Run the agent for a single user message
 * Uses Turn-based architecture with next-speaker checker
 */
async function runAgent(userMessage, session, chatService) {
  const context = session.getContext();
  const systemPrompt = generateSystemPrompt(context);
  const tools = createAgentTools(context);

  // Build initial messages
  const messages = [
    { role: "system", content: systemPrompt },
    ...session.getMessagesForAI()
  ];

  session.setProcessing(true, "thinking");

  let iteration = 0;
  let lastAssistantText = "";
  let consecutiveToolTurns = 0; // Turns with tools but no meaningful text
  const recentToolCalls = []; // Track recent tool calls for repetition detection

  // Helper to detect repetitive tool calls
  function isRepetitiveCall(toolName, args) {
    const key = `${toolName}:${args?.path || args?.command || args?.pattern || ""}`;
    const count = recentToolCalls.filter(k => k === key).length;
    recentToolCalls.push(key);
    // Keep only last 15 calls
    if (recentToolCalls.length > 15) recentToolCalls.shift();

    // createFile should NEVER be called twice on same path
    if (toolName === "createFile" && count >= 1) {
      log(`createFile on same path ${args?.path} - blocking repeat`);
      return true;
    }
    // Other tools get standard limit
    return count >= MAX_SAME_TOOL_CALLS;
  }

  try {
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      log(`\n--- Turn ${iteration} ---`);
      log(`Messages count: ${messages.length}`);

      // Start spinner while thinking
      startSpinner(iteration === 1 ? "Thinking..." : "Continuing...");

      // Create and execute a turn
      // IMPORTANT: maxSteps=1 ensures we check for repetition after EVERY tool call
      // Higher values let the SDK auto-execute multiple tools before we can intervene
      const turn = new Turn(model, messages, tools, {
        maxSteps: 1,
      });

      let responseText = "";

      // Execute turn - buffer text for markdown rendering
      const turnResult = await executeTurn(turn, {
        signal: session.abortController?.signal,
        onText: (chunk) => {
          // Buffer text for markdown rendering at the end
          responseText += chunk;
        },
        onToolCall: (event) => {
          // Tool calls are handled via onStepFinish in Turn
        },
      });

      stopSpinner();

      // Render markdown and display the response
      if (responseText.trim()) {
        console.log(); // Space before response
        try {
          // Render markdown for terminal using cli-markdown
          const rendered = cliMarkdown(responseText);
          console.log(rendered.trim());
        } catch (e) {
          // Fallback to raw text if markdown parsing fails
          log("Markdown render error:", e.message);
          console.log(responseText);
        }
        console.log(); // Space after response
      }

      log("Turn result:", {
        hasText: turnResult.hasText,
        hasToolCalls: turnResult.hasToolCalls,
        toolCallsCount: turnResult.toolCalls?.length || 0,
        toolResultsCount: turnResult.toolResults?.length || 0,
        textLength: turnResult.text?.length || 0,
        finishReason: turnResult.finishReason,
      });

      // Debug: show what tool calls and results we have
      if (turnResult.toolCalls?.length > 0) {
        log("Tool calls made:", turnResult.toolCalls.map(tc => ({
          name: tc.toolName,
          id: tc.toolCallId,
          args: tc.args,
        })));
      }
      if (turnResult.toolResults?.length > 0) {
        log("Tool results received:", turnResult.toolResults.map(tr => ({
          name: tr.toolName,
          id: tr.toolCallId,
          hasResult: tr.result !== undefined,
          resultType: typeof tr.result,
          resultKeys: tr.result && typeof tr.result === 'object' ? Object.keys(tr.result) : null,
        })));
      }

      // Update status bar with tool info (tools display themselves, no need to duplicate)
      if (turnResult.toolCalls?.length > 0) {
        for (const tc of turnResult.toolCalls) {
          const toolDesc = tc.args?.path || tc.args?.command || tc.args?.pattern || tc.toolName;
          statusBar.setActiveTask(`${tc.toolName}: ${toolDesc}`);
        }
      }

      // Check if we got any text
      if (turnResult.hasText) {
        lastAssistantText = turnResult.text;
      }

      // Use next-speaker checker to determine if model should continue
      const { nextSpeaker, reason } = checkNextSpeaker(messages, turnResult);
      log(`Next speaker: ${nextSpeaker} (${reason})`);

      // If tools were called, we need to add context and check if model should explain
      if (turnResult.hasToolCalls) {
        consecutiveToolTurns++;

        // Check for repetitive tool calls - STOP if same tool+path called too many times
        let foundRepetition = false;
        for (const tc of turnResult.toolCalls || []) {
          if (isRepetitiveCall(tc.toolName, tc.args)) {
            foundRepetition = true;
            log(`Repetition detected: ${tc.toolName} with same args called ${MAX_SAME_TOOL_CALLS}+ times`);
            console.log(chalk.yellow(`\n⚠ Stopping: ${tc.toolName} called repeatedly on same target.`));
            break;
          }
        }

        if (foundRepetition) {
          // Force a summary and exit
          if (lastAssistantText) {
            session.addMessage("assistant", lastAssistantText);
            await chatService.addMessage(session.conversationId, "assistant", lastAssistantText);
          }
          break;
        }

        // Check if plan is complete (plan exists and all steps done)
        const taskPlanner = context.taskPlanner;
        if (taskPlanner?.currentPlan && taskPlanner.isComplete()) {
          log("Plan is complete - stopping loop");
          console.log(chalk.green("\n✓ Plan completed."));
          if (lastAssistantText) {
            session.addMessage("assistant", lastAssistantText);
            await chatService.addMessage(session.conversationId, "assistant", lastAssistantText);
          }
          break;
        }

        // Check consecutive tool turns limit
        if (consecutiveToolTurns >= MAX_CONSECUTIVE_TOOL_TURNS) {
          log(`Max consecutive tool turns (${MAX_CONSECUTIVE_TOOL_TURNS}) reached`);
          console.log(chalk.yellow(`\n⚠ Stopping after ${consecutiveToolTurns} consecutive tool calls.`));
          if (lastAssistantText) {
            session.addMessage("assistant", lastAssistantText);
            await chatService.addMessage(session.conversationId, "assistant", lastAssistantText);
          }
          break;
        }

        // Add assistant message with any text
        if (turnResult.text) {
          messages.push({
            role: "assistant",
            content: turnResult.text,
          });
          // Only reset consecutive counter for actual summaries/completions
          // NOT for "I'll create..." or "Let me..." type announcements
          const lowerText = turnResult.text.toLowerCase();
          const isAnnouncement = lowerText.includes("i'll") || lowerText.includes("i will") ||
                                 lowerText.includes("let me") || lowerText.includes("now i");
          const isCompletion = lowerText.includes("done") || lowerText.includes("completed") ||
                               lowerText.includes("created") || lowerText.includes("finished");
          if (turnResult.text.length > 100 && !isAnnouncement && isCompletion) {
            consecutiveToolTurns = 0;
          }
        }

        // Create DETAILED tool results summary for conversation
        // The AI needs to see the ACTUAL data, not just "success"
        const toolResultsFormatted = turnResult.toolResults?.map((tr, i) => {
          // Use toolName from the result itself, not by index matching
          const toolName = tr.toolName || turnResult.toolCalls[i]?.toolName || "Tool";
          const args = tr.args || turnResult.toolCalls[i]?.args || {};
          // Handle both tr.result and tr directly (SDK version differences)
          const result = tr.result !== undefined ? tr.result : tr;

          log(`Formatting result for ${toolName}:`, JSON.stringify(result).slice(0, 500));

          let summary = `## ${toolName}`;
          if (args.path) summary += ` (${args.path})`;
          else if (args.command) summary += ` (${args.command})`;
          else if (args.pattern) summary += ` (${args.pattern})`;
          summary += "\n\n";

          if (!result) {
            summary += "No result returned.";
            return summary;
          }

          if (typeof result !== "object") {
            summary += String(result);
            return summary;
          }

          // Handle listDirectory results - ALWAYS show file/directory names
          if (result.entries && Array.isArray(result.entries)) {
            const dirs = result.entries.filter(e => e.type === "directory");
            const files = result.entries.filter(e => e.type === "file");

            summary += `**Found ${dirs.length} directories and ${files.length} files:**\n\n`;

            if (dirs.length > 0) {
              summary += "**Directories:**\n";
              dirs.forEach(d => { summary += `- 📁 ${d.name}\n`; });
              summary += "\n";
            }

            if (files.length > 0) {
              summary += "**Files:**\n";
              // Show all files up to 30, then truncate
              const filesToShow = files.slice(0, 30);
              filesToShow.forEach(f => { summary += `- 📄 ${f.name}\n`; });
              if (files.length > 30) {
                summary += `- ... and ${files.length - 30} more files\n`;
              }
            }
          }
          // Handle readFile results - show content
          else if (result.content !== undefined) {
            summary += `**File: ${result.path || "unknown"}** (${result.lines || "?"} lines) - FILE IS COMPLETE\n\n`;
            summary += "```\n";
            summary += result.content.slice(0, 1500);
            if (result.content.length > 1500) summary += "\n... [display truncated - file is complete]";
            summary += "\n```";
          }
          // Handle createFile results
          else if (result.bytesWritten !== undefined) {
            summary += `✓ FILE CREATED SUCCESSFULLY: ${result.path}\n`;
            summary += `Size: ${result.bytesWritten} bytes - FILE IS COMPLETE, DO NOT RECREATE`;
          }
          // Handle editFile results
          else if (result.occurrencesReplaced !== undefined) {
            summary += `✓ Edited file: ${result.path}\n`;
            summary += `Replacements made: ${result.occurrencesReplaced}`;
          }
          // Handle runCommand results
          else if (result.exitCode !== undefined) {
            summary += `**Command:** \`${result.command || "?"}\`\n`;
            summary += `**Exit code:** ${result.exitCode}\n\n`;
            if (result.stdout) {
              summary += "**Output:**\n```\n";
              summary += result.stdout.slice(0, 1500);
              if (result.stdout.length > 1500) summary += "\n... [truncated]";
              summary += "\n```\n";
            }
            if (result.stderr) {
              summary += "**Errors:**\n```\n" + result.stderr.slice(0, 500) + "\n```";
            }
          }
          // Handle glob results
          else if (result.files && Array.isArray(result.files)) {
            summary += `**Found ${result.files.length} matching files:**\n\n`;
            result.files.slice(0, 30).forEach(f => { summary += `- ${f}\n`; });
            if (result.files.length > 30) {
              summary += `- ... and ${result.files.length - 30} more\n`;
            }
          }
          // Handle grep results
          else if (result.matches !== undefined || result.totalMatches !== undefined) {
            summary += `**Found ${result.totalMatches || result.matches?.length || 0} matches**\n\n`;
            if (result.results) {
              result.results.slice(0, 10).forEach(r => {
                summary += `**${r.file}:**\n`;
                r.matches?.slice(0, 3).forEach(m => {
                  summary += `  Line ${m.line}: ${m.text?.slice(0, 100)}\n`;
                });
              });
            }
          }
          // Handle success/error results
          else if (result.success !== undefined) {
            if (result.success) {
              summary += "✓ Success";
              if (result.path) summary += `: ${result.path}`;
              if (result.message) summary += `\n${result.message}`;
            } else {
              summary += `✗ Failed: ${result.error || "Unknown error"}`;
            }
          }
          // Fallback: show raw JSON
          else {
            summary += "```json\n" + JSON.stringify(result, null, 2).slice(0, 1000) + "\n```";
          }

          return summary;
        }).join("\n\n---\n\n") || "No tool results.";

        // Add tool results to context - be explicit about not repeating and when to stop
        let continuationMsg = `Tool results:\n\n${toolResultsFormatted}\n\n`;
        continuationMsg += `IMPORTANT RULES:\n`;
        continuationMsg += `1. These actions SUCCEEDED - do NOT repeat them\n`;
        continuationMsg += `2. Do NOT call createFile on the same path again\n`;
        continuationMsg += `3. If all required files are created, provide a FINAL SUMMARY and STOP\n`;

        // Add plan status if available
        const plannerForMsg = context.taskPlanner;
        if (plannerForMsg?.currentPlan) {
          const progress = plannerForMsg.getProgress();
          continuationMsg += `\nPlan status: ${progress.completed}/${progress.total} steps complete.`;
          if (progress.completed >= progress.total) {
            continuationMsg += ` ALL STEPS DONE - provide final summary and STOP.`;
          } else {
            continuationMsg += ` Continue to next uncompleted step.`;
          }
        }

        messages.push({
          role: "user",
          content: continuationMsg,
        });

        continue; // Continue to next turn
      }

      // No tool calls - check if we should stop
      if (turnResult.hasText) {
        // Task complete - save and exit
        session.addMessage("assistant", turnResult.text);
        await chatService.addMessage(session.conversationId, "assistant", turnResult.text);
        break;
      }

      // Empty response with stop - we're done
      if (!turnResult.hasText && turnResult.finishReason === "stop") {
        log("Empty response with stop reason - ending");
        if (lastAssistantText) {
          session.addMessage("assistant", lastAssistantText);
          await chatService.addMessage(session.conversationId, "assistant", lastAssistantText);
        }
        break;
      }

      // Safety: break to avoid infinite loop
      log("Safety break - no text, no tools");
      break;
    }

    if (iteration >= MAX_ITERATIONS) {
      console.log(chalk.yellow("\n⚠ Max iterations reached."));
    }

    statusBar.clearTask();
    displayMiniStatus(session);
    return { success: true };

  } catch (error) {
    stopSpinner();
    if (error.name === "AbortError") {
      displayInterrupt("Response");
      return { success: false, aborted: true };
    }
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    log("Stack:", error.stack);
    displayError(error);
    return { success: false, error: error.message };
  } finally {
    stopSpinner();
    session.setProcessing(false);
  }
}

/**
 * Main loop
 */
export async function agentLoop(session, userId) {
  const chatService = new ChatService();

  // Initialize status bar at bottom of terminal
  statusBar.init(3);
  statusBar.startRenderLoop();

  let exitRequested = false;

  const sigintHandler = () => {
    if (session.isProcessing) {
      session.abort();
      displayInterrupt("operation");
    } else {
      exitRequested = true;
      console.log();
    }
  };

  process.on("SIGINT", sigintHandler);

  try {
    while (true) {
      if (exitRequested) {
        const shouldExit = await confirm({
          message: chalk.yellow("Exit?"),
          initialValue: false,
        });
        if (isCancel(shouldExit) || shouldExit) break;
        exitRequested = false;
      }

      const userInput = await text({
        message: getPrompt(),
        placeholder: "What would you like to do?",
        validate: v => (!v?.trim() ? "Enter a message" : undefined),
      });

      if (isCancel(userInput)) {
        const shouldExit = await confirm({
          message: chalk.yellow("Exit?"),
          initialValue: false,
        });
        if (isCancel(shouldExit) || shouldExit) break;
        continue;
      }

      const input = userInput.trim();
      const cmdResult = await handleSlashCommand(input, session);
      if (cmdResult === true) break;
      if (cmdResult === false) continue;

      session.addMessage("user", input);
      await chatService.addMessage(session.conversationId, "user", input);

      if (session.messages.filter(m => m.role === "user").length === 1) {
        await chatService.updateTitle(session.conversationId, input.slice(0, 50));
      }

      await runAgent(input, session, chatService);
    }
  } finally {
    process.removeListener("SIGINT", sigintHandler);
    statusBar.cleanup();
  }

  displaySessionSummary(session);
  displayGoodbye();
}

export default agentLoop;
