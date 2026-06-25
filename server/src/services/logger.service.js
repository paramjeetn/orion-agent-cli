/**
 * Logger Service
 * Simple logging utility for debugging and session recording
 */

import { promises as fs } from "fs";
import path from "path";
import os from "os";
import chalk from "chalk";

// Log levels
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

export class Logger {
  constructor(options = {}) {
    this.sessionId = options.sessionId || this.generateSessionId();
    this.level = options.level ?? (process.env.ORION_DEBUG ? LogLevel.DEBUG : LogLevel.INFO);
    this.writeToFile = options.writeToFile ?? false;
    this.logDir = options.logDir || path.join(os.homedir(), ".orion", "logs");
    this.logs = [];
    this.initialized = false;
  }

  /**
   * Initialize the logger (create log directory if needed)
   */
  async initialize() {
    if (this.writeToFile && !this.initialized) {
      try {
        await fs.mkdir(this.logDir, { recursive: true });
        this.initialized = true;
      } catch (error) {
        // Silently fail - logging shouldn't break the app
        this.writeToFile = false;
      }
    }
  }

  /**
   * Log a debug message
   */
  debug(message, data = null) {
    if (this.level <= LogLevel.DEBUG) {
      this.log("DEBUG", message, data);
      if (process.env.ORION_DEBUG) {
        console.log(chalk.dim(`[DEBUG] ${message}`), data || "");
      }
    }
  }

  /**
   * Log an info message
   */
  info(message, data = null) {
    if (this.level <= LogLevel.INFO) {
      this.log("INFO", message, data);
    }
  }

  /**
   * Log a warning
   */
  warn(message, data = null) {
    if (this.level <= LogLevel.WARN) {
      this.log("WARN", message, data);
      console.log(chalk.yellow(`[WARN] ${message}`));
    }
  }

  /**
   * Log an error
   */
  error(message, error = null) {
    this.log("ERROR", message, {
      error: error?.message,
      stack: error?.stack,
    });
    console.error(chalk.red(`[ERROR] ${message}`));
    if (error && process.env.ORION_DEBUG) {
      console.error(chalk.dim(error.stack));
    }
  }

  /**
   * Log a tool execution
   */
  tool(toolName, args, result) {
    this.log("TOOL", toolName, {
      args: this.sanitizeArgs(args),
      success: result?.success,
      error: result?.error,
    });
  }

  /**
   * Log an API call
   */
  api(action, details = {}) {
    this.log("API", action, details);
  }

  /**
   * Internal log method
   */
  log(level, message, data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level,
      message,
      data,
    };

    this.logs.push(entry);

    // Keep only last 1000 logs in memory
    if (this.logs.length > 1000) {
      this.logs.shift();
    }

    // Async write to file if enabled
    if (this.writeToFile) {
      this.writeLogEntry(entry).catch(() => {});
    }
  }

  /**
   * Write a log entry to file
   */
  async writeLogEntry(entry) {
    if (!this.initialized) {
      await this.initialize();
    }

    const date = new Date().toISOString().split("T")[0];
    const logFile = path.join(this.logDir, `orion-${date}.log`);
    const line = JSON.stringify(entry) + "\n";

    try {
      await fs.appendFile(logFile, line, "utf-8");
    } catch {
      // Silently fail
    }
  }

  /**
   * Get all logs for the current session
   */
  getSessionLogs() {
    return this.logs.filter((log) => log.sessionId === this.sessionId);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level) {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Export logs as JSON
   */
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Clear in-memory logs
   */
  clear() {
    this.logs = [];
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId() {
    return `sess_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize arguments for logging (remove sensitive data)
   */
  sanitizeArgs(args) {
    if (!args) return null;

    const sanitized = { ...args };

    // Truncate long content
    if (sanitized.content && sanitized.content.length > 200) {
      sanitized.content = sanitized.content.substring(0, 200) + "... [truncated]";
    }

    // Remove potentially sensitive fields
    const sensitiveFields = ["password", "token", "secret", "key", "apiKey"];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    }

    return sanitized;
  }
}

// Singleton instance for global use
let globalLogger = null;

export function getLogger(options = {}) {
  if (!globalLogger) {
    globalLogger = new Logger(options);
  }
  return globalLogger;
}

export function createLogger(options = {}) {
  return new Logger(options);
}

export default Logger;
