/**
 * Loop Detection Service
 * Detects repetitive patterns in agent behavior to prevent infinite loops
 * Inspired by gemini-cli's loop detection approach
 */

import chalk from "chalk";

export class LoopDetectionService {
  constructor(options = {}) {
    this.maxRecentActions = options.maxRecentActions || 20;
    this.repeatThreshold = options.repeatThreshold || 3;
    this.windowSize = options.windowSize || 5;

    this.recentActions = [];
    this.toolCallPatterns = [];
    this.loopCount = 0;
  }

  /**
   * Record a tool call action
   * @param {string} toolName - Name of the tool called
   * @param {object} args - Arguments passed to the tool
   * @param {boolean} success - Whether the tool call succeeded
   */
  recordAction(toolName, args, success) {
    const action = {
      tool: toolName,
      argsHash: this.hashArgs(args),
      success,
      timestamp: Date.now(),
    };

    this.recentActions.push(action);

    // Keep only recent actions
    if (this.recentActions.length > this.maxRecentActions) {
      this.recentActions.shift();
    }
  }

  /**
   * Check if the agent is in a loop
   * @returns {object} { isLoop: boolean, type: string, message: string }
   */
  checkForLoop() {
    if (this.recentActions.length < this.windowSize) {
      return { isLoop: false };
    }

    // Check for exact same action repeated
    const repeatedSameAction = this.checkRepeatedSameAction();
    if (repeatedSameAction.isLoop) {
      return repeatedSameAction;
    }

    // Check for repeating pattern of actions
    const repeatingPattern = this.checkRepeatingPattern();
    if (repeatingPattern.isLoop) {
      return repeatingPattern;
    }

    // Check for repeated failures
    const repeatedFailures = this.checkRepeatedFailures();
    if (repeatedFailures.isLoop) {
      return repeatedFailures;
    }

    return { isLoop: false };
  }

  /**
   * Check if the same action is being repeated
   */
  checkRepeatedSameAction() {
    if (this.recentActions.length < this.repeatThreshold) {
      return { isLoop: false };
    }

    const lastN = this.recentActions.slice(-this.repeatThreshold);
    const firstAction = lastN[0];

    const allSame = lastN.every(
      (action) =>
        action.tool === firstAction.tool &&
        action.argsHash === firstAction.argsHash
    );

    if (allSame) {
      this.loopCount++;
      return {
        isLoop: true,
        type: "repeated_action",
        message: `Same action "${firstAction.tool}" repeated ${this.repeatThreshold} times`,
        action: firstAction,
      };
    }

    return { isLoop: false };
  }

  /**
   * Check for repeating patterns (e.g., A -> B -> A -> B)
   */
  checkRepeatingPattern() {
    if (this.recentActions.length < this.windowSize * 2) {
      return { isLoop: false };
    }

    // Get the last window of actions
    const recent = this.recentActions.slice(-this.windowSize * 2);
    const firstHalf = recent.slice(0, this.windowSize);
    const secondHalf = recent.slice(this.windowSize);

    // Check if the pattern repeats
    const patternsMatch = firstHalf.every((action, index) => {
      const corresponding = secondHalf[index];
      return (
        action.tool === corresponding.tool &&
        action.argsHash === corresponding.argsHash
      );
    });

    if (patternsMatch) {
      this.loopCount++;
      const pattern = firstHalf.map((a) => a.tool).join(" -> ");
      return {
        isLoop: true,
        type: "repeating_pattern",
        message: `Repeating pattern detected: ${pattern}`,
        pattern: firstHalf,
      };
    }

    return { isLoop: false };
  }

  /**
   * Check for repeated failures on the same operation
   */
  checkRepeatedFailures() {
    const failureThreshold = 3;
    const failures = this.recentActions.filter((a) => !a.success);

    if (failures.length < failureThreshold) {
      return { isLoop: false };
    }

    // Check if recent failures are all the same operation
    const recentFailures = failures.slice(-failureThreshold);
    const firstFailure = recentFailures[0];

    const allSameFailure = recentFailures.every(
      (f) => f.tool === firstFailure.tool && f.argsHash === firstFailure.argsHash
    );

    if (allSameFailure) {
      this.loopCount++;
      return {
        isLoop: true,
        type: "repeated_failures",
        message: `Same operation "${firstFailure.tool}" failing repeatedly`,
        action: firstFailure,
      };
    }

    return { isLoop: false };
  }

  /**
   * Get a recommendation for breaking the loop
   */
  getLoopBreakingAdvice(loopInfo) {
    switch (loopInfo.type) {
      case "repeated_action":
        return `The agent is repeating the same ${loopInfo.action.tool} action. Consider providing different instructions or checking if the operation is actually completing.`;

      case "repeating_pattern":
        return `The agent is stuck in a cycle. This often happens when two operations depend on each other or when the agent can't make progress. Try providing more specific instructions.`;

      case "repeated_failures":
        return `The agent is repeatedly failing at "${loopInfo.action.tool}". Check if the target exists, permissions are correct, or if the operation is valid.`;

      default:
        return "Consider interrupting and providing new instructions.";
    }
  }

  /**
   * Display loop warning to user
   */
  displayLoopWarning(loopInfo) {
    console.log(chalk.yellow("\n⚠ Loop Detected"));
    console.log(chalk.yellow(`   Type: ${loopInfo.type}`));
    console.log(chalk.yellow(`   ${loopInfo.message}`));
    console.log(chalk.dim(`\n   ${this.getLoopBreakingAdvice(loopInfo)}\n`));
  }

  /**
   * Reset loop detection state
   */
  reset() {
    this.recentActions = [];
    this.loopCount = 0;
  }

  /**
   * Clear recent actions but keep loop count
   */
  clearRecent() {
    this.recentActions = [];
  }

  /**
   * Get statistics about loop detection
   */
  getStats() {
    return {
      totalActions: this.recentActions.length,
      loopsDetected: this.loopCount,
      recentTools: this.recentActions.slice(-5).map((a) => a.tool),
    };
  }

  /**
   * Create a hash of arguments for comparison
   * @private
   */
  hashArgs(args) {
    if (!args) return "null";

    // Simple hash based on JSON representation
    const str = JSON.stringify(args, Object.keys(args).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }
}

export default LoopDetectionService;
