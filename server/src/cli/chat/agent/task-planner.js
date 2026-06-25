/**
 * Task Planner - Plan and track complex multi-step tasks
 * Similar to Claude Code's planning approach
 */

import chalk from "chalk";

export class TaskPlanner {
  constructor() {
    this.currentPlan = null;
    this.steps = [];
    this.currentStepIndex = -1;
  }

  /**
   * Create a new plan
   * @param {string} goal - The main goal
   * @param {Array<string>} steps - Array of step descriptions
   */
  createPlan(goal, steps) {
    this.currentPlan = {
      goal,
      createdAt: new Date(),
      status: "in_progress",
    };
    this.steps = steps.map((step, index) => ({
      index,
      description: step,
      status: "pending", // pending, in_progress, completed, failed
      startTime: null,
      endTime: null,
      notes: null,
    }));
    // Auto-start the first step
    this.currentStepIndex = 0;
    if (this.steps.length > 0) {
      this.steps[0].status = "in_progress";
      this.steps[0].startTime = new Date();
    }
    return this;
  }

  /**
   * Start the next step
   */
  startNextStep() {
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      // Mark current step as completed if not already
      if (this.steps[this.currentStepIndex].status === "in_progress") {
        this.steps[this.currentStepIndex].status = "completed";
        this.steps[this.currentStepIndex].endTime = new Date();
      }
    }

    this.currentStepIndex++;
    if (this.currentStepIndex < this.steps.length) {
      this.steps[this.currentStepIndex].status = "in_progress";
      this.steps[this.currentStepIndex].startTime = new Date();
      return this.steps[this.currentStepIndex];
    }
    return null;
  }

  /**
   * Mark current step as completed and auto-advance to next
   * @returns {object|null} Next step if available, null if plan complete
   */
  completeCurrentStep(notes = null) {
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      this.steps[this.currentStepIndex].status = "completed";
      this.steps[this.currentStepIndex].endTime = new Date();
      this.steps[this.currentStepIndex].notes = notes;

      // Auto-advance to next step
      const nextIndex = this.currentStepIndex + 1;
      if (nextIndex < this.steps.length) {
        this.currentStepIndex = nextIndex;
        this.steps[nextIndex].status = "in_progress";
        this.steps[nextIndex].startTime = new Date();
        return this.steps[nextIndex];
      }
    }
    return null;
  }

  /**
   * Mark current step as failed
   */
  failCurrentStep(error) {
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      this.steps[this.currentStepIndex].status = "failed";
      this.steps[this.currentStepIndex].endTime = new Date();
      this.steps[this.currentStepIndex].notes = error;
    }
  }

  /**
   * Get current step
   */
  getCurrentStep() {
    if (this.currentStepIndex >= 0 && this.currentStepIndex < this.steps.length) {
      return this.steps[this.currentStepIndex];
    }
    return null;
  }

  /**
   * Check if plan is complete
   */
  isComplete() {
    return this.steps.every((s) => s.status === "completed" || s.status === "failed");
  }

  /**
   * Get progress info
   */
  getProgress() {
    const completed = this.steps.filter((s) => s.status === "completed").length;
    const failed = this.steps.filter((s) => s.status === "failed").length;
    const pending = this.steps.filter((s) => s.status === "pending").length;
    const inProgress = this.steps.filter((s) => s.status === "in_progress").length;

    return {
      total: this.steps.length,
      completed,
      failed,
      pending,
      inProgress,
      percentComplete: Math.round((completed / this.steps.length) * 100),
    };
  }

  /**
   * Display plan status
   */
  displayPlan() {
    if (!this.currentPlan) {
      console.log(chalk.dim("No active plan"));
      return;
    }

    console.log(chalk.bold.cyan("\n📋 Plan: ") + this.currentPlan.goal);
    console.log(chalk.dim("─".repeat(50)));

    this.steps.forEach((step, index) => {
      let icon, color;
      switch (step.status) {
        case "completed":
          icon = "✓";
          color = chalk.green;
          break;
        case "in_progress":
          icon = "▶";
          color = chalk.yellow;
          break;
        case "failed":
          icon = "✗";
          color = chalk.red;
          break;
        default:
          icon = "○";
          color = chalk.dim;
      }

      console.log(color(`  ${icon} ${index + 1}. ${step.description}`));
      if (step.notes && step.status !== "pending") {
        console.log(chalk.dim(`      └─ ${step.notes}`));
      }
    });

    const progress = this.getProgress();
    console.log(chalk.dim("─".repeat(50)));
    console.log(
      chalk.dim(`Progress: ${progress.completed}/${progress.total} steps (${progress.percentComplete}%)`)
    );
    console.log();
  }

  /**
   * Display compact progress bar
   */
  displayProgressBar() {
    if (!this.currentPlan) return;

    const progress = this.getProgress();
    const barLength = 20;
    const filled = Math.round((progress.completed / progress.total) * barLength);
    const bar = "█".repeat(filled) + "░".repeat(barLength - filled);

    console.log(
      chalk.dim(`\n[${bar}] ${progress.completed}/${progress.total} `) +
        chalk.cyan(this.getCurrentStep()?.description || "Done")
    );
  }

  /**
   * Get plan context for AI
   */
  getContextForAI() {
    if (!this.currentPlan) return "";

    const progress = this.getProgress();
    const currentStep = this.getCurrentStep();

    let context = `\n## Current Task Plan\nGoal: ${this.currentPlan.goal}\n`;
    context += `Progress: ${progress.completed}/${progress.total} steps completed\n\n`;

    context += "Steps:\n";
    this.steps.forEach((step, index) => {
      const status =
        step.status === "completed"
          ? "✓"
          : step.status === "in_progress"
            ? "▶"
            : step.status === "failed"
              ? "✗"
              : "○";
      context += `${status} ${index + 1}. ${step.description}\n`;
    });

    if (currentStep) {
      context += `\nCurrent step: ${currentStep.index + 1}. ${currentStep.description}\n`;
    }

    return context;
  }

  /**
   * Clear the current plan
   */
  clear() {
    this.currentPlan = null;
    this.steps = [];
    this.currentStepIndex = -1;
  }

  /**
   * Check if there's an active plan
   */
  hasActivePlan() {
    return this.currentPlan !== null && !this.isComplete();
  }
}

