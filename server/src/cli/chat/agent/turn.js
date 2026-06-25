/**
 * Turn Manager
 * Handles a single turn of conversation - streaming response, tool execution, result collection
 * Inspired by gemini-cli's turn.ts architecture
 */

import { streamText } from "ai";
import chalk from "chalk";

/**
 * Represents a single turn in the conversation
 * A turn consists of: model response (text + tool calls) → tool execution → results
 */
export class Turn {
  constructor(model, messages, tools, options = {}) {
    this.model = model;
    this.messages = messages;
    this.tools = tools;
    this.options = options;

    // Turn state
    this.text = "";
    this.toolCalls = [];
    this.toolResults = [];
    this.finishReason = null;
    this.usage = null;
    this.error = null;
    this.aborted = false;
  }

  /**
   * Execute the turn - stream response, collect tool calls, execute tools
   * @param {AbortSignal} signal - Optional abort signal
   * @returns {AsyncGenerator} Yields text chunks, returns turn result
   */
  async *run(signal = null) {
    try {
      // Start streaming from the model
      const result = streamText({
        model: this.model,
        messages: this.messages,
        tools: this.tools,
        maxSteps: this.options.maxSteps || 10,
        abortSignal: signal,
        onStepFinish: (step) => {
          // Debug: log what we receive from SDK
          if (process.env.ORION_DEBUG) {
            console.log(chalk.magenta("[Turn] onStepFinish:"), {
              hasText: !!step.text,
              textLength: step.text?.length || 0,
              toolCallsCount: step.toolCalls?.length || 0,
              toolResultsCount: step.toolResults?.length || 0,
            });
            if (step.toolCalls?.length > 0) {
              console.log(chalk.magenta("[Turn] Tool calls:"), step.toolCalls.map(tc => tc.toolName));
            }
            if (step.toolResults?.length > 0) {
              console.log(chalk.magenta("[Turn] Tool results:"), step.toolResults.map(tr => ({
                name: tr.toolName,
                hasResult: tr.result !== undefined,
                resultKeys: tr.result && typeof tr.result === 'object' ? Object.keys(tr.result).slice(0, 5) : null,
              })));
            }
          }

          // Collect tool calls and results from each step
          if (step.toolCalls && step.toolCalls.length > 0) {
            this.toolCalls.push(...step.toolCalls);
          }
          if (step.toolResults && step.toolResults.length > 0) {
            this.toolResults.push(...step.toolResults);
          }
        },
      });

      // Stream text chunks
      for await (const chunk of result.textStream) {
        if (signal?.aborted) {
          this.aborted = true;
          break;
        }
        this.text += chunk;
        yield { type: "text", content: chunk };
      }

      // Get final result
      const finalResult = await result;
      this.finishReason = finalResult.finishReason;
      this.usage = finalResult.usage;

      // Also collect from steps if not already collected via callback
      if (finalResult.steps && Array.isArray(finalResult.steps)) {
        for (const step of finalResult.steps) {
          // Avoid duplicates
          if (step.toolCalls) {
            for (const tc of step.toolCalls) {
              if (!this.toolCalls.find(t => t.toolCallId === tc.toolCallId)) {
                this.toolCalls.push(tc);
              }
            }
          }
          if (step.toolResults) {
            for (const tr of step.toolResults) {
              if (!this.toolResults.find(t => t.toolCallId === tr.toolCallId)) {
                this.toolResults.push(tr);
              }
            }
          }
        }
      }

      // Return turn summary
      return this.getResult();
    } catch (error) {
      if (error.name === "AbortError") {
        this.aborted = true;
        return this.getResult();
      }
      this.error = error;
      throw error;
    }
  }

  /**
   * Get the turn result summary
   */
  getResult() {
    return {
      text: this.text,
      toolCalls: this.toolCalls,
      toolResults: this.toolResults,
      finishReason: this.finishReason,
      usage: this.usage,
      hasToolCalls: this.toolCalls.length > 0,
      hasText: this.text.trim().length > 0,
      aborted: this.aborted,
      error: this.error,
    };
  }

  /**
   * Check if the turn produced meaningful output
   */
  hasOutput() {
    return this.text.trim().length > 0 || this.toolCalls.length > 0;
  }

  /**
   * Check if the turn has pending work (tool calls without explanation)
   */
  needsFollowUp() {
    // If there were tool calls but little/no text, model should explain
    return this.toolCalls.length > 0 && this.text.trim().length < 20;
  }
}

/**
 * Execute a turn and handle streaming output
 * @param {Turn} turn - The turn to execute
 * @param {object} options - Options for display
 * @returns {object} Turn result
 */
export async function executeTurn(turn, options = {}) {
  const { onText, onToolCall, signal } = options;

  const generator = turn.run(signal);
  let result;

  // Process stream
  for await (const event of generator) {
    if (event.type === "text" && onText) {
      onText(event.content);
    } else if (event.type === "toolCall" && onToolCall) {
      onToolCall(event);
    }

    // Generator returns the result when done
    if (event.done) {
      result = event;
    }
  }

  // Get final result from generator return value
  result = turn.getResult();

  return result;
}

/**
 * Display turn result summary
 */
export function displayTurnSummary(result) {
  if (process.env.ORION_DEBUG) {
    console.log(chalk.dim("\n[Turn Summary]"));
    console.log(chalk.dim(`  Text length: ${result.text.length}`));
    console.log(chalk.dim(`  Tool calls: ${result.toolCalls.length}`));
    console.log(chalk.dim(`  Tool results: ${result.toolResults.length}`));
    console.log(chalk.dim(`  Finish reason: ${result.finishReason}`));
    console.log(chalk.dim(`  Needs follow-up: ${result.hasToolCalls && !result.hasText}`));
  }
}

export default Turn;
