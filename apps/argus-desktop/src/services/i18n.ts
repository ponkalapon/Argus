import jsYaml from 'js-yaml';

export interface LanguageOption {
  code: string;
  label: string;
}

export const dictionaries: Record<string, Record<string, any>> = {
  ru: {
    meta: { name: "Русский", code: "ru" },
    navigation: {
      new_chat: "Новый чат",
      search: "Поиск",
      library: "Библиотека",
      sandbox: "Песочница",
      recent: "НЕДАВНИЕ",
      no_chats_title: "Пока нет диалогов",
      no_chats_text: "Первый чат создастся автоматически после отправки сообщения.",
      connected: "Подключено",
      select_folder: "Выбрать папку на ПК",
      pc_workspace: "Рабочая область ПК",
      download_zip: "Скачать ZIP архив",
    },
    status: {
      idle: "Готов",
      thinking: "Отвечает…",
      error: "Ошибка",
      no_model: "Модель не задана",
      not_configured: "Подключение не настроено",
      key_set: "ключ задан",
      no_key: "без ключа",
      msgs: "сообщ.",
    },
    chat: {
      placeholder: "Спросить Agent...",
      welcome_title: "Чем могу помочь?",
      connect_hint: "Настроить подключение",
      copy_code: "Копировать",
      copied: "Скопировано",
      exploring_files: "Просмотр файлов",
      running: "выполняется…",
      input_short: "Вх",
      output_short: "Вых",
      msgs_short: "сообщ.",
      match: "совпадение",
      select_model_title: "Выбрать модель",
      search_placeholder: "Поиск…",
      loading_models: "Загрузка моделей…",
    },
    workspace: {
      title: "Рабочая область ПК",
      no_active_chat: "Нет активного чата",
      no_active_chat_desc: "Создай чат, чтобы подключить рабочую папку.",
      change_folder: "📁 Сменить папку ПК",
      select_folder: "📁 Выбрать папку на ПК",
      download_zip: "Скачать ZIP архив",
      empty_title: "Рабочая область пуста",
      empty_desc: "Нажмите «📁 Выбрать папку на ПК», чтобы открыть файлы вашей системы напрямую в рабочем окне Агента.",
    },
    settings: {
      title: "Настройки",
      save: "Сохранить",
      saving: "Сохранение...",
      api_key: "API Ключ",
      api_key_desc: "Ключ сохраняется локально на вашем ПК и используется для авторизации",
      base_url: "Base URL (OpenAI-Compatible)",
      model: "Модель ИИ",
      model_placeholder: "gpt-4o-mini / mimo-v2.5",
      connection_title: "Подключение ИИ",
      connection_desc: "Настройка подключения к ИИ серверу (OpenAI-compatible API)",
      allow_contacts: "Разрешить ассистенту доступ к контактам",
      tab_general: "Подключение",
      tab_customization: "Кастомизация",
      tab_stats: "Использование",
      tab_skills: "Навыки",
      tab_privacy: "Безопасность",
      customization_title: "Внешний вид и кастомизация",
      customization_desc: "Настройка языка, внешнего вида и обоев приложения",
      wallpaper_title: "Фоновые обои приложения",
      custom_wallpaper: "+ Свои обои",
      reset_default: "Вернуть классический",
      custom_wallpaper_title: "Свои обои",
      custom_wallpaper_desc: "Загруженное пользователем изображение",
      wallpaper_opacity: "Интенсивность затемнения обоев",
      wallpaper_opacity_hint: "Регулируйте видимость выбранного фона для максимального удобства чтения",
      opacity_light: "Легкое (25%)",
      opacity_balanced: "Баланс (45%)",
      opacity_soft: "Мягкое (65%)",
      opacity_matte: "Матовое (85%)",
      language_title: "Язык приложения / Language",
      language_hint: "Загружено из .yml файлов локализации.",
      stats_title: "Статистика использования",
      input_tokens: "Входные токены",
      output_tokens: "Выходные токены",
      requests_count: "Запросов",
      chart_title: "График за 7 дней",
      reset_stats: "Сбросить статистику",
      skills_title: "Навыки ИИ (Skills)",
      skills_desc: "Автономные навыки, создаваемые ИИ или вручную во время диалога",
      add_skill: "+ Добавить навык",
      cancel: "Отмена",
      default_wallpaper_title: "Классический темный",
      default_wallpaper_desc: "Стандартный элегантный глубокий темный фон Argus",
      cyber_mesh_title: "Кибер-сетка",
      cyber_mesh_desc: "Неоновая анимированная кибернетическая сетка",
      argus_nebula_title: "Космическая туманность",
      argus_nebula_desc: "Глубокий космос со звездной туманностью",
      minimal_carbon_title: "Минимал Карбон",
      minimal_carbon_desc: "Строгая матовая текстура карбона с фиолетовым отливом",
      neon_waves_title: "Неоновые Волны",
      neon_waves_desc: "Яркие динамические волны светящегося неона",
      deep_space_title: "Глубокий Космос",
      deep_space_desc: "Тёмно-изумрудная космическая пыль и галактики",
      privacy_title: "Разрешения и безопасность ПК",
      privacy_desc: "Настройка доступа и локальной приватности ассистента на компьютере",
      project_files_title: "Доступ к файлам проекта",
      project_files_desc: "Разрешить ассистенту создавать, изменять и читать файлы кода в рабочей области на ПК",
      web_search_title: "Автоматический веб-поиск",
      web_search_desc: "Разрешить ассистенту находить свежие новости и факты в интернете во время диалога",
      skill_name: "Название навыка",
      skill_name_placeholder: "Например: deploy_app / format_json",
      skill_desc: "Описание",
      skill_desc_placeholder: "Что делает данный навык",
      skill_instruction: "Инструкция / Паттерн",
      skill_instruction_placeholder: "Пошаговая инструкция для ассистента",
      save_skill: "Сохранить навык",
      no_skills: "Нет активных навыков. Вы можете добавить новый навык по кнопке выше или попросить ИИ запомнить навык во время разговора.",
      base_url_empty: "Base URL не задан",
      key_saved: "Ключ сохранён",
      reset_stats_title: "⚠️ Сброс статистики",
      reset_stats_msg: "Вы действительно хотите полностью обнулить всю сохраненную статистику использования токенов? Это действие нельзя отменить.",
      reset_stats_confirm: "Да, обнулить",
      alert_need_url: "Нужен Base URL",
      alert_need_url_msg: "Укажи адрес OpenAI-compatible API.",
      alert_check_url: "Проверь Base URL",
      alert_check_url_msg: "Адрес должен начинаться с http:// или https://.",
      alert_need_model: "Нужна модель",
      alert_need_model_msg: "Укажи название модели.",
      alert_saved: "Готово",
      alert_saved_msg: "Настройки сохранены.",
      alert_error: "Ошибка",
      alert_skill_name: "Укажи название",
      alert_skill_name_msg: "Введите название навыка",
      alert_wallpaper_error: "Ошибка выбора файла",
      alert_wallpaper_error_msg: "Не удалось загрузить изображение.",
      skill_pattern_label: "Паттерн:",
      model_other: "Другое",
      no_models: "Нет моделей",
      other_label: "Другое",
    },
    attach: {
      camera: "Камера",
      photo: "Фото",
      files: "Файлы",
      file_manager: "Файл. менеджер",
      internet_on: "Интернет: вкл",
      internet_off: "Интернет: выкл",
    },
    search: {
      enter_query: "Введите запрос",
      enter_query_hint: "Начни вводить текст для поиска по истории диалогов.",
      not_found: "Ничего не найдено",
      not_found_hint: "Попробуй изменить запрос.",
      results_header: "РЕЗУЛЬТАТЫ ПОИСКА",
      match: "совпадение",
      msgs_count: "сообщ.",
    },
  },
  en: {
    meta: { name: "English", code: "en" },
    navigation: {
      new_chat: "New Chat",
      search: "Search",
      library: "Library",
      sandbox: "Sandbox",
      recent: "RECENT",
      no_chats_title: "No chats yet",
      no_chats_text: "Your first chat will be created automatically after sending a message.",
      connected: "Connected",
      select_folder: "Select Folder on PC",
      pc_workspace: "PC Workspace",
      download_zip: "Download ZIP Archive",
    },
    status: {
      idle: "Ready",
      thinking: "Responding…",
      error: "Error",
      no_model: "Model not set",
      not_configured: "Connection not configured",
      key_set: "key set",
      no_key: "no key",
      msgs: "msgs",
    },
    chat: {
      placeholder: "Ask Agent...",
      welcome_title: "How can I help you today?",
      connect_hint: "Configure connection",
      copy_code: "Copy",
      copied: "Copied",
      exploring_files: "Exploring files",
      running: "running…",
      input_short: "In",
      output_short: "Out",
      msgs_short: "msgs",
      match: "match",
      select_model_title: "Select Model",
      search_placeholder: "Search…",
      loading_models: "Loading models…",
    },
    workspace: {
      title: "PC Workspace",
      no_active_chat: "No Active Chat",
      no_active_chat_desc: "Create a chat to connect a workspace folder.",
      change_folder: "📁 Change PC Folder",
      select_folder: "📁 Select Folder on PC",
      download_zip: "Download ZIP Archive",
      empty_title: "Workspace is empty",
      empty_desc: "Click '📁 Select Folder on PC' to open your system files directly in the Agent workspace.",
    },
    settings: {
      title: "Settings",
      save: "Save",
      saving: "Saving...",
      api_key: "API Key",
      api_key_desc: "Key is stored locally on your PC and used for authentication",
      base_url: "Base URL (OpenAI-Compatible)",
      model: "AI Model",
      model_placeholder: "gpt-4o-mini / mimo-v2.5",
      connection_title: "AI Connection",
      connection_desc: "Configure connection to AI server (OpenAI-compatible API)",
      allow_contacts: "Allow assistant access to contacts",
      tab_general: "Connection",
      tab_customization: "Customization",
      tab_stats: "Usage",
      tab_skills: "Skills",
      tab_privacy: "Security",
      customization_title: "Appearance & Customization",
      customization_desc: "Configure language, theme appearance and wallpapers",
      wallpaper_title: "Application Wallpaper",
      custom_wallpaper: "+ Custom Wallpaper",
      reset_default: "Reset to Classic",
      custom_wallpaper_title: "Custom Wallpaper",
      custom_wallpaper_desc: "User uploaded background image",
      wallpaper_opacity: "Wallpaper Darkness Opacity",
      wallpaper_opacity_hint: "Adjust background visibility for optimal text readability",
      opacity_light: "Light (25%)",
      opacity_balanced: "Balanced (45%)",
      opacity_soft: "Soft (65%)",
      opacity_matte: "Matte (85%)",
      language_title: "Interface Language",
      language_hint: "Loaded from .yml localization files.",
      stats_title: "Usage Statistics",
      input_tokens: "Input Tokens",
      output_tokens: "Output Tokens",
      requests_count: "Requests",
      chart_title: "7-Day Activity Chart",
      reset_stats: "Reset Statistics",
      skills_title: "AI Skills",
      skills_desc: "Autonomous skills created by AI or manually during conversations",
      add_skill: "+ Add Skill",
      cancel: "Cancel",
      default_wallpaper_title: "Classic Dark",
      default_wallpaper_desc: "Standard elegant deep dark Argus background",
      cyber_mesh_title: "Cyber Mesh",
      cyber_mesh_desc: "Neon animated cybernetic grid",
      argus_nebula_title: "Space Nebula",
      argus_nebula_desc: "Deep space with stellar nebula",
      minimal_carbon_title: "Minimal Carbon",
      minimal_carbon_desc: "Strict matte carbon texture with purple tint",
      neon_waves_title: "Neon Waves",
      neon_waves_desc: "Vibrant dynamic glowing neon waves",
      deep_space_title: "Deep Space",
      deep_space_desc: "Dark emerald cosmic dust and galaxies",
      privacy_title: "PC Permissions & Security",
      privacy_desc: "Configure assistant access and local privacy on PC",
      project_files_title: "Project File Access",
      project_files_desc: "Allow assistant to create, edit and read code files in PC workspace",
      web_search_title: "Automatic Web Search",
      web_search_desc: "Allow assistant to find live news and web information during conversations",
      skill_name: "Skill Name",
      skill_name_placeholder: "Example: deploy_app / format_json",
      skill_desc: "Description",
      skill_desc_placeholder: "What this skill does",
      skill_instruction: "Instruction / Pattern",
      skill_instruction_placeholder: "Step-by-step assistant instructions",
      save_skill: "Save Skill",
      no_skills: "No active skills. You can add a skill using the button above or ask AI to remember a skill.",
      base_url_empty: "Base URL not set",
      key_saved: "Key saved",
      reset_stats_title: "⚠️ Reset Statistics",
      reset_stats_msg: "Are you sure you want to permanently reset all saved token usage statistics? This action cannot be undone.",
      reset_stats_confirm: "Yes, reset",
      alert_need_url: "Base URL required",
      alert_need_url_msg: "Please enter an OpenAI-compatible API address.",
      alert_check_url: "Check Base URL",
      alert_check_url_msg: "Address must start with http:// or https://.",
      alert_need_model: "Model required",
      alert_need_model_msg: "Please enter a model name.",
      alert_saved: "Done",
      alert_saved_msg: "Settings saved.",
      alert_error: "Error",
      alert_skill_name: "Name required",
      alert_skill_name_msg: "Please enter a skill name",
      alert_wallpaper_error: "File selection error",
      alert_wallpaper_error_msg: "Could not load the image.",
      skill_pattern_label: "Pattern:",
      model_other: "Other",
      no_models: "No models",
      other_label: "Other",
    },
    attach: {
      camera: "Camera",
      photo: "Photo",
      files: "Files",
      file_manager: "File Manager",
      internet_on: "Internet: on",
      internet_off: "Internet: off",
    },
    search: {
      enter_query: "Enter query",
      enter_query_hint: "Start typing to search through chat history.",
      not_found: "Nothing found",
      not_found_hint: "Try changing the search query.",
      results_header: "SEARCH RESULTS",
      match: "match",
      msgs_count: "msgs",
    },
  },
};

