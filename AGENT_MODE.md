# Orion CLI - Agent Mode

A Claude Code-like AI coding assistant that runs directly in your terminal with continuous chat, file operations, and CLI command execution.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tools Reference](#tools-reference)
- [Usage Guide](#usage-guide)
- [Configuration](#configuration)
- [Development](#development)

---

## Overview

Agent Mode transforms Orion CLI from a simple chat interface into a powerful AI coding assistant that can:

- **Create and modify files** directly in your project
- **Execute shell commands** with your permission
- **Remember context** throughout the session
- **Work incrementally** - one change at a time, not all at once

### Current vs Agent Mode

| Feature | Simple Chat | Agent Mode |
|---------|-------------|------------|
| Conversation | Single response | Continuous session |
| File Access | None | Full CRUD operations |
| CLI Commands | None | Execute with permission |
| Memory | Per-message | Session-wide context |
| Working Directory | N/A | Your project folder |

---

## Features

### Continuous Chat Loop

Unlike the one-shot app generator, Agent Mode stays open for follow-up prompts:

```
orion> Create a React todo app

[Creating files...]
Created: src/App.jsx
Created: src/components/TodoList.jsx
Created: package.json

orion> Add dark mode support

[Reading existing files...]
[Editing src/App.jsx...]
Added dark mode toggle and CSS variables.

orion> Now run npm install

[Permission Request]
Command: npm install
[Y] Allow  [n] Deny

orion> _
```

### File Operations

| Operation | Description | Example |
|-----------|-------------|---------|
| **Create** | Write new files | `createFile("src/utils.js", "export const...")` |
| **Read** | View file contents | `readFile("package.json")` |
| **Edit** | Targeted modifications | `editFile("App.jsx", oldCode, newCode)` |
| **Delete** | Remove files (with confirmation) | `deleteFile("temp.js")` |
| **List** | Browse directories | `listDirectory("src/", recursive: true)` |
| **Search** | Find code patterns | `searchCode("useState", "**/*.jsx")` |

### Command Execution

Agent Mode can run shell commands **with your explicit permission**:

```
┌─ Command Request ───────────────────────────────────────────────┐
│ AI wants to run:                                                │
│                                                                 │
│    $ npm install axios                                          │
│                                                                 │
│ Reason: Install HTTP client for API requests                    │
│                                                                 │
│ [Y] Allow  [n] Deny                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Safety features:**
- Every command requires explicit approval
- Dangerous commands (rm -rf, etc.) show warnings
- Command output streams in real-time
- 60-second timeout prevents runaway processes

### Session Memory

Agent Mode remembers what it did throughout the session:

```
Session Context:
- Working Directory: /Users/you/my-project
- Files Created: src/App.jsx, src/index.js, package.json
- Files Modified: README.md
- Commands Run: npm install, npm run dev
```

This context is included in the AI's system prompt, so it can reference previous actions intelligently.

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Orion CLI                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   CLI Entry  │───▶│  Agent Loop  │───▶│  AI Service  │       │
│  │  (wakeup.js) │    │              │    │   (Gemini)   │       │
│  └──────────────┘    └──────┬───────┘    └──────┬───────┘       │
│                             │                    │               │
│                             ▼                    ▼               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     Tool System                           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │   │
│  │  │ Create  │ │  Read   │ │  Edit   │ │   Run Command   │ │   │
│  │  │  File   │ │  File   │ │  File   │ │ (with confirm)  │ │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Session Manager                         │   │
│  │  • Working directory     • File tracking                  │   │
│  │  • Tool memory           • Permission state               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
server/src/
├── cli/
│   ├── main.js                      # CLI entry point
│   ├── commands/
│   │   └── ai/
│   │       └── wakeUp.js            # Mode selector
│   ├── chat/
│   │   ├── chat-with-ai.js          # Simple chat mode
│   │   ├── chat-with-ai-tool.js     # Tool calling mode
│   │   ├── chat-with-ai-agent.js    # Agent mode entry
│   │   └── agent/                   # Agent mode implementation
│   │       ├── agent-loop.js        # Main continuous loop
│   │       ├── agent-session.js     # Session state manager
│   │       └── agent-display.js     # Terminal UI helpers
│   └── ai/
│       └── google-service.js        # AI service wrapper
├── config/
│   ├── agent-tools.config.js        # Tool definitions (Zod schemas)
│   └── agent-system-prompt.js       # AI behavior prompt
├── tools/
│   ├── tool-memory.js               # Session action tracking
│   ├── command-runner.js            # Shell command execution
│   └── file-tools.js                # File operation handlers
└── services/
    ├── chat.services.js             # Conversation persistence
    └── file-operations.service.js   # Safe file I/O
```

### Data Flow

```
User Input
    │
    ▼
┌─────────────────┐
│   Agent Loop    │ ◀─────────────────────────────┐
└────────┬────────┘                               │
         │                                        │
         ▼                                        │
┌─────────────────┐                               │
│ Build Messages  │ (system prompt + history)     │
└────────┬────────┘                               │
         │                                        │
         ▼                                        │
┌─────────────────┐                               │
│   AI Service    │ (Google Gemini)               │
└────────┬────────┘                               │
         │                                        │
         ▼                                        │
┌─────────────────┐     ┌─────────────────┐       │
│  Stream Text    │────▶│  Tool Calls?    │───No──┤
└─────────────────┘     └────────┬────────┘       │
                                 │ Yes            │
                                 ▼                │
                        ┌─────────────────┐       │
                        │ Execute Tools   │       │
                        │ (with UI/perms) │       │
                        └────────┬────────┘       │
                                 │                │
                                 ▼                │
                        ┌─────────────────┐       │
                        │ Update Session  │       │
                        │    Memory       │───────┘
                        └─────────────────┘
```

---

## Tools Reference

### createFile

Create a new file with the specified content. Creates parent directories automatically.

```javascript
// Schema
{
  path: string,     // Relative path from cwd (e.g., "src/utils/helpers.js")
  content: string   // File content to write
}

// Example
createFile({
  path: "src/components/Button.jsx",
  content: `import React from 'react';

export const Button = ({ children, onClick }) => {
  return <button onClick={onClick}>{children}</button>;
};`
})

// Returns
{ success: true, path: "src/components/Button.jsx", bytesWritten: 142 }
```

### readFile

Read the contents of an existing file.

```javascript
// Schema
{
  path: string   // Relative path to the file
}

// Example
readFile({ path: "package.json" })

// Returns
{
  success: true,
  path: "package.json",
  content: "{ \"name\": \"my-app\", ... }",
  size: 523,
  modified: "2025-12-19T10:30:00Z"
}
```

### editFile

Make targeted edits to an existing file using search and replace.

```javascript
// Schema
{
  path: string,           // File to edit
  search: string,         // Text to find
  replace: string,        // Replacement text
  replaceAll?: boolean    // Replace all occurrences (default: false)
}

// Example
editFile({
  path: "src/App.jsx",
  search: "const [count, setCount] = useState(0);",
  replace: "const [count, setCount] = useState(10);",
})

// Returns
{ success: true, path: "src/App.jsx", occurrencesReplaced: 1 }
```

### deleteFile

Delete a file. **Always requires user confirmation.**

```javascript
// Schema
{
  path: string   // File to delete
}

// Example
deleteFile({ path: "temp.log" })

// User sees:
// "Delete file: temp.log? [y/N]"

// Returns
{ success: true, path: "temp.log" }
// or
{ success: false, error: "User declined to delete file" }
```

### listDirectory

List files and directories.

```javascript
// Schema
{
  path?: string,        // Directory path (default: ".")
  recursive?: boolean,  // Include subdirectories (default: false)
  maxDepth?: number     // Max depth for recursive (default: 3)
}

// Example
listDirectory({ path: "src/", recursive: true, maxDepth: 2 })

// Returns
{
  success: true,
  path: "src/",
  entries: [
    { name: "App.jsx", path: "src/App.jsx", type: "file", size: 1024 },
    { name: "components", path: "src/components", type: "directory" },
    { name: "Button.jsx", path: "src/components/Button.jsx", type: "file", size: 512 },
  ],
  totalFiles: 2,
  totalDirectories: 1
}
```

### runCommand

Execute a shell command. **Always requires user permission.**

```javascript
// Schema
{
  command: string,      // Command to execute
  description: string   // Why this command is needed (shown to user)
}

// Example
runCommand({
  command: "npm install react",
  description: "Install React library for building UI components"
})

// User sees permission prompt, then:
// Returns
{
  success: true,
  command: "npm install react",
  exitCode: 0,
  stdout: "added 3 packages in 2.1s",
  stderr: "",
  duration: 2100
}
```

### searchCode

Search for text patterns across project files.

```javascript
// Schema
{
  pattern: string,       // Regex pattern to search
  fileGlob?: string,     // File filter (e.g., "*.jsx")
  caseSensitive?: boolean
}

// Example
searchCode({
  pattern: "useState",
  fileGlob: "*.jsx"
})

// Returns
{
  success: true,
  pattern: "useState",
  results: [
    {
      file: "src/App.jsx",
      matches: [
        { line: 3, content: "import { useState } from 'react';" },
        { line: 7, content: "const [count, setCount] = useState(0);" }
      ]
    }
  ],
  totalMatches: 2,
  filesSearched: 5
}
```

---

## Usage Guide

### Starting Agent Mode

```bash
# Start Orion CLI
orion wakeup

# Select "Agent Mode" from the menu
? Select mode:
  Chat (Simple conversation)
  Tool Calling (Search, code execution)
❯ Agent Mode (File operations, commands)
```

### Session Header

When agent mode starts, you'll see:

```
╔═══════════════════════════════════════════════════════════════╗
║                    ORION AGENT MODE                            ║
║                AI-Powered Coding Assistant                     ║
╚═══════════════════════════════════════════════════════════════╝

Working Directory: /Users/you/projects/my-app
Platform: darwin (macOS)

Available Tools:
• File operations (create, read, edit, delete)
• Command execution (with your permission)
• Code search and analysis

Commands:
• /help    - Show available commands
• /files   - List files changed this session
• /summary - Show session statistics
• /exit    - End agent session

orion> _
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/files` | List files created/modified this session |
| `/summary` | Show session statistics |
| `/clear` | Clear conversation (keep session state) |
| `/exit` | End session and show summary |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Interrupt current operation / Exit prompt |
| `Enter` | Submit input |
| `Up/Down` | Navigate command history |

### Example Session

```
orion> Create a simple Express API with a /health endpoint

I'll create a basic Express API for you.

[Creating file] package.json
[Creating file] src/index.js
[Creating file] src/routes/health.js

Created 3 files:
• package.json - Project configuration
• src/index.js - Express server entry point
• src/routes/health.js - Health check endpoint

Would you like me to install the dependencies?

orion> Yes please

[Command Request]
$ npm install
Reason: Install Express and other dependencies
[Y] Allow  [n] Deny: Y

Installing...
added 57 packages in 3.2s

Dependencies installed! Run `npm start` to start the server.

orion> Add a /users endpoint that returns a list of users

[Reading file] src/index.js
[Creating file] src/routes/users.js
[Editing file] src/index.js

Added /users endpoint:
• Created src/routes/users.js with mock user data
• Updated src/index.js to import and use the route

orion> /summary

┌─ Session Summary ─────────────────────────────────────────────┐
│ Duration: 5 minutes                                           │
│ Messages: 6 exchanges                                         │
│                                                               │
│ Files Created: 4                                              │
│   • package.json                                              │
│   • src/index.js                                              │
│   • src/routes/health.js                                      │
│   • src/routes/users.js                                       │
│                                                               │
│ Files Modified: 1                                             │
│   • src/index.js                                              │
│                                                               │
│ Commands Executed: 1                                          │
│   • npm install (success)                                     │
└───────────────────────────────────────────────────────────────┘

orion> /exit

Thanks for using Orion Agent Mode!
```

---

## Configuration

### Environment Variables

```bash
# Required
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key

# Optional
ORION_MODEL=gemini-2.5-flash  # AI model to use
```

### Tool Configuration

Tools can be customized in `server/src/config/agent-tools.config.js`:

```javascript
export const toolConfig = {
  // Command execution settings
  command: {
    timeout: 60000,           // Max execution time (ms)
    dangerousPatterns: [      // Commands that show extra warnings
      'rm -rf',
      'git reset --hard',
      'git push -f',
    ],
  },

  // File operation settings
  files: {
    maxFileSize: 1024 * 1024, // Max file size to read (1MB)
    ignoredDirs: [            // Directories to skip in searches
      'node_modules',
      '.git',
      'dist',
    ],
  },
};
```

---

## Development

### Running Locally

```bash
# Install dependencies
cd server
npm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Run the CLI
npm run dev
# or
node src/cli/main.js wakeup
```

### Testing Agent Mode

```bash
# Test file operations
orion wakeup
> Create a test file called hello.txt with "Hello World"
> Read the file hello.txt
> Edit hello.txt to say "Hello Orion"
> Delete hello.txt

# Test command execution
> Run: echo "Hello from terminal"
> Run: node --version
```

### Adding New Tools

1. Define the tool schema in `config/agent-tools.config.js`:

```javascript
export const myNewTool = {
  id: 'myNewTool',
  description: 'Does something useful',
  parameters: z.object({
    param1: z.string().describe('First parameter'),
  }),
  execute: async ({ param1 }, context) => {
    // Implementation
    return { success: true, result: '...' };
  },
};
```

2. Add to the tools registry in the same file
3. Update the system prompt if needed

### Project Structure for Contributions

```
server/
├── src/
│   ├── cli/chat/agent/     # Agent mode implementation
│   ├── config/             # Tool and prompt configuration
│   ├── tools/              # Tool implementations
│   └── services/           # Business logic services
└── AGENT_MODE.md           # This documentation
```

---

## Roadmap

### Version 1.0 (Current Implementation)
- [x] Continuous chat loop
- [x] File CRUD operations
- [x] Command execution with permissions
- [x] Session memory tracking
- [x] Slash commands

### Version 1.1 (Planned)
- [ ] Multi-file editing in single operation
- [ ] Git integration (status, diff, commit)
- [ ] Project templates
- [ ] Custom tool plugins

### Version 1.2 (Future)
- [ ] Image support (screenshots, diagrams)
- [ ] Remote session resumption
- [ ] Team collaboration features
- [ ] Custom AI model support

---

## Troubleshooting

### Common Issues

**"Command not found: orion"**
```bash
# Link the CLI globally
npm link
```

**"Permission denied" when creating files**
```bash
# Check directory permissions
ls -la .
# Ensure you have write access to the working directory
```

**"AI response timeout"**
- Check your internet connection
- Verify your API key is valid
- Try a simpler prompt

**Commands not executing**
- Ensure you're approving the permission prompt
- Check if the command exists on your system
- Look for errors in the command output

### Getting Help

- Run `/help` in agent mode for available commands
- Check the [GitHub Issues](https://github.com/your-repo/orion-cli/issues)
- Join our Discord community

---

## License

MIT License - See LICENSE file for details.
