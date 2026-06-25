/**
 * Agent Display - Clean, Claude Code-inspired design
 * Minimal, professional terminal UI
 */

import chalk from "chalk";

// Simple, clean color palette
const colors = {
  primary: "#A78BFA",    // Soft purple
  accent: "#60A5FA",     // Blue for paths/links
  success: "#34D399",    // Green
  warning: "#FBBF24",    // Yellow
  error: "#F87171",      // Red
  dim: "#6B7280",        // Gray
  text: "#E5E7EB",       // Light gray text
};

// Tool icons - simple and consistent
const TOOL_ICONS = {
  createFile: "Write",
  readFile: "Read",
  editFile: "Edit",
  deleteFile: "Delete",
  listDirectory: "List",
  searchCode: "Search",
  glob: "Glob",
  grep: "Grep",
  runCommand: "Bash",
  createPlan: "Plan",
  updatePlanStep: "Step",
  showPlan: "Plan",
};

/**
 * Display minimal session header - Claude Code inspired
 */
export function displaySessionHeader(session) {
  const { cwd, projectContext } = session;

  console.log();
  console.log(chalk.hex(colors.primary).bold("Orion"));
  console.log(chalk.hex(colors.dim)(cwd));
  if (projectContext?.type && projectContext.type !== "Unknown") {
    const info = projectContext.framework
      ? `${projectContext.type} · ${projectContext.framework}`
      : projectContext.type;
    console.log(chalk.hex(colors.dim)(info));
  }
  console.log();
}

/**
 * Display a tool execution - Claude Code style inline
 */
export function displayToolStart(toolName, args) {
  const icon = TOOL_ICONS[toolName] || toolName;
  const path = args.path || args.command || args.pattern || args.goal || "";

  // Format: ● ToolName path/to/file
  console.log(
    chalk.hex(colors.accent)(`  ● ${icon}`) +
    (path ? chalk.hex(colors.dim)(` ${path}`) : "")
  );
}

/**
 * Display a tool result - minimal feedback
 */
export function displayToolResult(toolName, result) {
  if (!result) return;

  if (result.success === false) {
    if (result.declined) {
      console.log(chalk.hex(colors.warning)("    ⚠ declined"));
    } else {
      console.log(chalk.hex(colors.error)(`    ✗ ${result.error || "failed"}`));
    }
    return;
  }

  // Success - show minimal info
  switch (toolName) {
    case "createFile":
      console.log(chalk.hex(colors.success)(`    ✓ created (${result.bytesWritten || 0} bytes)`));
      break;
    case "readFile":
      console.log(chalk.hex(colors.success)(`    ✓ ${result.lines || 0} lines${result.cached ? " (cached)" : ""}`));
      break;
    case "editFile":
      console.log(chalk.hex(colors.success)(`    ✓ ${result.occurrencesReplaced || 0} changes`));
      break;
    case "deleteFile":
      console.log(chalk.hex(colors.success)("    ✓ deleted"));
      break;
    case "listDirectory":
      console.log(chalk.hex(colors.success)(`    ✓ ${result.totalFiles || 0} files, ${result.totalDirectories || 0} dirs`));
      break;
    case "searchCode":
    case "grep":
      console.log(chalk.hex(colors.success)(`    ✓ ${result.totalMatches || 0} matches`));
      break;
    case "glob":
      console.log(chalk.hex(colors.success)(`    ✓ ${result.files?.length || 0} files`));
      break;
    case "runCommand":
      if (result.exitCode !== undefined) {
        const icon = result.exitCode === 0 ? "✓" : "✗";
        const color = result.exitCode === 0 ? colors.success : colors.error;
        console.log(chalk.hex(color)(`    ${icon} exit ${result.exitCode}`));
      }
      break;
    default:
      console.log(chalk.hex(colors.success)("    ✓"));
  }
}

/**
 * Display session summary - clean and compact
 */
