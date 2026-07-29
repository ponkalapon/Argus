import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Code2,
  Cpu,
  Database,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  Gift,
  Globe,
  Image as ImageIcon,
  Key,
  Maximize2,
  Minimize2,
  Network,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { AgentSettings } from '../types';
import { loadApiKey, saveApiKey, sanitizeSettings } from '../services/storage';
import { getTokenStats, getDailyStats, resetTokenStats, DailyRecord, TokenStats } from '../services/tokenStats';
import { listSkills, deleteSkill, Skill, PRESET_SKILLS, installPresetSkill } from '../services/skills';
import { McpServer, loadMcpServers, addMcpServer, updateMcpServer, deleteMcpServer } from '../services/mcpStorage';
import { testMcpServer } from '../services/mcpClient';
import { loadThemeConfig, saveThemeConfig, WallpaperType, LayoutWidthType, LanguageType, FontFamilyType, AccentColorType, BubbleStyleType, FontSizeScaleType } from '../services/themeStorage';
import { availableLanguages, setLanguage as setI18nLanguage, t } from '../services/i18n';
import { UsageChart } from './UsageChart';
import { colors, motion, radius, spacing, typography, ACCENT_PALETTES, applyAccentColor } from '../styles/theme';

import { GitStatusResult, checkGitUpdates, runGitUpdateAndBuild, reloadApp, loadAutoCheckUpdates, saveAutoCheckUpdates } from '../services/updater';

type Props = {
  initialSettings: AgentSettings;
  onBack: () => void;
  onSave: (settings: AgentSettings, apiKey: string) => Promise<void>;
  onThemeChange?: () => void;
};

type TabType = 'connection' | 'customization' | 'mcp' | 'stats' | 'skills' | 'updates' | 'privacy';

const MODEL_PRESETS = [
  'mimo-v2.5',
  'gpt-4o-mini',
  'gpt-4.1-mini',
  'qwen/qwen3-coder',
];

const WALLPAPER_PRESETS_RAW: { id: WallpaperType; titleKey: string; descKey: string; title: string; desc: string; source: any }[] = [
  {
    id: 'default',
    titleKey: 'settings.default_wallpaper_title',
    descKey: 'settings.default_wallpaper_desc',
    title: 'Классический темный',
    desc: 'Стандартный элегантный глубокий темный фон Argus',
    source: null,
  },
  {
    id: 'cyber_mesh',
    titleKey: 'settings.cyber_mesh_title',
    descKey: 'settings.cyber_mesh_desc',
    title: 'Кибер-сетка',
    desc: 'Неоновая анимированная кибернетическая сетка',
    source: require('../../assets/wallpapers/cyber_mesh.jpg'),
  },
  {
    id: 'argus_nebula',
    titleKey: 'settings.argus_nebula_title',
    descKey: 'settings.argus_nebula_desc',
    title: 'Космическая туманность',
    desc: 'Глубокий космос со звездной туманностью',
    source: require('../../assets/wallpapers/argus_nebula.jpg'),
  },
  {
    id: 'minimal_carbon',
    titleKey: 'settings.minimal_carbon_title',
    descKey: 'settings.minimal_carbon_desc',
    title: 'Минимал Карбон',
    desc: 'Строгая матовая текстура карбона с фиолетовым отливом',
    source: require('../../assets/wallpapers/minimal_carbon.jpg'),
  },
  {
    id: 'neon_waves',
    titleKey: 'settings.neon_waves_title',
    descKey: 'settings.neon_waves_desc',
    title: 'Неоновые Волны',
    desc: 'Яркие динамические волны светящегося неона',
    source: require('../../assets/wallpapers/neon_waves.jpg'),
  },
  {
    id: 'deep_space',
    titleKey: 'settings.deep_space_title',
    descKey: 'settings.deep_space_desc',
    title: 'Глубокий Космос',
    desc: 'Тёмно-изумрудная космическая пыль и галактики',
    source: require('../../assets/wallpapers/deep_space.jpg'),
  },
];

