import yaml from 'js-yaml';

type Translations = Record<string, any>;

let currentLanguage = 'ru';
let translations: Translations = {};

export async function loadTranslations(lang: string): Promise<void> {
  currentLanguage = lang;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}locales/${lang}.yml`);
    if (!response.ok) {
      console.warn(`Failed to load translations for ${lang}`);
      return;
    }
    const text = await response.text();
    translations = yaml.load(text) as Translations;
  } catch (e) {
    console.error('Error loading translations:', e);
  }
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
    console.warn(`Translation key "${key}" not found`);
    return key;
  }
  if (typeof value !== 'string') {
    console.warn(`Translation key "${key}" is not a string`);
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