export function displaySessionSummary(session) {
  const summary = session.getSummary();
  const details = session.toolMemory.getDetails();

  console.log();
  console.log(chalk.hex(colors.primary).bold("─── Session Summary ───"));
  console.log();

  console.log(chalk.hex(colors.dim)(`Duration: ${summary.duration}`));
  console.log(chalk.hex(colors.dim)(`Messages: ${summary.messagesExchanged}`));
  console.log();

  if (summary.filesCreated > 0 || summary.filesModified > 0 || summary.filesDeleted > 0) {
    console.log(chalk.bold("Files:"));
    if (summary.filesCreated > 0) {
      console.log(chalk.hex(colors.success)(`  + ${summary.filesCreated} created`));
    }
    if (summary.filesModified > 0) {
      console.log(chalk.hex(colors.warning)(`  ~ ${summary.filesModified} modified`));
    }
    if (summary.filesDeleted > 0) {
      console.log(chalk.hex(colors.error)(`  - ${summary.filesDeleted} deleted`));
    }
    console.log();
  }

  if (summary.commandsRun > 0) {
    console.log(chalk.bold("Commands:"));
    console.log(chalk.hex(colors.dim)(`  ${summary.successfulCommands} succeeded, ${summary.failedCommands} failed`));
    console.log();
  }

  // List specific files
  if (details.filesCreated.length > 0) {
    console.log(chalk.hex(colors.success).bold("Created:"));
    details.filesCreated.slice(0, 5).forEach((f) => {
      console.log(chalk.hex(colors.dim)(`  ${f}`));
    });
    if (details.filesCreated.length > 5) {
      console.log(chalk.hex(colors.dim)(`  ... and ${details.filesCreated.length - 5} more`));
    }
    console.log();
  }

  if (details.filesModified.length > 0) {
    console.log(chalk.hex(colors.warning).bold("Modified:"));
    details.filesModified.slice(0, 5).forEach((f) => {
      console.log(chalk.hex(colors.dim)(`  ${f}`));
    });
    if (details.filesModified.length > 5) {
      console.log(chalk.hex(colors.dim)(`  ... and ${details.filesModified.length - 5} more`));
    }
    console.log();
  }
}

/**
 * Display files changed - minimal list
 */
export function displayFilesChanged(session) {
  const details = session.toolMemory.getDetails();

  if (
    details.filesCreated.length === 0 &&
    details.filesModified.length === 0 &&
    details.filesDeleted.length === 0
  ) {
    console.log(chalk.hex(colors.dim)("\n  No files changed.\n"));
    return;
  }

  console.log();
  if (details.filesCreated.length > 0) {
    console.log(chalk.hex(colors.success).bold("Created:"));
    details.filesCreated.forEach((f) => console.log(chalk.hex(colors.dim)(`  ${f}`)));
  }
  if (details.filesModified.length > 0) {
    console.log(chalk.hex(colors.warning).bold("Modified:"));
    details.filesModified.forEach((f) => console.log(chalk.hex(colors.dim)(`  ${f}`)));
  }
  if (details.filesDeleted.length > 0) {
    console.log(chalk.hex(colors.error).bold("Deleted:"));
    details.filesDeleted.forEach((f) => console.log(chalk.hex(colors.dim)(`  ${f}`)));
  }
  console.log();
}

/**
 * Display current plan - clean progress view
 */
export function displayPlan(session) {
  if (!session.taskPlanner || !session.taskPlanner.hasActivePlan()) {
    console.log(chalk.hex(colors.dim)("\n  No active plan.\n"));
    return;
  }

  session.taskPlanner.displayPlan();
}

/**
 * Display help - clean and minimal
 */
