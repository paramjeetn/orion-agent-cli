/**
 * Function Response Converter
 * Converts tool execution results into proper format for the AI conversation
 * This ensures tool results are properly communicated back to the model
 */

/**
 * Convert a single tool result to a function response format
 * @param {object} toolResult - The tool result object
 * @returns {object} Formatted function response
 */
export function convertToFunctionResponse(toolResult) {
  const { toolName, toolCallId, result } = toolResult;

  // Create response content based on result
  let responseContent;

  if (!result) {
    responseContent = { output: "Tool executed but returned no result" };
  } else if (typeof result === "string") {
    responseContent = { output: result };
  } else if (result.success === false) {
    responseContent = {
      error: result.error || "Tool execution failed",
      success: false,
    };
  } else {
    // Structure the result based on tool type
    responseContent = formatResultForTool(toolName, result);
  }

  return {
    functionResponse: {
      id: toolCallId,
      name: toolName,
      response: responseContent,
    },
  };
}

/**
 * Format result content based on tool type
 * @param {string} toolName - Name of the tool
 * @param {object} result - The raw result
 * @returns {object} Formatted result for AI consumption
 */
function formatResultForTool(toolName, result) {
  switch (toolName) {
    case "listDirectory":
      return formatListDirectoryResult(result);
    case "readFile":
      return formatReadFileResult(result);
    case "createFile":
      return formatCreateFileResult(result);
    case "editFile":
      return formatEditFileResult(result);
    case "deleteFile":
      return formatDeleteFileResult(result);
    case "searchCode":
      return formatSearchCodeResult(result);
    case "runCommand":
      return formatRunCommandResult(result);
    default:
      return { output: JSON.stringify(result) };
  }
}

function formatListDirectoryResult(result) {
  if (!result.entries) {
    return { output: "Directory listing failed", success: false };
  }

  const directories = result.entries
    .filter((e) => e.type === "directory")
    .map((e) => e.name);
  const files = result.entries
    .filter((e) => e.type === "file")
    .map((e) => e.name);

  return {
    success: true,
    path: result.path || ".",
    directories: directories,
    files: files,
    totalDirectories: directories.length,
    totalFiles: files.length,
    output: `Found ${directories.length} directories and ${files.length} files.\nDirectories: ${directories.join(", ") || "none"}\nFiles: ${files.join(", ") || "none"}`,
  };
}

function formatReadFileResult(result) {
  if (!result.content) {
    return { output: `Failed to read file: ${result.error || "unknown error"}`, success: false };
  }

  // Truncate very long files for the AI
  const maxLength = 5000;
  const content = result.content.length > maxLength
    ? result.content.substring(0, maxLength) + `\n... [truncated, ${result.content.length - maxLength} more characters]`
    : result.content;

  return {
    success: true,
    path: result.path,
    content: content,
    lines: result.lines,
    size: result.size,
    output: `File: ${result.path}\nLines: ${result.lines}\nSize: ${result.size} bytes\n\nContent:\n${content}`,
  };
}

function formatCreateFileResult(result) {
  if (!result.success) {
    return { output: `Failed to create file: ${result.error || "unknown error"}`, success: false };
  }

  return {
    success: true,
    path: result.path,
    bytesWritten: result.bytesWritten,
    output: `Successfully created file: ${result.path} (${result.bytesWritten} bytes)`,
  };
}

function formatEditFileResult(result) {
  if (!result.success) {
    return { output: `Failed to edit file: ${result.error || "unknown error"}`, success: false };
  }

  return {
    success: true,
    path: result.path,
    occurrencesReplaced: result.occurrencesReplaced,
    output: `Successfully edited file: ${result.path} (${result.occurrencesReplaced} replacement${result.occurrencesReplaced !== 1 ? "s" : ""})`,
  };
}

function formatDeleteFileResult(result) {
  if (!result.success) {
    return { output: `Failed to delete file: ${result.error || "unknown error"}`, success: false };
  }

  return {
    success: true,
    path: result.path,
    output: `Successfully deleted file: ${result.path}`,
  };
}

