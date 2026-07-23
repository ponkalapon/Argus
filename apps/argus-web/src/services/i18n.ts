import jsYaml from 'js-yaml';

const RU_YAML_STR = `
navigation:
  new_chat: "Новый чат"
  search: "Поиск"
  library: "Библиотека"
  sandbox: "Песочница"
  recent: "НЕДАВНИЕ"
  no_chats_title: "Пока нет диалогов"
  no_chats_text: "Первый чат создастся автоматически после отправки сообщения."
  connected: "Подключено"

chat:
  placeholder: "Спросить Agent..."
  welcome_title: "Чем могу помочь?"
  connect_hint: "Настроить подключение"
  copy_code: "Копировать"
  copied: "Скопировано"

settings:
  title: "Настройки"
  save: "Сохранить"
  saving: "Сохранение..."
  api_key: "API Ключ"
  base_url: "Base URL (OpenAI-Compatible)"
  model: "Модель"
  allow_contacts: "Разрешить ассистенту доступ к контактам"
  tab_general: "Подключение"
  tab_customization: "Кастомизация"
  tab_stats: "Статистика"
  tab_skills: "Навыки"
  wallpaper_title: "Фоновые обои приложения"
  custom_wallpaper: "+ Свои обои"
  reset_default: "Вернуть классический"
  custom_wallpaper_title: "Свои обои"
  custom_wallpaper_desc: "Загруженное пользователем изображение"
  wallpaper_opacity: "Затемнение обоев"
  screen_width: "Ширина области сообщений"
  width_fluid: "Широкий экран (Full Width)"
  width_fluid_desc: "Заполняет всё окно без больших черных полос по бокам"
  width_compact: "Компактная колонка"
  width_compact_desc: "Классический центрированный столбец 880px"
  default_wallpaper_title: "Классический темный"
  default_wallpaper_desc: "Стандартный элегантный глубокий темный фон Argus"
`;

// Parse YML string via js-yaml
let ruDictionary: Record<string, any> = {};

try {
  ruDictionary = (jsYaml.load(RU_YAML_STR) as Record<string, any>) || {};
} catch (e) {
  console.error('Failed to parse ru.yml:', e);
}

/**
 * Get translation by key path e.g. t('navigation.new_chat')
 */
export function t(keyPath: string, fallback?: string): string {
  const parts = keyPath.split('.');
  let current: any = ruDictionary;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return fallback || keyPath;
    }
  }
  return typeof current === 'string' ? current : (fallback || keyPath);
}
