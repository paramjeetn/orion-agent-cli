/**
 * File Operations Service
 * Provides safe file system operations for the agent mode
 */

import { promises as fs } from "fs";
import path from "path";

// Directories to ignore when searching/listing
const IGNORED_DIRS = ["node_modules", ".git", "dist", "build", ".next", "coverage", "__pycache__", ".venv", "venv"];

// Binary file extensions to skip
const BINARY_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".bmp", ".svg",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv",
  ".exe", ".dll", ".so", ".dylib",
  ".pyc", ".pyo", ".class",
];

// Maximum file size to read (1MB)
const MAX_FILE_SIZE = 1024 * 1024;

export class FileOperationsService {
  constructor(workingDirectory) {
    this.cwd = workingDirectory || process.cwd();
  }

  /**
   * Validate that a path is within the working directory (security)
   * @param {string} relativePath - Relative path to validate
   * @returns {string} Absolute path if valid
   * @throws {Error} If path is outside working directory
   */
  validatePath(relativePath) {
    // Normalize the path
    const absolutePath = path.resolve(this.cwd, relativePath);

    // Ensure path is within cwd
    if (!absolutePath.startsWith(this.cwd)) {
      throw new Error(`Security Error: Cannot access files outside working directory. Path: ${relativePath}`);
    }

    return absolutePath;
  }

