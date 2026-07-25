# Argus — Personal AI Assistant

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

**Argus** is a personal AI assistant with persistent memory, chat history, and support for any OpenAI-compatible API — running on your own device.

*Inspired by [Hermes Agent](https://github.com/ponkalapon/hermes-agent) · Built with TypeScript*

</div>

---

## ✨ Features

- 🧠 **Persistent memory** — the assistant remembers facts across sessions
- 💬 **Full chat history** — sessions are stored locally and exportable
- 🔌 **Multi-provider support** — works with OpenAI, OpenRouter, Ollama, LM Studio, or any OpenAI-compatible endpoint
- 📱 **Android app** — standalone mobile client, no server required
- 🖥 **Web / Desktop app** — thin client connected to `argus-core`
- 📡 **Offline queue** — messages sent while offline are automatically retried (up to 90 attempts)
- 📦 **Backup & restore** — export/import all chats and memory as a single JSON file
- 🔍 **RAG support** — semantic search over stored knowledge base
- 🛠 **Extensible tools** — agent tool system for custom integrations

---

## 🏗 Architecture

Argus is a monorepo consisting of three packages:

| Package | Description |
|---|---|
| **argus-core** | Core engine: LLM client, memory, sessions, RAG, HTTP API (port 3456) |
| **argus-mobile** | React Native (Expo) Android app — connects **directly** to your AI endpoint |
| **argus-web** | React Native (Expo) web/desktop app — thin client to `argus-core` |

```
┌─────────────────┐        ┌──────────────────────────────────┐
│  argus-mobile   │───────▶│  Your AI Endpoint                │
│  (Android)      │        │  (OpenAI / OpenRouter / Ollama)  │
└─────────────────┘        └──────────────────────────────────┘
                                           ▲
┌─────────────────┐        ┌──────────────┴───────┐
│  argus-web      │───────▶│  argus-core          │
│  (Web/Desktop)  │        │  localhost:3456       │
└─────────────────┘        └──────────────────────┘
```

---

## 📋 Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- An OpenAI-compatible API key (OpenAI, OpenRouter, etc.) or a local model server (Ollama, LM Studio)
- **Android** 8.0+ for the mobile app

---

## ⚙️ Configuration

Copy the environment template and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
ARGUS_API_KEY=sk-...                          # Your API key
ARGUS_BASE_URL=https://api.openai.com/v1      # Or any compatible endpoint
```

---

## 🚀 Quick Start

### Install dependencies

```bash
npm install
```

### Run CLI chat

```bash
cd packages/argus-core
npm run cli
```

### Run API server

```bash
cd packages/argus-core
npm run api
# Server starts at http://localhost:3456
```

### Run web / desktop app

```bash
cd apps/argus-desktop
npm install --legacy-peer-deps
npx expo start
```

### Install Android APK

1. Go to [**Releases**](https://github.com/ponkalapon/Argus/releases)
2. Download the latest `.apk` file
3. Open it on your Android device
4. Allow installation from unknown sources if prompted
5. Enter your API key in Settings on first launch

---

## 💾 Backup & Restore

Export all chats and memory to a single JSON file:

```bash
# Export
curl http://localhost:3456/export > backup.json

# Import
curl -X POST http://localhost:3456/import \
  -H "Content-Type: application/json" \
  -d @backup.json
```

---

## 🔌 API Reference

<details>
<summary>Show all endpoints (argus-core, port 3456)</summary>

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/chat` | Send message (SSE stream) |
| GET | `/sessions` | List all sessions |
| POST | `/sessions` | Create a session |
| GET | `/sessions/:id` | Get session with messages |
| POST | `/sessions/:id/message` | Add message to session |
| GET | `/memory` | Retrieve memory |
| POST | `/memory` | Add to memory |
| GET | `/stats` | Token usage statistics |
| GET | `/export` | Export everything to JSON |
| POST | `/import` | Import from JSON |

</details>

---

## 🗂 Project Structure

<details>
<summary>Show project tree</summary>

```
argus/
├── packages/
│   └── argus-core/              ← Core engine (AI, memory, API)
│       └── src/core/            ← 16 modules
│           ├── llm.ts           — LLM client (retry, multi-provider)
│           ├── memory.ts        — Persistent memory
│           ├── session.ts       — Session management
│           ├── sessionExport.ts — Export / import
│           ├── rag.ts           — Semantic search (RAG)
│           ├── tools.ts         — Agent tool system
│           └── ...              — 10 more modules
├── apps/
│   ├── argus-mobile/            ← React Native (Expo), standalone
│   │   └── src/services/
│   │       └── offlineQueue.ts  — Offline request queue
│   └── argus-web/               ← React Native (Expo), thin client
├── .env.example
└── package.json                 ← npm workspaces
```

</details>

---

## 🛠 Development

<details>
<summary>Build & development commands</summary>

```bash
# Build entire monorepo
npm run build

# Watch mode
npm run dev

# Build Android APK manually
cd apps/argus-mobile
npm install --legacy-peer-deps
cd android && ./gradlew assembleRelease
```

Built APK location: `apps/argus-mobile/android/app/build/outputs/apk/release/app-release.apk`

</details>

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you would like to change, then submit a pull request.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

[MIT](LICENSE)