const PRESET_ICON_MAP: Record<string, { icon: any; color: string; bg: string }> = {
  code: { icon: Code2, color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' },
  flask: { icon: FlaskConical, color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)' },
  database: { icon: Database, color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' },
  file: { icon: FileText, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
  palette: { icon: Palette, color: '#f472b6', bg: 'rgba(244, 114, 182, 0.15)' },
  globe: { icon: Globe, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
};

export const SettingsScreen = ({ initialSettings, onBack, onSave, onThemeChange }: Props) => {
  const [activeTab, setActiveTab] = useState<TabType>('connection');
  const [baseUrl, setBaseUrl] = useState(initialSettings.baseUrl);
  const [model, setModel] = useState(initialSettings.model);
  const [allowAssistantContacts, setAllowAssistantContacts] = useState(initialSettings.allowAssistantContacts);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyRecord[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillPattern, setNewSkillPattern] = useState('');
  const [expandedSkillName, setExpandedSkillName] = useState<string | null>(null);

  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [showAddMcp, setShowAddMcp] = useState(false);
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpUrl, setNewMcpUrl] = useState('');
  const [testingMcpId, setTestingMcpId] = useState<string | null>(null);

  const [wallpaper, setWallpaper] = useState<WallpaperType>('default');
  const [customWallpaperUri, setCustomWallpaperUri] = useState<string | null>(null);
  const [layoutWidth, setLayoutWidth] = useState<LayoutWidthType>('fluid');
  const [language, setLanguage] = useState<LanguageType>('ru');
  const [fontFamily, setFontFamily] = useState<string>('system');
  const [showLangFontMenu, setShowLangFontMenu] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const [showFontPanel, setShowFontPanel] = useState(false);
  const [accentColor, setAccentColor] = useState<AccentColorType>('purple');
  const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(0.45);
  const [bubbleStyle, setBubbleStyle] = useState<BubbleStyleType>('glass');
  const [fontSize, setFontSize] = useState<FontSizeScaleType>('standard');

  const [gitStatus, setGitStatus] = useState<GitStatusResult | null>(null);
  const [isCheckingGit, setIsCheckingGit] = useState(false);
  const [isUpdatingGit, setIsUpdatingGit] = useState(false);
  const [updateLog, setUpdateLog] = useState('');
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(true);

  const entrance = useRef(new Animated.Value(0)).current;

  const refreshSkills = useCallback(async () => {
    const s = await listSkills();
    setSkills(s);
  }, []);

  const loadStats = useCallback(async () => {
    const stats = await getTokenStats();
    setTokenStats(stats);
    const daily = await getDailyStats();
    setDailyStats(daily);
  }, []);

  const refreshMcpServers = useCallback(async () => {
    const s = await loadMcpServers();
    setMcpServers(s);
  }, []);

  useEffect(() => {
    if (activeTab === 'skills') {
      refreshSkills();
    } else if (activeTab === 'mcp') {
      refreshMcpServers();
    }
  }, [activeTab, refreshSkills, refreshMcpServers]);

  useEffect(() => {
    let mounted = true;
    Animated.timing(entrance, {
      duration: motion.base,
      toValue: 1,
      useNativeDriver: true,
    }).start();

    loadApiKey().then((key) => {
      if (mounted) setApiKey(key);
    });

    loadThemeConfig().then((cfg) => {
      if (mounted) {
        setWallpaper(cfg.wallpaper);
        setCustomWallpaperUri(cfg.customWallpaperUri || null);
        setLayoutWidth(cfg.layoutWidth);
        setLanguage(cfg.language);
        setFontFamily(cfg.fontFamily || 'system');
        setAccentColor(cfg.accentColor);
        setWallpaperOpacity(cfg.wallpaperOpacity);
        setBubbleStyle(cfg.bubbleStyle);
        setFontSize(cfg.fontSize);
        applyAccentColor(cfg.accentColor);
      }
    });

    loadStats();
    listSkills().then((s) => { if (mounted) setSkills(s); });
    loadAutoCheckUpdates().then((val) => { if (mounted) setAutoCheckUpdates(val); });
    checkGitUpdates().then((res) => { if (mounted) setGitStatus(res); });

    return () => { mounted = false; };
  }, [entrance, loadStats]);

  const endpointPreview = useMemo(() => {
    let normalized = baseUrl.trim().replace(/\/+$/, '');
    if (normalized.toLowerCase().endsWith('/v1')) {
      normalized = normalized.slice(0, -3).replace(/\/+$/, '');
    }
    return normalized ? `${normalized}/v1/chat/completions` : t('settings.base_url_empty', 'Base URL не задан');
  }, [baseUrl]);

  const handleBack = async () => {
    const settings = sanitizeSettings({ baseUrl, model, allowAssistantContacts });
    try {
      await saveApiKey(apiKey);
      await saveThemeConfig({ wallpaper, customWallpaperUri, layoutWidth, language, fontFamily, accentColor, wallpaperOpacity, bubbleStyle, fontSize });
      applyAccentColor(accentColor);
      if (onThemeChange) onThemeChange();
      await onSave(settings, apiKey.trim());
    } catch {
      /* silent on back */
    }
    onBack();
  };

  const updateTheme = async (updates: Partial<{
    wallpaper: WallpaperType;
    customWallpaperUri?: string | null;
    layoutWidth: LayoutWidthType;
    language: LanguageType;
    fontFamily: FontFamilyType;
    accentColor: AccentColorType;
    wallpaperOpacity: number;
    bubbleStyle: BubbleStyleType;
    fontSize: FontSizeScaleType;
  }>) => {
    const nextWallpaper = updates.wallpaper ?? wallpaper;
    const nextCustomUri = updates.customWallpaperUri !== undefined ? updates.customWallpaperUri : customWallpaperUri;
    const nextLayoutWidth = updates.layoutWidth ?? layoutWidth;
    const nextLanguage = updates.language ?? language;
    const nextFontFamily = updates.fontFamily ?? fontFamily;
    const nextAccent = updates.accentColor ?? accentColor;
    const nextOpacity = updates.wallpaperOpacity ?? wallpaperOpacity;
    const nextBubble = updates.bubbleStyle ?? bubbleStyle;
    const nextFontSize = updates.fontSize ?? fontSize;
    setI18nLanguage(nextLanguage);
    if (updates.wallpaper !== undefined) setWallpaper(updates.wallpaper);
    if (updates.customWallpaperUri !== undefined) setCustomWallpaperUri(updates.customWallpaperUri);
    if (updates.layoutWidth !== undefined) setLayoutWidth(updates.layoutWidth);
    if (updates.language !== undefined) setLanguage(updates.language);
    if (updates.fontFamily !== undefined) setFontFamily(updates.fontFamily);
    if (updates.accentColor !== undefined) setAccentColor(updates.accentColor);
    if (updates.wallpaperOpacity !== undefined) setWallpaperOpacity(updates.wallpaperOpacity);
    if (updates.bubbleStyle !== undefined) setBubbleStyle(updates.bubbleStyle);
    if (updates.fontSize !== undefined) setFontSize(updates.fontSize);
    applyAccentColor(nextAccent);
    await saveThemeConfig({
      wallpaper: nextWallpaper,
      customWallpaperUri: nextCustomUri,
      layoutWidth: nextLayoutWidth,
      language: nextLanguage,
      fontFamily: nextFontFamily,
      accentColor: nextAccent,
      wallpaperOpacity: nextOpacity,
      bubbleStyle: nextBubble,
      fontSize: nextFontSize,
    });
    if (onThemeChange) onThemeChange();
  };

  const handlePickCustomWallpaper = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        let dataUri = asset.uri;

        try {
          if (asset.file) {
            dataUri = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(asset.file!);
            });
          } else if (asset.uri) {
            const resp = await fetch(asset.uri);
            const blob = await resp.blob();
            dataUri = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }
        } catch {
          // fallback to asset.uri if conversion fails
        }

        setCustomWallpaperUri(dataUri);
        await updateTheme({ wallpaper: 'custom', customWallpaperUri: dataUri });
      }
    } catch (error) {
      Alert.alert('Ошибка выбора файла', 'Не удалось загрузить изображение.');
    }
  };

  const handleSelectWallpaper = (wp: WallpaperType) => updateTheme({ wallpaper: wp });
  const handleSelectLayoutWidth = (lw: LayoutWidthType) => updateTheme({ layoutWidth: lw });
  const handleSelectLanguage = (lang: LanguageType) => updateTheme({ language: lang });
  const handleSelectAccentColor = (acc: AccentColorType) => updateTheme({ accentColor: acc });
  const handleSelectWallpaperOpacity = (op: number) => updateTheme({ wallpaperOpacity: op });
  const handleSelectBubbleStyle = (bs: BubbleStyleType) => updateTheme({ bubbleStyle: bs });
  const handleSelectFontSize = (fs: FontSizeScaleType) => updateTheme({ fontSize: fs });

  const handleResetStats = () => {
    const title = t('settings.reset_stats_title', '⚠️ Сброс статистики');
    const message = t('settings.reset_stats_msg', 'Вы действительно хотите полностью обнулить всю сохраненную статистику использования токенов? Это действие нельзя отменить.');

    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`${title}\n\n${message}`)) {
        resetTokenStats().then(() => {
          setTokenStats({ totalInput: 0, totalOutput: 0, totalRequests: 0 });
          setDailyStats([]);
        });
      }
      return;
    }

    Alert.alert(title, message, [
      { text: t('settings.cancel', 'Отмена'), style: 'cancel' },
      {
        text: t('settings.reset_stats_confirm', 'Да, обнулить'),
        style: 'destructive',
        onPress: async () => {
          await resetTokenStats();
          setTokenStats({ totalInput: 0, totalOutput: 0, totalRequests: 0 });
          setDailyStats([]);
        },
      },
    ]);
  };

  const handleCheckUpdates = async () => {
    setIsCheckingGit(true);
    setUpdateLog('');
    try {
      const res = await checkGitUpdates();
      setGitStatus(res);
    } finally {
      setIsCheckingGit(false);
    }
  };

  const handleRunUpdate = async () => {
    setIsUpdatingGit(true);
    setUpdateLog('Подключение к Git репозиторию и сборка...');
    try {
      const res = await runGitUpdateAndBuild();
      setUpdateLog(res.log);
      if (res.success) {
        const nextStatus = await checkGitUpdates();
        setGitStatus(nextStatus);
      }
    } finally {
      setIsUpdatingGit(false);
    }
  };

  const handleToggleAutoCheck = async (enabled: boolean) => {
    setAutoCheckUpdates(enabled);
    await saveAutoCheckUpdates(enabled);
  };

  const formatLargeNumber = (n: number) => {
    if (isNaN(n) || !isFinite(n)) return '0';
    return n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : String(n);
  };

  const navItems: { id: TabType; label: string; icon: any }[] = [
    { id: 'connection', label: t('settings.tab_general', 'Подключение'), icon: Cpu },
    { id: 'customization', label: t('settings.tab_customization', 'Кастомизация'), icon: Palette },
    { id: 'mcp', label: 'MCP Серверы', icon: Network },
    { id: 'stats', label: t('settings.tab_stats', 'Использование'), icon: BarChart3 },
    { id: 'skills', label: t('settings.tab_skills', 'Навыки'), icon: Sparkles },
    { id: 'updates', label: 'Обновления', icon: RefreshCw },
    { id: 'privacy', label: t('settings.tab_privacy', 'Безопасность'), icon: Shield },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.container, { opacity: entrance }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={handleBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <ArrowLeft size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('settings.title', 'Настройки')}</Text>
          <View style={{ width: 34 }} />
        </View>

        {/* Main Settings Modal Layout */}
        <View style={styles.layoutBody}>
          {/* Sidebar Tabs */}
          <View style={styles.sidebar}>
            {navItems.map((item) => {
              const active = activeTab === item.id;
              const Icon = item.icon;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setActiveTab(item.id)}
                  style={({ pressed }) => [
                    styles.tabItem,
                    active && styles.tabItemActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon size={18} color={active ? colors.accent : colors.textMuted} />
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Content Area */}
          <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
            {activeTab === 'connection' && (
              <View style={styles.sectionCard}>
                <View style={styles.cardHeader}>
                  <Globe size={18} color={colors.accent} />
                  <Text style={styles.cardTitle}>{t('settings.connection_title', 'Подключение ИИ')}</Text>
                </View>
                <Text style={styles.cardDesc}>{t('settings.connection_desc', 'Настройка подключения к ИИ серверу (OpenAI-compatible API)')}</Text>

                {/* Base URL */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('settings.base_url', 'Base URL')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={baseUrl}
                    onChangeText={setBaseUrl}
                    placeholder="https://api.openai.com"
                    placeholderTextColor={colors.textDim}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.fieldHint}>{endpointPreview}</Text>
                </View>

                {/* Model */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('settings.model', 'Модель ИИ')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={model}
                    onChangeText={setModel}
                    placeholder={t('settings.model_placeholder', 'gpt-4o-mini / mimo-v2.5')}
                    placeholderTextColor={colors.textDim}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {/* Preset Model Chips */}
                  <View style={styles.chipRow}>
                    {MODEL_PRESETS.map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => setModel(m)}
                        style={({ pressed }) => [
                          styles.chip,
                          model === m && styles.chipActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.chipText, model === m && styles.chipTextActive]}>{m}</Text>
                        {model === m && <Check size={12} color={colors.accent} style={{ marginLeft: 4 }} />}
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* API Key */}
                <View style={styles.fieldGroup}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                    <Text style={styles.fieldLabel}>API Key</Text>
                    {apiKey ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#064e3b', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill }}>
                        <Check size={12} color="#34d399" />
                        <Text style={{ color: '#34d399', fontSize: 11, fontWeight: '600' }}>{t('settings.key_saved', 'Ключ сохранён')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ position: 'relative', justifyContent: 'center' }}>
                    <TextInput
                      style={[styles.textInput, { paddingRight: 40 }]}
                      value={apiKey}
                      onChangeText={setApiKey}
                      placeholder={t('settings.api_key', 'API Key') + ' (' + t('settings.model_placeholder', 'sk-...') + ')'}
                      placeholderTextColor={colors.textDim}
                      secureTextEntry={!showApiKey}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Pressable
                      onPress={() => setShowApiKey(!showApiKey)}
                      style={{ position: 'absolute', right: 12, padding: 4 }}
                    >
                      {showApiKey ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
                    </Pressable>
                  </View>
                  <Text style={styles.fieldHint}>{t('settings.api_key_desc', 'Ключ сохраняется локально на вашем ПК и используется для авторизации')}</Text>
                </View>
              </View>
            )}

            {activeTab === 'customization' && (
              <View style={styles.sectionCard}>
                <View style={styles.cardHeader}>
                  <Palette size={18} color={colors.accent} />
                  <Text style={styles.cardTitle}>{t('settings.customization_title', 'Внешний вид и кастомизация')}</Text>
                </View>
                <Text style={styles.cardDesc}>{t('settings.customization_desc', 'Настройка языка, внешнего вида и обоев приложения')}</Text>

                {/* Wallpaper Opacity */}
                <View style={{ marginBottom: spacing.xl, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                  <Text style={[styles.fieldLabel, { marginBottom: 4 }]}>{t('settings.wallpaper_opacity', 'Интенсивность затемнения обоев')}</Text>
                  <Text style={[styles.fieldHint, { marginBottom: spacing.md }]}>{t('settings.wallpaper_opacity_hint', 'Регулируйте видимость выбранного фона для максимального удобства чтения')}</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {[
                      { val: 0.25, label: t('settings.opacity_light', 'Легкое (25%)') },
                      { val: 0.45, label: t('settings.opacity_balanced', 'Баланс (45%)') },
                      { val: 0.65, label: t('settings.opacity_soft', 'Мягкое (65%)') },
                      { val: 0.85, label: t('settings.opacity_matte', 'Матовое (85%)') },
                    ].map((opt) => {
                      const active = Math.abs(wallpaperOpacity - opt.val) < 0.05;
                      return (
                        <Pressable
                          key={opt.val}
                          onPress={() => handleSelectWallpaperOpacity(opt.val)}
                          style={({ pressed }) => [
                            {
                              flex: 1,
                              alignItems: 'center',
                              justifyContent: 'center',
                              paddingVertical: 8,
                              borderRadius: radius.md,
                              backgroundColor: active ? '#27272a' : '#18181b',
                              borderWidth: 1,
                              borderColor: active ? '#a78bfa' : '#27272a',
                            },
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '600', color: active ? colors.text : colors.textMuted }}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Language Option — chips like opacity selector */}
                {/* Language + Font button */}
                <View style={{ marginBottom: spacing.xl, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, paddingRight: spacing.md }}>
                      <Text style={styles.fieldLabel}>{t('settings.lang_font_title', 'Язык и шрифт')}</Text>
                      <Text style={styles.fieldHint}>
                        {availableLanguages.find((l) => l.code === language)?.label || 'Русский'}
                        {' · '}
                        {fontFamily === 'system' ? 'Системный' : fontFamily}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setShowLangFontMenu(true)}
                      style={({ pressed }) => [
                        styles.langFontBtn,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Globe size={15} color={colors.accent} />
                      <Text style={styles.langFontBtnText}>{t('settings.lang_font_open', 'Изменить')}</Text>
                      <ChevronDown size={13} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </View>

                {/* Wallpaper Preset Options */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <Text style={styles.fieldLabel}>{t('settings.wallpaper_title', 'Фоновые обои приложения')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <Pressable
                      onPress={handlePickCustomWallpaper}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#18181b', borderColor: colors.accent, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill }}
                    >
                      <Upload size={13} color={colors.accent} />
                      <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>{t('settings.custom_wallpaper', '+ Свои обои')}</Text>
                    </Pressable>
                    {wallpaper !== 'default' && (
                      <Pressable onPress={() => handleSelectWallpaper('default')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <RotateCcw size={12} color={colors.textMuted} />
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('settings.reset_default', 'Вернуть классический')}</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                <View style={styles.wallpaperGrid}>
                  {/* Custom Wallpaper Card if set */}
                  {customWallpaperUri ? (
                    <Pressable
                      onPress={() => handleSelectWallpaper('custom')}
                      style={({ pressed }) => [
                        styles.wallpaperCard,
                        wallpaper === 'custom' && styles.wallpaperCardActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Image source={{ uri: customWallpaperUri }} style={styles.wallpaperPreviewImage} resizeMode="cover" />
                      <View style={styles.wallpaperCardBody}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={[styles.wallpaperTitle, wallpaper === 'custom' && styles.wallpaperTitleActive]}>
                            {t('settings.custom_wallpaper_title', 'Свои обои')}
                          </Text>
                          {wallpaper === 'custom' && <Check size={14} color={colors.accent} />}
                        </View>
                        <Text style={styles.wallpaperDesc}>{t('settings.custom_wallpaper_desc', 'Загруженное пользователем изображение')}</Text>
                      </View>
                    </Pressable>
                  ) : null}

                  {WALLPAPER_PRESETS_RAW.map((wp) => {
                    const active = wallpaper === wp.id;
                    const wpTitle = t(wp.titleKey, wp.title);
                    const wpDesc = t(wp.descKey, wp.desc);
                    return (
                      <Pressable
                        key={wp.id}
                        onPress={() => handleSelectWallpaper(wp.id)}
                        style={({ pressed }) => [
                          styles.wallpaperCard,
                          active && styles.wallpaperCardActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        {wp.source ? (
                          <Image source={wp.source} style={styles.wallpaperPreviewImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.wallpaperPreviewImage, { backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center' }]}>
                            <ImageIcon size={24} color={colors.textMuted} />
                          </View>
                        )}
                        <View style={styles.wallpaperCardBody}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={[styles.wallpaperTitle, active && styles.wallpaperTitleActive]}>{wpTitle}</Text>
                            {active && <Check size={14} color={colors.accent} />}
                          </View>
                          <Text style={styles.wallpaperDesc}>{wpDesc}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {activeTab === 'stats' && (
              <View style={styles.sectionCard}>
                <View style={styles.cardHeader}>
                  <BarChart3 size={18} color={colors.accent} />
                  <Text style={styles.cardTitle}>{t('settings.stats_title', 'Статистика использования')}</Text>
                </View>

                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{formatLargeNumber(tokenStats?.totalInput || 0)}</Text>
                    <Text style={styles.statSub}>{t('settings.input_tokens', 'Входные токены')}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{formatLargeNumber(tokenStats?.totalOutput || 0)}</Text>
                    <Text style={styles.statSub}>{t('settings.output_tokens', 'Выходные токены')}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{tokenStats?.totalRequests || 0}</Text>
                    <Text style={styles.statSub}>{t('settings.requests_count', 'Запросов')}</Text>
                  </View>
                </View>

                {/* Usage Chart */}
                <Text style={[styles.fieldLabel, { marginTop: spacing.lg, marginBottom: spacing.xs }]}>{t('settings.chart_title', 'График за 7 дней')}</Text>
                <UsageChart data={dailyStats} />

                <Pressable onPress={handleResetStats} style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}>
                  <RefreshCw size={14} color={colors.danger} />
                  <Text style={styles.resetBtnText}>{t('settings.reset_stats', 'Сбросить статистику')}</Text>
                </Pressable>
              </View>
            )}

            {activeTab === 'skills' && (
              <View style={styles.sectionCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <View style={styles.cardHeader}>
                    <Sparkles size={18} color={colors.accent} />
                    <Text style={styles.cardTitle}>{t('settings.skills_title', 'Навыки ИИ (Skills)')}</Text>
                  </View>
                  <Pressable
                    onPress={() => setShowAddSkill(!showAddSkill)}
                    style={{ backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill }}
                  >
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>
                      {showAddSkill ? t('settings.cancel', 'Отмена') : t('settings.add_skill', '+ Свой навык')}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.cardDesc}>{t('settings.skills_desc', 'Автономные навыки, создаваемые ИИ или добавляемые вручную в один клик')}</Text>

                {showAddSkill && (
                  <View style={{ backgroundColor: '#18181b', borderColor: '#27272a', borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg }}>
                    <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>{t('settings.skill_name', 'Название навыка')}</Text>
                    <TextInput
                      style={styles.textInput}
                      value={newSkillName}
                      onChangeText={setNewSkillName}
                      placeholder={t('settings.skill_name_placeholder', 'Например: deploy_app / format_json')}
                      placeholderTextColor={colors.textDim}
                    />

                    <Text style={[styles.fieldLabel, { marginTop: 10, marginBottom: 6 }]}>{t('settings.skill_desc', 'Описание')}</Text>
                    <TextInput
                      style={styles.textInput}
                      value={newSkillDesc}
                      onChangeText={setNewSkillDesc}
                      placeholder={t('settings.skill_desc_placeholder', 'Что делает данный навык')}
                      placeholderTextColor={colors.textDim}
                    />

                    <Text style={[styles.fieldLabel, { marginTop: 10, marginBottom: 6 }]}>{t('settings.skill_instruction', 'Инструкция / Паттерн')}</Text>
                    <TextInput
                      style={[styles.textInput, { minHeight: 60 }]}
                      value={newSkillPattern}
                      onChangeText={setNewSkillPattern}
                      placeholder={t('settings.skill_instruction_placeholder', 'Пошаговая инструкция для ассистента')}
                      placeholderTextColor={colors.textDim}
                      multiline
                    />

                    <Pressable
                      onPress={async () => {
                        if (!newSkillName.trim()) {
                          Alert.alert('Укажи название', 'Введите название навыка');
                          return;
                        }
                        const { saveSkill } = await import('../services/skills');
                        await saveSkill({
                          name: newSkillName.trim(),
                          description: newSkillDesc.trim() || 'Пользовательский навык',
                          pattern: newSkillPattern.trim() || 'Выполняй задачи по данному паттерну.',
                          triggerKeywords: [newSkillName.trim().toLowerCase()],
                        });
                        setNewSkillName('');
                        setNewSkillDesc('');
                        setNewSkillPattern('');
                        setShowAddSkill(false);
                        await refreshSkills();
                      }}
                      style={{ backgroundColor: colors.accent, paddingVertical: 8, borderRadius: radius.lg, alignItems: 'center', marginTop: 12 }}
                    >
                      <Text style={{ color: '#000000', fontWeight: '700', fontSize: 13 }}>{t('settings.save_skill', 'Сохранить навык')}</Text>
                    </Pressable>
                  </View>
                )}

                {/* Preset Skills Catalog Section */}
                <View style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
                    <Gift size={16} color="#fbbf24" />
                    <Text style={{ fontSize: 13, color: colors.text, fontWeight: '700' }}>
                      Каталог готовых скиллов
                    </Text>
                  </View>
                  <View style={{ gap: spacing.sm }}>
                    {PRESET_SKILLS.map((preset) => {
                      const isInstalled = skills.some(
                        (s) => s.name.toLowerCase() === preset.name.toLowerCase()
                      );
                      const iconMeta = PRESET_ICON_MAP[preset.icon] || { icon: Sparkles, color: colors.accent, bg: 'rgba(167, 139, 250, 0.15)' };
                      const IconComp = iconMeta.icon;
                      const isExpanded = expandedSkillName === preset.name;

                      return (
                        <Pressable
                          key={preset.name}
                          onPress={() => setExpandedSkillName(isExpanded ? null : preset.name)}
                          style={{
                            backgroundColor: '#141419',
                            borderColor: isExpanded ? colors.accent : (isInstalled ? colors.accent + '50' : '#27272a'),
                            borderWidth: 1,
                            borderRadius: radius.lg,
                            padding: spacing.md,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1, paddingRight: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                              <View style={{ width: 34, height: 34, borderRadius: radius.md, backgroundColor: iconMeta.bg, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                                <IconComp size={18} color={iconMeta.color} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{preset.name}</Text>
                                  <View style={{ backgroundColor: '#27272a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm }}>
                                    <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '600' }}>{preset.category}</Text>
                                  </View>
                                </View>
                                {!isExpanded && (
                                  <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
                                    {preset.description}
                                  </Text>
                                )}
                              </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                              <Pressable
                                disabled={isInstalled}
                                onPress={async (e) => {
                                  e.stopPropagation();
                                  await installPresetSkill(preset);
                                  await refreshSkills();
                                }}
                                style={({ pressed }) => [{
                                  backgroundColor: isInstalled ? '#18181b' : colors.accent,
                                  borderColor: isInstalled ? '#27272a' : colors.accent,
                                  borderWidth: 1,
                                  paddingHorizontal: 12,
                                  paddingVertical: 6,
                                  borderRadius: radius.pill,
                                  alignItems: 'center',
                                }, pressed && styles.pressed]}
                              >
                                <Text style={{
                                  color: isInstalled ? colors.textMuted : '#000000',
                                  fontSize: 12,
                                  fontWeight: '700'
                                }}>
                                  {isInstalled ? '✓ Установлен' : '+ Установить'}
                                </Text>
                              </Pressable>
                              <View style={{ padding: 4 }}>
                                {isExpanded ? (
                                  <ChevronUp size={16} color={colors.textMuted} />
                                ) : (
                                  <ChevronDown size={16} color={colors.textMuted} />
                                )}
                              </View>
                            </View>
                          </View>

                          {isExpanded && (
                            <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: '#27272a' }}>
                              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>Описание:</Text>
                              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: spacing.md }}>{preset.description}</Text>

                              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>Инструкция для ИИ (Промпт):</Text>
                              <View style={{ backgroundColor: '#09090b', borderColor: '#27272a', borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md }}>
                                <Text style={{ color: '#a1a1aa', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 17 }}>
                                  {preset.pattern}
                                </Text>
                              </View>

                              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Ключевые триггеры:</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {preset.triggerKeywords.map((kw) => (
                                  <View key={kw} style={{ backgroundColor: '#27272a', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill }}>
                                    <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '600' }}>#{kw}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Installed Skills Section */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
                  <Zap size={16} color="#f59e0b" />
                  <Text style={{ fontSize: 13, color: colors.text, fontWeight: '700' }}>
                    Ваши активные навыки ({skills.length})
                  </Text>
                </View>

                {skills.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>{t('settings.no_skills', 'Нет активных навыков. Нажмите «+ Установить» выше в каталоге или попросите ИИ запомнить навык во время разговора.')}</Text>
                  </View>
                ) : (
                  skills.map((s) => {
                    const isExpanded = expandedSkillName === (s.id || s.name);
                    return (
                      <Pressable
                        key={s.id || s.name}
                        onPress={() => setExpandedSkillName(isExpanded ? null : (s.id || s.name))}
                        style={[styles.skillRow, isExpanded && { borderColor: colors.accent, backgroundColor: '#141419' }]}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={styles.skillTitle}>{s.name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSkill(s.id || s.name);
                                }}
                                style={styles.iconBtn}
                              >
                                <Trash2 size={16} color={colors.danger} />
                              </Pressable>
                              <View style={{ padding: 2 }}>
                                {isExpanded ? (
                                  <ChevronUp size={16} color={colors.textMuted} />
                                ) : (
                                  <ChevronDown size={16} color={colors.textMuted} />
                                )}
                              </View>
                            </View>
                          </View>
                          <Text style={styles.skillDesc} numberOfLines={isExpanded ? undefined : 2}>{s.description}</Text>

                          {isExpanded && (
                            <View style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: '#27272a' }}>
                              {s.pattern ? (
                                <>
                                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>Системная инструкция:</Text>
                                  <View style={{ backgroundColor: '#09090b', borderColor: '#27272a', borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs }}>
                                    <Text style={{ color: '#a1a1aa', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 16 }}>
                                      {s.pattern}
                                    </Text>
                                  </View>
                                </>
                              ) : null}
                              {s.triggerKeywords && s.triggerKeywords.length > 0 && (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                  {s.triggerKeywords.map((kw) => (
                                    <View key={kw} style={{ backgroundColor: '#27272a', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill }}>
                                      <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '600' }}>#{kw}</Text>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}

            {activeTab === 'privacy' && (
              <View style={styles.sectionCard}>
                <View style={styles.cardHeader}>
                  <Shield size={18} color="#a78bfa" />
                  <Text style={styles.cardTitle}>{t('settings.privacy_title', 'Разрешения и безопасность ПК')}</Text>
                </View>
                <Text style={styles.cardDesc}>{t('settings.privacy_desc', 'Настройка доступа и локальной приватности ассистента на компьютере')}</Text>

                {/* Workspace File Access */}
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: spacing.md }}>
                    <Text style={styles.switchTitle}>{t('settings.project_files_title', 'Доступ к файлам проекта')}</Text>
                    <Text style={styles.switchDesc}>{t('settings.project_files_desc', 'Разрешить ассистенту создавать, изменять и читать файлы кода в рабочей области на ПК')}</Text>
                  </View>
                  <Switch
                    value={true}
                    disabled
                    trackColor={{ false: '#27272a', true: '#a78bfa' }}
                    thumbColor="#ffffff"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: '#27272a', marginVertical: spacing.lg }} />

                {/* Web Search Access */}
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: spacing.md }}>
                    <Text style={styles.switchTitle}>{t('settings.web_search_title', 'Автоматический веб-поиск')}</Text>
                    <Text style={styles.switchDesc}>{t('settings.web_search_desc', 'Разрешить ассистенту находить свежие новости и факты в интернете во время диалога')}</Text>
                  </View>
                  <Switch
                    value={true}
                    disabled
                    trackColor={{ false: '#27272a', true: '#a78bfa' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            )}

            {/* Updates / Git Sync Tab */}
            {activeTab === 'updates' && (
              <View style={styles.sectionCard}>
                <View style={styles.cardHeader}>
                  <RefreshCw size={18} color={colors.accent} />
                  <Text style={styles.cardTitle}>Синхронизация с Git и автообновление</Text>
                </View>
                <Text style={styles.cardDesc}>
                  Обновление приложения напрямую из GitHub репозитория без скачивания установочных файлов .exe. Изменения подтягиваются и собираются локально.
                </Text>

                {/* Status Box */}
                <View style={{ backgroundColor: '#18181b', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>Репозиторий:</Text>
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>github.com/ponkalapon/Argus.git (main)</Text>
                  </View>

                  <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: spacing.xs }} />

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: gitStatus?.available ? colors.success : colors.accent }} />
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                      {gitStatus?.available
                        ? `Доступны новые обновления (коммитов: ${gitStatus.commitCount})`
                        : gitStatus?.error
                          ? `Статус: ${gitStatus.error}`
                          : 'Версия актуальна — локальный код совпадает с GitHub'}
                    </Text>
                  </View>

                  {gitStatus?.commits && gitStatus.commits.length > 0 && (
                    <View style={{ marginTop: spacing.md, backgroundColor: '#0d0d10', borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: '#232328' }}>
                      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>СВЕЖИЕ КОММИТЫ В MAIN:</Text>
                      {gitStatus.commits.slice(0, 5).map((commit, idx) => (
                        <Text key={idx} style={{ color: '#e4e4e7', fontFamily: 'Consolas, monospace', fontSize: 11, marginVertical: 2 }}>
                          • {commit}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>

                {/* Auto Check Switch */}
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: spacing.md }}>
                    <Text style={styles.switchTitle}>Автопроверка обновлений</Text>
                    <Text style={styles.switchDesc}>Проверять новые коммиты в GitHub при запуске приложения</Text>
                  </View>
                  <Switch
                    value={autoCheckUpdates}
                    onValueChange={handleToggleAutoCheck}
                    trackColor={{ false: '#27272a', true: colors.accent }}
                    thumbColor="#ffffff"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.lg }} />

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleCheckUpdates}
                    disabled={isCheckingGit || isUpdatingGit}
                    style={({ pressed }) => [
                      styles.mcBtn,
                      { flex: 1, minWidth: 160, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', gap: 8 },
                      (isCheckingGit || isUpdatingGit) && { opacity: 0.5 },
                      pressed && styles.pressed,
                    ]}
                  >
                    <RefreshCw size={16} color={colors.text} />
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>
                      {isCheckingGit ? 'Проверка...' : 'Проверить Git'}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={handleRunUpdate}
                    disabled={isUpdatingGit}
                    style={({ pressed }) => [
                      styles.mcBtn,
                      styles.mcBtnPrimary,
                      { flex: 1, minWidth: 200, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', gap: 8 },
                      isUpdatingGit && { opacity: 0.5 },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Zap size={16} color="#ffffff" fill="#ffffff" />
                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>
                      {isUpdatingGit ? 'Сборка локально...' : 'Синхронизировать и собрать ПК'}
                    </Text>
                  </Pressable>
                </View>

                {/* Output log */}
                {Boolean(updateLog) && (
                  <View style={{ marginTop: spacing.lg, backgroundColor: '#0d0d10', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: spacing.xs }}>ЛОГ СИНХРОНИЗАЦИИ:</Text>
                    <ScrollView style={{ maxHeight: 160 }}>
                      <Text style={{ color: '#4ade80', fontFamily: 'Consolas, monospace', fontSize: 12, lineHeight: 18 }}>
                        {updateLog}
                      </Text>
                    </ScrollView>

                    <Pressable
                      onPress={reloadApp}
                      style={({ pressed }) => [
                        styles.mcBtn,
                        { marginTop: spacing.md, backgroundColor: colors.accent, borderColor: colors.accent, paddingVertical: 10, alignItems: 'center' },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Перезапустить приложение</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {activeTab === 'mcp' && (
              <View style={styles.sectionCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Network size={18} color={colors.accent} />
                    <Text style={styles.cardTitle}>MCP Серверы (Model Context Protocol)</Text>
                  </View>
                  <Pressable
                    onPress={() => setShowAddMcp(!showAddMcp)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: showAddMcp ? '#27272a' : colors.accent,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: radius.md,
                    }}
                  >
                    <Plus size={14} color={showAddMcp ? colors.text : '#000'} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: showAddMcp ? colors.text : '#000' }}>
                      {showAddMcp ? 'Отмена' : 'Добавить MCP'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={[styles.cardDesc, { marginBottom: spacing.md }]}>
                  Подключай внешние MCP-серверы для расширения возможностей ассистента дополнительными инструментами.
                </Text>

                {showAddMcp && (
                  <View style={{ backgroundColor: '#18181b', borderWidth: 1, borderColor: colors.accent, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: spacing.sm }}>Подключение нового MCP сервера</Text>
                    <TextInput
                      style={[styles.textInput, { marginBottom: spacing.sm }]}
                      placeholder="Название (например: GitHub Tools, Database MCP)"
                      placeholderTextColor={colors.textMuted}
                      value={newMcpName}
                      onChangeText={setNewMcpName}
                    />
                    <TextInput
                      style={[styles.textInput, { marginBottom: spacing.md }]}
                      placeholder="URL (например: http://localhost:8000/mcp или sse://...)"
                      placeholderTextColor={colors.textMuted}
                      value={newMcpUrl}
                      onChangeText={setNewMcpUrl}
                      autoCapitalize="none"
                    />
                    <Pressable
                      onPress={async () => {
                        if (!newMcpName.trim() || !newMcpUrl.trim()) {
                          Alert.alert('Заполните поля', 'Укажите название и URL сервера');
                          return;
                        }
                        await addMcpServer({ name: newMcpName.trim(), url: newMcpUrl.trim(), enabled: true, status: 'untested' });
                        setNewMcpName('');
                        setNewMcpUrl('');
                        setShowAddMcp(false);
                        refreshMcpServers();
                      }}
                      style={{ backgroundColor: colors.accent, paddingVertical: 8, borderRadius: radius.md, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>Сохранить сервер</Text>
                    </Pressable>
                  </View>
                )}

                {mcpServers.length === 0 ? (
                  <View style={{ padding: spacing.xl, alignItems: 'center', backgroundColor: 'rgba(24, 24, 27, 0.4)', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                    <Network size={32} color={colors.textMuted} style={{ marginBottom: spacing.sm, opacity: 0.5 }} />
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>Нет подключенных MCP серверов</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
                      Нажми кнопку «Добавить MCP» выше, чтобы подключить сервер с инструментами по стандарту Model Context Protocol.
                    </Text>
                  </View>
                ) : (
                  mcpServers.map((server) => (
                    <View key={server.id} style={{ backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1, paddingRight: spacing.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{server.name}</Text>
                            <View style={{
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: radius.pill,
                              backgroundColor: server.status === 'ok' ? 'rgba(34, 197, 94, 0.15)' : server.status === 'error' ? 'rgba(239, 68, 68, 0.15)' : '#27272a',
                            }}>
                              <Text style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: server.status === 'ok' ? '#4ade80' : server.status === 'error' ? '#f87171' : colors.textMuted,
                              }}>
                                {server.status === 'ok' ? 'АКТИВЕН' : server.status === 'error' ? 'ОШИБКА' : 'НЕ ПРОВЕРЕН'}
                              </Text>
                            </View>
                          </View>
                          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{server.url}</Text>
                          {server.statusMessage && (
                            <Text style={{ color: server.status === 'error' ? '#f87171' : colors.accent, fontSize: 11, marginTop: 4 }}>
                              {server.statusMessage}
                            </Text>
                          )}
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                          <Pressable
                            disabled={testingMcpId === server.id}
                            onPress={async () => {
                              setTestingMcpId(server.id);
                              await testMcpServer(server);
                              setTestingMcpId(null);
                              refreshMcpServers();
                            }}
                            style={{ padding: 6, backgroundColor: '#27272a', borderRadius: radius.md }}
                          >
                            <RefreshCw size={14} color={testingMcpId === server.id ? colors.accent : colors.textMuted} />
                          </Pressable>

                          <Switch
                            value={server.enabled}
                            onValueChange={async (val) => {
                              await updateMcpServer(server.id, { enabled: val });
                              refreshMcpServers();
                            }}
                            trackColor={{ false: '#27272a', true: colors.accent }}
                            thumbColor="#ffffff"
                          />

                          <Pressable
                            onPress={async () => {
                              await deleteMcpServer(server.id);
                              refreshMcpServers();
                            }}
                            style={{ padding: 6 }}
                          >
                            <Trash2 size={16} color={colors.danger} />
                          </Pressable>
                        </View>
                      </View>

                      {server.tools && server.tools.length > 0 && (
                        <View style={{ marginTop: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                          {server.tools.map((t) => (
                            <View key={t.name} style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm }}>
                              <Text style={{ color: colors.textMuted, fontSize: 10, fontFamily: 'monospace' }}>⚡ {t.name}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        </View>

        {/* ═══ Language + Font overlay — sibling to ScrollView, never clipped ═══ */}
        {showLangFontMenu && (
          <View style={styles.langFontOverlay}>
            {/* Backdrop */}
            <Pressable
              style={styles.langFontBackdrop}
              onPress={() => { setShowLangFontMenu(false); setShowFontPanel(false); setLangSearch(''); }}
            />

            {/* Minecraft-style panel */}
            <View style={styles.mcPanel}>
              {!showFontPanel ? (
                /* ════════ LANGUAGE SCREEN ════════ */
                <>
                  <Text style={styles.mcTitle}>Язык</Text>

                  <TextInput
                    style={styles.mcSearchInput}
                    value={langSearch}
                    onChangeText={setLangSearch}
                    placeholder="Поиск..."
                    placeholderTextColor="#555"
                    autoCorrect={false}
                    spellCheck={false}
                  />

                  <ScrollView
                    style={styles.mcListScroll}
                    showsVerticalScrollIndicator
                    contentContainerStyle={{ paddingVertical: 2 }}
                  >
                    {availableLanguages
                      .filter((l) => l.label.toLowerCase().includes(langSearch.toLowerCase()))
                      .map((langOpt) => {
                        const isSel = language === langOpt.code;
                        return (
                          <Pressable
                            key={langOpt.code}
                            onPress={() => handleSelectLanguage(langOpt.code as LanguageType)}
                            style={({ pressed }) => [
                              styles.mcListItem,
                              isSel && styles.mcListItemActive,
                              pressed && { opacity: 0.7 },
                            ]}
                          >
                            <Text style={[styles.mcListItemText, isSel && styles.mcListItemTextActive]}>
                              {langOpt.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                  </ScrollView>

                  <Text style={styles.mcFooterNote}>(Переводы могут содержать ошибки)</Text>

                  <View style={styles.mcBtnRow}>
                    <Pressable
                      style={({ pressed }) => [styles.mcBtn, pressed && styles.mcBtnPressed]}
                      onPress={() => setShowFontPanel(true)}
                    >
                      <Text style={styles.mcBtnText}>Настройки шрифта...</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.mcBtn, styles.mcBtnPrimary, pressed && styles.mcBtnPressed]}
                      onPress={() => { setShowLangFontMenu(false); setLangSearch(''); }}
                    >
                      <Text style={[styles.mcBtnText, styles.mcBtnTextPrimary]}>Готово</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                /* ════════ FONT SCREEN ════════ */
                <>
                  <Text style={styles.mcTitle}>Настройки шрифта</Text>

                  <ScrollView
                    style={styles.mcListScroll}
                    showsVerticalScrollIndicator
                    contentContainerStyle={{ paddingVertical: 2 }}
                  >
                    {[
                      { key: 'system',     label: 'Системный (по умолчанию)' },
                      { key: 'monospace',  label: 'Моноширинный' },
                      { key: 'serif',      label: 'Serif' },
                      { key: 'sans-serif', label: 'Sans-serif' },
                    ].map((fontOpt) => {
                      const isSel = fontFamily === fontOpt.key;
                      return (
                        <Pressable
                          key={fontOpt.key}
                          onPress={() => updateTheme({ fontFamily: fontOpt.key })}
                          style={({ pressed }) => [
                            styles.mcListItem,
                            isSel && styles.mcListItemActive,
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text style={[
                            styles.mcListItemText,
                            { fontFamily: fontOpt.key === 'system' ? undefined : fontOpt.key },
                            isSel && styles.mcListItemTextActive,
                          ]}>
                            {fontOpt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Pressable
                    onPress={async () => {
                      try {
                        const result = await DocumentPicker.getDocumentAsync({
                          type: ['font/ttf', 'font/otf', 'application/octet-stream'],
                          copyToCacheDirectory: true,
                        });
                        if (!result.canceled && result.assets?.[0]) {
                          const name = result.assets[0].name.replace(/\.[^.]+$/, '');
                          updateTheme({ fontFamily: name });
                        }
                      } catch (e) { /* ignore */ }
                    }}
                    style={({ pressed }) => [styles.mcUploadBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Upload size={14} color="#aaa" />
                    <Text style={styles.mcUploadBtnText}>Загрузить свой шрифт (.ttf / .otf)</Text>
                  </Pressable>

                  <Text style={styles.mcFooterNote}>(Шрифт применяется к интерфейсу приложения)</Text>

                  <View style={styles.mcBtnRow}>
                    <Pressable
                      style={({ pressed }) => [styles.mcBtn, pressed && styles.mcBtnPressed]}
                      onPress={() => setShowFontPanel(false)}
                    >
                      <Text style={styles.mcBtnText}>← Назад</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.mcBtn, styles.mcBtnPrimary, pressed && styles.mcBtnPressed]}
                      onPress={() => { setShowLangFontMenu(false); setShowFontPanel(false); }}
                    >
                      <Text style={[styles.mcBtnText, styles.mcBtnTextPrimary]}>Готово</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    backgroundColor: 'rgba(9, 9, 11, 0.7)',
  },
  backBtn: {
    padding: spacing.xs,
    borderRadius: radius.pill,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  saveBtnText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 13,
  },
  pressed: {
    opacity: 0.75,
  },

  layoutBody: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 220,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: 2,
    backgroundColor: 'rgba(9, 9, 11, 0.35)',
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  tabItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'transparent',
    borderWidth: 0,
  },
  tabLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#ffffff',
    fontWeight: '600',
  },

  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.xl,
    maxWidth: 1040,
    width: '100%',
    alignSelf: 'center',
  },

  sectionCard: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  cardTitle: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cardDesc: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.xl,
  },

  fieldGroup: {
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    color: '#f4f4f5',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  fieldHint: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  textInput: {
    backgroundColor: 'rgba(18, 18, 20, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    fontSize: 13,
    outlineStyle: 'none' as any,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipActive: {
    borderColor: 'rgba(167, 139, 250, 0.4)',
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  chipText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#c4b5fd',
    fontWeight: '600',
  },

  layoutOption: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 20, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  layoutOptionActive: {
    borderColor: 'rgba(167, 139, 250, 0.5)',
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
  },
  layoutOptionTitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  layoutOptionTitleActive: {
    color: '#c4b5fd',
  },
  layoutOptionDesc: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    lineHeight: 15,
  },

  wallpaperGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  wallpaperCard: {
    flex: 1,
    minWidth: 220,
    maxWidth: 240,
    backgroundColor: 'rgba(18, 18, 20, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  wallpaperCardActive: {
    borderColor: 'rgba(167, 139, 250, 0.6)',
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
  },
  wallpaperPreviewImage: {
    width: '100%',
    height: 72,
  },
  wallpaperCardBody: {
    padding: 10,
  },
  wallpaperTitle: {
    color: '#f4f4f5',
    fontSize: 12,
    fontWeight: '600',
  },
  wallpaperTitleActive: {
    color: '#c4b5fd',
  },
  wallpaperDesc: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },

  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#18181b',
    borderColor: '#27272a',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  statVal: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  statSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },

  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  resetBtnText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },

  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderColor: '#27272a',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  skillTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  skillDesc: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  iconBtn: {
    padding: spacing.xs,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  switchDesc: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  // Overlay shared
  langFontOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langFontBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },

  // Minecraft-structure modal styled with Argus theme
  mcPanel: {
    width: 520,
    maxWidth: '90%' as any,
    maxHeight: '82%' as any,
    backgroundColor: '#0f0f11',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.xl,
    padding: 0,
    overflow: 'hidden' as any,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 30,
  },
  mcTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    letterSpacing: 0.3,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  mcSearchInput: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: radius.md,
    outlineStyle: 'none' as any,
  },
  mcListScroll: {
    flex: 1,
    marginHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radius.md,
    backgroundColor: 'rgba(24, 24, 27, 0.4)',
  },
  mcListItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center' as any,
    backgroundColor: 'transparent',
    borderRadius: radius.sm,
    marginVertical: 2,
  },
  mcListItemActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
    marginHorizontal: 4,
  },
  mcListItemText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center' as any,
  },
  mcListItemTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  mcFooterNote: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center' as any,
    paddingVertical: 8,
    opacity: 0.8,
  },
  mcBtnRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  mcBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center' as any,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: radius.md,
  },
  mcBtnPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  mcBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  mcBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  mcBtnTextPrimary: {
    color: '#ffffff',
    fontWeight: '700',
  },
  mcUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    alignSelf: 'center' as any,
  },
  mcUploadBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },

  // Keep for button in settings row
  langFontBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  langFontBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