  /**
   * Create a new file with content (or overwrite existing)
   * @param {string} relativePath - Relative path for the new file
   * @param {string} content - File content
   * @param {boolean} overwrite - If true, overwrite existing file (default: true)
   * @returns {Promise<object>} Result object
   */
  async createFile(relativePath, content, overwrite = true) {
    try {
      const absolutePath = this.validatePath(relativePath);

      // Create parent directories if needed
      const dirPath = path.dirname(absolutePath);
      await fs.mkdir(dirPath, { recursive: true });

      // Check if file already exists
      let fileExists = false;
      try {
        await fs.access(absolutePath);
        fileExists = true;
      } catch {
        // File doesn't exist
      }

      // If file exists and overwrite is false, return error
      if (fileExists && !overwrite) {
        return {
          success: false,
          error: `File already exists: ${relativePath}. Use editFile to modify it.`,
          path: relativePath,
        };
      }

      // Write the file (creates or overwrites)
      await fs.writeFile(absolutePath, content, "utf8");

      return {
        success: true,
        path: relativePath,
        absolutePath: absolutePath,
        bytesWritten: Buffer.byteLength(content, "utf8"),
        overwritten: fileExists,
        message: fileExists ? `Overwrote file: ${relativePath}` : `Created file: ${relativePath}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        path: relativePath,
      };
    }
  }

  /**
   * Read a file's contents
   * @param {string} relativePath - Relative path to the file
   * @returns {Promise<object>} Result object with content
   */
  async readFile(relativePath) {
    try {
      const absolutePath = this.validatePath(relativePath);

      // Check file stats
      const stats = await fs.stat(absolutePath);

      if (stats.isDirectory()) {
        return {
          success: false,
          error: `Path is a directory, not a file: ${relativePath}`,
          path: relativePath,
        };
      }

      if (stats.size > MAX_FILE_SIZE) {
        return {
          success: false,
          error: `File is too large (${Math.round(stats.size / 1024)}KB). Maximum: ${MAX_FILE_SIZE / 1024}KB`,
          path: relativePath,
          size: stats.size,
        };
      }

      // Check if binary
      const ext = path.extname(relativePath).toLowerCase();
      if (BINARY_EXTENSIONS.includes(ext)) {
        return {
          success: false,
          error: `Cannot read binary file: ${relativePath}`,
          path: relativePath,
          type: "binary",
        };
      }

      // Read the file
      const content = await fs.readFile(absolutePath, "utf8");

      return {
        success: true,
        path: relativePath,
        content: content,
        size: stats.size,
        lines: content.split("\n").length,
        modified: stats.mtime.toISOString(),
      };
    } catch (error) {
      if (error.code === "ENOENT") {
        return {
          success: false,
          error: `File not found: ${relativePath}`,
          path: relativePath,
        };
      }
      return {
        success: false,
        error: error.message,
        path: relativePath,
      };
    }
  }

  /**
   * Edit a file using search and replace
   * @param {string} relativePath - Path to the file
   * @param {string} search - Text to find
   * @param {string} replace - Replacement text
   * @param {boolean} replaceAll - Replace all occurrences
   * @returns {Promise<object>} Result object
   */
  async editFile(relativePath, search, replace, replaceAll = false) {
    try {
      const absolutePath = this.validatePath(relativePath);

      // Read current content
      const content = await fs.readFile(absolutePath, "utf8");

      // Check if search text exists
      if (!content.includes(search)) {
        return {
          success: false,
          error: `Search text not found in file: "${search.slice(0, 50)}${search.length > 50 ? "..." : ""}"`,
          path: relativePath,
        };
      }

      // Count occurrences
      const regex = new RegExp(this.escapeRegex(search), "g");
      const matches = content.match(regex) || [];
      const occurrencesFound = matches.length;

      // Perform replacement
      let newContent;
      let occurrencesReplaced;

      if (replaceAll) {
        newContent = content.replaceAll(search, replace);
        occurrencesReplaced = occurrencesFound;
      } else {
        newContent = content.replace(search, replace);
        occurrencesReplaced = 1;
      }

      // Write back
      await fs.writeFile(absolutePath, newContent, "utf8");

      return {
        success: true,
        path: relativePath,
        occurrencesFound: occurrencesFound,
        occurrencesReplaced: occurrencesReplaced,
        message: `Replaced ${occurrencesReplaced} occurrence(s) in ${relativePath}`,
      };
    } catch (error) {
      if (error.code === "ENOENT") {
        return {
          success: false,
          error: `File not found: ${relativePath}`,
          path: relativePath,
        };
      }
      return {
        success: false,
        error: error.message,
        path: relativePath,
      };
    }
  }

  /**
   * Delete a file
   * @param {string} relativePath - Path to the file
   * @returns {Promise<object>} Result object
   */
  async deleteFile(relativePath) {
    try {
      const absolutePath = this.validatePath(relativePath);

      // Check if exists and is a file
      const stats = await fs.stat(absolutePath);

      if (stats.isDirectory()) {
        return {
          success: false,
          error: `Cannot delete directory with this tool: ${relativePath}`,
          path: relativePath,
        };
      }

      // Delete the file
      await fs.unlink(absolutePath);

      return {
        success: true,
        path: relativePath,
        message: `Deleted file: ${relativePath}`,
      };
    } catch (error) {
      if (error.code === "ENOENT") {
        return {
          success: false,
          error: `File not found: ${relativePath}`,
          path: relativePath,
        };
      }
      return {
        success: false,
        error: error.message,
        path: relativePath,
      };
    }
  }

  /**
   * List contents of a directory
   * @param {string} relativePath - Directory path (defaults to cwd)
   * @param {boolean} recursive - Include subdirectories
   * @param {number} maxDepth - Maximum depth for recursive listing
   * @returns {Promise<object>} Result object with entries
   */
  async listDirectory(relativePath = ".", recursive = false, maxDepth = 3) {
    try {
      const absolutePath = this.validatePath(relativePath);

      // Check if directory exists
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        return {
          success: false,
          error: `Path is not a directory: ${relativePath}`,
          path: relativePath,
        };
      }

      const entries = await this.listDirRecursive(absolutePath, this.cwd, recursive, maxDepth, 0);

      return {
        success: true,
        path: relativePath,
        entries: entries,
        totalFiles: entries.filter((e) => e.type === "file").length,
        totalDirectories: entries.filter((e) => e.type === "directory").length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        path: relativePath,
      };
    }
  }

  /**
   * Search for code patterns in files
   * @param {string} pattern - Search pattern (regex or text)
   * @param {string} fileGlob - File pattern filter (e.g., "*.js")
   * @param {boolean} caseSensitive - Case sensitive search
   * @param {number} maxResults - Maximum results to return
   * @returns {Promise<object>} Result object with matches
   */
  async searchCode(pattern, fileGlob = "*", caseSensitive = false, maxResults = 50) {
    try {
      const results = [];
      const flags = caseSensitive ? "g" : "gi";

      // Create regex from pattern
      let regex;
      try {
        regex = new RegExp(pattern, flags);
      } catch (e) {
        // If invalid regex, escape and try as literal
        regex = new RegExp(this.escapeRegex(pattern), flags);
      }

      await this.searchDirectory(this.cwd, this.cwd, regex, fileGlob, results, maxResults);

      return {
        success: true,
        pattern: pattern,
        results: results,
        totalMatches: results.reduce((sum, r) => sum + r.matches.length, 0),
        filesWithMatches: results.length,
        truncated: results.length >= maxResults,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        pattern: pattern,
      };
    }
  }

  // ===== Helper Methods =====

  /**
   * Recursively list directory contents
   */
  async listDirRecursive(dirPath, basePath, recursive, maxDepth, currentDepth) {
    const entries = [];

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        // Skip hidden files and ignored directories
        if (item.name.startsWith(".") || IGNORED_DIRS.includes(item.name)) {
          continue;
        }

        const fullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(basePath, fullPath);

        if (item.isDirectory()) {
          entries.push({
            name: item.name,
            path: relativePath.replace(/\\/g, "/"),
            type: "directory",
          });

          if (recursive && currentDepth < maxDepth) {
            const subEntries = await this.listDirRecursive(
              fullPath,
              basePath,
              recursive,
              maxDepth,
              currentDepth + 1
            );
            entries.push(...subEntries);
          }
        } else {
          try {
            const stats = await fs.stat(fullPath);
            entries.push({
              name: item.name,
              path: relativePath.replace(/\\/g, "/"),
              type: "file",
              size: stats.size,
              modified: stats.mtime.toISOString(),
            });
          } catch {
            // Skip files we can't stat
          }
        }
      }
    } catch (error) {
      // Directory not readable, skip
    }

    return entries;
  }

  /**
   * Recursively search for pattern in directory
   */
  async searchDirectory(dirPath, basePath, regex, fileGlob, results, maxResults) {
    if (results.length >= maxResults) return;

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        if (results.length >= maxResults) break;

        // Skip hidden and ignored
        if (item.name.startsWith(".") || IGNORED_DIRS.includes(item.name)) {
          continue;
        }

        const fullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(basePath, fullPath);

        if (item.isDirectory()) {
          await this.searchDirectory(fullPath, basePath, regex, fileGlob, results, maxResults);
        } else if (item.isFile()) {
          // Check file glob pattern
          if (fileGlob !== "*" && !this.matchGlob(item.name, fileGlob)) {
            continue;
          }

          // Skip binary files
          const ext = path.extname(item.name).toLowerCase();
          if (BINARY_EXTENSIONS.includes(ext)) {
            continue;
          }

          // Check file size
          try {
            const stats = await fs.stat(fullPath);
            if (stats.size > MAX_FILE_SIZE) continue;

            const content = await fs.readFile(fullPath, "utf8");
            const lines = content.split("\n");
            const matches = [];

            lines.forEach((line, index) => {
              if (regex.test(line)) {
                matches.push({
                  line: index + 1,
                  content: line.trim().slice(0, 200),
                });
              }
              regex.lastIndex = 0; // Reset regex state
            });

            if (matches.length > 0) {
              results.push({
                file: relativePath.replace(/\\/g, "/"),
                matches: matches.slice(0, 10), // Limit matches per file
              });
            }
          } catch {
            // Skip files we can't read
          }
        }
      }
    } catch {
      // Directory not readable
    }
  }

  /**
   * Simple glob pattern matching
   */
  matchGlob(filename, glob) {
    // Convert glob to regex
    const pattern = glob
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".")
      .replace(/\{([^}]+)\}/g, (_, p) => `(${p.split(",").join("|")})`);

    return new RegExp(`^${pattern}$`, "i").test(filename);
  }

  /**
   * Escape special regex characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Find files matching a glob pattern
   * @param {string} pattern - Glob pattern (e.g., "**\/*.tsx")
   * @param {number} maxResults - Maximum number of results
   */
  async globFiles(pattern, maxResults = 50) {
    try {
      const files = [];
      await this.globRecursive(this.cwd, this.cwd, pattern, files, maxResults);

      return {
        success: true,
        pattern: pattern,
        files: files,
        count: files.length,
        truncated: files.length >= maxResults
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        pattern: pattern
      };
    }
  }

  /**
   * Recursively find files matching glob pattern
   */
  async globRecursive(dirPath, basePath, pattern, results, maxResults) {
    if (results.length >= maxResults) return;

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        if (results.length >= maxResults) break;
        if (item.name.startsWith(".") || IGNORED_DIRS.includes(item.name)) continue;

        const fullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(basePath, fullPath).replace(/\\/g, "/");

        if (item.isDirectory()) {
          // Check if pattern includes this directory
          if (pattern.includes("**") || this.matchGlobPath(relativePath + "/", pattern)) {
            await this.globRecursive(fullPath, basePath, pattern, results, maxResults);
          }
        } else if (item.isFile()) {
          if (this.matchGlobPath(relativePath, pattern)) {
            results.push(relativePath);
          }
        }
      }
    } catch {
      // Directory not readable
    }
  }

  /**
   * Match a path against a glob pattern
   */
  matchGlobPath(filepath, pattern) {
    // Convert glob pattern to regex
    let regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\*\*/g, "<<<DOUBLESTAR>>>")
      .replace(/\*/g, "[^/]*")
      .replace(/<<<DOUBLESTAR>>>/g, ".*")
      .replace(/\?/g, ".")
      .replace(/\{([^}]+)\}/g, (_, p) => `(${p.split(",").join("|")})`);

    try {
      return new RegExp(`^${regexPattern}$`).test(filepath);
    } catch {
      return false;
    }
  }

  /**
   * Search for pattern in files with context
   * @param {string} pattern - Regex pattern
   * @param {string} searchPath - Directory to search
   * @param {string} filePattern - File name filter
   * @param {number} contextLines - Lines of context
   */
  async grepFiles(pattern, searchPath = ".", filePattern = "*", contextLines = 0) {
    try {
      const absolutePath = this.validatePath(searchPath);
      const results = [];
      let totalMatches = 0;

      const flags = "gi";
      let regex;
      try {
        regex = new RegExp(pattern, flags);
      } catch {
        regex = new RegExp(this.escapeRegex(pattern), flags);
      }

      await this.grepDirectory(absolutePath, this.cwd, regex, filePattern, contextLines, results, 50);

      results.forEach(r => totalMatches += r.matches.length);

      return {
        success: true,
        pattern: pattern,
        results: results,
        totalMatches: totalMatches,
        filesWithMatches: results.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        pattern: pattern
      };
    }
  }

  /**
   * Recursively grep directory
   */
  async grepDirectory(dirPath, basePath, regex, filePattern, contextLines, results, maxFiles) {
    if (results.length >= maxFiles) return;

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        if (results.length >= maxFiles) break;
        if (item.name.startsWith(".") || IGNORED_DIRS.includes(item.name)) continue;

        const fullPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          await this.grepDirectory(fullPath, basePath, regex, filePattern, contextLines, results, maxFiles);
        } else if (item.isFile()) {
          // Check file pattern
          if (filePattern !== "*" && !this.matchGlob(item.name, filePattern)) continue;

          // Skip binary
          const ext = path.extname(item.name).toLowerCase();
          if (BINARY_EXTENSIONS.includes(ext)) continue;

          try {
            const stats = await fs.stat(fullPath);
            if (stats.size > MAX_FILE_SIZE) continue;

            const content = await fs.readFile(fullPath, "utf8");
            const lines = content.split("\n");
            const matches = [];

            lines.forEach((line, index) => {
              regex.lastIndex = 0;
              if (regex.test(line)) {
                const match = {
                  line: index + 1,
                  content: line.trim().slice(0, 200)
                };

                // Add context if requested
                if (contextLines > 0) {
                  match.before = lines.slice(Math.max(0, index - contextLines), index).map(l => l.trim());
                  match.after = lines.slice(index + 1, index + 1 + contextLines).map(l => l.trim());
                }

                matches.push(match);
              }
            });

            if (matches.length > 0) {
              const relativePath = path.relative(basePath, fullPath).replace(/\\/g, "/");
              results.push({
                file: relativePath,
                matches: matches.slice(0, 20) // Limit matches per file
              });
            }
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Directory not readable
    }
  }

  /**
   * Check if a path exists
   */
  async exists(relativePath) {
    try {
      const absolutePath = this.validatePath(relativePath);
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats
   */
  async getStats(relativePath) {
    try {
      const absolutePath = this.validatePath(relativePath);
      const stats = await fs.stat(absolutePath);
      return {
        success: true,
        path: relativePath,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        path: relativePath,
      };
    }
  }
}

export default FileOperationsService;
