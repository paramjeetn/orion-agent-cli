/**
 * Agent Tools Configuration
 * Defines all tools available to the AI agent using Vercel AI SDK format
 */

import { z } from "zod";
import { tool } from "ai";
import chalk from "chalk";
import { FileOperationsService } from "../services/file-operations.service.js";
import { runCommandWithPermission } from "../tools/command-runner.js";

// Tool display icons
const TOOL_ICONS = {
  createFile: "📝",
  readFile: "📖",
  editFile: "✏️",
  deleteFile: "🗑️",
  listDirectory: "📂",
  searchCode: "🔍",
  runCommand: "⚡",
  createPlan: "📋",
  updatePlanStep: "✅",
};

/**
 * Display tool execution start
 */
function showToolStart(toolName, args) {
  const icon = TOOL_ICONS[toolName] || "🔧";
  const path = args.path || args.command || args.pattern || "";
  console.log(chalk.hex("#60A5FA")(`\n${icon} [${toolName}] ${path}`));
}

/**
 * Display tool execution result
 * Improved to handle all edge cases gracefully
 */
function showToolResult(toolName, result) {
  // Handle missing result - don't show warning, just log for debug
  if (!result) {
    if (process.env.ORION_DEBUG) {
      console.log(chalk.dim(`   [Debug] Tool ${toolName} returned no result object`));
    }
    return;
  }

  // Handle explicit failure
  if (result.success === false) {
    if (result.declined) {
      console.log(chalk.yellow(`   ⚠ Declined by user`));
    } else {
      console.log(chalk.red(`   ✗ Error: ${result.error || "Unknown error"}`));
    }
    return;
  }

  // Handle success cases
  switch (toolName) {
    case "createFile":
      console.log(chalk.green(`   ✓ Created: ${result.path || "file"} (${result.bytesWritten || 0} bytes)`));
      break;
    case "readFile":
      console.log(chalk.green(`   ✓ Read: ${result.path || "file"} (${result.lines || 0} lines)`));
      break;
    case "editFile":
      const count = result.occurrencesReplaced || 0;
      console.log(chalk.green(`   ✓ Edited: ${result.path || "file"} (${count} replacement${count !== 1 ? "s" : ""})`));
      break;
    case "deleteFile":
      console.log(chalk.green(`   ✓ Deleted: ${result.path || "file"}`));
      break;
    case "listDirectory":
      console.log(chalk.green(`   ✓ Listed: ${result.totalFiles || 0} files, ${result.totalDirectories || 0} directories`));
      break;
    case "searchCode":
      console.log(chalk.green(`   ✓ Found: ${result.totalMatches || 0} matches in ${result.filesWithMatches || 0} files`));
      break;
    case "runCommand":
      // runCommand handles its own display, but include fallback
      if (result.exitCode !== undefined) {
        const status = result.exitCode === 0 ? chalk.green("✓") : chalk.red("✗");
        console.log(`   ${status} Exit code: ${result.exitCode}`);
      } else {
        console.log(chalk.green(`   ✓ Command completed`));
      }
      break;
    default:
      console.log(chalk.green(`   ✓ Completed`));
  }
}

/**
 * Create agent tools bound to a session context
 * @param {object} context - Session context with cwd, toolMemory, loopDetector, logger, etc.
 * @returns {object} Tools object for AI SDK
 */
