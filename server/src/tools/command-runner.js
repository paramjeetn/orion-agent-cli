/**
 * Command Runner
 * Executes shell commands with permission prompts and safety checks
 * Supports ESC key to abort running commands (like Claude Code)
 */

import { spawn, execSync } from "child_process";
import { confirm } from "@clack/prompts";
import chalk from "chalk";

// Default timeout: 5 minutes (for long-running commands like npm install)
const DEFAULT_TIMEOUT = 300000;

// Track the currently running process for ESC key abort
let currentProcess = null;
let escKeyListener = null;

/**
 * Kill a process - handles Windows and Unix differently
 */
function killProcess(proc) {
  if (!proc || proc.killed) return;

  const isWindows = process.platform === "win32";

  if (isWindows) {
    // On Windows, use taskkill to force kill the process tree
    try {
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: "ignore" });
    } catch {
      // Fallback to regular kill
      try { proc.kill(); } catch {}
    }
  } else {
    // On Unix, SIGTERM then SIGKILL
    try {
      proc.kill("SIGTERM");
      setTimeout(() => {
        try { if (!proc.killed) proc.kill("SIGKILL"); } catch {}
      }, 1000);
    } catch {}
  }
}

/**
 * Setup ESC key listener to abort current process
 */
function setupEscKeyListener(proc, onAbort) {
  // Enable raw mode to capture individual key presses
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();

    escKeyListener = (key) => {
      // ESC key = \x1b (27)
      if (key.toString() === '\x1b') {
        console.log(chalk.yellow('\n\n⚠ Aborting command...'));
        killProcess(proc);
        if (onAbort) onAbort();
      }
      // Also handle Ctrl+C (for compatibility)
      if (key.toString() === '\x03') {
        console.log(chalk.yellow('\n\n⚠ Aborting command...'));
        killProcess(proc);
        if (onAbort) onAbort();
      }
    };

    process.stdin.on('data', escKeyListener);
  }
}

/**
 * Clean up ESC key listener
 */
function cleanupEscKeyListener() {
  if (escKeyListener && process.stdin.isTTY) {
    process.stdin.removeListener('data', escKeyListener);
    process.stdin.setRawMode(false);
    process.stdin.pause();
    escKeyListener = null;
  }
}

// Commands that require extra confirmation
const DANGEROUS_PATTERNS = [
  "rm -rf",
  "rm -r",
  "rmdir /s",
  "del /s",
  "format",
  "mkfs",
  "dd if=",
  "git reset --hard",
  "git push -f",
  "git push --force",
  "sudo",
  "chmod -R",
  "chown -R",
  "> /dev/",
  ":(){ :|:& };:",
];

// Commands that should never be auto-allowed
const NEVER_AUTO_ALLOW = [
  "rm",
  "rmdir",
  "del",
  "sudo",
  "chmod",
  "chown",
  "git push",
  "git reset",
];

/**
 * Check if a command matches dangerous patterns
 */
function isDangerousCommand(command) {
  const lowerCommand = command.toLowerCase();
  return DANGEROUS_PATTERNS.some((pattern) => lowerCommand.includes(pattern.toLowerCase()));
}

/**
 * Check if command can potentially be auto-allowed
 */
function canAutoAllow(command) {
  const lowerCommand = command.toLowerCase().trim();
  return !NEVER_AUTO_ALLOW.some((pattern) => lowerCommand.startsWith(pattern.toLowerCase()));
}

/**
 * Display command request - compact, Claude Code-like style
 */
function displayCommandRequest(command, description, isDangerous) {
  console.log(); // Single line break

  if (isDangerous) {
    console.log(chalk.red.bold("⚠ Dangerous Command"));
    console.log(chalk.red(`  ${command}`));
    console.log(chalk.dim(`  ${description}`));
  } else {
    console.log(chalk.yellow("Run command:"), chalk.white(command));
    if (description) {
      console.log(chalk.dim(`  ${description}`));
    }
  }
}

/**
 * Request permission to run a command
 * @param {string} command - The command to run
 * @param {string} description - Why the command is needed
 * @param {object} options - Additional options
 * @returns {Promise<boolean>} Whether permission was granted
 */
export async function requestCommandPermission(command, description, options = {}) {
  const isDangerous = isDangerousCommand(command);

  // Display the request
  displayCommandRequest(command, description, isDangerous);

  // For dangerous commands, require explicit confirmation
  if (isDangerous) {
    console.log(chalk.red('\nType "ALLOW" to proceed, or press Enter to cancel:'));

    // Use readline for dangerous command confirmation
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(chalk.red("> "), (answer) => {
        rl.close();
        const allowed = answer.trim().toUpperCase() === "ALLOW";
        if (!allowed) {
          console.log(chalk.yellow("\nCommand cancelled."));
        }
        resolve(allowed);
      });
    });
  }

  // Normal permission prompt
  const shouldRun = await confirm({
    message: chalk.cyan("Do you want to run this command?"),
    initialValue: true,
  });

  if (!shouldRun) {
    console.log(chalk.yellow("\nCommand declined."));
  }

  return shouldRun;
}

