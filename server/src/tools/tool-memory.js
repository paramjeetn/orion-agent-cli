/**
 * Tool Memory System
 * Tracks all tool executions during an agent session for context awareness
 */

import chalk from "chalk";

export class ToolMemory {
  constructor(conversationId) {
    this.conversationId = conversationId;
    this.startTime = new Date();
    this.actions = [];

    // Categorized tracking
    this.filesCreated = [];
    this.filesModified = [];
    this.filesDeleted = [];
    this.filesRead = [];
    this.commandsRun = [];
    this.searchesPerformed = [];

    // Track current project folder (when scaffolding creates a new folder)
    this.currentProjectFolder = null;

    // File content cache - avoid re-reading same files
    this.fileCache = new Map();
    this.cacheMaxAge = 60000; // 1 minute cache
  }

  /**
   * Extract project folder name from scaffolding commands
   */
  extractProjectFolder(command) {
    if (!command) return null;

    // Common scaffolding patterns
    const patterns = [
      // npx create-next-app my-app
      /npx\s+create-next-app(?:@\S+)?\s+([^\s-]+)/i,
      // npx create-react-app my-app
      /npx\s+create-react-app\s+([^\s-]+)/i,
      // npx create-vite my-app
      /npx\s+create-vite\s+([^\s-]+)/i,
      // npm create vite@latest my-app
      /npm\s+create\s+\S+\s+([^\s-]+)/i,
      // mkdir my-app && cd my-app
      /mkdir\s+([^\s&]+)/i,
      // git clone ... my-app
      /git\s+clone\s+\S+\s+([^\s]+)$/i,
    ];

    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match && match[1] && !match[1].startsWith('-')) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Cache file content
   */
  cacheFile(path, content, lines) {
    this.fileCache.set(path, {
      content,
      lines,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached file content if still valid
   */
  getCachedFile(path) {
    const cached = this.fileCache.get(path);
    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.cacheMaxAge) {
      this.fileCache.delete(path);
      return null;
    }

    return cached;
  }

  /**
   * Invalidate cache for a file (when it's modified)
   */
  invalidateCache(path) {
    this.fileCache.delete(path);
  }

  /**
   * Check if file is in cache
   */
  isFileCached(path) {
    return this.getCachedFile(path) !== null;
  }

  /**
   * Record a tool action
   * @param {string} toolName - Name of the tool executed
   * @param {object} details - Action details
   */
  recordAction(toolName, details) {
    const action = {
      timestamp: new Date().toISOString(),
      tool: toolName,
      details: details,
      success: details.success !== false,
    };

    this.actions.push(action);

    // Categorize the action
    switch (toolName) {
      case "createFile":
        if (action.success) {
          this.filesCreated.push({
            path: details.path,
            timestamp: action.timestamp,
            size: details.size || details.bytesWritten,
          });
        }
        break;

      case "editFile":
        if (action.success && !this.filesModified.find((f) => f.path === details.path)) {
          this.filesModified.push({
            path: details.path,
            timestamp: action.timestamp,
            changes: details.occurrencesReplaced || 1,
          });
        }
        break;

      case "deleteFile":
        if (action.success) {
          this.filesDeleted.push({
            path: details.path,
            timestamp: action.timestamp,
          });
          // Remove from created/modified if it was tracked
          this.filesCreated = this.filesCreated.filter((f) => f.path !== details.path);
          this.filesModified = this.filesModified.filter((f) => f.path !== details.path);
        }
        break;

      case "readFile":
        if (action.success && !this.filesRead.find((f) => f.path === details.path)) {
          this.filesRead.push({
            path: details.path,
            timestamp: action.timestamp,
          });
        }
        break;

      case "runCommand":
        this.commandsRun.push({
          command: details.command,
          exitCode: details.exitCode,
          success: details.exitCode === 0,
          approved: details.approved !== false,
          timestamp: action.timestamp,
          duration: details.duration,
        });
        // Detect scaffolding commands that create project folders
        if (action.success) {
          const projectFolder = this.extractProjectFolder(details.command);
          if (projectFolder) {
            this.currentProjectFolder = projectFolder;
          }
        }
        break;

      case "searchCode":
      case "listDirectory":
        this.searchesPerformed.push({
          type: toolName,
          query: details.pattern || details.path,
          timestamp: action.timestamp,
          resultCount: details.totalMatches || details.totalFiles || 0,
        });
        break;
    }

    // Debug log (can be disabled in production)
    if (process.env.DEBUG_TOOLS) {
      console.log(chalk.gray(`[ToolMemory] ${toolName}: ${JSON.stringify(details)}`));
    }
  }

  /**
   * Get session statistics summary
   */
  getSummary() {
    const duration = Math.round((new Date() - this.startTime) / 1000 / 60); // minutes

    return {
      duration: duration,
      totalActions: this.actions.length,
      filesCreated: this.filesCreated.length,
      filesModified: this.filesModified.length,
      filesDeleted: this.filesDeleted.length,
      filesRead: this.filesRead.length,
      commandsRun: this.commandsRun.length,
      successfulCommands: this.commandsRun.filter((c) => c.success).length,
      failedCommands: this.commandsRun.filter((c) => !c.success).length,
      searchesPerformed: this.searchesPerformed.length,
    };
  }

  /**
   * Get detailed lists of all tracked items
   */
  getDetails() {
    return {
      filesCreated: this.filesCreated.map((f) => f.path),
      filesModified: this.filesModified.map((f) => f.path),
      filesDeleted: this.filesDeleted.map((f) => f.path),
      filesRead: this.filesRead.map((f) => f.path),
      commandsRun: this.commandsRun.map((c) => ({
        command: c.command,
        success: c.success,
      })),
    };
  }

  /**
   * Get context string for AI system prompt
   * This helps the AI understand what has happened in the session
   */
  getContextForAI() {
    const parts = [];

    // CRITICAL: Show current project folder prominently
    if (this.currentProjectFolder) {
      parts.push(`## CURRENT PROJECT FOLDER: ${this.currentProjectFolder}
**ALL new files MUST be created inside "${this.currentProjectFolder}/"**
Example paths:
- ${this.currentProjectFolder}/src/components/MyComponent.tsx
- ${this.currentProjectFolder}/src/app/page.tsx
- ${this.currentProjectFolder}/package.json`);
    }

    if (this.filesCreated.length > 0) {
      parts.push(`Files created:\n${this.filesCreated.map((f) => `  - ${f.path}`).join("\n")}`);
    }

    if (this.filesModified.length > 0) {
      parts.push(`Files modified:\n${this.filesModified.map((f) => `  - ${f.path}`).join("\n")}`);
    }

    if (this.commandsRun.length > 0) {
      const cmdSummary = this.commandsRun
        .slice(-5)
        .map((c) => `  - ${c.command} (${c.success ? "✓" : "✗"})`)
        .join("\n");
      parts.push(`Recent commands:\n${cmdSummary}`);
    }

    return parts.length > 0 ? "\n## Session Context\n" + parts.join("\n\n") : "";
  }

  /**
   * Get all files that have been touched (created or modified)
   */
  getTouchedFiles() {
    const touched = new Set();
    this.filesCreated.forEach((f) => touched.add(f.path));
    this.filesModified.forEach((f) => touched.add(f.path));
    return Array.from(touched);
  }

  /**
   * Check if a file was created in this session
   */
  wasFileCreated(path) {
    return this.filesCreated.some((f) => f.path === path);
  }

  /**
   * Check if a file was modified in this session
   */
  wasFileModified(path) {
    return this.filesModified.some((f) => f.path === path);
  }

  /**
   * Get recent actions (for debugging or display)
   */
  getRecentActions(count = 10) {
    return this.actions.slice(-count);
  }

  /**
   * Serialize session state for persistence
   */
  toJSON() {
    return {
      conversationId: this.conversationId,
      startTime: this.startTime.toISOString(),
      actions: this.actions,
      filesCreated: this.filesCreated,
      filesModified: this.filesModified,
      filesDeleted: this.filesDeleted,
      filesRead: this.filesRead,
      commandsRun: this.commandsRun,
      searchesPerformed: this.searchesPerformed,
    };
  }

  /**
   * Restore session state from JSON
   */
  static fromJSON(data) {
    const memory = new ToolMemory(data.conversationId);
    memory.startTime = new Date(data.startTime);
    memory.actions = data.actions || [];
    memory.filesCreated = data.filesCreated || [];
    memory.filesModified = data.filesModified || [];
    memory.filesDeleted = data.filesDeleted || [];
    memory.filesRead = data.filesRead || [];
    memory.commandsRun = data.commandsRun || [];
    memory.searchesPerformed = data.searchesPerformed || [];
    return memory;
  }

  /**
   * Clear all tracked data (for testing or reset)
   */
  clear() {
    this.actions = [];
    this.filesCreated = [];
    this.filesModified = [];
    this.filesDeleted = [];
    this.filesRead = [];
    this.commandsRun = [];
    this.searchesPerformed = [];
    this.currentProjectFolder = null;
    this.fileCache.clear();
  }

  /**
   * Get current project folder
   */
  getCurrentProjectFolder() {
    return this.currentProjectFolder;
  }

  /**
   * Set current project folder manually
   */
  setCurrentProjectFolder(folder) {
    this.currentProjectFolder = folder;
  }
}

export default ToolMemory;
