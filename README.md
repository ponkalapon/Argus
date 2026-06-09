# Argus — AI Agent Platform

Архитектура вдохновлена [Hermes Agent](https://github.com/ponkalapon/hermes-agent), но реализована на TypeScript/Node.js.

## Структура проекта

```
argus/
├── packages/
│   └── argus-core/              ← Ядро (AI, память, API)
│       ├── src/
│       │   ├── core/            ← 14 модулей
│       │   │   ├── db.ts        — SQLite через sql.js
│       │   │   ├── llm.ts       — OpenAI API (streaming)
│       │   │   ├── memory.ts    — Key-value хранилище
│       │   │   ├── session.ts   — Сессии чатов
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
│   │       ├── services/        — 19 сервисов (OpenAI, RAG, память, файлы…)
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
├── package.json                 — npm workspaces (root monorepo)
└── README.md
```

## Компоненты

| Компонент | Технология | Роль |
|-----------|-----------|------|
| **@argus/core** | TypeScript, Node.js, SQLite | Ядро: AI-логика, память, RAG, сессии, инструменты, HTTP API |
| **argus-mobile** | React Native (Expo) | Мобильное приложение — **автономное**, AI напрямую через OpenAI API |
| **argus-web** | React Native (Expo) | Десктоп/веб — **тонкий клиент** к argus-core через REST API на порту 3456 |

## Архитектура

```
┌─────────────────────────────────────────────────────┐
│  apps/argus-mobile        apps/argus-web            │
│  (React Native)           (React Native)            │
│  ┌──────────────────┐    ┌───────────────────┐      │
│  │ services/*       │    │ api/client.ts ──────┐   │
│  │ (OpenAI прямой)  │    │ services/* (stub)   │   │
│  └──────┬───────────┘    └──────────┬──────────┘   │
│         │ AI напрямую               │ HTTP :3456    │
└─────────┼───────────────────────────┼───────────────┘
          │                           │
          │              ┌───────────────────────────┐
          │              │  packages/argus-core       │
          │              │  (CLI + API сервер)        │
          │              │  ┌─────────────────────┐   │
          └──────────────│  │ LLM → Memory → RAG  │   │
                         │  │ Session → Tools     │   │
                         │  │ SQLite (sql.js)     │   │
                         │  └─────────────────────┘   │
                         └───────────────────────────┘
```

## Быстрый старт

### Установка зависимостей (весь monorepo)
```bash
npm install
```

### Ядро (@argus/core)
```bash
cd packages/argus-core

# CLI режим (REPL)
npm run cli

# API сервер (порт 3456)
ARGUS_API_KEY=sk-... npm run api
```

### Десктоп/веб (тонкий клиент)
```bash
cd apps/argus-web
npm install --legacy-peer-deps
npx expo start
```

### Мобильное приложение (автономное)

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
| GET | `/memory` | Получить память |
| POST | `/memory` | Добавить в память |
| GET | `/stats` | Статистика токенов |
| GET | `/config` | Конфигурация |

## Разработка

```bash
# Сборка всех пакетов
npm run build

# Разработка (watch mode)
npm run dev
```

## Лицензия

MIT
