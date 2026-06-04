import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
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
import { Trash2, ChevronDown, ChevronRight, BarChart3, ArrowLeft } from 'lucide-react-native';
import { AgentSettings } from '../types';
import { loadApiKey, saveApiKey, sanitizeSettings } from '../services/storage';
import { getTokenStats, getDailyStats, resetTokenStats, TokenStats, DailyRecord } from '../services/tokenStats';
import { listSkills, deleteSkill, Skill } from '../services/skills';
import { UsageChart } from './UsageChart';
import { colors, motion, radius, spacing, typography } from '../styles/theme';

type Props = {
  initialSettings: AgentSettings;
  onBack: () => void;
  onSave: (settings: AgentSettings, apiKey: string) => Promise<void>;
};

const SECTIONS_STATE_KEY = '@settings_sections_state';
const MODEL_SUGGESTIONS = ['gpt-4.1-mini', 'gpt-4o-mini', 'qwen/qwen3-coder'];

type SectionsState = {
  connectionExpanded: boolean;
  statsExpanded: boolean;
  skillsExpanded: boolean;
};

export const SettingsScreen = ({ initialSettings, onBack, onSave }: Props) => {
  const [baseUrl, setBaseUrl] = useState(initialSettings.baseUrl);
  const [model, setModel] = useState(initialSettings.model);
  const [allowAssistantContacts, setAllowAssistantContacts] = useState(initialSettings.allowAssistantContacts);
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isKeyLoaded, setIsKeyLoaded] = useState(false);
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyRecord[]>([]);
  const [connectionExpanded, setConnectionExpanded] = useState(true);
  const [statsExpanded, setStatsExpanded] = useState(true);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showStatsDetail, setShowStatsDetail] = useState(false);
  const entrance = useRef(new Animated.Value(0)).current;

  const loadDaily = useCallback(async () => {
    const stats = await getDailyStats();
    setDailyStats(stats);
  }, []);

  useEffect(() => {
    let mounted = true;
    Animated.timing(entrance, {
      duration: motion.slow,
      toValue: 1,
      useNativeDriver: true,
    }).start();

    loadApiKey()
      .then((key) => {
        if (mounted) { setApiKey(key); setIsKeyLoaded(true); }
      })
      .catch(() => { if (mounted) setIsKeyLoaded(true); });

    getTokenStats().then((stats) => {
      if (mounted) setTokenStats(stats);
    });

    listSkills().then((s) => { if (mounted) setSkills(s); });

    AsyncStorage.getItem(SECTIONS_STATE_KEY).then((raw) => {
      if (!mounted) return;
      if (raw) {
        try {
          const saved = JSON.parse(raw) as SectionsState;
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setConnectionExpanded(saved.connectionExpanded);
          setStatsExpanded(saved.statsExpanded);
          setSkillsExpanded(saved.skillsExpanded);
        } catch { /* ignore */ }
      }
      setSectionsLoaded(true);
    });

    return () => { mounted = false; };
  }, [entrance]);

  useEffect(() => {
    if (!sectionsLoaded) return;
    AsyncStorage.setItem(SECTIONS_STATE_KEY, JSON.stringify({
      connectionExpanded,
      statsExpanded,
      skillsExpanded,
    }));
  }, [connectionExpanded, statsExpanded, skillsExpanded, sectionsLoaded]);

  const endpointPreview = useMemo(() => {
    const normalized = baseUrl.trim().replace(/\/+$/, '');
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
      Alert.alert('Нужна модель', 'Укажи имя модели.');
      return;
    }

    setIsSaving(true);
    try {
      await saveApiKey(apiKey);
      await onSave(settings, apiKey.trim());
      Alert.alert('Готово', 'Настройки сохранены.', [{ text: 'OK', onPress: onBack }]);
    } catch (error) {
      Alert.alert('Ошибка', error instanceof Error ? error.message : 'Неизвестная ошибка');
    } finally {
      setIsSaving(false);
    }
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

  const toggleSection = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter((prev) => !prev);
  };

  const handleDeleteSkill = useCallback(async (id: string) => {
    await deleteSkill(id);
    const updated = await listSkills();
    setSkills(updated);
  }, []);

  const formatLargeNumber = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : String(n);

  const openStatsDetail = () => {
    setShowStatsDetail(true);
    loadDaily();
  };

  const closeStatsDetail = () => {
    setShowStatsDetail(false);
  };

  // ── Detail View (Chart) ──
  if (showStatsDetail) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={closeStatsDetail}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>График использования</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <UsageChart data={dailyStats} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main Settings View ──
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Настройки</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Animated.ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}
        >
          {/* Section: Подключение */}
          <Pressable
            onPress={() => toggleSection(setConnectionExpanded)}
            style={styles.sectionHeaderRow}
          >
            {connectionExpanded ? <ChevronDown size={14} color={colors.textDim} /> : <ChevronRight size={14} color={colors.textDim} />}
            <Text style={styles.sectionHeader}>ПОДКЛЮЧЕНИЕ</Text>
          </Pressable>
          {connectionExpanded && (
            <>
              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Base URL</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    onChangeText={setBaseUrl}
                    placeholder="https://api.openai.com"
                    placeholderTextColor={colors.textDim}
                    style={styles.fieldInput}
                    value={baseUrl}
                  />
                  <Text style={styles.fieldHint}>{endpointPreview}</Text>
                </View>
              </View>

              <View style={styles.cardGap} />

              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Модель</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={setModel}
                    placeholder="your-model-name"
                    placeholderTextColor={colors.textDim}
                    style={styles.fieldInput}
                    value={model}
                  />
                  <View style={styles.chipRow}>
                    {MODEL_SUGGESTIONS.map((item) => (
                      <Pressable
                        key={item}
                        onPress={() => setModel(item)}
                        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                      >
                        <Text style={styles.chipText}>{item}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.cardGap} />

              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>API Key</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={setApiKey}
                    placeholder={isKeyLoaded ? 'sk-...' : 'Загружается…'}
                    placeholderTextColor={colors.textDim}
                    secureTextEntry
                    style={styles.fieldInput}
                    value={apiKey}
                  />
                  <Text style={styles.fieldHint}>Оставь пустым, если endpoint не требует ключ.</Text>
                </View>
              </View>
              <View style={styles.cardGap} />

              <View style={styles.card}>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleTextBlock}>
                    <Text style={styles.fieldLabel}>Разрешать ассистенту доступ к контактам</Text>
                    <Text style={styles.fieldHint}>Выключено по умолчанию. Даже при включении номера и звонки/SMS требуют отдельного подтверждения.</Text>
                  </View>
                  <Switch
                    onValueChange={setAllowAssistantContacts}
                    value={allowAssistantContacts}
                    trackColor={{ false: colors.surfaceMuted, true: colors.success }}
                    thumbColor={colors.text}
                  />
                </View>
              </View>
            </>
          )}

          {/* Section: Статистика */}
          {tokenStats && (
            <>
              <Pressable
                onPress={() => toggleSection(setStatsExpanded)}
                style={styles.sectionHeaderRow}
              >
                {statsExpanded ? <ChevronDown size={14} color={colors.textDim} /> : <ChevronRight size={14} color={colors.textDim} />}
                <Text style={styles.sectionHeader}>СТАТИСТИКА</Text>
              </Pressable>
              {statsExpanded && (
                <View style={styles.card}>
                  <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{formatLargeNumber(tokenStats.totalInput)}</Text>
                      <Text style={styles.statLabel}>входных</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{formatLargeNumber(tokenStats.totalOutput)}</Text>
                      <Text style={styles.statLabel}>выходных</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{formatLargeNumber(tokenStats.totalInput + tokenStats.totalOutput)}</Text>
                      <Text style={styles.statLabel}>всего</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{tokenStats.totalRequests}</Text>
                      <Text style={styles.statLabel}>запросов</Text>
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <Pressable
                    onPress={openStatsDetail}
                    style={({ pressed }) => [styles.nestedRow, pressed && styles.pressed]}
                  >
                    <View style={styles.nestedRowLeft}>
                      <BarChart3 size={16} color={colors.textMuted} />
                      <Text style={styles.nestedRowText}>График использования</Text>
                    </View>
                    <ChevronRight size={14} color={colors.textDim} />
                  </Pressable>
                  <View style={styles.divider} />
                  <Pressable
                    onPress={handleResetStats}
                    style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.resetBtnText}>Сбросить статистику</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}

          {/* Section: Скиллы */}
          <Pressable
            onPress={() => toggleSection(setSkillsExpanded)}
            style={styles.sectionHeaderRow}
          >
            {skillsExpanded ? <ChevronDown size={14} color={colors.textDim} /> : <ChevronRight size={14} color={colors.textDim} />}
            <Text style={styles.sectionHeader}>СКИЛЛЫ</Text>
          </Pressable>
          {skillsExpanded && (
            <View style={styles.card}>
              {skills.length === 0 ? (
                <View style={styles.emptySkillsBox}>
                  <Text style={styles.emptySkillsTitle}>Нет сохранённых скиллов</Text>
                  <Text style={styles.emptySkillsText}>Скиллы создаются автоматически, когда AI решает сложные задачи.</Text>
                </View>
              ) : (
                skills.map((skill, index) => (
                  <View key={skill.id}>
                    {index > 0 && <View style={styles.divider} />}
                    <View style={styles.skillRow}>
                      <View style={styles.skillInfo}>
                        <Text style={styles.skillName}>{skill.name}</Text>
                        <Text style={styles.skillDesc}>{skill.description}</Text>
                        <View style={styles.skillMeta}>
                          <Text style={styles.skillMetaText}>использован {skill.usageCount} раз</Text>
                          {skill.triggerKeywords.length > 0 && (
                            <Text style={styles.skillMetaText}> · {skill.triggerKeywords.slice(0, 3).join(', ')}</Text>
                          )}
                        </View>
                      </View>
                      <Pressable
                        onPress={() => {
                          Alert.alert('Удалить скилл', `Удалить «${skill.name}»?`, [
                            { text: 'Отмена', style: 'cancel' },
                            { text: 'Удалить', style: 'destructive', onPress: () => handleDeleteSkill(skill.id) },
                          ]);
                        }}
                        style={({ pressed }) => [styles.skillDeleteBtn, pressed && styles.skillDeleteBtnPressed]}
                        hitSlop={10}
                      >
                        <Trash2 size={16} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          <View style={styles.footerSpace} />
        </Animated.ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && styles.saveBtnPressed,
              isSaving && styles.disabled,
            ]}
          >
            <Text style={styles.saveBtnText}>
              {isSaving ? 'Сохранение…' : 'Сохранить'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    flex: 1,
  },

  /* Header */
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  backBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  backIcon: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '400',
  },
  pressed: {
    opacity: 0.55,
  },
  headerTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 38,
  },

  /* Content */
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },

  /* Section */
  sectionHeader: {
    color: colors.textDim,
    fontSize: typography.caption,
    fontWeight: '600',
    letterSpacing: 0.8,
  },

  /* Card */
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  cardGap: {
    height: spacing.md,
  },
  divider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
  },

  /* Field row */
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  toggleTextBlock: {
    flex: 1,
  },
  fieldRow: {
    padding: spacing.xl,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  fieldInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: typography.body,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  fieldHint: {
    color: colors.textDim,
    fontSize: typography.caption,
    lineHeight: 17,
    marginTop: spacing.md,
  },

  /* Chips */
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '500',
  },

  /* Stats */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.xl,
  },
  statItem: {
    alignItems: 'center',
    flexBasis: '50%',
    paddingVertical: spacing.md,
  },
  statValue: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  statDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.xl,
    width: '100%',
  },
  resetBtn: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  resetBtnText: {
    color: colors.textDim,
    fontSize: typography.caption,
    fontWeight: '500',
  },

  /* Section header row (collapsible) */
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },

  /* Nested row */
  nestedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  nestedRowLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  nestedRowText: {
    color: colors.textMuted,
    fontSize: typography.body,
  },

  /* Skills */
  emptySkillsBox: {
    padding: spacing.xl,
  },
  emptySkillsTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptySkillsText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  skillRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  skillInfo: {
    flex: 1,
  },
  skillName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  skillDesc: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  skillMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  skillMetaText: {
    color: colors.textDim,
    fontSize: typography.caption,
  },
  skillDeleteBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  skillDeleteBtnPressed: {
    backgroundColor: colors.dangerSoft,
  },

  /* Footer */
  footerSpace: {
    height: spacing.xxl,
  },
  footer: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
  },
  saveBtn: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.xxl,
    justifyContent: 'center',
    minHeight: 52,
  },
  saveBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
  saveBtnText: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: '700',
  },
});