export function createAgentTools(context) {
  const { cwd, toolMemory, loopDetector, logger, taskPlanner } = context;
  const fileOps = new FileOperationsService(cwd);

  /**
   * Record tool action for loop detection and logging
   */
  const recordAction = (toolName, args, result) => {
    // Record for tool memory (file tracking)
    toolMemory.recordAction(toolName, {
      ...args,
      success: result?.success,
      error: result?.error,
    });

    // Record for loop detection
    if (loopDetector) {
      loopDetector.recordAction(toolName, args, result?.success ?? true);
    }

    // Log the action
    if (logger) {
      logger.tool(toolName, args, result);
    }
  };

  return {
    /**
     * Create a new file with content
     */
    createFile: tool({
      description:
        "Create or overwrite a file with the specified content. Creates parent directories automatically. Overwrites if file exists.",
      parameters: z.object({
        path: z
          .string()
          .describe("Relative file path from working directory (e.g., 'src/components/Button.jsx')"),
        content: z.string().describe("The content to write to the file"),
      }),
      execute: async ({ path, content }) => {
        // SAFEGUARD: Check if this file was already created in this session
        // Prevents infinite loops where AI keeps recreating the same file
        if (toolMemory.wasFileCreated(path)) {
          console.log(chalk.yellow(`\n⚠ [createFile] ${path} - Already created this session, skipping`));
          return {
            success: true,
            path,
            bytesWritten: 0,
            skipped: true,
            message: `File "${path}" was already created in this session. Use editFile to modify it, or move on to the next task.`,
          };
        }

        showToolStart("createFile", { path });
        const result = await fileOps.createFile(path, content, true); // Always overwrite
        showToolResult("createFile", result);

        // Cache the new file content
        if (result.success) {
          toolMemory.cacheFile(path, content, content.split("\n").length);
          // Invalidate old cache if overwritten
          if (result.overwritten) {
            toolMemory.invalidateCache(path);
          }
        }

        recordAction("createFile", { path, bytesWritten: result?.bytesWritten, overwritten: result?.overwritten }, result);
        return result;
      },
    }),

    /**
     * Read an existing file
     */
    readFile: tool({
      description:
        "Read the contents of an existing file. Use this to understand existing code before making modifications, or to check configuration files.",
      parameters: z.object({
        path: z.string().describe("Relative file path to read"),
      }),
      execute: async ({ path }) => {
        // Check cache first
        const cached = toolMemory.getCachedFile(path);
        if (cached) {
          console.log(chalk.hex("#60A5FA")(`\n📖 [readFile] ${path} ${chalk.dim("(cached)")}`));
          console.log(chalk.green(`   ✓ Read: ${path} (${cached.lines} lines, cached)`));
          recordAction("readFile", { path, cached: true }, { success: true });
          return {
            success: true,
            path: path,
            content: cached.content,
            lines: cached.lines,
            cached: true
          };
        }

        showToolStart("readFile", { path });
        const result = await fileOps.readFile(path);
        showToolResult("readFile", result);

        // Cache successful reads
        if (result.success) {
          toolMemory.cacheFile(path, result.content, result.lines);
        }

        recordAction("readFile", { path, size: result?.size }, result);
        return result;
      },
    }),

    /**
     * Edit an existing file with search and replace
     */
    editFile: tool({
      description:
        "Edit an existing file by finding and replacing specific text. IMPORTANT: The search text must be an EXACT character-for-character match including whitespace. Read the file first if unsure of the exact content.",
      parameters: z.object({
        path: z.string().describe("Relative file path to edit"),
        search: z.string().describe("The EXACT text to find (must match perfectly including whitespace)"),
        replace: z.string().describe("The text to replace it with"),
        replaceAll: z
          .boolean()
          .optional()
          .default(false)
          .describe("Replace all occurrences (default: false, only first)"),
      }),
      execute: async ({ path, search, replace, replaceAll }) => {
        showToolStart("editFile", { path });
        const result = await fileOps.editFile(path, search, replace, replaceAll);

        // If edit failed because search not found, read the file and include content for retry
        if (!result.success && result.error?.includes("not found")) {
          console.log(chalk.yellow(`   ⚠ Search text not found. Reading file for retry...`));
          const fileContent = await fileOps.readFile(path);
          if (fileContent.success) {
            result.fileContent = fileContent.content;
            result.hint = "The file content is provided below. Copy the EXACT text you want to replace.";
            console.log(chalk.dim(`   ℹ File has ${fileContent.lines} lines. Use exact text from file.`));
            // Cache the file content we just read
            toolMemory.cacheFile(path, fileContent.content, fileContent.lines);
          }
        } else {
          showToolResult("editFile", result);
          // Invalidate cache since file was modified
          if (result.success) {
            toolMemory.invalidateCache(path);
          }
        }

        recordAction("editFile", { path, occurrencesReplaced: result?.occurrencesReplaced }, result);
        return result;
      },
    }),

    /**
     * Delete a file
     */
    deleteFile: tool({
      description:
        "Delete a file. This action requires user confirmation. Use sparingly and only when necessary.",
      parameters: z.object({
        path: z.string().describe("Relative file path to delete"),
      }),
      execute: async ({ path }) => {
        showToolStart("deleteFile", { path });
        const result = await fileOps.deleteFile(path);
        showToolResult("deleteFile", result);
        recordAction("deleteFile", { path }, result);
        return result;
      },
    }),

    /**
     * List directory contents
     */
    listDirectory: tool({
      description:
        "List files and directories in a path. Use this to explore project structure and find relevant files.",
      parameters: z.object({
        path: z
          .string()
          .optional()
          .default(".")
          .describe("Directory path to list (default: current directory)"),
        recursive: z
          .boolean()
          .optional()
          .default(false)
          .describe("Include subdirectories recursively"),
        maxDepth: z
          .number()
          .optional()
          .default(3)
          .describe("Maximum depth for recursive listing (default: 3)"),
      }),
      execute: async ({ path, recursive, maxDepth }) => {
        showToolStart("listDirectory", { path: path || "." });
        const result = await fileOps.listDirectory(path, recursive, maxDepth);
        showToolResult("listDirectory", result);
        recordAction("listDirectory", { path, totalFiles: result?.totalFiles, totalDirectories: result?.totalDirectories }, result);
        return result;
      },
    }),

    /**
     * Search for code patterns
     */
    searchCode: tool({
      description:
        "Search for text patterns across project files. Use this to find usages, definitions, or understand how code is structured.",
      parameters: z.object({
        pattern: z.string().describe("Text or regex pattern to search for"),
        fileGlob: z
          .string()
          .optional()
          .default("*")
          .describe("File pattern filter (e.g., '*.js', '*.{ts,tsx}')"),
        caseSensitive: z.boolean().optional().default(false).describe("Case sensitive search"),
      }),
      execute: async ({ pattern, fileGlob, caseSensitive }) => {
        showToolStart("searchCode", { pattern });
        const result = await fileOps.searchCode(pattern, fileGlob, caseSensitive);
        showToolResult("searchCode", result);
        recordAction("searchCode", { pattern, fileGlob, totalMatches: result?.totalMatches, filesWithMatches: result?.filesWithMatches }, result);
        return result;
      },
    }),

    /**
     * Find files by glob pattern
     */
    glob: tool({
      description:
        "Find files matching a glob pattern. Use this to quickly locate files by name pattern. Examples: '**/*.tsx', 'src/**/*.js', '*.json'",
      parameters: z.object({
        pattern: z.string().describe("Glob pattern (e.g., '**/*.tsx', 'src/**/*.js', '*.config.*')"),
        maxResults: z.number().optional().default(50).describe("Maximum number of results"),
      }),
      execute: async ({ pattern, maxResults }) => {
        console.log(chalk.hex("#60A5FA")(`\n🔎 [glob] ${pattern}`));
        const result = await fileOps.globFiles(pattern, maxResults);
        if (result.success) {
          console.log(chalk.green(`   ✓ Found: ${result.files.length} files`));
        } else {
          console.log(chalk.red(`   ✗ Error: ${result.error}`));
        }
        recordAction("glob", { pattern, count: result?.files?.length || 0 }, result);
        return result;
      },
    }),

    /**
     * Search file contents with regex
     */
    grep: tool({
      description:
        "Search for a regex pattern in file contents. Returns matching lines with context. More powerful than searchCode for complex patterns.",
      parameters: z.object({
        pattern: z.string().describe("Regex pattern to search for"),
        path: z.string().optional().default(".").describe("Directory to search in"),
        filePattern: z.string().optional().default("*").describe("File name pattern filter (e.g., '*.ts')"),
        contextLines: z.number().optional().default(0).describe("Number of context lines before/after match"),
      }),
      execute: async ({ pattern, path, filePattern, contextLines }) => {
        console.log(chalk.hex("#60A5FA")(`\n🔍 [grep] ${pattern} in ${path}`));
        const result = await fileOps.grepFiles(pattern, path, filePattern, contextLines);
        if (result.success) {
          console.log(chalk.green(`   ✓ Found: ${result.totalMatches} matches in ${result.filesWithMatches} files`));
        } else {
          console.log(chalk.red(`   ✗ Error: ${result.error}`));
        }
        recordAction("grep", { pattern, path, totalMatches: result?.totalMatches }, result);
        return result;
      },
    }),

    /**
     * Run a shell command
     */
    runCommand: tool({
      description:
        "Execute a shell command. ALWAYS requires user permission before running. Use for installing packages, running builds, starting servers, git operations, etc.",
      parameters: z.object({
        command: z.string().describe("The shell command to execute"),
        description: z
          .string()
          .describe("Brief explanation of what this command does (shown to user)"),
      }),
      execute: async ({ command, description }) => {
        // Note: runCommandWithPermission handles its own display (permission dialog, output streaming)
        const result = await runCommandWithPermission(command, description, cwd);
        recordAction("runCommand", { command, description, exitCode: result?.exitCode, declined: result?.declined }, result);
        return result;
      },
    }),

    /**
     * Create a plan for complex tasks
     */
    createPlan: tool({
      description:
        "Create a step-by-step plan for complex tasks. Steps must be simple strings like ['Create component', 'Add styling', 'Test'].",
      parameters: z.object({
        goal: z.string().describe("The main goal"),
        steps: z.array(z.any()).describe("Array of step description STRINGS"),
      }),
      execute: async ({ goal, steps }) => {
        console.log(chalk.hex("#60A5FA")(`\n📋 [createPlan] ${goal}`));

        if (taskPlanner) {
          // Normalize steps - handle both strings and objects
          const normalizedSteps = steps.map(step => {
            if (typeof step === 'string') return step;
            if (typeof step === 'object' && step !== null) {
              return step.description || step.title || step.name || step.step || step.text || JSON.stringify(step);
            }
            return String(step);
          });

          taskPlanner.createPlan(goal, normalizedSteps);
          taskPlanner.displayPlan();
          const firstStep = taskPlanner.getCurrentStep();

          recordAction("createPlan", { goal, stepCount: normalizedSteps.length }, { success: true });
          return {
            success: true,
            goal,
            totalSteps: normalizedSteps.length,
            currentStep: 1,
            currentStepDescription: firstStep?.description,
            message: `Plan created with ${normalizedSteps.length} steps. Now working on step 1: "${firstStep?.description}"`,
          };
        }

        return { success: false, error: "Task planner not available" };
      },
    }),

    /**
     * Update plan step status
     */
    updatePlanStep: tool({
      description:
        "Track plan progress. Use 'complete' after finishing a step (auto-advances to next). Use 'fail' if step failed. First step starts automatically when plan is created.",
      parameters: z.object({
        action: z.enum(["next", "complete", "fail"]).describe("'complete' = mark done & auto-advance, 'next' = manually advance, 'fail' = mark failed"),
        notes: z.string().optional().describe("Optional notes about the step"),
      }),
      execute: async ({ action, notes }) => {
        if (!taskPlanner || !taskPlanner.hasActivePlan()) {
          return { success: false, error: "No active plan" };
        }

        // Default to "complete" if action not specified (most common use)
        const resolvedAction = action || "complete";
        console.log(chalk.hex("#60A5FA")(`\n✅ [updatePlanStep] ${resolvedAction}`));

        switch (resolvedAction) {
          case "next": {
            const nextStep = taskPlanner.startNextStep();
            if (nextStep) {
              taskPlanner.displayProgressBar();
              recordAction("updatePlanStep", { action, stepIndex: nextStep.index }, { success: true });
              return {
                success: true,
                currentStep: nextStep.index + 1,
                description: nextStep.description,
                remaining: taskPlanner.steps.length - nextStep.index - 1,
              };
            }
            return { success: true, message: "Plan complete!", isComplete: true };
          }

          case "complete": {
            const completedNext = taskPlanner.completeCurrentStep(notes);
            const progress = taskPlanner.getProgress();

            if (completedNext) {
              console.log(chalk.green(`   ✓ Step completed (${progress.completed}/${progress.total}) → Next: ${completedNext.description}`));
              recordAction("updatePlanStep", { action, notes, nextStep: completedNext.index }, { success: true });
              return {
                success: true,
                completed: progress.completed,
                total: progress.total,
                percentComplete: progress.percentComplete,
                nextStep: completedNext.description,
                nextStepIndex: completedNext.index + 1,
              };
            } else {
              console.log(chalk.green(`   ✓ All steps completed! (${progress.completed}/${progress.total})`));
              recordAction("updatePlanStep", { action, notes, planComplete: true }, { success: true });
              return {
                success: true,
                completed: progress.completed,
                total: progress.total,
                percentComplete: 100,
                planComplete: true,
                message: "All plan steps are complete!",
              };
            }
          }

          case "fail": {
            taskPlanner.failCurrentStep(notes);
            console.log(chalk.red(`   ✗ Step failed: ${notes || "No details"}`));
            recordAction("updatePlanStep", { action, notes }, { success: false });
            return {
              success: false,
              error: notes || "Step failed",
              canContinue: true,
            };
          }

          default: {
            // Treat unknown action as "complete"
            const defaultNext = taskPlanner.completeCurrentStep(notes);
            const defaultProgress = taskPlanner.getProgress();
            console.log(chalk.green(`   ✓ Step completed (${defaultProgress.completed}/${defaultProgress.total})`));
            return {
              success: true,
              completed: defaultProgress.completed,
              total: defaultProgress.total,
              nextStep: defaultNext?.description,
            };
          }
        }
      },
    }),

    /**
     * Show current plan status
     */
    showPlan: tool({
      description: "Display the current plan status and progress. Use this to show the user what has been done and what remains.",
      parameters: z.object({}),
      execute: async () => {
        if (!taskPlanner || !taskPlanner.hasActivePlan()) {
          console.log(chalk.dim("\nNo active plan."));
          return { success: true, hasActivePlan: false };
        }

        taskPlanner.displayPlan();
        const progress = taskPlanner.getProgress();
        return {
          success: true,
          hasActivePlan: true,
          goal: taskPlanner.currentPlan?.goal,
          progress,
        };
      },
    }),
  };
}

