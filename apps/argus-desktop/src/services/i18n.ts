// Import built-in localization files
import ruYaml from '../locales/ru.yml';
import enYaml from '../locales/en.yml';

export interface LanguageOption {
  code: string;
  label: string;
}

export const dictionaries: Record<string, Record<string, any>> = {};
export const availableLanguages: LanguageOption[] = [];

/**
 * Register a custom YML localization string or object
 */
export function registerYmlLanguage(yamlData: string | Record<string, any>) {
  try {
    const dict: Record<string, any> = typeof yamlData === 'string'
      ? ((jsYaml.load(yamlData) as Record<string, any>) || {})
      : (yamlData || {});

    const code = dict.meta?.code;
    const label = dict.meta?.name;
    if (code && label) {
      dictionaries[code] = dict;
      const existingIdx = availableLanguages.findIndex((l) => l.code === code);
      if (existingIdx !== -1) {
        availableLanguages[existingIdx] = { code, label };
      } else {
        availableLanguages.push({ code, label });
      }
    }
  } catch (e) {
    console.error('Failed to register YML language:', e);
  }
}

// Auto-register built-in YAML localization files
registerYmlLanguage(ruYaml);
registerYmlLanguage(enYaml);


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
