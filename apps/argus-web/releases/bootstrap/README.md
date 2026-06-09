# Argus Bootstrap - Quick Start Guides

Выберите вашу платформу и следуйте инструкциям:

## 🖥️ Windows (PC)

### Требования:
- Git: https://git-scm.com/
- Node.js v18+: https://nodejs.org/

### Установка:
1. Скачайте **PC_Bootstrap.bat** из этой папки
2. Поместите файл в папку, где хотите установить Argus
3. Дважды нажмите на **PC_Bootstrap.bat**
4. Дождитесь завершения установки
5. После этого запускайте приложение командой:
   ```
   cd Argus
   node argus-cli.js start
   ```

## 🐧 Linux / macOS

### Требования:
- Git (обычно предустановлен)
- Node.js v18+: https://nodejs.org/

### Установка:
1. Скачайте **Linux_Bootstrap.sh** из этой папки
2. Откройте терминал в папке, где хотите установить Argus
3. Выполните команду:
   ```bash
   bash Linux_Bootstrap.sh
   ```
4. Дождитесь завершения установки
5. После этого запускайте приложение командой:
   ```bash
   cd Argus
   node argus-cli.js start
   ```

## 📱 Android (Termux)

### Требования:
- Termux приложение: https://termux.com/ (или F-Droid)
- Expo Go (для тестирования): https://play.google.com/store/apps/details?id=host.exp.exponent

### Установка:
1. Откройте **Termux**
2. Скачайте **Android_Bootstrap.sh**:
   ```bash
   curl -o Android_Bootstrap.sh https://raw.githubusercontent.com/ponkalapon/Argus/master/releases/bootstrap/Android_Bootstrap.sh
   ```
3. Запустите скрипт:
   ```bash
   bash Android_Bootstrap.sh
   ```
4. Дождитесь завершения установки
5. После этого для запуска:
   ```bash
   cd Argus
   npm start
   ```
   Отсканируйте QR-код приложением Expo Go

---

## 🔄 Обновление приложения

После первоначальной установки, для обновления просто выполните:

```bash
node argus-cli.js update
```

Это будет:
1. Скачать последние изменения с GitHub
2. Обновить все зависимости
3. Пересобрать приложение (если требуется)

---

## ⚠️ Решение проблем

### Git не найден
**Windows:** Установите Git с https://git-scm.com/
**Linux:** `sudo apt install git`
**macOS:** `brew install git`

### Node.js не найден
Установите с https://nodejs.org/ (требуется v18 или выше)

### Ошибка при клонировании репозитория
Проверьте подключение к интернету и убедитесь, что Git установлен корректно.

### Ошибка при установке зависимостей
Попробуйте:
```bash
npm cache clean --force
npm install
```

---

## 📚 Дополнительно

- Исходный код: https://github.com/ponkalapon/Argus
- Документация: см. README.md в основной папке проекта
