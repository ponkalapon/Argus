# Argus AI - Universal Client

Argus — это универсальный клиент для работы с AI-агентами, поддерживающий desktop (Windows/Linux/macOS) и mobile (Android/iOS через Expo) платформы.

## 🔧 Установка

### Быстрый старт (Bootstrap)
Для быстрого старта используйте **bootstrap-скрипты** из папки [`releases/bootstrap/`](releases/bootstrap/):

- **Windows:** [PC_Bootstrap.bat](releases/bootstrap/PC_Bootstrap.bat)
- **Linux/macOS:** [Linux_Bootstrap.sh](releases/bootstrap/Linux_Bootstrap.sh)
- **Android (Termux):** [Android_Bootstrap.sh](releases/bootstrap/Android_Bootstrap.sh)

Скрипты автоматически:
1. Клонируют репозиторий
2. Устанавливают зависимости
3. Обновляют приложение до последней версии

После установки запускайте приложение командой:
```bash
node argus-cli.js start  # Desktop
```

### Обновление
Для обновления до последней версии выполните:
```bash
node argus-cli.js update
```

## 📱 CLI-команды

| Команда | Описание |
|---------|----------|
| `node argus-cli.js update` | Обновить код, зависимости и пересобрать приложение |
| `node argus-cli.js start` | Запустить desktop-приложение |
| `node argus-cli.js bootstrap` | Сгенерировать bootstrap-скрипты |

## 🛠️ Сборка

### Desktop (Electron)
```bash
npm run build      # Сборка приложения
npm run dist      # Создание дистрибутива (Windows/Linux/macOS)
```

### Mobile (Expo)
```bash
npm start          # Запуск Expo-сервера
```

## 📂 Структура проекта

```
Argus/
├── android/               # Android-специфичные файлы
├── src/
│   ├── components/        # React-компоненты
│   ├── services/           # Логика приложения
│   └── styles/             # Стили
├── argus-cli.js           # CLI-утилита для обновлений
├── package.json           # Зависимости и скрипты
└── releases/
    └── bootstrap/           # Bootstrap-скрипты для всех платформ
```

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку (`git checkout -b feat/your-feature`)
3. Закоммитьте изменения (`git commit -m 'feat: add new feature'`)
4. Запушьте ветку (`git push origin feat/your-feature`)
5. Создайте Pull Request

## 📄 Лицензия

MIT

---

© 2026 Argus AI