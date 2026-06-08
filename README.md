# Argus — AI Agent Platform

## Architecture

```
argus_cli/       ← CORE engine (all AI logic, memory, RAG, sessions, tools)
argus_mobile/    ← Standalone React Native Expo app (AI runs directly on device)
argus_desktop/   ← Thin React Native Expo client → HTTP API to argus_cli
```

**argus_mobile** — работает автономно, AI-логика на телефоне через OpenAI API (как и было).  
**argus_desktop** — тонкий клиент к `argus_cli` (на том же ПК). Вся AI-логика, память, RAG — на сервере.  
**argus_cli** — ядро: REPL и HTTP API сервер на порту 3456.

## Быстрый старт

### Mobile (автономно)
```bash
cd argus_mobile
npm install --legacy-peer-deps
npx expo start
```
AI-запросы идут напрямую к OpenAI API через `settings.baseUrl`.

### Desktop (через сервер)
```bash
# 1. Запустить ядро
cd argus_cli
npm install --legacy-peer-deps
export ARGUS_API_KEY="sk-..."
npm run api

# 2. Запустить клиент (в другом терминале)
cd argus_desktop
npm install --legacy-peer-deps
npx expo start
```

## Структура проекта

| Компонент | Технологии | Роль |
|-----------|-----------|------|
| `argus_cli` | TypeScript, Node.js, SQLite | Ядро: память, RAG, сессии, LLM, инструменты |
| `argus_mobile` | React Native Expo | Автономное мобильное приложение (AI на устройстве) |
| `argus_desktop` | React Native Expo (web) | Тонкий клиент к argus_cli API |

## API Endpoints (argus_cli, порт 3456)

| Метод | Путь | Описание |
|--------|------|----------|
| GET | /health | Health check |
| POST | /chat | Отправить сообщение (non-streaming) |
| GET | /chat/stream?sessionId=X&message=hello | SSE стриминг чата |
| GET | /sessions | Список сессий |
| POST | /sessions | Создать сессию |
| GET | /sessions/:id | Детали сессии |
| GET | /memory | Память |
| POST | /memory | Добавить в память |
| POST | /config | Обновить конфиг |
| GET | /stats | Статистика токенов |
