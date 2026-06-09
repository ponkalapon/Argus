import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Platform, StyleSheet, Text, UIManager, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { SettingsScreen } from './src/components/SettingsScreen';
import { SandboxScreen } from './src/components/SandboxScreen';
import { WorkspaceScreen } from './src/components/WorkspaceScreen';
import { FileManagerScreen } from './src/components/FileManagerScreen';

import { loadApiKey, loadSettings, saveSettings } from './src/services/storage';
import { checkAndPromptUpdate } from './src/services/autoUpdate';
import { AgentSettings } from './src/types';
import { colors, spacing, typography } from './src/styles/theme';


try { SplashScreen.preventAutoHideAsync(); } catch {}


if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function App() {
  const [screen, setScreen] = useState<'workspace' | 'settings' | 'sandbox' | 'files'>('workspace');
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pendingAttach, setPendingAttach] = useState<{ name: string; content: string } | null>(null);

  useEffect(() => {
    let mounted = true;

    Promise.all([loadSettings(), loadApiKey()])
      .then(([storedSettings, storedApiKey]) => {
        if (mounted) {
          setSettings(storedSettings);
          setApiKey(storedApiKey);
          // Check for app updates on startup
          checkAndPromptUpdate().catch(() => {});
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
  }, []);

  if (isLoading || !settings) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingTitle}>Загрузка…</Text>
          {loadError ? <Text style={styles.loadingError}>{loadError}</Text> : null}
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <LinearGradient
          colors={["#0d0d0d", "#1c1c1e"]}
          style={{ flex: 1 }}
        >
        <StatusBar style="light" />
        {screen === 'settings' ? (
          <SettingsScreen
            initialSettings={settings}
            onBack={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('workspace'); }}
            onSave={handleSaveSettings}
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
          <WorkspaceScreen apiKey={apiKey} onOpenSettings={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('settings'); }} onOpenSandbox={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('sandbox'); }} onOpenFiles={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setScreen('files'); }} settings={settings!} onSaveSettings={handleSaveSettings} pendingAttach={pendingAttach} onClearPendingAttach={() => setPendingAttach(null)} />
        )}
      </LinearGradient>
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
