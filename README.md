# Argus — AI Agent Platform

Архитектура вдохновлена [Hermes Agent](https://github.com/ponkalapon/hermes-agent), но реализована на TypeScript/Node.js.

## Структура проекта

```
argus/
├── packages/
│   └── argus-core/          ← Ядро (Core Engine)
│       ├── src/
│       │   ├── core/        ← Основные модули (DB, LLM, Memory, RAG, Session)
│       │   ├── api/         ← HTTP API сервер
│       │   ├── cli/         ← CLI REPL
│       │   └── types.ts     ← Типы
│       ├── dist/            ← Скомпилированный JS
│       └── package.json
├── apps/
│   ├── argus-web/           ← Веб-интерфейс (React/Next.js) — в разработке
│   └── argus-mobile/        ← Мобильное приложение (React Native)
├── package.json             ← Root monorepo
└── README.md
```

## Компоненты

| Компонент | Технология | Роль |
|-----------|-----------|------|
| **@argus/core** | TypeScript, Node.js, SQLite | Ядро: AI-логика, память, RAG, сессии, инструменты, API |
| **argus-web** | React, Next.js | Веб-интерфейс (десктоп) — тонкий клиент к core API |
| **argus-mobile** | React Native | Мобильное приложение (телефон) — автономное, AI напрямую |

## Быстрый старт

### Установка зависимостей (весь monorepo)
```bash
npm install
```

### Ядро (@argus/core)
```bash
cd packages/argus-core

# CLI режим
npm run cli

# API сервер (порт 3456)
ARGUS_API_KEY=sk-... npm run api
```

### Веб-интерфейс (в разработке)
```bash
cd apps/argus-web
npm run dev
```

### Мобильное приложение
```bash
cd apps/argus-mobile
npm install --legacy-peer-deps
npx expo start
```

## API Endpoints (@argus/core, порт 3456)

| Метод | Путь | Описание |
|-------|------|---------|
| GET | `/health` | Health check |
| POST | `/chat` | Отправить сообщение |
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