/**
 * Execute a shell command
 * @param {string} command - Command to execute
 * @param {string} cwd - Working directory
 * @param {number} timeout - Timeout in milliseconds
 * @param {function} onOutput - Callback for output streaming
 * @returns {Promise<object>} Execution result
 */
export function executeCommand(command, cwd, timeout = DEFAULT_TIMEOUT, onOutput = null) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const isWindows = process.platform === "win32";

    // Determine shell based on platform
    const shell = isWindows ? process.env.COMSPEC || "cmd.exe" : "/bin/sh";
    const shellArg = isWindows ? "/c" : "-c";

    // Spawn the process
    const proc = spawn(shell, [shellArg, command], {
      cwd: cwd,
      env: { ...process.env },
      stdio: ["inherit", "pipe", "pipe"],
    });

    // Store reference for ESC key abort
    currentProcess = proc;

    let stdout = "";
    let stderr = "";
    let killed = false;
    let abortedByUser = false;

    // Setup ESC key listener to abort command
    setupEscKeyListener(proc, () => {
      abortedByUser = true;
      killed = true;
    });

    // Minimal ESC hint
    console.log(chalk.dim("ESC to abort"));

    // Handle stdout
    proc.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;

      // Stream output if callback provided, otherwise print
      if (onOutput) {
        onOutput("stdout", text);
      } else {
        process.stdout.write(chalk.gray(text));
      }
    });

    // Handle stderr
    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;

      if (onOutput) {
        onOutput("stderr", text);
      } else {
        process.stderr.write(chalk.red(text));
      }
    });

    // Timeout handler
    const timeoutId = setTimeout(() => {
      killed = true;
      proc.kill("SIGTERM");

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {
          // Process already dead
        }
      }, 5000);
    }, timeout);

    // Handle process close
    proc.on("close", (exitCode) => {
      clearTimeout(timeoutId);
      cleanupEscKeyListener();
      currentProcess = null;
      const duration = Date.now() - startTime;

      if (abortedByUser) {
        resolve({
          success: false,
          command: command,
          exitCode: exitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          duration: duration,
          error: "Command aborted by user",
          aborted: true,
        });
      } else if (killed) {
        resolve({
          success: false,
          command: command,
          exitCode: exitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          duration: duration,
          error: `Command timed out after ${timeout / 1000} seconds`,
          timedOut: true,
        });
      } else {
        resolve({
          success: exitCode === 0,
          command: command,
          exitCode: exitCode || 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          duration: duration,
        });
      }
    });

    // Handle spawn errors
    proc.on("error", (error) => {
      clearTimeout(timeoutId);
      cleanupEscKeyListener();
      currentProcess = null;
      resolve({
        success: false,
        command: command,
        exitCode: -1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        duration: Date.now() - startTime,
        error: error.message,
      });
    });
  });
}

/**
 * Run a command with permission prompt
 * @param {string} command - Command to execute
 * @param {string} description - Why the command is needed
 * @param {string} cwd - Working directory
 * @param {object} options - Additional options
 * @returns {Promise<object>} Execution result
 */
export async function runCommandWithPermission(command, description, cwd, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, onOutput = null, skipPermission = false } = options;

  // Request permission (unless skipped)
  if (!skipPermission) {
    const allowed = await requestCommandPermission(command, description, options);

    if (!allowed) {
      return {
        success: false,
        command: command,
        error: "User declined to run command",
        declined: true,
      };
    }
  }

  // Execute the command
  console.log(); // Clean line before output
  const result = await executeCommand(command, cwd, timeout, onOutput);

  // Compact result indicator
  if (result.aborted) {
    console.log(chalk.yellow("\n⚠ Aborted"));
  } else if (result.timedOut) {
    console.log(chalk.red(`\n✗ Timed out (${timeout / 1000}s)`));
  } else if (!result.success) {
    console.log(chalk.red(`\n✗ Failed (exit ${result.exitCode})`));
  }
  // Don't print success - the output speaks for itself

  return result;
}

/**
 * Create a command runner bound to a working directory
 */
export function createCommandRunner(cwd) {
  return {
    /**
     * Run a command with permission
     */
    run: (command, description, options = {}) => {
      return runCommandWithPermission(command, description, cwd, options);
    },

    /**
     * Check if command is dangerous
     */
    isDangerous: isDangerousCommand,

    /**
     * Check if command can be auto-allowed
     */
    canAutoAllow: canAutoAllow,
  };
}

export default {
  executeCommand,
  runCommandWithPermission,
  requestCommandPermission,
  createCommandRunner,
  isDangerousCommand,
  canAutoAllow,
};
