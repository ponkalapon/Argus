# Argus CLI

Local AI agent with memory, RAG, sessions, tools, and HTTP API.

## Quick Start

```bash
# Set your API key
export ARGUS_API_KEY="sk-..."

# Start interactive CLI
npm run cli

# Or start API server (for mobile/desktop apps)
npm run api
```

## CLI Usage

```
argus              Start interactive CLI
argus cli          Start interactive CLI
argus api          Start HTTP API server
```

### Inside CLI

```
/help              Show help
/new               New session
/sessions          List sessions
/switch <id>       Switch session
/rename <name>     Rename session
/delete [id]       Delete session
/memory list       Show memories
/memory search <q> Search memories
/config            Show config
/config <k> <v>    Set config (apiKey, model, baseUrl)
/stats             Token usage
/export            Export session as JSON
/api               Start API server
/exit              Exit
```

## API Endpoints (port 3456)

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /chat | Send message (non-streaming) |
| GET | /chat/stream?sessionId=X&message=hello | SSE streaming chat |
| GET | /sessions | List sessions |
| POST | /sessions | Create session |
| GET | /sessions/:id | Get session details |
| GET | /memory | List/search memory |
| POST | /memory | Add memory |
| POST | /config | Update config |
| GET | /stats | Token usage stats |

## Architecture

```
argus_cli/
├── src/
│   ├── index.ts              # Entry point
│   ├── types.ts              # Shared types
│   ├── core/
│   │   ├── index.ts          # ArgusCore - central orchestrator
│   │   ├── db.ts             # SQLite database
│   │   ├── memory.ts         # Long-term memory
│   │   ├── session.ts        # Chat sessions
│   │   ├── llm.ts            # LLM API client (streaming)
│   │   ├── workspace.ts      # File workspace
│   │   ├── tools.ts          # Tool registry
│   │   ├── rag.ts            # RAG engine
│   │   ├── soul.ts           # Agent personality/prompts
│   │   ├── skills.ts         # Skills manager
│   │   ├── trajectory.ts     # Action logging
│   │   ├── tokenStats.ts     # Token usage tracking
│   │   └── webSearch.ts      # Web search
│   ├── cli/
│   │   └── index.ts          # CLI REPL interface
│   └── api/
│       └── server.ts         # HTTP API server
└── data/                     # SQLite database location
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| ARGUS_API_KEY | — | API key |
| ARGUS_BASE_URL | https://api.openai.com/v1 | API endpoint |
| ARGUS_MODEL | gpt-4o-mini | Model name |
| ARGUS_PORT | 3456 | API server port |
| ARGUS_DATA_DIR | ./data | Data directory |

## Build

```bash
npm run build     # Compile TypeScript
npm run dev       # Build + run CLI
```
