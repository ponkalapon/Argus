import jsYaml from 'js-yaml';

export interface LanguageOption {
  code: string;
  label: string;
}

export const dictionaries: Record<string, Record<string, any>> = {};
export const availableLanguages: LanguageOption[] = [];

// Automatically scan and load ALL .yml files inside ../locales folder
try {
  // @ts-ignore
  const localesContext = require.context('../locales', false, /\.yml$/);
  localesContext.keys().forEach((key: string) => {
    const rawData = localesContext(key);
    const dict: Record<string, any> = typeof rawData === 'string'
      ? ((jsYaml.load(rawData) as Record<string, any>) || {})
      : (rawData?.default || rawData || {});

    const code = dict.meta?.code;
    const label = dict.meta?.name;
    if (code && label) {
      dictionaries[code] = dict;
      if (!availableLanguages.some((l) => l.code === code)) {
        availableLanguages.push({ code, label });
      }
    }
  });
} catch (e) {
  console.warn('Auto yml scanner failed, falling back to manual load:', e);
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