export const availableLanguages: LanguageOption[] = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

/**
 * Register a custom YML localization string
 */
export function registerYmlLanguage(yamlStr: string) {
  try {
    const dict = (jsYaml.load(yamlStr) as Record<string, any>) || {};
    const code = dict.meta?.code;
    const label = dict.meta?.name;
    if (code && label) {
      dictionaries[code] = dict;
      if (!availableLanguages.some((l) => l.code === code)) {
        availableLanguages.push({ code, label });
      }
    }
  } catch (e) {
    console.error('Failed to register YML language:', e);
  }
}

let activeLanguage = 'ru';

export function getLanguage(): string {
  return activeLanguage;
}

export function setLanguage(lang: string) {
  if (dictionaries[lang]) {
    activeLanguage = lang;
  }
}

export function t(keyPath: string, fallback?: string): string {
  const parts = keyPath.split('.');
  let current: any = dictionaries[activeLanguage] || dictionaries['ru'] || {};
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      current = undefined;
      break;
    }
  }
  if (typeof current === 'string') return current;

  // Fallback to Russian dictionary if key is missing in active language
  if (activeLanguage !== 'ru') {
    let ruCurrent: any = dictionaries['ru'] || {};
    for (const part of parts) {
      if (ruCurrent && typeof ruCurrent === 'object' && part in ruCurrent) {
        ruCurrent = ruCurrent[part];
      } else {
        ruCurrent = undefined;
        break;
      }
    }
    if (typeof ruCurrent === 'string') return ruCurrent;
  }

  return fallback || keyPath;
}
