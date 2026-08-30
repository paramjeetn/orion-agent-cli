# Orion CLI

An AI-powered command-line companion with secure browser-based authentication.

```
   ___       _               ____ _     ___
  / _ \ _ __(_) ___  _ __   / ___| |   |_ _|
 | | | | '__| |/ _ \| '_ \ | |   | |    | |
 | |_| | |  | | (_) | | | || |___| |___ | |
  \___/|_|  |_|\___/|_| |_| \____|_____|___|

  Your AI-powered command line companion
```

## Quick Start

### Prerequisites

*   Node.js 18+
*   PostgreSQL database ([Neon](https://neon.tech) recommended)
*   [GitHub OAuth App](https://github.com/settings/developers)
*   [Google AI API Key](https://ai.google.dev)

### 1\. Clone Repository

```
git clone https://github.com/paramjeetn/Orion.CLI.git
cd Orion.CLI
```

### 2\. Configure Environment

```
cd server
cp .env.example .env
```

Edit `server/.env` with your credentials:

| Variable | Where to get it |
| --- | --- |
| DATABASE\_URL | [Neon](https://neon.tech) - Create project → Copy connection string |
| GITHUB\_CLIENT\_ID | [GitHub OAuth](https://github.com/settings/developers) - New OAuth App |
| GITHUB\_CLIENT\_SECRET | Same as above |
| GOOGLE\_GENERATIVE\_AI\_API\_KEY | [Google AI Studio](https://aistudio.google.com/apikey) |

> **GitHub OAuth Callback URL:** `http://localhost:3005/api/auth/callback/github`

### 3\. Setup & Start Server

```
cd server
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Server runs at `http://localhost:3005`

### 4\. Start Client (New Terminal)

```
cd client
npm install
npm run dev
```

Client runs at `http://localhost:3000`

### 5\. Install CLI Globally (New Terminal)

```
cd server
npm link
```

### 6\. Test & Use

```
# Test if orion is accessible (from any folder)
orion --help

# Start using
orion login      # Authenticate via browser
orion wakeup     # Start AI chat
```

---

## Commands

| Command | Description |
| --- | --- |
| `orion login` | Authenticate via browser |
| `orion logout` | Clear credentials |
| `orion whoami` | Show current user |
| `orion wakeup` | Start AI chat |

---

## How It Works

### Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   CLI App   │◄────►│    Server    │◄────►│   Client    │
│  (Node.js)  │      │ (Port 3005)  │      │ (Port 3000) │
└─────────────┘      └──────┬───────┘      └─────────────┘
                           │
                    ┌──────▼───────┐
                    │  PostgreSQL  │
                    │    (Neon)    │
                    └──────────────┘
```

### Authentication Flow

Orion uses **OAuth 2.0 Device Authorization** - the same flow used by Netflix and GitHub CLI:

1.  **CLI requests a code** → Server generates unique device code
2.  **User visits browser** → Enters code and logs in with GitHub
3.  **User approves device** → Server marks code as approved
4.  **CLI receives token** → Stored locally for future use

```
CLI                    Browser                  Server
 │                        │                        │
 │─── Request Code ──────────────────────────────►│
 │◄── "ABCD-1234" ────────────────────────────────│
 │                        │                        │
 │   "Visit localhost:3005/device"                │
 │   "Enter: ABCD-1234"   │                        │
 │                        │                        │
 │                        │─── Login + Approve ───►│
 │                        │◄── Success ────────────│
 │                        │                        │
 │─── Poll for token ────────────────────────────►│
 │◄── Access Token ───────────────────────────────│
 │                        │                        │
 ▼ Token saved locally    │                        │
```

### AI Modes

After login, `orion wakeup` offers three modes:

**Chat** - Simple conversation with Gemini AI

*   Streaming responses
*   Markdown rendering in terminal
*   Conversation history saved

**Tool Calling** - AI with superpowers

*   Google Search (real-time web data)
*   Code Execution (Python calculations)
*   URL Context (analyze web pages)

**Agent Mode** - Autonomous app generator

*   Describe what you want to build
*   AI generates complete project structure
*   Creates all files automatically

### Database Models

| Model | Purpose |
| --- | --- |
| User | GitHub profile data |
| Session | Active login sessions |
| Account | OAuth provider links |
| DeviceCode | Pending authorizations |
| Conversation | Chat sessions |
| Message | Chat messages |

### Tech Stack

**Server**: Express.js, Better Auth, Prisma, AI SDK

**Client**: Next.js 16, React 19, Tailwind CSS, Radix UI

**Database**: PostgreSQL (Neon), Prisma ORM

---

## Project Structure

```
orion-cli/
├── client/                 # Next.js frontend
│   ├── app/
│   │   ├── (auth)/sign-in  # GitHub login
│   │   ├── device/         # Code entry
│   │   └── approve/        # Device approval
│   └── components/
│
├── server/                 # Express backend + CLI
│   ├── src/
│   │   ├── cli/
│   │   │   ├── chat/       # AI chat modes
│   │   │   └── commands/   # CLI commands
│   │   ├── config/         # AI & tool configs
│   │   ├── lib/            # Auth & DB setup
│   │   └── services/       # Business logic
│   └── prisma/
│
└── documentation/          # Full system docs
```

---

## Documentation

For detailed technical documentation, see [documentation/SYSTEM\_OVERVIEW.md](./documentation/SYSTEM_OVERVIEW.md)

---

## License

MIT

## Quickstart Guide

To run Orion Agent CLI locally:
```bash
npm install
npm run dev
```
