/**
 * Agent Session Manager
 * Manages session state, project context, and conversation history
 */

import { promises as fs } from "fs";
import path from "path";
import { ToolMemory } from "../../../tools/tool-memory.js";
import { LoopDetectionService } from "../../../services/loop-detection.service.js";
import { createLogger } from "../../../services/logger.service.js";
import { TaskPlanner } from "./task-planner.js";

/**
 * Project type detection configurations
 */
const PROJECT_DETECTORS = [
  {
    file: "package.json",
    type: "node",
    detect: async (content) => {
      try {
        const pkg = JSON.parse(content);
        let framework = null;

        // Detect framework
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.next) framework = "Next.js";
        else if (deps.react) framework = "React";
        else if (deps.vue) framework = "Vue";
        else if (deps.svelte) framework = "Svelte";
        else if (deps.express) framework = "Express";
        else if (deps.fastify) framework = "Fastify";
        else if (deps.nestjs || deps["@nestjs/core"]) framework = "NestJS";

        return {
          name: pkg.name,
          version: pkg.version,
          type: "Node.js",
          language: deps.typescript ? "TypeScript" : "JavaScript",
          framework,
          scripts: Object.keys(pkg.scripts || {}),
        };
      } catch {
        return { type: "Node.js" };
      }
    },
  },
  {
    file: "requirements.txt",
    type: "python",
    detect: async (content) => {
      let framework = null;
      if (content.includes("django")) framework = "Django";
      else if (content.includes("flask")) framework = "Flask";
      else if (content.includes("fastapi")) framework = "FastAPI";

      return {
        type: "Python",
        language: "Python",
        framework,
      };
    },
  },
  {
    file: "pyproject.toml",
    type: "python",
    detect: async () => ({ type: "Python", language: "Python" }),
  },
  {
    file: "Cargo.toml",
    type: "rust",
    detect: async (content) => {
      const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
      return {
        type: "Rust",
        language: "Rust",
        name: nameMatch ? nameMatch[1] : null,
      };
    },
  },
  {
    file: "go.mod",
    type: "go",
    detect: async (content) => {
      const moduleMatch = content.match(/module\s+(\S+)/);
      return {
        type: "Go",
        language: "Go",
        name: moduleMatch ? moduleMatch[1] : null,
      };
    },
  },
  {
    file: "pom.xml",
    type: "java",
    detect: async () => ({ type: "Java/Maven", language: "Java" }),
  },
  {
    file: "build.gradle",
    type: "java",
    detect: async () => ({ type: "Java/Gradle", language: "Java" }),
  },
];

export class AgentSession {
  constructor(conversationId, workingDirectory) {
    this.conversationId = conversationId;
    this.cwd = workingDirectory || process.cwd();
    this.toolMemory = new ToolMemory(conversationId);
    this.loopDetector = new LoopDetectionService();
    this.logger = createLogger({ sessionId: conversationId });
    this.taskPlanner = new TaskPlanner();
    this.projectContext = null;
    this.startTime = new Date();
    this.messages = [];
    this.isProcessing = false;
    this.currentOperation = null;
    this.abortController = null;

    // Track last tool calls for continuation logic
    this.lastToolCalls = [];
    this.lastToolResults = [];
  }

  /**
   * Initialize the session by detecting project context
   */
  async initialize() {
    this.projectContext = await this.detectProjectContext();
    return this;
  }

  /**
   * Detect the type of project in the working directory
   */
  async detectProjectContext() {
    for (const detector of PROJECT_DETECTORS) {
      const filePath = path.join(this.cwd, detector.file);

      try {
        const content = await fs.readFile(filePath, "utf8");
        const context = await detector.detect(content);
        return context;
      } catch {
        // File doesn't exist, try next detector
      }
    }

    // No specific project detected
    return {
      type: "Unknown",
      language: "Unknown",
    };
  }

