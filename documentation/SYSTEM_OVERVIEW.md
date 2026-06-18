# Orion CLI - Complete System Overview

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Database Schema](#database-schema)
6. [Authentication System](#authentication-system)
7. [Server Application](#server-application)
8. [Client Application](#client-application)
9. [CLI Application](#cli-application)
10. [AI Integration](#ai-integration)
11. [How to Run the System](#how-to-run-the-system)
12. [Complete Flow Walkthrough](#complete-flow-walkthrough)
13. [Environment Variables](#environment-variables)
14. [API Endpoints](#api-endpoints)

---

## Project Overview

**Orion CLI** is an AI-powered command-line companion that combines a modern authentication system with powerful AI capabilities. It consists of three main components:

1. **Server**: Express.js backend handling authentication and API endpoints
2. **Client**: Next.js web application for user authentication and device authorization
3. **CLI**: Command-line interface for interacting with AI services

The system uses **OAuth 2.0 Device Authorization Flow** (RFC 8628) to authenticate CLI users through a web browser, similar to how services like Netflix or GitHub CLI handle authentication on devices with limited input capabilities.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ORION CLI SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐         ┌─────────────────┐         ┌─────────────────┐   │
│  │             │         │                 │         │                 │   │
│  │   CLI App   │◄───────►│  Express Server │◄───────►│  Next.js Client │   │
│  │  (Node.js)  │         │   (Port 3005)   │         │   (Port 3000)   │   │
│  │             │         │                 │         │                 │   │
│  └─────────────┘         └────────┬────────┘         └─────────────────┘   │
│        │                          │                          │             │
│        │                          │                          │             │
│        ▼                          ▼                          │             │
│  ┌─────────────┐         ┌─────────────────┐                │             │
│  │ Local Token │         │                 │                │             │
│  │   Storage   │         │  PostgreSQL DB  │◄───────────────┘             │
│  │ (~/.better- │         │  (Neon Cloud)   │                              │
│  │   auth/)    │         │                 │                              │
│  └─────────────┘         └─────────────────┘                              │
│        │                          ▲                                        │
│        │                          │                                        │
│        ▼                          │                                        │
│  ┌─────────────┐         ┌─────────────────┐                              │
│  │             │         │                 │                              │
│  │  Google AI  │◄───────►│   Prisma ORM    │                              │
│  │   (Gemini)  │         │                 │                              │
│  │             │         └─────────────────┘                              │
│  └─────────────┘                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Server
| Technology | Purpose |
|------------|---------|
| Express.js 5 | Web framework |
| Better Auth | Authentication library |
| Prisma ORM | Database ORM |
| Neon PostgreSQL | Serverless database |
| AI SDK (@ai-sdk/google) | AI integration |
| Commander.js | CLI framework |
| Chalk | Terminal styling |
| Figlet | ASCII art banners |
| @clack/prompts | Interactive CLI prompts |
| Boxen | Terminal box styling |
| Marked + Marked-Terminal | Markdown rendering in terminal |

### Client
| Technology | Purpose |
|------------|---------|
| Next.js 16 | React framework |
| React 19 | UI library |
| Tailwind CSS 4 | Styling |
| Better Auth (React) | Auth client |
| Radix UI | UI components |
| Lucide React | Icons |
| Sonner | Toast notifications |
| next-themes | Dark/light mode |

### Database
| Technology | Purpose |
|------------|---------|
| PostgreSQL | Primary database |
| Neon | Serverless PostgreSQL hosting with WebSocket support |
| Prisma | ORM with Neon adapter |

---

## Project Structure

```
orion-cli/
├── client/                          # Next.js Frontend Application
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── layout.tsx           # Auth layout wrapper
│   │   │   └── sign-in/
│   │   │       └── page.tsx         # Sign-in page (GitHub OAuth)
│   │   ├── approve/
│   │   │   └── page.tsx             # Device approval page
│   │   ├── device/
│   │   │   └── page.tsx             # Device code entry page
│   │   ├── layout.tsx               # Root layout with theme provider
│   │   ├── page.tsx                 # Home page (user profile)
│   │   └── globals.css              # Global styles
│   ├── components/
│   │   ├── approve-content.tsx      # Device approval UI component
│   │   ├── login-form.tsx           # GitHub login form component
│   │   ├── theme-provider.tsx       # Dark/light theme wrapper
│   │   └── ui/                      # Shadcn UI components
│   ├── lib/
│   │   ├── auth-client.ts           # Better Auth client configuration
│   │   └── utils.ts                 # Utility functions (cn helper)
│   └── package.json
│
├── server/                          # Express Backend & CLI
│   ├── prisma/
│   │   └── schema.prisma            # Database schema definition
│   ├── src/
│   │   ├── cli/
│   │   │   ├── ai/
│   │   │   │   └── google-service.js    # AI service wrapper class
│   │   │   ├── chat/
│   │   │   │   ├── chat-with-ai.js      # Simple chat mode implementation
│   │   │   │   ├── chat-with-ai-tool.js # Tool calling mode implementation
│   │   │   │   └── chat-with-ai-agent.js # Agent mode implementation
│   │   │   ├── commands/
│   │   │   │   ├── ai/
│   │   │   │   │   └── wakeUp.js        # AI menu command
│   │   │   │   └── auth/
│   │   │   │       └── login.js         # Auth commands (login, logout, whoami)
│   │   │   └── main.js                  # CLI entry point
│   │   ├── config/
│   │   │   ├── google.config.js         # Google AI configuration
│   │   │   ├── tool.config.js           # AI tools configuration
│   │   │   └── agent.config.js          # Agent mode configuration
│   │   ├── lib/
│   │   │   ├── auth.js                  # Better Auth server configuration
│   │   │   ├── auth-client.js           # Auth client helper
│   │   │   └── db.js                    # Prisma client initialization
│   │   ├── services/
│   │   │   └── chat.services.js         # Chat/conversation database service
│   │   └── index.js                     # Server entry point
│   └── package.json
│
└── SYSTEM_OVERVIEW.md
```

---

## Database Schema

The application uses PostgreSQL with Prisma ORM. Here's an overview of all models:

### User Model
Stores authenticated user information from GitHub OAuth.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| name | String | User's display name |
| email | String | Unique email address |
| emailVerified | Boolean | Email verification status |
| image | String? | Profile picture URL |
| createdAt | DateTime | Account creation timestamp |
| updatedAt | DateTime | Last update timestamp |

**Relationships**: Has many Sessions, Accounts, and Conversations

### Session Model
Tracks active user sessions and authentication tokens.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| expiresAt | DateTime | Session expiration time |
| token | String | Unique access token (used for CLI auth) |
| ipAddress | String? | Client IP address |
| userAgent | String? | Client user agent |
| userId | String | Foreign key to User |

### Account Model
Links OAuth provider accounts (GitHub) to users.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| accountId | String | GitHub account ID |
| providerId | String | OAuth provider ("github") |
| userId | String | Foreign key to User |
| accessToken | String? | OAuth access token |
| refreshToken | String? | OAuth refresh token |
| scope | String? | Granted OAuth scopes |

### DeviceCode Model
Manages the device authorization flow state.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| deviceCode | String | Server-side device code |
| userCode | String | User-facing code (e.g., "ABCD-1234") |
| userId | String? | Null until user approves, then links to approving user |
| expiresAt | DateTime | Code expiration time |
| status | String | Current status: "pending", "approved", "denied", "expired" |
| lastPolledAt | DateTime? | Last time CLI polled for status |
| pollingInterval | Int? | Minimum seconds between polls |
| clientId | String? | OAuth client ID |
| scope | String? | Requested OAuth scopes |

### Conversation Model
Stores chat conversations for persistence.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (CUID) |
| userId | String | Foreign key to User |
| title | String? | Conversation title (auto-generated from first message) |
| mode | String | Chat mode: "chat", "tool", or "agent" |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last message timestamp |

### Message Model
Stores individual messages within conversations.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key (CUID) |
| conversationId | String | Foreign key to Conversation |
| role | String | Message role: "user", "assistant", "system", "tool" |
| content | String | Message content (can be JSON for complex content) |
| createdAt | DateTime | Message timestamp |

---

## Authentication System

### OAuth 2.0 Device Authorization Flow

The system implements the OAuth 2.0 Device Authorization Grant (RFC 8628), which is ideal for CLI applications. This flow allows users to authenticate on devices with limited input capabilities by completing authentication in a web browser.

### How Device Flow Works

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    DEVICE AUTHORIZATION FLOW                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: CLI requests device code from server                                │
│  ┌─────────┐                              ┌──────────────┐                  │
│  │   CLI   │ ───── Request Code ─────────►│    Server    │                  │
│  │         │◄────── Response ───────────── │              │                  │
│  └─────────┘   (device_code, user_code,   └──────────────┘                  │
│                 verification_uri)                                            │
│                                                                              │
│  STEP 2: CLI displays code to user                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Terminal Output:                                                    │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │  Device Authorization Required                               │   │    │
│  │  │                                                              │   │    │
│  │  │  Please visit: http://localhost:3005/device                  │   │    │
│  │  │  Enter code: ABCD-1234                                       │   │    │
│  │  │                                                              │   │    │
│  │  │  ? Open browser automatically? (Y/n)                         │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  STEP 3: User completes authorization in browser                             │
│  ┌─────────────┐     ┌───────────────┐     ┌──────────────┐                │
│  │   Browser   │────►│  /device page │────►│ /approve page│                │
│  │             │     │ (enter code)  │     │  (approve)   │                │
│  └─────────────┘     └───────────────┘     └──────┬───────┘                │
│                                                    │                        │
│                                            Updates status                   │
│                                            in database                      │
│                                                    │                        │
│                                                    ▼                        │
│  STEP 4: CLI polls for token                 ┌──────────────┐              │
│  ┌─────────┐                                 │   Database   │              │
│  │   CLI   │ ──── Poll (every 5s) ──────────►│              │              │
│  │         │◄───── Access Token ────────────── │              │              │
│  └────┬────┘                                 └──────────────┘              │
│       │                                                                      │
│       ▼                                                                      │
│  STEP 5: Token stored locally                                                │
│  ┌─────────────────────────────────┐                                        │
│  │  ~/.better-auth/token.json      │                                        │
│  │  ─────────────────────────────  │                                        │
│  │  access_token: "..."            │                                        │
│  │  expires_at: "2025-01-17..."    │                                        │
│  │  token_type: "Bearer"           │                                        │
│  └─────────────────────────────────┘                                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Token Management

**Token Storage Location**: ~/.better-auth/token.json (in user's home directory)

**Token Contents**:
- **access_token**: The session token used for API authentication
- **refresh_token**: Token for refreshing expired access tokens (if available)
- **token_type**: Always "Bearer"
- **scope**: OAuth scopes granted ("openid profile email")
- **expires_at**: ISO timestamp of token expiration
- **created_at**: ISO timestamp when token was obtained

**Token Validation**:
- Before any CLI operation, the stored token is validated
- If token is expired (or within 5 minutes of expiring), user is prompted to re-login
- If no token exists, user must complete the login flow

### Authentication Configuration

**Server Configuration** (in server/src/lib/auth.js):
- Uses Better Auth library with Prisma adapter
- Connects to PostgreSQL database via Neon
- Enables device authorization plugin with 30-minute code expiration
- Sets minimum polling interval to 5 seconds
- Configures GitHub as the OAuth provider
- Trusts requests from the client app origin (localhost:3000)

**Client Configuration** (in client/lib/auth-client.ts):
- Uses Better Auth React client
- Connects to server at localhost:3005
- Enables device authorization client plugin
- Provides useSession hook for session management

---

## Server Application

### Overview

The Express server serves as the central backend, handling:
1. All authentication flows (OAuth, device authorization)
2. Session management
3. API endpoints
4. Database connections

### Server Startup

When the server starts (via npm run dev):
1. Loads environment variables from .env file
2. Initializes Prisma client with Neon adapter (WebSocket enabled)
3. Configures Better Auth with all plugins
4. Sets up CORS for client app access
5. Registers route handlers
6. Listens on port 3005

### Route Handling

| Route Pattern | Handler | Purpose |
|--------------|---------|---------|
| /api/auth/* | Better Auth | All authentication routes (OAuth, device flow, sessions) |
| /api/me | Custom | Get session from Authorization header (Bearer token) |
| /api/me/:token | Custom | Get session from URL parameter |
| /device | Custom | Redirect to client device page with user_code query param |

### CORS Configuration

The server allows requests from http://localhost:3000 (the client app) with:
- GET, POST, PUT, DELETE methods
- Credentials (cookies) support
- All necessary headers for authentication

---

## Client Application

### Overview

The Next.js client application provides:
1. User authentication via GitHub OAuth
2. Device authorization approval interface
3. User profile display
4. Session management

### Pages and Their Functions

#### Home Page (/)
**Purpose**: Display authenticated user's profile

**Behavior**:
1. Checks for active session using Better Auth hook
2. Shows loading spinner while checking
3. If no session → redirects to sign-in page
4. If session exists → displays user avatar, name, email, and sign-out button

#### Sign-In Page (/sign-in)
**Purpose**: GitHub OAuth login

**Behavior**:
1. Checks for existing session
2. If already logged in → redirects to home
3. Displays Orion CLI branding with login illustration
4. Shows "Continue with GitHub" button
5. On click → initiates GitHub OAuth flow
6. After successful auth → redirects to home

#### Device Page (/device)
**Purpose**: Enter device authorization code

**Behavior**:
1. Displays code entry form (XXXX-XXXX format)
2. Auto-formats input to uppercase with dash separator
3. Validates code with server when submitted
4. If valid → redirects to approve page with code
5. If invalid → shows error message

#### Approve Page (/approve)
**Purpose**: Approve or deny device access request

**Behavior**:
1. Requires authentication (redirects to sign-in if not logged in)
2. Displays the user code for verification against CLI display
3. Shows account email for confirmation
4. Security warning about only approving self-initiated requests
5. Two action buttons: Approve Device (green) and Deny Device (red)
6. Shows toast notifications for success/failure
7. Redirects to home after action

### Session Management

The client uses Better Auth's React integration for session management:
- useSession() hook provides current session state and loading status
- Automatically handles session refresh
- Provides isPending state during session check
- Syncs with server-side session storage

---

## CLI Application

### Overview

The Orion CLI is a Node.js command-line application that provides:
1. Device flow authentication
2. Session management
3. AI chat interfaces (Chat, Tool, Agent modes)

### Entry Point

The CLI starts from server/src/cli/main.js:
1. Displays ASCII art banner ("Orion CLI" in purple)
2. Shows tagline ("Your AI-powered command line companion")
3. Registers all commands with Commander.js
4. Parses command line arguments and executes appropriate command

### Available Commands

| Command | Description |
|---------|-------------|
| orion login | Start device authorization flow to authenticate |
| orion logout | Clear stored credentials and end session |
| orion whoami | Display current authenticated user information |
| orion wakeup | Start AI chat interface with mode selection |

### Login Command Details

**What happens when you run `orion login`**:
1. Checks if user is already logged in with valid token
2. If logged in, asks if user wants to re-authenticate
3. Creates auth client with device authorization plugin
4. Requests device code from server
5. Displays verification URL and user code in formatted box
6. Prompts user to open browser automatically
7. Opens browser to verification URL if confirmed
8. Starts polling server every 5 seconds for token
9. Handles various polling responses (pending, slow_down, denied, expired)
10. On success, stores token to ~/.better-auth/token.json
11. Fetches and displays user info with welcome message

### Logout Command Details

**What happens when you run `orion logout`**:
1. Checks for stored token file
2. If not logged in, informs user and exits
3. Asks for confirmation before logging out
4. Deletes token file from ~/.better-auth/
5. Displays success message

### WhoAmI Command Details

**What happens when you run `orion whoami`**:
1. Validates stored token exists and is not expired
2. Queries database for user by session token
3. Displays user name, email, and ID in formatted output

### WakeUp Command Details

**What happens when you run `orion wakeup`**:
1. Verifies authentication (exits if not logged in)
2. Fetches user information from database
3. Displays welcome message with user's name
4. Presents interactive mode selection menu with three options
5. Launches selected AI mode (Chat, Tool, or Agent)

---

## AI Integration

### AI Service

The AI service (server/src/cli/ai/google-service.js) wraps Google's Gemini model using the Vercel AI SDK.

**Capabilities**:
- Streaming text responses for real-time display
- Tool calling with multi-step support (up to 5 steps)
- Structured output generation using Zod schemas
- Error handling and debug logging

**Configuration**:
- Model: gemini-2.5-flash (configurable via ORION_MODEL env var)
- API Key: From GOOGLE_GENERATIVE_AI_API_KEY environment variable
- Supports temperature and max tokens configuration

### Chat Service

The chat service (server/src/services/chat.services.js) handles conversation persistence in the database.

**Features**:
- Create new conversations with specified mode
- Get existing conversation or create new one
- Add messages to conversations (user, assistant, system, tool roles)
- Retrieve conversation history ordered by timestamp
- Update conversation titles (auto-generated from first message)
- Delete conversations
- Format messages for AI SDK compatibility
- Parse JSON content for complex message types

### Chat Mode (Simple Chat)

**Location**: server/src/cli/chat/chat-with-ai.js

**Features**:
- Direct conversation with Gemini AI
- Streaming responses displayed in real-time
- Markdown rendering in terminal with syntax highlighting
- Conversation persistence in database
- Beautiful styled terminal UI with boxen borders
- Themed colors matching Orion branding (purple/violet)
- Exit with "exit" command or Ctrl+C

**UI Elements**:
- Intro banner with Orion branding in double-border box
- Conversation info box showing ID, title, and mode
- Previous messages displayed on conversation resume
- User messages in blue bordered boxes
- Assistant messages in green bordered boxes with markdown rendering
- Help instructions showing available actions
- Exit confirmation message

### Tool Mode (Tool Calling Chat)

**Location**: server/src/cli/chat/chat-with-ai-tool.js

**Features**:
- All features from simple chat mode
- Interactive tool selection interface at startup
- Multi-step tool calling (AI can use tools up to 5 times per response)
- Tool call visualization showing tool name and arguments
- Tool result display showing returned data
- Tools reset when chat session ends

**Available Tools**:

| Tool | ID | Description |
|------|-----|-------------|
| Google Search | google_search | Real-time web search for current events, news, and information |
| Code Execution | code_execution | Execute Python code for calculations and problem solving |
| URL Context | url_context | Analyze content from provided URLs (up to 20 per request) |

**Tool Selection Flow**:
1. Displays all available tools with descriptions
2. User selects tools using space bar to toggle
3. Press Enter to confirm selection
4. Selected tools are enabled for the entire chat session
5. Can select none, some, or all tools
6. Tools automatically reset when exiting chat

### Agent Mode (Application Generator)

**Location**: server/src/cli/chat/chat-with-ai-agent.js

**Features**:
- Autonomous application generation from natural language descriptions
- Structured output generation using Zod schemas
- Complete file and folder creation in current working directory
- Setup command generation and display
- Progress visualization during generation
- File tree display after creation

**How It Works**:
1. User describes desired application in natural language
2. AI generates structured output containing:
   - Kebab-case folder name for the project
   - Brief description of what was created
   - Array of all files with paths and complete content
   - Array of setup commands (npm install, npm run dev, etc.)
3. System creates the folder in current working directory
4. All files are written with proper directory structure
5. Displays file tree showing created structure
6. Shows next steps with setup commands to run

**Example Prompts**:
- "Build a todo app with React and Tailwind"
- "Create a REST API with Express and MongoDB"
- "Make a weather app using OpenWeatherMap API"

**Safety Features**:
- Warns user about file system access before starting
- Requires explicit confirmation to proceed
- Saves generation history to conversation for reference

---

## How to Run the System

### Prerequisites

Before starting, ensure you have:
- Node.js version 18 or higher installed
- npm package manager (comes with Node.js)
- PostgreSQL database (Neon recommended for easy serverless setup)
- GitHub OAuth App credentials
- Google AI API Key

### Step 1: Clone and Install

1. Clone the repository to your local machine
2. Navigate to the project directory
3. Install server dependencies by running npm install in the server folder
4. Install client dependencies by running npm install in the client folder

### Step 2: Database Setup

1. Create a Neon account at neon.tech (free tier available)
2. Create a new project and database
3. Copy the connection string (make sure it includes ?sslmode=require)

### Step 3: GitHub OAuth App Setup

1. Go to GitHub Settings → Developer Settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in the details:
   - Application name: Orion CLI (or your preferred name)
   - Homepage URL: http://localhost:3000
   - Authorization callback URL: http://localhost:3005/api/auth/callback/github
4. Click "Register application"
5. Copy the Client ID
6. Generate and copy a new Client Secret

### Step 4: Google AI API Key

1. Go to ai.google.dev
2. Sign in with your Google account
3. Create a new project or use existing one
4. Navigate to API keys section
5. Create and copy your API key

### Step 5: Environment Configuration

Create a file named .env in the server directory with these variables:
- DATABASE_URL: Your Neon PostgreSQL connection string
- GITHUB_CLIENT_ID: From step 3
- GITHUB_CLIENT_SECRET: From step 3
- GOOGLE_GENERATIVE_AI_API_KEY: From step 4
- ORION_MODEL: Optional, defaults to gemini-2.5-flash

### Step 6: Database Migration

From the server directory:
1. Generate Prisma client by running: npx prisma generate
2. Push schema to database by running: npx prisma db push

This creates all the necessary tables in your database.

### Step 7: Start the Server

From the server directory, run one of:
- npm run dev (standard development mode)
- npm run dev:watch (with auto-reload on file changes)

Server will start and listen at http://localhost:3005
You should see: "Orion server running on port 3005"

### Step 8: Start the Client

From the client directory, run: npm run dev

Client will start and be available at http://localhost:3000

### Step 9: Use the CLI

From the server directory, you can run CLI commands:
- npm run cli login (authenticate via device flow)
- npm run cli wakeup (start AI chat)
- npm run cli whoami (check current user)
- npm run cli logout (clear credentials)

### Optional: Global CLI Installation

To use the "orion" command from anywhere:
1. Navigate to server directory
2. Run: npm link

Now you can use these commands globally:
- orion login
- orion wakeup
- orion whoami
- orion logout

---

## Complete Flow Walkthrough

### Scenario: First-Time User Authenticating and Chatting with AI

**Phase 1: Starting the CLI**

1. User opens terminal
2. Runs the login command
3. CLI displays ASCII art banner showing "Orion CLI"
4. Shows intro message for Better Auth CLI Login

**Phase 2: Device Authorization Request**

5. CLI sends request to server for a new device code
6. Server creates DeviceCode record in database containing:
   - Random device code (kept server-side)
   - Random user code (8 characters, e.g., "ABCD-1234")
   - Status set to "pending"
   - Expiration set to 30 minutes from creation
7. CLI receives and displays:
   - Verification URL to visit
   - User code to enter
8. CLI prompts asking if user wants to open browser automatically

**Phase 3: Browser Authentication**

9. If user confirms, browser opens to http://localhost:3005/device
10. Server redirects to client app at http://localhost:3000/device with user_code parameter
11. User sees the device code entry page with the code pre-filled
12. User clicks "Continue" button
13. Client validates the code exists and is not expired
14. Since user is not logged in, they are redirected to /sign-in page

**Phase 4: GitHub OAuth**

15. User sees Orion CLI branding and "Continue with GitHub" button
16. User clicks the button
17. Browser redirects to GitHub authorization page
18. User reviews permissions and clicks "Authorize"
19. GitHub redirects back to callback URL on server
20. Server creates or updates User record with GitHub profile data
21. Server creates Account record linking GitHub to User
22. Server creates Session record with new access token
23. User is redirected to home page showing their profile

**Phase 5: Device Approval**

24. User navigates back to /device or directly to /approve with the user_code
25. Approve page loads and shows:
    - The user code for verification (should match CLI display)
    - Their account email address
    - Security warning about only approving self-initiated requests
    - Approve and Deny buttons
26. User clicks "Approve Device" button
27. Client calls the device approve API endpoint
28. Server updates DeviceCode record:
    - Status changes from "pending" to "approved"
    - userId is set to the approving user's ID
29. Toast notification shows success message
30. User is redirected to home page

**Phase 6: CLI Token Receipt**

31. Meanwhile, CLI has been polling server every 5 seconds
32. On next poll after approval, server returns the access token
33. CLI stores token in ~/.better-auth/token.json with:
    - access_token value
    - expiration timestamp
    - token type and scope
34. CLI displays success message: "Login successful! Welcome [User Name]"
35. Shows where token was saved

**Phase 7: Starting AI Chat**

36. User runs the wakeup command
37. CLI reads and validates stored token
38. Fetches user info from database using token
39. Displays personalized welcome message
40. Shows interactive mode selection menu:
    - Chat (simple conversation)
    - Tool Calling (with external tools)
    - Agentic Mode (application generator)

**Phase 8: Chat Mode Example**

41. User selects "Chat" option
42. CLI creates new Conversation record in database with mode "chat"
43. Displays conversation info box showing ID, title, and mode
44. Shows help instructions for using the chat
45. User types a message and presses Enter
46. Message is saved to database as user role
47. AI service sends conversation history to Gemini
48. Response streams back chunk by chunk, displayed in real-time
49. Complete response is rendered with markdown formatting
50. Response is saved to database as assistant role
51. Conversation title is updated based on first message
52. Loop continues until user types "exit" or presses Ctrl+C

### Scenario: Returning User (Token Already Stored)

1. User runs the wakeup command
2. CLI finds existing token at ~/.better-auth/token.json
3. Validates token has not expired
4. Fetches user info directly without re-authentication
5. Proceeds to mode selection menu
6. No browser interaction needed

### Scenario: Expired Token

1. User runs any authenticated command
2. CLI finds token but it has expired (or expires within 5 minutes)
3. Displays message: "Your session has expired. Please login again."
4. User must run login command to get new token

---

## Environment Variables

### Required Variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string from Neon (must include ?sslmode=require) |
| GITHUB_CLIENT_ID | Client ID from your GitHub OAuth App |
| GITHUB_CLIENT_SECRET | Client Secret from your GitHub OAuth App |
| GOOGLE_GENERATIVE_AI_API_KEY | API key from Google AI Studio |

### Optional Variables

| Variable | Description | Default Value |
|----------|-------------|---------------|
| ORION_MODEL | Which Gemini model to use | gemini-2.5-flash |

---

## API Endpoints

### Authentication Endpoints (Handled by Better Auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/auth/sign-in/social | POST | Initiate GitHub OAuth flow |
| /api/auth/callback/github | GET | Handle GitHub OAuth callback |
| /api/auth/sign-out | POST | End user session and invalidate token |
| /api/auth/session | GET | Get current session information |
| /api/auth/device | POST | Request new device authorization code |
| /api/auth/device/token | POST | Poll for access token (CLI uses this) |
| /api/auth/device/approve | POST | Approve a device authorization request |
| /api/auth/device/deny | POST | Deny a device authorization request |
| /api/auth/device/verify | GET | Verify if a user code exists and is valid |

### Custom Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/me | GET | Get session using Authorization: Bearer header |
| /api/me/:access_token | GET | Get session by providing token in URL path |
| /device | GET | Redirect to client device page, passes user_code as query parameter |

---

## Summary

Orion CLI is a comprehensive full-stack system demonstrating modern authentication patterns and AI integration:

**Authentication Excellence**
- OAuth 2.0 Device Authorization Flow for CLI authentication
- Secure token storage and automatic validation
- Session persistence across CLI restarts
- Seamless browser-based authorization

**Robust Architecture**
- Express.js backend with Better Auth library
- Next.js 16 frontend with React 19
- PostgreSQL database with Prisma ORM and Neon serverless
- Clean separation between server, client, and CLI

**Powerful AI Features**
- Three distinct interaction modes for different use cases
- Streaming responses with real-time terminal display
- Tool calling for web search, code execution, and URL analysis
- Autonomous application generation with file system access

**Developer-Friendly Design**
- Beautiful terminal UI with colors, boxes, and spinners
- Markdown rendering in terminal output
- Persistent conversation history
- Easy global CLI installation
- Comprehensive error handling and user feedback

The system serves as a production-ready foundation for building AI-powered CLI applications with enterprise-grade authentication and user management capabilities.
