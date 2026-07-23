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
  Cpu,
  Eye,
  EyeOff,
  Globe,
  Image as ImageIcon,
  Key,
  Maximize2,
  Minimize2,
  Palette,
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
import { listSkills, deleteSkill, Skill } from '../services/skills';
import { loadThemeConfig, saveThemeConfig, WallpaperType, LayoutWidthType, LanguageType, AccentColorType, BubbleStyleType, FontSizeScaleType } from '../services/themeStorage';
import { availableLanguages, setLanguage as setI18nLanguage, t } from '../services/i18n';
import { UsageChart } from './UsageChart';
import { colors, motion, radius, spacing, typography, ACCENT_PALETTES, applyAccentColor } from '../styles/theme';

type Props = {
  initialSettings: AgentSettings;
  onBack: () => void;
  onSave: (settings: AgentSettings, apiKey: string) => Promise<void>;
  onThemeChange?: () => void;
};

type TabType = 'connection' | 'customization' | 'stats' | 'skills' | 'privacy';

const MODEL_PRESETS = [
  'mimo-v2.5',
  'gpt-4o-mini',
  'gpt-4.1-mini',
  'qwen/qwen3-coder',
];

const WALLPAPER_PRESETS_RAW: { id: WallpaperType; titleKey: string; descKey: string; source: any }[] = [
  {
    id: 'default',
    titleKey: 'settings.default_wallpaper_title',
    descKey: 'settings.default_wallpaper_desc',
    source: null,
  },
  {
    id: 'cyber_mesh',
    titleKey: 'settings.cyber_mesh_title',
    descKey: 'settings.cyber_mesh_desc',
    source: require('../../assets/wallpapers/cyber_mesh.jpg'),
  },
  {
    id: 'argus_nebula',
    titleKey: 'settings.argus_nebula_title',
    descKey: 'settings.argus_nebula_desc',
    source: require('../../assets/wallpapers/argus_nebula.jpg'),
  },
  {
    id: 'minimal_carbon',
    titleKey: 'settings.minimal_carbon_title',
    descKey: 'settings.minimal_carbon_desc',
    source: require('../../assets/wallpapers/minimal_carbon.jpg'),
  },
  {
    id: 'neon_waves',
    titleKey: 'settings.neon_waves_title',
    descKey: 'settings.neon_waves_desc',
    source: require('../../assets/wallpapers/neon_waves.jpg'),
  },
  {
    id: 'deep_space',
    titleKey: 'settings.deep_space_title',
    descKey: 'settings.deep_space_desc',
    source: require('../../assets/wallpapers/deep_space.jpg'),
  },
];

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

  const [wallpaper, setWallpaper] = useState<WallpaperType>('default');
  const [customWallpaperUri, setCustomWallpaperUri] = useState<string | null>(null);
  const [layoutWidth, setLayoutWidth] = useState<LayoutWidthType>('fluid');
  const [language, setLanguage] = useState<LanguageType>('ru');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [accentColor, setAccentColor] = useState<AccentColorType>('purple');
  const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(0.45);
  const [bubbleStyle, setBubbleStyle] = useState<BubbleStyleType>('glass');
  const [fontSize, setFontSize] = useState<FontSizeScaleType>('standard');

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

  useEffect(() => {
    if (activeTab === 'skills') {
      refreshSkills();
    }
  }, [activeTab, refreshSkills]);

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
        setAccentColor(cfg.accentColor);
        setWallpaperOpacity(cfg.wallpaperOpacity);
        setBubbleStyle(cfg.bubbleStyle);
        setFontSize(cfg.fontSize);
        applyAccentColor(cfg.accentColor);
      }
    });

    loadStats();
    listSkills().then((s) => { if (mounted) setSkills(s); });

    return () => { mounted = false; };
  }, [entrance, loadStats]);

  const endpointPreview = useMemo(() => {
    let normalized = baseUrl.trim().replace(/\/+$/, '');
    if (normalized.toLowerCase().endsWith('/v1')) {
      normalized = normalized.slice(0, -3).replace(/\/+$/, '');
    }
    return normalized ? `${normalized}/v1/chat/completions` : t('settings.base_url_empty', 'Base URL не задан');
  }, [baseUrl]);

  const handleSave = async () => {
    const settings = sanitizeSettings({ baseUrl, model, allowAssistantContacts });

    if (!settings.baseUrl.trim()) {
      Alert.alert(t('settings.alert_need_url', 'Нужен Base URL'), t('settings.alert_need_url_msg', 'Укажи адрес OpenAI-compatible API.'));
      return;
    }
    if (!/^https?:\/\//i.test(settings.baseUrl.trim())) {
      Alert.alert(t('settings.alert_check_url', 'Проверь Base URL'), t('settings.alert_check_url_msg', 'Адрес должен начинаться с http:// или https://.'));
      return;
    }
    if (!settings.model.trim()) {
      Alert.alert(t('settings.alert_need_model', 'Нужна модель'), t('settings.alert_need_model_msg', 'Укажи название модели.'));
      return;
    }

    setIsSaving(true);
    try {
      await saveApiKey(apiKey);
      await saveThemeConfig({ wallpaper, customWallpaperUri, layoutWidth, language, accentColor, wallpaperOpacity, bubbleStyle, fontSize });
      applyAccentColor(accentColor);
      if (onThemeChange) onThemeChange();
      await onSave(settings, apiKey.trim());
      Alert.alert(t('settings.alert_saved', 'Готово'), t('settings.alert_saved_msg', 'Настройки сохранены.'), [{ text: 'OK', onPress: onBack }]);
    } catch (error) {
      Alert.alert(t('settings.alert_error', 'Ошибка'), error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setIsSaving(false);
    }
  };

  const updateTheme = async (updates: Partial<{
    wallpaper: WallpaperType;
    customWallpaperUri?: string | null;
    layoutWidth: LayoutWidthType;
    language: LanguageType;
    accentColor: AccentColorType;
    wallpaperOpacity: number;
    bubbleStyle: BubbleStyleType;
    fontSize: FontSizeScaleType;
  }>) => {
    const nextWallpaper = updates.wallpaper ?? wallpaper;
    const nextCustomUri = updates.customWallpaperUri !== undefined ? updates.customWallpaperUri : customWallpaperUri;
    const nextLayoutWidth = updates.layoutWidth ?? layoutWidth;
    const nextLanguage = updates.language ?? language;
    const nextAccent = updates.accentColor ?? accentColor;
    const nextOpacity = updates.wallpaperOpacity ?? wallpaperOpacity;
    const nextBubble = updates.bubbleStyle ?? bubbleStyle;
    const nextFontSize = updates.fontSize ?? fontSize;

    setI18nLanguage(nextLanguage);
    if (updates.wallpaper !== undefined) setWallpaper(updates.wallpaper);
    if (updates.customWallpaperUri !== undefined) setCustomWallpaperUri(updates.customWallpaperUri);
    if (updates.layoutWidth !== undefined) setLayoutWidth(updates.layoutWidth);
    if (updates.language !== undefined) setLanguage(updates.language);
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

  const handleDeleteSkill = useCallback(async (id: string) => {
    await deleteSkill(id);
    await refreshSkills();
  }, [refreshSkills]);

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
    { id: 'stats', label: t('settings.tab_stats', 'Использование'), icon: BarChart3 },
    { id: 'skills', label: t('settings.tab_skills', 'Навыки'), icon: Sparkles },
    { id: 'privacy', label: t('settings.tab_privacy', 'Безопасность'), icon: Shield },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.container, { opacity: entrance }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <ArrowLeft size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('settings.title', 'Настройки')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
          >
            <Text style={styles.saveBtnText}>{isSaving ? t('settings.saving', 'Сохранение…') : t('settings.save', 'Сохранить')}</Text>
          </Pressable>
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

                {/* Language Option (Dropdown Select) */}
                <View style={{ marginBottom: spacing.xl, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', zIndex: 50 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={styles.fieldLabel}>{t('settings.language_title', 'Язык приложения / Language')}</Text>
                      <Text style={styles.fieldHint}>{t('settings.language_hint', 'Загружено из .yml файлов локализации.')}</Text>
                    </View>

                    <View style={{ position: 'relative' }}>
                      <Pressable
                        onPress={() => setShowLangPicker((prev) => !prev)}
                        style={({ pressed }) => [
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            backgroundColor: '#18181b',
                            borderColor: colors.accent,
                            borderWidth: 1,
                            paddingHorizontal: 14,
                            paddingVertical: 7,
                            borderRadius: radius.md,
                            minWidth: 135,
                            justifyContent: 'space-between',
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Globe size={14} color={colors.accent} />
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                            {availableLanguages.find((l) => l.code === language)?.label || availableLanguages[0]?.label || 'Русский'}
                          </Text>
                        </View>
                        <ChevronDown size={14} color={colors.textMuted} />
                      </Pressable>

                      {showLangPicker && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 42,
                            right: 0,
                            width: 145,
                            backgroundColor: '#121215',
                            borderColor: '#27272a',
                            borderWidth: 1,
                            borderRadius: radius.md,
                            padding: 4,
                            zIndex: 100,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 10,
                          }}
                        >
                          {availableLanguages.map((langOpt) => {
                            const isSel = language === langOpt.code;
                            return (
                              <Pressable
                                key={langOpt.code}
                                onPress={() => {
                                  handleSelectLanguage(langOpt.code as LanguageType);
                                  setShowLangPicker(false);
                                }}
                                style={({ pressed }) => [
                                  {
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: radius.sm,
                                    backgroundColor: isSel ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                                  },
                                  pressed && styles.pressed,
                                ]}
                              >
                                <Text style={{ color: isSel ? colors.accent : colors.text, fontSize: 13, fontWeight: '600' }}>
                                  {langOpt.label}
                                </Text>
                                {isSel && <Check size={14} color={colors.accent} />}
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
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
                    const wpTitle = t(wp.titleKey, wp.titleKey);
                    const wpDesc = t(wp.descKey, wp.descKey);
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
                      {showAddSkill ? t('settings.cancel', 'Отмена') : t('settings.add_skill', '+ Добавить навык')}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.cardDesc}>{t('settings.skills_desc', 'Автономные навыки, создаваемые ИИ или вручную во время диалога')}</Text>

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

                {skills.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>{t('settings.no_skills', 'Нет активных навыков. Вы можете добавить новый навык по кнопке выше или попросить ИИ запомнить навык во время разговора.')}</Text>
                  </View>
                ) : (
                  skills.map((s) => (
                    <View key={s.id || s.name} style={styles.skillRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.skillTitle}>{s.name}</Text>
                        <Text style={styles.skillDesc}>{s.description}</Text>
                        {s.pattern ? (
                          <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 4, fontFamily: 'monospace' }}>
                            {t('settings.skill_pattern_label', 'Инструкция:')} {s.pattern.slice(0, 100)}{s.pattern.length > 100 ? '...' : ''}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable onPress={() => handleDeleteSkill(s.id || s.name)} style={styles.iconBtn}>
                        <Trash2 size={16} color={colors.danger} />
                      </Pressable>
                    </View>
                  ))
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
          </ScrollView>
        </View>
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
});
