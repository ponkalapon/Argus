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
  Zap,
} from 'lucide-react-native';
import { AgentSettings } from '../types';
import { loadApiKey, saveApiKey, sanitizeSettings } from '../services/storage';
import { getTokenStats, getDailyStats, resetTokenStats, DailyRecord, TokenStats } from '../services/tokenStats';
import { listSkills, deleteSkill, Skill } from '../services/skills';
import { loadThemeConfig, saveThemeConfig, WallpaperType, LayoutWidthType } from '../services/themeStorage';
import { UsageChart } from './UsageChart';
import { colors, motion, radius, spacing, typography } from '../styles/theme';

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

const WALLPAPER_PRESETS: { id: WallpaperType; title: string; desc: string; source: any }[] = [
  {
    id: 'default',
    title: 'Классический темный',
    desc: 'Стандартный элегантный глубокий темный фон Hermes',
    source: null,
  },
  {
    id: 'cyber_mesh',
    title: 'Кибер-сетка',
    desc: 'Неоновая анимированная кибернетическая сетка',
    source: require('../../assets/wallpapers/cyber_mesh.jpg'),
  },
  {
    id: 'argus_nebula',
    title: 'Космическая туманность',
    desc: 'Глубокий космос со звездной туманностью',
    source: require('../../assets/wallpapers/argus_nebula.jpg'),
  },
  {
    id: 'minimal_carbon',
    title: 'Минимал Карбон',
    desc: 'Строгая матовая текстура карбона с фиолетовым отливом',
    source: require('../../assets/wallpapers/minimal_carbon.jpg'),
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
  const [layoutWidth, setLayoutWidth] = useState<LayoutWidthType>('fluid');
  const [language, setLanguage] = useState<LanguageType>('ru');

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
      duration: motion.normal,
      toValue: 1,
      useNativeDriver: true,
    }).start();

    loadApiKey().then((key) => {
      if (mounted) setApiKey(key);
    });

    loadThemeConfig().then((cfg) => {
      if (mounted) {
        setWallpaper(cfg.wallpaper);
        setLayoutWidth(cfg.layoutWidth);
        setLanguage(cfg.language);
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
    return normalized ? `${normalized}/v1/chat/completions` : 'Base URL не задан';
  }, [baseUrl]);

  const handleSave = async () => {
    const settings = sanitizeSettings({ baseUrl, model, allowAssistantContacts });

    if (!settings.baseUrl.trim()) {
      Alert.alert('Нужен Base URL', 'Укажи адрес OpenAI-compatible API.');
      return;
    }
    if (!/^https?:\/\//i.test(settings.baseUrl.trim())) {
      Alert.alert('Проверь Base URL', 'Адрес должен начинаться с http:// или https://.');
      return;
    }
    if (!settings.model.trim()) {
      Alert.alert('Нужна модель', 'Укажи название модели.');
      return;
    }

    setIsSaving(true);
    try {
      await saveApiKey(apiKey);
      await saveThemeConfig({ wallpaper, layoutWidth, language });
      if (onThemeChange) onThemeChange();
      await onSave(settings, apiKey.trim());
      Alert.alert('Готово', 'Настройки сохранены.', [{ text: 'OK', onPress: onBack }]);
    } catch (error) {
      Alert.alert('Ошибка', error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectWallpaper = async (wp: WallpaperType) => {
    setWallpaper(wp);
    await saveThemeConfig({ wallpaper: wp, layoutWidth, language });
    if (onThemeChange) onThemeChange();
  };

  const handleSelectLayoutWidth = async (lw: LayoutWidthType) => {
    setLayoutWidth(lw);
    await saveThemeConfig({ wallpaper, layoutWidth: lw, language });
    if (onThemeChange) onThemeChange();
  };

  const handleSelectLanguage = async (lang: LanguageType) => {
    setLanguage(lang);
    await saveThemeConfig({ wallpaper, layoutWidth, language: lang });
    if (onThemeChange) onThemeChange();
  };

  const handleResetStats = () => {
    Alert.alert('Сбросить статистику', 'Обнулить счётчики токенов?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Сбросить',
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
    { id: 'connection', label: 'Подключение', icon: Cpu },
    { id: 'customization', label: 'Кастомизация', icon: Palette },
    { id: 'stats', label: 'Использование', icon: BarChart3 },
    { id: 'skills', label: 'Навыки', icon: Sparkles },
    { id: 'privacy', label: 'Безопасность', icon: Shield },
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
          <Text style={styles.headerTitle}>Настройки</Text>
          <Pressable
            accessibilityRole="button"
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
          >
            <Text style={styles.saveBtnText}>{isSaving ? 'Сохранение…' : 'Сохранить'}</Text>
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
                  <Icon size={18} color={active ? '#a78bfa' : colors.textMuted} />
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
                  <Globe size={18} color="#a78bfa" />
                  <Text style={styles.cardTitle}>Подключение ИИ</Text>
                </View>
                <Text style={styles.cardDesc}>Настройка подключения к ИИ серверу (OpenAI-compatible API)</Text>

                {/* Base URL */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Base URL</Text>
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
                  <Text style={styles.fieldLabel}>Модель ИИ</Text>
                  <TextInput
                    style={styles.textInput}
                    value={model}
                    onChangeText={setModel}
                    placeholder="gpt-4o-mini / mimo-v2.5"
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
                        {model === m && <Check size={12} color="#a78bfa" style={{ marginLeft: 4 }} />}
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
                        <Text style={{ color: '#34d399', fontSize: 11, fontWeight: '600' }}>Ключ сохранён</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ position: 'relative', justifyContent: 'center' }}>
                    <TextInput
                      style={[styles.textInput, { paddingRight: 40 }]}
                      value={apiKey}
                      onChangeText={setApiKey}
                      placeholder="Введи твой API ключ (например sk-...)"
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
                  <Text style={styles.fieldHint}>Ключ сохраняется локально на вашем ПК и используется для авторизации</Text>
                </View>
              </View>
            )}

            {activeTab === 'customization' && (
              <View style={styles.sectionCard}>
                <View style={styles.cardHeader}>
                  <Palette size={18} color="#a78bfa" />
                  <Text style={styles.cardTitle}>Внешний вид и кастомизация</Text>
                </View>
                <Text style={styles.cardDesc}>Настройка языка, темы и внешнего вида интерфейса</Text>

                {/* Language Option (Hermes Style) */}
                <View style={{ marginBottom: spacing.xl, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <View>
                      <Text style={styles.fieldLabel}>Language / Язык</Text>
                      <Text style={styles.fieldHint}>Choose the language for the desktop interface.</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: spacing.xs, backgroundColor: '#18181b', borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: '#27272a' }}>
                      <Pressable
                        onPress={() => handleSelectLanguage('ru')}
                        style={({ pressed }) => [
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: radius.sm - 2,
                            backgroundColor: language === 'ru' ? '#27272a' : 'transparent',
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Globe size={14} color={language === 'ru' ? '#a78bfa' : colors.textMuted} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: language === 'ru' ? colors.text : colors.textMuted }}>
                          Русский
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleSelectLanguage('en')}
                        style={({ pressed }) => [
                          {
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: radius.sm - 2,
                            backgroundColor: language === 'en' ? '#27272a' : 'transparent',
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Globe size={14} color={language === 'en' ? '#a78bfa' : colors.textMuted} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: language === 'en' ? colors.text : colors.textMuted }}>
                          English
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Layout Width Option */}
                <Text style={[styles.fieldLabel, { marginBottom: spacing.sm }]}>Ширина интерфейса на ПК</Text>
                <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl }}>
                  <Pressable
                    onPress={() => handleSelectLayoutWidth('fluid')}
                    style={({ pressed }) => [
                      styles.layoutOption,
                      layoutWidth === 'fluid' && styles.layoutOptionActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Maximize2 size={20} color={layoutWidth === 'fluid' ? '#a78bfa' : colors.textMuted} />
                    <Text style={[styles.layoutOptionTitle, layoutWidth === 'fluid' && styles.layoutOptionTitleActive]}>
                      Широкий экран (Full Width)
                    </Text>
                    <Text style={styles.layoutOptionDesc}>Заполняет всё окно без больших черных полос по бокам</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleSelectLayoutWidth('compact')}
                    style={({ pressed }) => [
                      styles.layoutOption,
                      layoutWidth === 'compact' && styles.layoutOptionActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Minimize2 size={20} color={layoutWidth === 'compact' ? '#a78bfa' : colors.textMuted} />
                    <Text style={[styles.layoutOptionTitle, layoutWidth === 'compact' && styles.layoutOptionTitleActive]}>
                      Компактный колонка
                    </Text>
                    <Text style={styles.layoutOptionDesc}>Классический центрированный столбец 880px</Text>
                  </Pressable>
                </View>

                {/* Wallpaper Preset Options */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <Text style={styles.fieldLabel}>Фоновые обои приложения</Text>
                  {wallpaper !== 'default' && (
                    <Pressable onPress={() => handleSelectWallpaper('default')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <RotateCcw size={12} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>Вернуть классический</Text>
                    </Pressable>
                  )}
                </View>

                <View style={styles.wallpaperGrid}>
                  {WALLPAPER_PRESETS.map((wp) => {
                    const active = wallpaper === wp.id;
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
                            <Text style={[styles.wallpaperTitle, active && styles.wallpaperTitleActive]}>{wp.title}</Text>
                            {active && <Check size={14} color="#a78bfa" />}
                          </View>
                          <Text style={styles.wallpaperDesc}>{wp.desc}</Text>
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
                  <BarChart3 size={18} color="#a78bfa" />
                  <Text style={styles.cardTitle}>Статистика использования</Text>
                </View>

                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{formatLargeNumber(tokenStats?.totalInput || 0)}</Text>
                    <Text style={styles.statSub}>Входные токены</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{formatLargeNumber(tokenStats?.totalOutput || 0)}</Text>
                    <Text style={styles.statSub}>Выходные токены</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{tokenStats?.totalRequests || 0}</Text>
                    <Text style={styles.statSub}>Запросов</Text>
                  </View>
                </View>

                {/* Usage Chart */}
                <Text style={[styles.fieldLabel, { marginTop: spacing.lg, marginBottom: spacing.xs }]}>График за 7 дней</Text>
                <UsageChart data={dailyStats} />

                <Pressable onPress={handleResetStats} style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}>
                  <RefreshCw size={14} color={colors.danger} />
                  <Text style={styles.resetBtnText}>Сбросить статистику</Text>
                </Pressable>
              </View>
            )}

            {activeTab === 'skills' && (
              <View style={styles.sectionCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <View style={styles.cardHeader}>
                    <Sparkles size={18} color="#a78bfa" />
                    <Text style={styles.cardTitle}>Навыки ИИ (Skills)</Text>
                  </View>
                  <Pressable
                    onPress={() => setShowAddSkill(!showAddSkill)}
                    style={{ backgroundColor: '#1e1b4b', borderColor: '#a78bfa', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill }}
                  >
                    <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: '600' }}>
                      {showAddSkill ? 'Отмена' : '+ Добавить навык'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.cardDesc}>Автономные навыки, создаваемые ИИ или вручную во время диалога</Text>

                {showAddSkill && (
                  <View style={{ backgroundColor: '#18181b', borderColor: '#27272a', borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg }}>
                    <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>Название навыка</Text>
                    <TextInput
                      style={styles.textInput}
                      value={newSkillName}
                      onChangeText={setNewSkillName}
                      placeholder="Например: deploy_app / format_json"
                      placeholderTextColor={colors.textDim}
                    />

                    <Text style={[styles.fieldLabel, { marginTop: 10, marginBottom: 6 }]}>Описание</Text>
                    <TextInput
                      style={styles.textInput}
                      value={newSkillDesc}
                      onChangeText={setNewSkillDesc}
                      placeholder="Что делает данный навык"
                      placeholderTextColor={colors.textDim}
                    />

                    <Text style={[styles.fieldLabel, { marginTop: 10, marginBottom: 6 }]}>Инструкция / Паттерн</Text>
                    <TextInput
                      style={[styles.textInput, { minHeight: 60 }]}
                      value={newSkillPattern}
                      onChangeText={setNewSkillPattern}
                      placeholder="Пошаговая инструкция для ассистента"
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
                      style={{ backgroundColor: '#a78bfa', paddingVertical: 8, borderRadius: radius.lg, alignItems: 'center', marginTop: 12 }}
                    >
                      <Text style={{ color: '#000000', fontWeight: '700', fontSize: 13 }}>Сохранить навык</Text>
                    </Pressable>
                  </View>
                )}

                {skills.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>Нет активных навыков. Вы можете добавить новый навык по кнопке выше или попросить ИИ запомнить навык во время разговора.</Text>
                  </View>
                ) : (
                  skills.map((s) => (
                    <View key={s.id || s.name} style={styles.skillRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.skillTitle}>{s.name}</Text>
                        <Text style={styles.skillDesc}>{s.description}</Text>
                        {s.pattern ? (
                          <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 4, fontFamily: 'monospace' }}>
                            Инструкция: {s.pattern.slice(0, 100)}{s.pattern.length > 100 ? '...' : ''}
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
                  <Text style={styles.cardTitle}>Разрешения и безопасность ПК</Text>
                </View>
                <Text style={styles.cardDesc}>Настройка доступа и локальной приватности ассистента на компьютере</Text>

                {/* Workspace File Access */}
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: spacing.md }}>
                    <Text style={styles.switchTitle}>Доступ к файлам проекта</Text>
                    <Text style={styles.switchDesc}>Разрешить ассистенту создавать, изменять и читать файлы кода в рабочей области на ПК</Text>
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
                    <Text style={styles.switchTitle}>Автоматический веб-поиск</Text>
                    <Text style={styles.switchDesc}>Разрешить ассистенту находить свежие новости и факты в интернете во время диалога</Text>
                  </View>
                  <Switch
                    value={true}
                    disabled
                    trackColor={{ false: '#27272a', true: '#a78bfa' }}
                    thumbColor="#ffffff"
                  />
                </View>

                <View style={{ height: 1, backgroundColor: '#27272a', marginVertical: spacing.lg }} />

                {/* Local Data Privacy */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: '#18181b', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: '#27272a' }}>
                  <Shield size={20} color="#34d399" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Локальное хранение на ПК</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 18 }}>
                      Все ваши диалоги, API-ключи и файлы проектов хранятся исключительно на вашем компьютере и не передаются на сторонние серверы аналитики.
                    </Text>
                  </View>
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
    backgroundColor: '#a78bfa',
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
