# Argus — Персональный ИИ-Ассистент

<div align="center">

<p align="center">
  <a href="README.md">English</a> | <b>Русский</b>
</p>

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

**Argus** — это ваш персональный ИИ-ассистент с постоянной памятью, историей чатов и поддержкой любого API, совместимого с OpenAI, который работает прямо на вашем устройстве.

*Вдохновлен проектом [Hermes Agent](https://github.com/ponkalapon/hermes-agent) · Написан на TypeScript*

</div>

---

## ✨ Возможности

- 🧠 **Постоянная память** — ассистент запоминает важные факты между сессиями общения.
- 💬 **Полная история чатов** — сессии хранятся локально, и их всегда можно экспортировать.
- 🔌 **Поддержка любых провайдеров** — отлично работает с OpenAI, OpenRouter, Ollama, LM Studio и любыми другими совместимыми API.
- 📱 **Мобильное приложение (Android)** — полностью самостоятельный клиент, не требующий внешнего сервера.
- 🖥 **Web / Desktop приложение** — легковесный клиент, подключающийся к локальному ядру `argus-core`.
- 📡 **Офлайн-очередь** — сообщения, отправленные без интернета, будут автоматически отправлены позже (до 90 попыток).
- 📦 **Резервное копирование** — экспорт и импорт всей истории и памяти в виде одного удобного JSON-файла.
- 🔍 **RAG (Поиск по знаниям)** — семантический поиск по сохраненной базе знаний.
- 🛠 **Расширяемые инструменты (Интеграция MCP)** — поддержка вызова функций, в том числе использование Model Context Protocol.

---

## 🏗 Архитектура

Проект Argus представляет собой монорепозиторий, состоящий из трех основных пакетов:

| Пакет | Описание |
|---|---|
| **argus-core** | Основное ядро: клиент LLM, память, сессии, RAG, HTTP API (по умолчанию порт 3456) |
| **argus-mobile** | Мобильное приложение на React Native (Expo) для Android — подключается **напрямую** к вашему ИИ-серверу |
| **argus-web** | Десктопное/Веб-приложение на React Native (Expo) — тонкий клиент, работающий в связке с `argus-core` |

```text
┌─────────────────┐        ┌──────────────────────────────────┐
│  argus-mobile   │───────▶│  Ваш ИИ-сервер (API)             │
│  (Android)      │        │  (OpenAI / OpenRouter / Ollama)  │
└─────────────────┘        └──────────────────────────────────┘
                                           ▲
┌─────────────────┐        ┌──────────────┴───────┐
│  argus-web      │───────▶│  argus-core          │
│  (Web/Desktop)  │        │  localhost:3456       │
└─────────────────┘        └──────────────────────┘
```

---

## 📋 Требования

- **Node.js** v18 или новее
- **npm** v9 или новее
- Ключ от любого API, совместимого с OpenAI (например, OpenAI, OpenRouter) или локально запущенная модель (Ollama, LM Studio)
- **Android 8.0+** для использования мобильного приложения

---

## ⚙️ Настройка

Скопируйте шаблон файла переменных окружения и впишите свои данные:

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```env
ARGUS_API_KEY=sk-...                          # Ваш API-ключ
ARGUS_BASE_URL=https://api.openai.com/v1      # Адрес вашего API-сервера
```

---

## 🚀 Быстрый старт

### Установка зависимостей

```bash
npm install
```

### Запуск чата в терминале (CLI)

```bash
cd packages/argus-core
npm run cli
```

### Запуск API-сервера ядра

```bash
cd packages/argus-core
npm run api
# Сервер запустится по адресу http://localhost:3456
```

### Запуск Web / Desktop приложения

```bash
cd apps/argus-desktop
npm install --legacy-peer-deps
npx expo start
```

### Установка APK на Android

1. Перейдите в раздел [**Releases**](https://github.com/ponkalapon/Argus/releases).
2. Скачайте самый свежий файл `.apk`.
3. Откройте его на вашем Android-устройстве (потребуется разрешить установку из неизвестных источников).
4. При первом запуске введите свой API-ключ в настройках приложения.

---

## 💾 Бэкап и восстановление данных

Экспорт всех чатов и базы памяти в единый JSON-файл:

```bash
# Экспорт
curl http://localhost:3456/export > backup.json

# Импорт
curl -X POST http://localhost:3456/import \
  -H "Content-Type: application/json" \
  -d @backup.json
```

---

## 🔌 Описание API (Reference)

<details>
<summary>Показать все эндпоинты (argus-core, порт 3456)</summary>

| Метод | Путь | Описание |
|--------|------|-------------|
| GET | `/health` | Проверка работоспособности |
| POST | `/chat` | Отправка сообщения (SSE стриминг) |
| GET | `/sessions` | Список всех сессий |
| POST | `/sessions` | Создание новой сессии |
| GET | `/sessions/:id` | Получение сессии со всеми сообщениями |
| POST | `/sessions/:id/message` | Добавление сообщения в сессию |
| GET | `/memory` | Получение содержимого памяти |
| POST | `/memory` | Добавление факта в память |
| GET | `/stats` | Статистика использования токенов |
| GET | `/export` | Полный экспорт данных в JSON |
| POST | `/import` | Восстановление данных из JSON |

</details>

---

## 🗂 Структура проекта

<details>
<summary>Показать дерево файлов</summary>

```text
argus/
├── packages/
│   └── argus-core/              ← Основное ядро (ИИ, память, API)
│       └── src/core/            ← 16 модулей логики
│           ├── llm.ts           — Клиент LLM (мультипровайдер, ретраи)
│           ├── memory.ts        — Постоянная память
│           ├── session.ts       — Управление сессиями
│           ├── sessionExport.ts — Экспорт / Импорт
│           ├── rag.ts           — Семантический поиск (RAG)
│           ├── tools.ts         — Инструменты для агента
│           └── ...              — Еще 10 модулей
├── apps/
│   ├── argus-mobile/            ← React Native (Expo) - мобилка
│   │   └── src/services/
│   │       └── offlineQueue.ts  — Очередь офлайн-сообщений
│   └── argus-web/               ← React Native (Expo) - веб/десктоп
├── .env.example
└── package.json                 ← Конфиг monorepo (npm workspaces)
```

</details>

---

## 🛠 Разработка (Сборка)

<details>
<summary>Команды для разработки и билдов</summary>

```bash
# Сборка всего монорепозитория
npm run build

# Запуск в режиме разработки (Watch mode)
npm run dev

# Ручная сборка Android APK
cd apps/argus-mobile
npm install --legacy-peer-deps
cd android && ./gradlew assembleRelease
```

Путь к готовому APK-файлу: `apps/argus-mobile/android/app/build/outputs/apk/release/app-release.apk`

</details>

---

## 🤝 Вклад в развитие (Contributing)

Будем рады любой помощи! Пожалуйста, перед внесением больших изменений сначала создайте Issue (проблему) для обсуждения, а затем открывайте Pull Request.

1. Форкните этот репозиторий.
2. Создайте новую ветку: `git checkout -b feature/my-feature`
3. Закоммитьте изменения: `git commit -m 'feat: add my feature'`
4. Отправьте ветку в свой форк: `git push origin feature/my-feature`
5. Откройте Pull Request.

---

## 📄 Лицензия

[MIT](LICENSE)
