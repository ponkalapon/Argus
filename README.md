# Argus — AI-агент на вашем устройстве

Argus — это персональный AI-ассистент с памятью, историей чатов и поддержкой любого OpenAI-совместимого API (OpenAI, OpenRouter, Ollama, LM Studio и т.д.).

> Вдохновлён [Hermes Agent](https://github.com/ponkalapon/hermes-agent), написан на TypeScript.

---

## 📱 Просто хочу поставить приложение

1. Перейди на страницу **[Releases](https://github.com/ponkalapon/Argus/releases)**
2. Скачай последний `.apk` файл
3. Открой его на Android-телефоне
4. Если появится предупреждение — разреши установку из неизвестных источников
5. Готово! При первом запуске укажи свой API-ключ в настройках

---

## ⚙️ Настройка

Скопируй файл с переменными окружения и заполни:

```bash
cp .env.example .env
```

Открой `.env` и укажи:

```env
ARGUS_API_KEY=sk-...       # твой API-ключ (OpenAI, OpenRouter и т.д.)
ARGUS_BASE_URL=https://api.openai.com/v1   # или другой совместимый endpoint
```

---

## 🚀 Быстрый старт

### Установка зависимостей

```bash
npm install
```

### Запустить чат в терминале

```bash
cd packages/argus-core
npm run cli
```

### Запустить API-сервер

```bash
cd packages/argus-core
npm run api
# Сервер запустится на http://localhost:3456
```

### Запустить веб/десктоп приложение

```bash
cd apps/argus-web
npm install --legacy-peer-deps
npx expo start
```

---

## 🗂 Как это устроено

Проект состоит из трёх частей:

| Часть | Что это |
|-------|---------|
| **argus-core** | Ядро: AI, память, история чатов, HTTP API на порту 3456 |
| **argus-mobile** | Мобильное приложение (Android). Работает **автономно** — подключается напрямую к твоему API |
| **argus-web** | Веб/десктоп приложение. Работает как **тонкий клиент** к argus-core |

```
argus-mobile ──→ твой AI endpoint (OpenAI / OpenRouter / etc.)
argus-web    ──→ argus-core (localhost:3456) ──→ твой AI endpoint
```

---

## 💾 Резервная копия данных

Можно экспортировать все чаты и память в один JSON-файл:

```bash
# Сохранить
curl http://localhost:3456/export > backup.json

# Восстановить
curl -X POST http://localhost:3456/import \
  -H "Content-Type: application/json" \
  -d @backup.json
```

---

## 📡 Офлайн-режим

Если интернет пропал — мобильное приложение не теряет сообщения. Они сохраняются в очередь и автоматически отправляются при восстановлении соединения (до 90 попыток с паузами).

---

## 🔌 API (argus-core, порт 3456)

<details>
<summary>Показать все эндпоинты</summary>

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | Проверка статуса |
| POST | `/chat` | Отправить сообщение (SSE stream) |
| GET | `/sessions` | Список сессий |
| POST | `/sessions` | Создать сессию |
| GET | `/sessions/:id` | Сессия с сообщениями |
| POST | `/sessions/:id/message` | Добавить сообщение |
| GET | `/memory` | Получить память |
| POST | `/memory` | Добавить в память |
| GET | `/stats` | Статистика токенов |
| GET | `/export` | Экспорт всего в JSON |
| POST | `/import` | Импорт из JSON |

</details>

---

## 🛠 Для разработчиков

<details>
<summary>Структура проекта</summary>

```
argus/
├── packages/
│   └── argus-core/          ← Ядро (AI, память, API)
│       └── src/core/        ← 16 модулей
│           ├── llm.ts       — LLM-клиент (retry, multi-provider)
│           ├── memory.ts    — Память
│           ├── session.ts   — Сессии
│           ├── sessionExport.ts — Экспорт/импорт
│           ├── rag.ts       — Поиск по базе
│           ├── tools.ts     — Инструменты агента
│           └── ...          — ещё 10 модулей
├── apps/
│   ├── argus-mobile/        ← React Native (Expo), автономный
│   │   └── src/services/
│   │       └── offlineQueue.ts — Очередь офлайн-запросов
│   └── argus-web/           ← React Native (Expo), тонкий клиент
├── .env.example
└── package.json             ← npm workspaces
```

</details>

<details>
<summary>Сборка и разработка</summary>

```bash
# Сборка всего monorepo
npm run build

# Watch-режим
npm run dev

# Собрать APK вручную
cd apps/argus-mobile
npm install --legacy-peer-deps
cd android && ./gradlew assembleRelease
```

Готовый APK: `apps/argus-mobile/android/app/build/outputs/apk/release/app-release.apk`

</details>

---

## Лицензия

MIT
