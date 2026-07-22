import AsyncStorage from '@react-native-async-storage/async-storage';

export type WallpaperType = 'default' | 'cyber_mesh' | 'argus_nebula' | 'minimal_carbon';
export type LayoutWidthType = 'fluid' | 'compact';
export type LanguageType = 'ru' | 'en';

export type ThemeConfig = {
  wallpaper: WallpaperType;
  layoutWidth: LayoutWidthType;
  language: LanguageType;
};

const THEME_STORAGE_KEY = '@argus_theme_config_v1';

export const defaultThemeConfig: ThemeConfig = {
  wallpaper: 'default',
  layoutWidth: 'fluid',
  language: 'ru',
};

export const loadThemeConfig = async (): Promise<ThemeConfig> => {
  try {
    const raw = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return defaultThemeConfig;
    const parsed = JSON.parse(raw);
    return {
      wallpaper: parsed.wallpaper || 'default',
      layoutWidth: parsed.layoutWidth || 'fluid',
      language: parsed.language || 'ru',
    };
  } catch {
    return defaultThemeConfig;
  }
};

export const saveThemeConfig = async (config: ThemeConfig): Promise<void> => {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(config));
  } catch {}
};