function formatSearchCodeResult(result) {
  if (!result.success) {
    return { output: `Search failed: ${result.error || "unknown error"}`, success: false };
  }

  // Format search results
  let output = `Found ${result.totalMatches} matches in ${result.filesWithMatches} files.\n`;

  if (result.results && result.results.length > 0) {
    output += "\nMatches:\n";
    for (const match of result.results.slice(0, 10)) {
      output += `\n${match.file}:\n`;
      for (const m of match.matches.slice(0, 3)) {
        output += `  Line ${m.line}: ${m.text.trim()}\n`;
      }
    }
    if (result.results.length > 10) {
      output += `\n... and ${result.results.length - 10} more files`;
    }
  }

  return {
    success: true,
    totalMatches: result.totalMatches,
    filesWithMatches: result.filesWithMatches,
    results: result.results?.slice(0, 10), // Limit for AI context
    output: output,
  };
}

function formatRunCommandResult(result) {
  if (result.declined) {
    return { output: "Command was declined by user", declined: true };
  }

  if (result.timedOut) {
    return { output: `Command timed out after ${result.duration}ms`, timedOut: true, success: false };
  }

  // Truncate very long output
  const maxLength = 3000;
  let stdout = result.stdout || "";
  let stderr = result.stderr || "";

  if (stdout.length > maxLength) {
    stdout = stdout.substring(0, maxLength) + "\n... [output truncated]";
  }
  if (stderr.length > maxLength) {
    stderr = stderr.substring(0, maxLength) + "\n... [stderr truncated]";
  }

  let output = `Command: ${result.command}\nExit code: ${result.exitCode}\nDuration: ${result.duration}ms`;
  if (stdout) output += `\n\nOutput:\n${stdout}`;
  if (stderr) output += `\n\nStderr:\n${stderr}`;

  return {
    success: result.success,
    command: result.command,
    exitCode: result.exitCode,
    duration: result.duration,
    stdout: stdout,
    stderr: stderr,
    output: output,
  };
}

/**
 * Convert multiple tool results to function responses
 * @param {Array} toolResults - Array of tool results
 * @returns {Array} Array of function response objects
 */
export function convertAllToFunctionResponses(toolResults) {
  if (!toolResults || toolResults.length === 0) {
    return [];
  }

  return toolResults.map(convertToFunctionResponse);
}

/**
 * Create a message containing function responses
 * This is added to the conversation as a "user" message with tool results
 * @param {Array} toolResults - Array of tool results
 * @returns {object} Message object for conversation history
 */
export function createFunctionResponseMessage(toolResults) {
  const responses = convertAllToFunctionResponses(toolResults);

  // Create a summary of results for the message content
  const summary = toolResults.map((tr) => {
    const result = tr.result;
    if (!result) return `[Tool Result] ${tr.toolName}: no result`;
    if (result.success === false) return `[Tool Result] ${tr.toolName}: failed - ${result.error}`;
    return `[Tool Result] ${tr.toolName}: success`;
  }).join("\n");

  return {
    role: "user",
    content: summary,
    toolResults: toolResults,
    functionResponses: responses,
    isToolResponse: true,
  };
}

/**
 * Extract displayable summary from tool results
 * @param {Array} toolResults - Array of tool results
 * @returns {string} Human-readable summary
 */
export function getToolResultsSummary(toolResults) {
  if (!toolResults || toolResults.length === 0) {
    return "No tools executed";
  }

  return toolResults.map((tr) => {
    const result = tr.result;
    if (!result) return `${tr.toolName}: completed`;

    switch (tr.toolName) {
      case "listDirectory":
        return `Listed directory: ${result.totalFiles || 0} files, ${result.totalDirectories || 0} directories`;
      case "readFile":
        return `Read file: ${result.path} (${result.lines || 0} lines)`;
      case "createFile":
        return `Created file: ${result.path}`;
      case "editFile":
        return `Edited file: ${result.path}`;
      case "deleteFile":
        return `Deleted file: ${result.path}`;
      case "searchCode":
        return `Search: found ${result.totalMatches || 0} matches`;
      case "runCommand":
        return `Command: exit code ${result.exitCode}`;
      default:
        return `${tr.toolName}: ${result.success ? "success" : "failed"}`;
    }
  }).join("\n");
}

export default {
  convertToFunctionResponse,
  convertAllToFunctionResponses,
  createFunctionResponseMessage,
  getToolResultsSummary,
};
