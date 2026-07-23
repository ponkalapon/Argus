type Translations = Record<string, any>;

let currentLanguage = 'ru';
let translations: Translations = {};

const localeData: Record<string, Translations> = {
  ru: require('../assets/locales/ru.json'),
  en: require('../assets/locales/en.json'),
  uk: require('../assets/locales/uk.json'),
  zh: require('../assets/locales/zh.json'),
  hi: require('../assets/locales/hi.json'),
  es: require('../assets/locales/es.json'),
  pt: require('../assets/locales/pt.json'),
  ar: require('../assets/locales/ar.json'),
  de: require('../assets/locales/de.json'),
  fr: require('../assets/locales/fr.json'),
  tr: require('../assets/locales/tr.json'),
  ko: require('../assets/locales/ko.json'),
  ja: require('../assets/locales/ja.json'),
  pl: require('../assets/locales/pl.json'),
  vi: require('../assets/locales/vi.json'),
  th: require('../assets/locales/th.json'),
  id: require('../assets/locales/id.json'),
  fa: require('../assets/locales/fa.json'),
};

export async function loadTranslations(lang: string): Promise<void> {
  currentLanguage = lang;
  translations = localeData[lang] || localeData['ru'] || {};
}

export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: any = translations;
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      value = undefined;
      break;
    }
  }
  if (value === undefined) {
    return key;
  }
  if (typeof value !== 'string') {
    return key;
  }
  if (params) {
    return Object.entries(params).reduce(
      (str, [param, val]) => str.replace(new RegExp(`{{${param}}}`, 'g'), String(val)),
      value,
    );
  }
  return value;
}

export function getCurrentLanguage(): string {
  return currentLanguage;
}