/**
 * Detect if a task is complex and needs planning
 * @param {string} userMessage - The user's request
 * @returns {boolean}
 */
export function isComplexTask(userMessage) {
  const complexIndicators = [
    // Explicit multi-step requests
    /create\s+(a\s+)?full/i,
    /build\s+(a\s+)?complete/i,
    /implement\s+(a\s+)?full/i,
    /set\s*up\s+(a\s+)?project/i,
    /scaffold/i,
    /initialize/i,
    // Multiple actions
    /and\s+then/i,
    /after\s+that/i,
    /first.*then/i,
    /step\s*by\s*step/i,
    // Large scope indicators
    /entire/i,
    /whole/i,
    /all\s+the/i,
    /complete\s+(app|application|project|system)/i,
    // Specific complex tasks
    /authentication\s+system/i,
    /api\s+with\s+crud/i,
    /full\s+stack/i,
    /from\s+scratch/i,
  ];

  return complexIndicators.some((pattern) => pattern.test(userMessage));
}

/**
 * Generate a plan for a complex task
 * @param {string} userMessage - The user's request
 * @param {object} projectContext - Project context info
 * @returns {object|null} - Plan object or null if not needed
 */
export function generatePlanSuggestion(userMessage, projectContext) {
  // This returns a suggestion - the AI will refine it
  const lowerMessage = userMessage.toLowerCase();

  // React/Next.js component
  if (lowerMessage.includes("component") && lowerMessage.includes("full")) {
    return {
      goal: "Create complete React component",
      suggestedSteps: [
        "Analyze existing component patterns",
        "Create component file with props interface",
        "Implement component logic and JSX",
        "Add styling (CSS/Tailwind)",
        "Add tests if test files exist",
      ],
    };
  }

  // API endpoint
  if (lowerMessage.includes("api") || lowerMessage.includes("endpoint")) {
    return {
      goal: "Create API endpoint",
      suggestedSteps: [
        "Check existing API patterns",
        "Create route handler",
        "Implement business logic",
        "Add validation",
        "Test endpoint",
      ],
    };
  }

  // Authentication
  if (lowerMessage.includes("auth") || lowerMessage.includes("login")) {
    return {
      goal: "Implement authentication",
      suggestedSteps: [
        "Set up auth configuration",
        "Create login/signup forms",
        "Implement auth logic",
        "Add protected routes",
        "Test auth flow",
      ],
    };
  }

  // Generic project setup
  if (lowerMessage.includes("project") || lowerMessage.includes("scaffold")) {
    return {
      goal: "Set up project",
      suggestedSteps: [
        "Initialize project structure",
        "Install dependencies",
        "Configure build tools",
        "Create initial files",
        "Verify setup works",
      ],
    };
  }

  // Default - let AI determine steps
  return null;
}

export default TaskPlanner;
