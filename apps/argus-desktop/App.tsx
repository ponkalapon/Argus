import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, LayoutAnimation, Platform, StyleSheet, Text, UIManager, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { SettingsScreen } from './src/components/SettingsScreen';
import { SandboxScreen } from './src/components/SandboxScreen';
import { WorkspaceScreen } from './src/components/WorkspaceScreen';
import { FileManagerScreen } from './src/components/FileManagerScreen';
import { AnimatedSplashScreen } from './src/components/AnimatedSplashScreen';

import { loadApiKey, loadSettings, saveSettings } from './src/api';
import { loadThemeConfig, ThemeConfig, WallpaperType } from './src/services/themeStorage';
import { setLanguage as setI18nLanguage } from './src/services/i18n';
import { AgentSettings } from './src/types';
import { applyAccentColor, colors, spacing, typography } from './src/styles/theme';

try { SplashScreen.preventAutoHideAsync(); } catch {}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleTagId = 'disable-orange-focus-outline';
  if (!document.getElementById(styleTagId)) {
    const style = document.createElement('style');
    style.id = styleTagId;
    style.innerHTML = `
      *:focus, *:focus-visible, *:focus-within, input:focus, textarea:focus, [tabindex]:focus, textarea:focus-visible {
        outline: none !important;
        box-shadow: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }
    `;
    document.head.appendChild(style);
  }
}

const WALLPAPER_MAP: Record<WallpaperType, any> = {
  default: null,
  cyber_mesh: require('./assets/wallpapers/cyber_mesh.jpg'),
  argus_nebula: require('./assets/wallpapers/argus_nebula.jpg'),
  minimal_carbon: require('./assets/wallpapers/minimal_carbon.jpg'),
  neon_waves: require('./assets/wallpapers/neon_waves.jpg'),
  deep_space: require('./assets/wallpapers/deep_space.jpg'),
};

const FONT_FAMILY_MAP: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  monospace: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  'sans-serif': 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const FONT_STYLE_ID = 'argus-font-family';

function applyFontFamily(fontKey: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const cssFont = FONT_FAMILY_MAP[fontKey] || FONT_FAMILY_MAP.system;
  let el = document.getElementById(FONT_STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = FONT_STYLE_ID;
    document.head.appendChild(el);
  }
  el.innerHTML = `* { font-family: ${cssFont} !important; }`;
}

export default function App() {
  const [screen, setScreen] = useState<'workspace' | 'settings' | 'sandbox' | 'files'>('workspace');
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>({
    wallpaper: 'default',
    layoutWidth: 'fluid',
    language: 'ru',
    fontFamily: 'system',
    accentColor: 'purple',
    wallpaperOpacity: 0.45,
    bubbleStyle: 'glass',
    fontSize: 'standard',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pendingAttach, setPendingAttach] = useState<{ name: string; content: string } | null>(null);

  const refreshTheme = useCallback(async () => {
    const cfg = await loadThemeConfig();
    applyAccentColor(cfg.accentColor);
    setI18nLanguage(cfg.language);
    applyFontFamily(cfg.fontFamily);
    setThemeConfig(cfg);
  }, []);

  // Apply font on every themeConfig change
  useEffect(() => {
    applyFontFamily(themeConfig.fontFamily);
  }, [themeConfig.fontFamily]);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadSettings(), loadApiKey(), loadThemeConfig()])
      .then(([storedSettings, storedApiKey, storedTheme]) => {
        if (mounted) {
          applyAccentColor(storedTheme.accentColor);
          setI18nLanguage(storedTheme.language);
          applyFontFamily(storedTheme.fontFamily);
          setSettings(storedSettings);
          setApiKey(storedApiKey);
          setThemeConfig(storedTheme);
        }
      })
      .catch((error) => {
        if (mounted) {
          setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить настройки');
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
        SplashScreen.hideAsync().catch(() => {});
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveSettings = useCallback(async (nextSettings: AgentSettings, nextApiKey: string) => {
    await saveSettings(nextSettings);
    setSettings(nextSettings);
    setApiKey(nextApiKey);
    await refreshTheme();
  }, [refreshTheme]);

  if (isLoading || !settings) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" hidden />
        <AnimatedSplashScreen />
      </SafeAreaProvider>
    );
  }

  const wallpaperSource =
    themeConfig.wallpaper === 'custom' && themeConfig.customWallpaperUri
      ? { uri: themeConfig.customWallpaperUri }
      : WALLPAPER_MAP[themeConfig.wallpaper];
  const overlayOpacity = themeConfig.wallpaperOpacity ?? 0.45;

  const renderContent = () => (
    <>
      <StatusBar style="light" />
      {screen === 'settings' ? (
        <SettingsScreen
          initialSettings={settings}
          onBack={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('workspace'); }}
          onSave={handleSaveSettings}
          onThemeChange={refreshTheme}
        />
      ) : screen === 'sandbox' ? (
        <SandboxScreen
          onBack={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('workspace'); }}
        />
      ) : screen === 'files' ? (
        <FileManagerScreen
          onBack={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('workspace'); }}
          onAttach={(name, content) => { setPendingAttach({ name, content }); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('workspace'); }}
        />
      ) : (
        <WorkspaceScreen
          apiKey={apiKey}
          onOpenSettings={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('settings'); }}
          onOpenSandbox={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('sandbox'); }}
          onOpenFiles={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('files'); }}
          settings={settings!}
          onSaveSettings={handleSaveSettings}
          pendingAttach={pendingAttach}
          onClearPendingAttach={() => setPendingAttach(null)}
          layoutWidth={themeConfig.layoutWidth}
        />
      )}
    </>
  );

  return (
    <SafeAreaProvider style={{ flex: 1, width: '100%', height: '100%' }}>
      <GestureHandlerRootView style={{ flex: 1, width: '100%', height: '100%' }}>
        {wallpaperSource ? (
          <ImageBackground
            source={wallpaperSource}
            style={{ flex: 1, width: '100%', height: '100%' }}
            resizeMode="cover"
          >
            <View style={{ flex: 1, width: '100%', height: '100%', backgroundColor: `rgba(9, 9, 11, ${overlayOpacity})` }}>
              {renderContent()}
            </View>
          </ImageBackground>
        ) : (
          <LinearGradient colors={["#09090b", "#121215"]} style={{ flex: 1, width: '100%', height: '100%' }}>
            {renderContent()}
          </LinearGradient>
        )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '900',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  loadingError: {
    color: colors.danger,
    fontSize: typography.body,
    lineHeight: 22,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