/**
 * Get list of available agent tools for display
 */
export function getAgentToolList() {
  return [
    {
      id: "createFile",
      name: "Create File",
      description: "Create a new file with content",
      requiresPermission: false,
    },
    {
      id: "readFile",
      name: "Read File",
      description: "Read contents of an existing file",
      requiresPermission: false,
    },
    {
      id: "editFile",
      name: "Edit File",
      description: "Modify file with search/replace",
      requiresPermission: false,
    },
    {
      id: "deleteFile",
      name: "Delete File",
      description: "Delete a file (with confirmation)",
      requiresPermission: true,
    },
    {
      id: "listDirectory",
      name: "List Directory",
      description: "Browse directory contents",
      requiresPermission: false,
    },
    {
      id: "searchCode",
      name: "Search Code",
      description: "Search for patterns in code",
      requiresPermission: false,
    },
    {
      id: "glob",
      name: "Glob",
      description: "Find files by pattern (e.g., **/*.tsx)",
      requiresPermission: false,
    },
    {
      id: "grep",
      name: "Grep",
      description: "Search file contents with regex",
      requiresPermission: false,
    },
    {
      id: "runCommand",
      name: "Run Command",
      description: "Execute shell commands",
      requiresPermission: true,
    },
    {
      id: "createPlan",
      name: "Create Plan",
      description: "Create step-by-step plan for complex tasks",
      requiresPermission: false,
    },
    {
      id: "updatePlanStep",
      name: "Update Plan Step",
      description: "Track progress through plan steps",
      requiresPermission: false,
    },
    {
      id: "showPlan",
      name: "Show Plan",
      description: "Display current plan and progress",
      requiresPermission: false,
    },
  ];
}

/**
 * Tool configuration options
 */
export const toolConfig = {
  // Maximum steps the AI can take in a single response
  maxSteps: 10,

  // Command execution settings
  command: {
    timeout: 60000,
    dangerousPatterns: ["rm -rf", "git reset --hard", "git push -f"],
  },

  // File operation settings
  files: {
    maxFileSize: 1024 * 1024, // 1MB
    ignoredDirs: ["node_modules", ".git", "dist", "build"],
  },
};

export default {
  createAgentTools,
  getAgentToolList,
  toolConfig,
};