  /**
   * Add a message to the conversation history
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   * @param {object} metadata - Optional metadata (toolCalls, toolResults, etc.)
   */
  addMessage(role, content, metadata = {}) {
    this.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Add tool results as a context message
   * @param {Array} toolResults - Array of tool results
   */
  addToolResultMessage(toolResults) {
    if (!toolResults || toolResults.length === 0) return;

    const formattedResults = toolResults.map(tr => {
      const result = tr.result;
      if (!result) return `${tr.toolName}: completed`;

      if (tr.toolName === "listDirectory" && result.entries) {
        const dirs = result.entries.filter(e => e.type === "directory").length;
        const files = result.entries.filter(e => e.type === "file").length;
        return `listDirectory: ${dirs} directories, ${files} files`;
      }

      if (tr.toolName === "readFile" && result.content) {
        return `readFile (${result.path}): ${result.lines || "?"} lines`;
      }

      if (tr.toolName === "createFile") {
        return `createFile: created ${result.path}`;
      }

      if (tr.toolName === "editFile") {
        return `editFile: modified ${result.path}`;
      }

      if (tr.toolName === "runCommand") {
        return `runCommand: exit code ${result.exitCode}`;
      }

      return `${tr.toolName}: ${result.success ? "success" : "failed"}`;
    });

    this.addMessage("user", `[Tool Results]\n${formattedResults.join("\n")}`, {
      isToolResult: true,
      toolResults: toolResults,
    });
  }

  /**
   * Get messages formatted for the AI SDK
   */
  getMessagesForAI() {
    return this.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Get the current session context for the system prompt
   */
  getContext() {
    return {
      cwd: this.cwd,
      toolMemory: this.toolMemory,
      loopDetector: this.loopDetector,
      logger: this.logger,
      taskPlanner: this.taskPlanner,
      projectContext: this.projectContext,
      messageCount: this.messages.length,
      duration: Math.round((new Date() - this.startTime) / 1000 / 60),
    };
  }

  /**
   * Record a tool action (for loop detection)
   */
  recordToolAction(toolName, args, success) {
    this.loopDetector.recordAction(toolName, args, success);
    this.logger.tool(toolName, args, { success });
  }

  /**
   * Check if the agent is in a loop
   */
  checkForLoop() {
    const loopInfo = this.loopDetector.checkForLoop();
    if (loopInfo.isLoop) {
      this.logger.warn("Loop detected", loopInfo);
      this.loopDetector.displayLoopWarning(loopInfo);
    }
    return loopInfo;
  }

  /**
   * Get session summary
   */
  getSummary() {
    const memSummary = this.toolMemory.getSummary();
    const duration = Math.round((new Date() - this.startTime) / 1000 / 60);

    return {
      conversationId: this.conversationId,
      workingDirectory: this.cwd,
      projectType: this.projectContext?.type || "Unknown",
      duration: `${duration} minute${duration !== 1 ? "s" : ""}`,
      messagesExchanged: this.messages.length,
      ...memSummary,
    };
  }

  /**
   * Get detailed session info for display
   */
  getDetails() {
    return {
      ...this.getSummary(),
      ...this.toolMemory.getDetails(),
      projectContext: this.projectContext,
    };
  }

  /**
   * Set processing state (for interrupt handling)
   */
  setProcessing(isProcessing, operation = null) {
    this.isProcessing = isProcessing;
    this.currentOperation = operation;

    if (isProcessing) {
      this.abortController = new AbortController();
    } else {
      this.abortController = null;
    }
  }

  /**
   * Abort current operation
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isProcessing = false;
    this.currentOperation = null;
  }

  /**
   * Check if an abort has been requested
   */
  isAborted() {
    return this.abortController?.signal?.aborted || false;
  }

  /**
   * Serialize session state for persistence
   */
  toJSON() {
    return {
      conversationId: this.conversationId,
      cwd: this.cwd,
      projectContext: this.projectContext,
      startTime: this.startTime.toISOString(),
      messages: this.messages,
      toolMemory: this.toolMemory.toJSON(),
    };
  }

  /**
   * Restore session from JSON
   */
  static fromJSON(data) {
    const session = new AgentSession(data.conversationId, data.cwd);
    session.projectContext = data.projectContext;
    session.startTime = new Date(data.startTime);
    session.messages = data.messages || [];

    if (data.toolMemory) {
      session.toolMemory = ToolMemory.fromJSON(data.toolMemory);
    }

    return session;
  }

  /**
   * Clear session state (for reset)
   */
  clear() {
    this.messages = [];
    this.toolMemory.clear();
    this.taskPlanner.clear();
    this.startTime = new Date();
  }
}

export default AgentSession;