export function displayHelp() {
  console.log();
  console.log(chalk.hex(colors.primary).bold("─── Help ───"));
  console.log();
  console.log(chalk.bold("Commands:"));
  console.log(chalk.hex(colors.accent)("  /help") + chalk.hex(colors.dim)("     Show this help"));
  console.log(chalk.hex(colors.accent)("  /files") + chalk.hex(colors.dim)("    List changed files"));
  console.log(chalk.hex(colors.accent)("  /plan") + chalk.hex(colors.dim)("     Show current plan"));
  console.log(chalk.hex(colors.accent)("  /summary") + chalk.hex(colors.dim)("  Show session stats"));
  console.log(chalk.hex(colors.accent)("  /clear") + chalk.hex(colors.dim)("    Clear history"));
  console.log(chalk.hex(colors.accent)("  /exit") + chalk.hex(colors.dim)("     End session"));
  console.log();
  console.log(chalk.bold("Shortcuts:"));
  console.log(chalk.hex(colors.dim)("  Ctrl+C    Interrupt/exit"));
  console.log(chalk.hex(colors.dim)("  ESC       Abort running command"));
  console.log();
}

/**
 * Display error - simple inline
 */
export function displayError(error) {
  const message = error.message || String(error);
  console.log(chalk.hex(colors.error)(`\n  ✗ Error: ${message}\n`));
}

/**
 * Display interrupt message
 */
export function displayInterrupt(type = "operation") {
  console.log(chalk.hex(colors.warning)(`\n  ⚠ ${type} interrupted\n`));
}

/**
 * Display mini status bar - compact inline
 */
export function displayMiniStatus(session) {
  const summary = session.toolMemory.getSummary();
  const duration = Math.round((new Date() - session.startTime) / 1000 / 60);

  const parts = [];
  if (duration > 0) parts.push(`${duration}m`);
  if (summary.filesCreated > 0) parts.push(chalk.hex(colors.success)(`+${summary.filesCreated}`));
  if (summary.filesModified > 0) parts.push(chalk.hex(colors.warning)(`~${summary.filesModified}`));
  if (summary.commandsRun > 0) parts.push(`${summary.commandsRun} cmds`);

  if (parts.length > 0) {
    console.log(chalk.hex(colors.dim)(`\n  ${parts.join(" · ")}`));
  }
}

/**
 * Display welcome - minimal
 */
export function displayWelcome() {
  // No welcome message needed - keep it clean
}

/**
 * Display goodbye - simple
 */
export function displayGoodbye() {
  console.log(chalk.hex(colors.dim)("\n  Session ended.\n"));
}

/**
 * Get the prompt string - clean minimal prompt
 */
export function getPrompt() {
  return chalk.hex(colors.primary)("> ");
}

/**
 * Display task list - clean progress indicators
 */
export function displayTaskList(tasks) {
  if (!tasks || tasks.length === 0) return;

  console.log();
  tasks.forEach((task, index) => {
    let icon, color;
    switch (task.status) {
      case "completed":
        icon = "✓";
        color = colors.success;
        break;
      case "in_progress":
        icon = "●";
        color = colors.accent;
        break;
      case "failed":
        icon = "✗";
        color = colors.error;
        break;
      default:
        icon = "○";
        color = colors.dim;
    }
    console.log(chalk.hex(color)(`  ${icon} ${task.description}`));
  });
  console.log();
}

/**
 * Display a single task step
 */
export function displayTaskStep(step, total, description, status = "running") {
  const icons = {
    running: chalk.hex(colors.accent)("●"),
    done: chalk.hex(colors.success)("✓"),
    failed: chalk.hex(colors.error)("✗"),
    pending: chalk.hex(colors.dim)("○"),
  };

  console.log(`  ${icons[status] || icons.pending} [${step}/${total}] ${description}`);
}

/**
 * Display thinking indicator - simple
 */
export function displayThinking(message = "Thinking...") {
  process.stdout.write(chalk.hex(colors.dim)(`  ${message}`));
}

/**
 * Clear thinking indicator
 */
export function clearThinking() {
  process.stdout.write("\r" + " ".repeat(60) + "\r");
}

export default {
  displaySessionHeader,
  displayToolStart,
  displayToolResult,
  displaySessionSummary,
  displayPlan,
  displayTaskList,
  displayTaskStep,
  displayThinking,
  clearThinking,
  displayFilesChanged,
  displayHelp,
  displayError,
  displayInterrupt,
  displayMiniStatus,
  displayWelcome,
  displayGoodbye,
  getPrompt,
};
