/**
 * Status Bar - Persistent bottom bar like Claude Code
 * Shows current activity at the bottom while content streams above
 */

import chalk from "chalk";

class StatusBar {
  constructor() {
    this.enabled = false;
    this.height = 3;
    this.currentTask = null;
    this.startTime = Date.now();
    this.taskStartTime = null;
    this.renderInterval = null;
  }

  /**
   * Initialize the status bar
   */
  init(height = 3) {
    if (!process.stdout.isTTY) return;

    this.height = height;
    this.enabled = true;

    const rows = process.stdout.rows || 24;

    // Set scroll region (top to rows - height)
    process.stdout.write(`\x1b[1;${rows - this.height}r`);

    // Move cursor to top
    process.stdout.write(`\x1b[1;1H`);

    this.render();
  }

  /**
   * Set current task
   */
  setActiveTask(task) {
    this.currentTask = task;
    this.taskStartTime = Date.now();
    if (this.enabled) this.render();
  }

  /**
   * Clear current task
   */
  clearTask() {
    this.currentTask = null;
    this.taskStartTime = null;
    if (this.enabled) this.render();
  }

  /**
   * Render the status bar
   */
  render() {
    if (!this.enabled || !process.stdout.isTTY) return;

    const rows = process.stdout.rows || 24;
    const cols = process.stdout.columns || 80;

    // Save cursor
    process.stdout.write("\x1b[s");

    // Position at status bar area
    const statusRow = rows - this.height + 1;
    process.stdout.write(`\x1b[${statusRow};1H`);

    // Clear the status bar lines
    for (let i = 0; i < this.height; i++) {
      process.stdout.write(`\x1b[${statusRow + i};1H\x1b[2K`);
    }

    // Draw separator
    process.stdout.write(`\x1b[${statusRow};1H`);
    process.stdout.write(chalk.dim("─".repeat(Math.min(cols - 1, 70))));

    // Draw current task with spinner
    process.stdout.write(`\x1b[${statusRow + 1};1H`);
    if (this.currentTask) {
      const elapsed = this.formatTime(Date.now() - this.taskStartTime);
      const spinner = this.getSpinner();
      const maxLen = cols - 20;
      const task = this.currentTask.length > maxLen
        ? this.currentTask.slice(0, maxLen) + "…"
        : this.currentTask;

      process.stdout.write(
        chalk.cyan(`${spinner} ${task}`) +
        chalk.dim(` · ${elapsed}`) +
        chalk.dim(" · esc to interrupt")
      );
    } else {
      process.stdout.write(chalk.dim("Ready"));
    }

    // Restore cursor
    process.stdout.write("\x1b[u");
  }

  /**
   * Get spinner frame
   */
  getSpinner() {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    const elapsed = Date.now() - (this.taskStartTime || this.startTime);
    return frames[Math.floor(elapsed / 80) % frames.length];
  }

  /**
   * Format time elapsed
   */
  formatTime(ms) {
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    return `${mins}m ${secs % 60}s`;
  }

  /**
   * Start animation loop
   */
  startRenderLoop() {
    if (this.renderInterval) return;
    this.renderInterval = setInterval(() => {
      if (this.currentTask) this.render();
    }, 80);
  }

  /**
   * Stop animation
   */
  stopRenderLoop() {
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }
  }

  /**
   * Cleanup - restore terminal
   */
  cleanup() {
    if (!this.enabled) return;

    this.stopRenderLoop();

    // Reset scroll region
    process.stdout.write("\x1b[r");

    // Clear status area
    const rows = process.stdout.rows || 24;
    for (let i = 0; i < this.height; i++) {
      process.stdout.write(`\x1b[${rows - this.height + 1 + i};1H\x1b[2K`);
    }

    // Move to bottom
    process.stdout.write(`\x1b[${rows};1H`);

    this.enabled = false;
  }
}

export const statusBar = new StatusBar();
export default statusBar;
