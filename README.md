# Argus — AI Agent Platform

Архитектура вдохновлена [Hermes Agent](https://github.com/ponkalapon/hermes-agent), реализована на TypeScript/Node.js.

## Структура проекта

```
argus/
├── packages/
│   └── argus-core/              ← Ядро (AI, память, API)
│       ├── src/
│       │   ├── core/            ← 16 модулей
│       │   │   ├── db.ts        — SQLite через sql.js
│       │   │   ├── llm.ts       — LLMClient с retry (до 90 попыток)
│       │   │   ├── retry.ts     — Утилита withRetry (exponential backoff)
│       │   │   ├── memory.ts    — Key-value хранилище
│       │   │   ├── session.ts   — Сессии чатов
│       │   │   ├── sessionExport.ts — Экспорт/импорт сессий и памяти
│       │   │   ├── rag.ts       — Поиск по ключевым словам
│       │   │   ├── skills.ts    — CRUD навыков
│       │   │   ├── soul.ts      — Сборка system prompt
│       │   │   ├── tools.ts     — Инструменты (read, write, web, memory)
│       │   │   ├── workspace.ts — Работа с файлами
│       │   │   ├── trajectory.ts— Логирование действий
│       │   │   ├── tokenStats.ts— Учёт токенов
│       │   │   ├── webSearch.ts — DuckDuckGo + Google fallback
│       │   │   ├── index.ts     — ArgusCore (оркестратор)
│       │   │   └── context.ts   — Контекст сессии
│       │   ├── api/server.ts    — REST + SSE на порту 3456
│       │   ├── cli/index.ts     — REPL с /командами
│       │   ├── index.ts         — Точка входа: `argus [cli|api]`
│       │   └── types.ts         — Все типы
│       ├── dist/                — Скомпилированный JS
│       └── package.json
├── apps/
│   ├── argus-mobile/            ← React Native (автономный)
│   │   └── src/
│   │       ├── components/      — 10 экранов (Workspace, Settings, Chat…)
│   │       ├── services/        — 20 сервисов (OpenAI, RAG, память, файлы…)
│   │       │   └── offlineQueue.ts — Офлайн-очередь запросов
│   │       ├── styles/theme.ts  — Тёмная тема
│   │       └── types.ts
│   │
│   └── argus-web/               ← React Native (тонкий клиент)
│       └── src/
│           ├── api/             — HTTP-клиент к argus-core (:3456)
│           ├── components/      — Те же 10 экранов
│           ├── services/        — 19 сервисов (stub/совместимый слой)
│           ├── styles/theme.ts
│           └── types.ts
├── .env.example                 — Пример конфигурации
├── package.json                 — npm workspaces (root monorepo)
└── README.md
```

## Компоненты

| Компонент | Технология | Роль |
|-----------|-----------|------|
| **@argus/core** | TypeScript, Node.js, SQLite | Ядро: AI-логика, память, RAG, сессии, инструменты, HTTP API |
| **argus-mobile** | React Native (Expo) | Мобильное приложение — **автономное**, AI напрямую через endpoint пользователя |
| **argus-web** | React Native (Expo) | Десктоп/веб — **тонкий клиент** к argus-core через REST API на порту 3456 |

## Архитектура

```
┌─────────────────────────────────────────────────────┐
│  apps/argus-mobile        apps/argus-web            │
│  (React Native)           (React Native)            │
│  ┌──────────────────┐    ┌───────────────────┐      │
│  │ services/*       │    │ api/client.ts ──────┐   │
│  │ (AI напрямую)    │    │ services/* (stub)   │   │
│  │ offlineQueue.ts  │    └──────────┬──────────┘   │
│  └──────┬───────────┘               │ HTTP :3456    │
└─────────┼───────────────────────────┼───────────────┘
          │                           │
          ▼                           ▼
    Endpoint пользователя   packages/argus-core
    (OpenAI / OpenRouter /  (CLI + API сервер)
     любой /v1 прокси)      ┌─────────────────────┐
                             │ LLM → Memory → RAG  │
                             │ Session → Tools     │
                             │ SQLite (sql.js)     │
                             │ retry (90 попыток)  │
                             └─────────────────────┘
```

## Быстрый старт

### 1. Конфигурация

```bash
cp .env.example .env
# Заполни ARGUS_API_KEY и ARGUS_BASE_URL
```

### 2. Установка зависимостей (весь monorepo)

```bash
npm install
```

### 3. Ядро (@argus/core)

```bash
cd packages/argus-core

# CLI режим (REPL)
npm run cli

# API сервер (порт 3456)
ARGUS_API_KEY=sk-... npm run api
```

### 4. Десктоп/веб (тонкий клиент)

```bash
cd apps/argus-web
npm install --legacy-peer-deps
npx expo start
```

### 5. Мобильное приложение (автономное)

#### Установка из APK (рекомендуется)

Скачайте последнюю версию APK со страницы [Releases](https://github.com/ponkalapon/Argus/releases):
- Откройте на телефоне скачанный APK
- Разрешите установку из неизвестных источников
- При запуске приложение автоматически проверит наличие обновлений на GitHub

#### Сборка из исходников

```bash
cd apps/argus-mobile
npm install --legacy-peer-deps
cd android
export ANDROID_HOME=/path/to/android/sdk
./gradlew assembleRelease
```

APK будет в `apps/argus-mobile/android/app/build/outputs/apk/release/app-release.apk`

## API Endpoints (@argus/core, порт 3456)

| Метод | Путь | Описание |
|-------|------|---------|
| GET | `/health` | Health check |
| POST | `/chat` | Отправить сообщение (SSE stream) |
| GET | `/sessions` | Список сессий |
| POST | `/sessions` | Создать сессию |
| GET | `/sessions/:id` | Получить сессию с сообщениями |
| POST | `/sessions/:id/message` | Добавить сообщение |
| GET | `/memory` | Получить память |
| POST | `/memory` | Добавить в память |
| GET | `/stats` | Статистика токенов |
| GET | `/export` | Экспортировать все сессии и память в JSON |
| POST | `/import` | Импортировать сессии и память из JSON |

## Экспорт / Импорт данных

```bash
# Экспорт всех сессий и памяти
curl http://localhost:3456/export > argus-backup.json

# Импорт на другой машине
curl -X POST http://localhost:3456/import \
  -H "Content-Type: application/json" \
  -d @argus-backup.json
```

## Офлайн-режим (argus-mobile)

При отсутствии сети запросы автоматически попадают в очередь (`offlineQueue.ts`) и отправляются при восстановлении соединения. Максимум 90 попыток на каждый запрос.

```typescript
import { enqueueRequest, processQueue } from './services/offlineQueue';

// При потере сети
await enqueueRequest(sessionId, userMessage);

// При восстановлении (NetInfo event)
NetInfo.addEventListener(state => {
  if (state.isConnected) processQueue(sendFn);
});
```

## Retry и таймауты

`LLMClient.chat()` автоматически повторяет запросы при сетевых ошибках и 5xx:
- **90 попыток** максимум
- **30 секунд** таймаут на попытку
- Exponential backoff с jitter между попытками

```typescript
// Опциональные параметры
await core.llm.chat({
  ...opts,
  maxRetries: 90,    // по умолчанию
  timeoutMs: 30000,  // по умолчанию
  onRetry: (attempt, err) => console.log(`Retry ${attempt}: ${err.message}`),
});
```

## Разработка

```bash
# Сборка всех пакетов
npm run build

# Разработка (watch mode)
npm run dev
```

## Лицензия

MIT
