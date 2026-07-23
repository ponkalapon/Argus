import AsyncStorage from '@react-native-async-storage/async-storage';

export type WallpaperType =
  | 'default'
  | 'cyber_mesh'
  | 'argus_nebula'
  | 'minimal_carbon'
  | 'neon_waves'
  | 'deep_space'
  | 'custom';

export type LayoutWidthType = 'fluid' | 'compact';
export type LanguageType = 'ru' | 'en';
export type AccentColorType = 'purple' | 'cyan' | 'emerald' | 'amber' | 'blue' | 'rose';
export type BubbleStyleType = 'glass' | 'rounded' | 'cyber';
export type FontSizeScaleType = 'compact' | 'standard' | 'large';

export type ThemeConfig = {
  wallpaper: WallpaperType;
  customWallpaperUri?: string | null;
  layoutWidth: LayoutWidthType;
  language: LanguageType;
  accentColor: AccentColorType;
  wallpaperOpacity: number;
  bubbleStyle: BubbleStyleType;
  fontSize: FontSizeScaleType;
};

const THEME_STORAGE_KEY = '@argus_theme_config_v1';

export const defaultThemeConfig: ThemeConfig = {
  wallpaper: 'default',
  customWallpaperUri: null,
  layoutWidth: 'fluid',
  language: 'ru',
  accentColor: 'purple',
  wallpaperOpacity: 0.45,
  bubbleStyle: 'glass',
  fontSize: 'standard',
};

export const loadThemeConfig = async (): Promise<ThemeConfig> => {
  try {
    const raw = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return defaultThemeConfig;
    const parsed = JSON.parse(raw);
    return {
      wallpaper: parsed.wallpaper || 'default',
      customWallpaperUri: parsed.customWallpaperUri || null,
      layoutWidth: parsed.layoutWidth || 'fluid',
      language: parsed.language || 'ru',
      accentColor: parsed.accentColor || 'purple',
      wallpaperOpacity: typeof parsed.wallpaperOpacity === 'number' ? parsed.wallpaperOpacity : 0.45,
      bubbleStyle: parsed.bubbleStyle || 'glass',
      fontSize: parsed.fontSize || 'standard',
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

