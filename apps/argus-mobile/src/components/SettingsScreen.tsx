import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  PermissionsAndroid,
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
import { Trash2, ChevronRight, BarChart3, ArrowLeft, RefreshCw, Check, X, X as XIcon, Download, ExternalLink } from 'lucide-react-native';
import { AgentSettings, LLMProvider } from '../types';
import { loadApiKey, saveApiKey, sanitizeSettings, PROVIDER_META, ALL_PROVIDERS, PROVIDER_DEFAULTS } from '../services/storage';
import { getTokenStats, getDailyStats, resetTokenStats, TokenStats, DailyRecord } from '../services/tokenStats';
import { listSkills, deleteSkill, Skill } from '../services/skills';
import { checkForUpdate, downloadAndInstallUpdate, CURRENT_BUILD } from '../services/autoUpdate';
import { UsageChart } from './UsageChart';
import { colors, motion, radius, spacing, typography } from '../styles/theme';

type Props = {
  initialSettings: AgentSettings;
  onBack: () => void;
  onSave: (settings: AgentSettings, apiKey: string) => Promise<void>;
};

const MODEL_SUGGESTIONS: Partial<Record<LLMProvider, string[]>> = {
  openai: ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4o', 'o4-mini'],
  anthropic: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-opus-4-5'],
  gemini: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  openrouter: ['openai/gpt-4o-mini', 'anthropic/claude-3-haiku', 'meta-llama/llama-3.1-8b-instruct:free'],
  ollama: ['llama3.2', 'mistral', 'qwen2.5', 'phi3', 'gemma3'],
  mistral: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
  cohere: ['command-r-plus', 'command-r', 'command-light'],
  groq: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemma2-9b-it'],
  together: ['meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo', 'mistralai/Mistral-7B-Instruct-v0.3'],
  xai: ['grok-3-mini', 'grok-3', 'grok-2-1212'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  azure: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  custom: [],
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const SettingsScreen = ({ initialSettings, onBack, onSave }: Props) => {
  const [provider, setProvider] = useState<LLMProvider>(initialSettings.provider ?? 'openai');
  const [baseUrl, setBaseUrl] = useState(initialSettings.baseUrl);
  const [model, setModel] = useState(initialSettings.model);
  const [allowAssistantContacts, setAllowAssistantContacts] = useState(initialSettings.allowAssistantContacts);
  const [apiKey, setApiKey] = useState('');
  const [azureResourceName, setAzureResourceName] = useState(initialSettings.azureResourceName ?? '');
  const [azureDeploymentId, setAzureDeploymentId] = useState(initialSettings.azureDeploymentId ?? '');
  const [azureApiVersion, setAzureApiVersion] = useState(initialSettings.azureApiVersion ?? '2024-02-01');
  const [isKeyLoaded, setIsKeyLoaded] = useState(false);
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyRecord[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showStatsDetail, setShowStatsDetail] = useState(false);
  const [permissionsStatus, setPermissionsStatus] = useState<{ group: string; key: string; label: string; granted: boolean; checked: boolean }[]>([]);
  const [modalSection, setModalSection] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<{ version?: string; size?: number; changelog?: string; url?: string } | null>(null);
  const [updateError, setUpdateError] = useState('');
  const entrance = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  const meta = PROVIDER_META[provider];
  const primaryAuth = meta.authSchemes[0];
  const supportsOAuth = meta.authSchemes.includes('oauth');
  const needsKey = primaryAuth !== 'none';
  const isAzure = provider === 'azure';

  const loadDaily = useCallback(async () => {
    const stats = await getDailyStats();
    setDailyStats(stats);
  }, []);

  const loadPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    const groups: { label: string; perms: { key: string; label: string }[] }[] = [
      {
        label: 'Микрофон и камера',
        perms: [
          { key: 'RECORD_AUDIO', label: 'Микрофон' },
          { key: 'CAMERA', label: 'Камера' },
        ],
      },
      {
        label: 'Контакты',
        perms: [
          { key: 'READ_CONTACTS', label: 'Чтение контактов' },
          { key: 'WRITE_CONTACTS', label: 'Запись контактов' },
          { key: 'GET_ACCOUNTS', label: 'Аккаунты' },
        ],
      },
      {
        label: 'Календарь',
        perms: [
          { key: 'READ_CALENDAR', label: 'Чтение календаря' },
          { key: 'WRITE_CALENDAR', label: 'Запись календаря' },
        ],
      },
      {
        label: 'Телефон',
        perms: [
          { key: 'READ_PHONE_STATE', label: 'Состояние телефона' },
          { key: 'READ_PHONE_NUMBERS', label: 'Номер телефона' },
          { key: 'CALL_PHONE', label: 'Звонки' },
          { key: 'READ_CALL_LOG', label: 'Журнал звонков' },
          { key: 'WRITE_CALL_LOG', label: 'Запись в журнал звонков' },
          { key: 'ADD_VOICEMAIL', label: 'Голосовая почта' },
          { key: 'USE_SIP', label: 'VoIP/SIP' },
          { key: 'ANSWER_PHONE_CALLS', label: 'Ответ на звонки' },
        ],
      },
      {
        label: 'SMS',
        perms: [
          { key: 'SEND_SMS', label: 'Отправка SMS' },
          { key: 'RECEIVE_SMS', label: 'Получение SMS' },
          { key: 'READ_SMS', label: 'Чтение SMS' },
          { key: 'RECEIVE_WAP_PUSH', label: 'WAP Push' },
          { key: 'RECEIVE_MMS', label: 'Получение MMS' },
        ],
      },
      {
        label: 'Хранилище и медиа',
        perms: [
          { key: 'READ_EXTERNAL_STORAGE', label: 'Внешнее хранилище (чтение)' },
          { key: 'WRITE_EXTERNAL_STORAGE', label: 'Внешнее хранилище (запись)' },
          { key: 'READ_MEDIA_IMAGES', label: 'Изображения' },
          { key: 'READ_MEDIA_VIDEO', label: 'Видео' },
          { key: 'READ_MEDIA_AUDIO', label: 'Аудио' },
        ],
      },
      {
        label: 'Геолокация',
        perms: [
          { key: 'ACCESS_FINE_LOCATION', label: 'Точное местоположение' },
          { key: 'ACCESS_COARSE_LOCATION', label: 'Приблизительное местоположение' },
          { key: 'ACCESS_BACKGROUND_LOCATION', label: 'Фоновое местоположение' },
        ],
      },
      {
        label: 'Bluetooth и сеть',
        perms: [
          { key: 'BLUETOOTH', label: 'Bluetooth' },
          { key: 'BLUETOOTH_ADMIN', label: 'Bluetooth (управление)' },
          { key: 'BLUETOOTH_ADVERTISE', label: 'Bluetooth (реклама)' },
          { key: 'BLUETOOTH_CONNECT', label: 'Bluetooth (подключение)' },
          { key: 'BLUETOOTH_SCAN', label: 'Bluetooth (сканирование)' },
          { key: 'ACCESS_WIFI_STATE', label: 'Состояние WiFi' },
          { key: 'CHANGE_WIFI_STATE', label: 'Изменение WiFi' },
          { key: 'INTERNET', label: 'Интернет' },
          { key: 'ACCESS_NETWORK_STATE', label: 'Состояние сети' },
          { key: 'CHANGE_NETWORK_STATE', label: 'Изменение сети' },
        ],
      },
      {
        label: 'Уведомления',
        perms: [
          { key: 'POST_NOTIFICATIONS', label: 'Уведомления' },
        ],
      },
      {
        label: 'Датчики и активность',
        perms: [
          { key: 'BODY_SENSORS', label: 'Датчики тела' },
          { key: 'ACTIVITY_RECOGNITION', label: 'Распознавание активности' },
        ],
      },
      {
        label: 'Другие',
        perms: [
          { key: 'VIBRATE', label: 'Вибрация' },
          { key: 'WAKE_LOCK', label: 'Блокировка сна' },
          { key: 'SYSTEM_ALERT_WINDOW', label: 'Поверх других окон' },
          { key: 'REQUEST_INSTALL_PACKAGES', label: 'Установка пакетов' },
        ],
      },
    ];
    const flat: { group: string; key: string; label: string; granted: boolean; checked: boolean }[] = [];
    for (const g of groups) {
      for (const perm of g.perms) {
        try {
          const permissionConst = (PermissionsAndroid.PERMISSIONS as any)[perm.key];
          if (!permissionConst) continue;
          const granted = await PermissionsAndroid.check(permissionConst);
          flat.push({ group: g.label, ...perm, granted, checked: true });
        } catch {
          /* permission not available on this API level */
        }
      }
    }
    setPermissionsStatus(flat);
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  useEffect(() => {
    let mounted = true;
    Animated.timing(entrance, {
      duration: motion.slow,
      toValue: 1,
      useNativeDriver: true,
    }).start();

    loadApiKey(provider)
      .then((key) => {
        if (mounted) { setApiKey(key); setIsKeyLoaded(true); }
      })
      .catch(() => { if (mounted) setIsKeyLoaded(true); });

    getTokenStats().then((stats) => {
      if (mounted) setTokenStats(stats);
    });

    listSkills().then((s) => { if (mounted) setSkills(s); });

    return () => { mounted = false; };
  }, [entrance]);

  // При смене провайдера — перезагружаем ключ
  useEffect(() => {
    setIsKeyLoaded(false);
    loadApiKey(provider).then((key) => {
      setApiKey(key);
      setIsKeyLoaded(true);
    });
  }, [provider]);

  const openModal = (section: string) => {
    setModalSection(section);
    modalScale.setValue(0.85);
    modalOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(modalScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 16,
        stiffness: 250,
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(modalScale, {
        toValue: 0.85,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => setModalSection(null));
  };

  const endpointPreview = useMemo(() => {
    if (isAzure && azureResourceName && azureDeploymentId) {
      return `https://${azureResourceName}.openai.azure.com/openai/deployments/${azureDeploymentId}/chat/completions?api-version=${azureApiVersion || '2024-02-01'}`;
    }
    const normalized = baseUrl.trim().replace(/\/+$/, '');
    return normalized ? `${normalized}/v1/chat/completions` : 'Base URL не задан';
  }, [baseUrl, isAzure, azureResourceName, azureDeploymentId, azureApiVersion]);

  const handleProviderChange = (newProvider: LLMProvider) => {
    setProvider(newProvider);
    const m = PROVIDER_META[newProvider];
    setBaseUrl(m.baseUrl);
    setModel(m.model);
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      const settings = sanitizeSettings({
        provider,
        baseUrl,
        model,
        allowAssistantContacts,
        azureResourceName: azureResourceName || undefined,
        azureDeploymentId: azureDeploymentId || undefined,
        azureApiVersion: azureApiVersion || undefined,
      });
      if (!isAzure && (!settings.baseUrl.trim() || !settings.model.trim())) return;
      await saveApiKey(apiKey, provider);
      await onSave(settings, apiKey.trim());
    }, 600);
    return () => clearTimeout(timer);
  }, [provider, baseUrl, model, apiKey, allowAssistantContacts, azureResourceName, azureDeploymentId, azureApiVersion]);

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

  const handleCheckUpdate = useCallback(async () => {
    setUpdateStatus('checking');
    setUpdateError('');
    try {
      const result = await checkForUpdate();
      if (result.hasUpdate) {
        setUpdateInfo({ version: result.version, size: result.size, changelog: result.changelog, url: result.url });
        setUpdateStatus('available');
      } else {
        setUpdateInfo(null);
        if (result.error) {
          setUpdateError(result.error);
          setUpdateStatus('error');
        } else {
          setUpdateStatus('idle');
          Alert.alert('Обновлений нет', result.info || 'У вас актуальная версия.');
        }
      }
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : 'Ошибка проверки');
      setUpdateStatus('error');
    }
  }, []);

  const handleDownloadUpdate = useCallback(async () => {
    if (!updateInfo?.url) return;
    setUpdateStatus('downloading');
    setUpdateError('');
    try {
      await downloadAndInstallUpdate(updateInfo.url);
      setUpdateStatus('downloaded');
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : 'Ошибка загрузки');
      setUpdateStatus('error');
    }
  }, [updateInfo]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

  const authSchemeLabel = (scheme: string) => {
    switch (scheme) {
      case 'apiKey': return 'API Key';
      case 'oauth': return 'OAuth 2.0';
      case 'none': return 'Без авторизации';
      case 'azure': return 'Azure API Key';
      default: return scheme;
    }
  };

  const renderModalContent = () => {
    switch (modalSection) {
      case 'provider':
        return (
          <>
            <Text style={styles.modalTitle}>ПРОВАЙДЕР</Text>
            <View style={styles.card}>
              {ALL_PROVIDERS.map((p, index) => {
                const m = PROVIDER_META[p];
                return (
                  <View key={p}>
                    {index > 0 && <View style={styles.divider} />}
                    <Pressable
                      onPress={() => handleProviderChange(p)}
                      style={({ pressed }) => [styles.providerRow, pressed && styles.pressed]}
                    >
                      <View style={styles.providerRowLeft}>
                        <View style={[styles.providerDot, provider === p && styles.providerDotActive]} />
                        <View>
                          <Text style={[styles.providerLabel, provider === p && styles.providerLabelActive]}>
                            {m.label}
                          </Text>
                          <Text style={styles.providerAuthHint}>
                            {m.authSchemes.map(authSchemeLabel).join(' / ')}
                          </Text>
                        </View>
                      </View>
                      {provider === p && <Check size={16} color={colors.success} />}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </>
        );

      case 'connection':
        return (
          <>
            <Text style={styles.modalTitle}>ПОДКЛЮЧЕНИЕ</Text>

            {/* Auth section */}
            <View style={styles.card}>
              {/* Auth scheme badge */}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Авторизация</Text>
                <View style={styles.authBadgeRow}>
                  {meta.authSchemes.map((scheme) => (
                    <View key={scheme} style={styles.authBadge}>
                      <Text style={styles.authBadgeText}>{authSchemeLabel(scheme)}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* API Key field */}
              {needsKey && !isAzure && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <View style={styles.fieldLabelRow}>
                      <Text style={styles.fieldLabel}>API Key</Text>
                      {meta.keyUrl && (
                        <Pressable
                          onPress={() => Linking.openURL(meta.keyUrl!)}
                          hitSlop={8}
                          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                        >
                          <ExternalLink size={13} color={colors.accent} />
                        </Pressable>
                      )}
                    </View>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={setApiKey}
                      placeholder={isKeyLoaded ? (meta.keyHint ?? 'токен...') : 'Загружается…'}
                      placeholderTextColor={colors.textDim}
                      secureTextEntry
                      style={styles.fieldInput}
                      value={apiKey}
                    />
                    {meta.authHeader && (
                      <Text style={styles.fieldHint}>
                        Передаётся как: <Text style={{ color: colors.textMuted }}>{meta.authHeader}{meta.authHeader === 'Authorization' ? ': Bearer …' : ': …'}</Text>
                      </Text>
                    )}
                    {meta.keyAsQuery && (
                      <Text style={styles.fieldHint}>
                        Передаётся как query: <Text style={{ color: colors.textMuted }}>?{meta.keyAsQuery}=…</Text>
                      </Text>
                    )}
                    {primaryAuth === 'none' && (
                      <Text style={styles.fieldHint}>Авторизация не требуется</Text>
                    )}
                  </View>
                </>
              )}

              {/* OAuth hint */}
              {supportsOAuth && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>OAuth 2.0</Text>
                    <Text style={styles.fieldHint}>
                      Поддерживается. Для OAuth вставь access token в поле API Key выше.
                    </Text>
                  </View>
                </>
              )}

              {/* Azure-specific fields */}
              {isAzure && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>API Key</Text>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={setApiKey}
                      placeholder="ваш Azure API ключ"
                      placeholderTextColor={colors.textDim}
                      secureTextEntry
                      style={styles.fieldInput}
                      value={apiKey}
                    />
                    <Text style={styles.fieldHint}>Передаётся как: <Text style={{ color: colors.textMuted }}>api-key: …</Text></Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Resource Name</Text>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={setAzureResourceName}
                      placeholder="my-resource"
                      placeholderTextColor={colors.textDim}
                      style={styles.fieldInput}
                      value={azureResourceName}
                    />
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Deployment ID</Text>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={setAzureDeploymentId}
                      placeholder="gpt-4o"
                      placeholderTextColor={colors.textDim}
                      style={styles.fieldInput}
                      value={azureDeploymentId}
                    />
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>API Version</Text>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={setAzureApiVersion}
                      placeholder="2024-02-01"
                      placeholderTextColor={colors.textDim}
                      style={styles.fieldInput}
                      value={azureApiVersion}
                    />
                  </View>
                </>
              )}
            </View>

            <View style={styles.cardGap} />

            {/* Base URL (not for Azure) */}
            {!isAzure && (
              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Base URL</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    onChangeText={setBaseUrl}
                    placeholder={PROVIDER_DEFAULTS[provider].baseUrl || 'https://...'}
                    placeholderTextColor={colors.textDim}
                    style={styles.fieldInput}
                    value={baseUrl}
                  />
                  <Text style={styles.fieldHint}>{endpointPreview}</Text>
                </View>
              </View>
            )}

            {isAzure && (
              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Endpoint preview</Text>
                  <Text style={[styles.fieldHint, { fontFamily: 'monospace' }]}>{endpointPreview}</Text>
                </View>
              </View>
            )}

            <View style={styles.cardGap} />

            <View style={styles.card}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Модель</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setModel}
                  placeholder={PROVIDER_DEFAULTS[provider].model || 'model-name'}
                  placeholderTextColor={colors.textDim}
                  style={styles.fieldInput}
                  value={model}
                />
                {(MODEL_SUGGESTIONS[provider]?.length ?? 0) > 0 && (
                  <View style={styles.chipRow}>
                    {(MODEL_SUGGESTIONS[provider] ?? []).map((item) => (
                      <Pressable
                        key={item}
                        onPress={() => setModel(item)}
                        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                      >
                        <Text style={styles.chipText}>{item}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </>
        );

      case 'permissions':
        return (
          <>
            <Text style={styles.modalTitle}>РАЗРЕШЕНИЯ</Text>
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

            <View style={styles.cardGap} />

            <View style={styles.card}>
              <View style={styles.permissionsHeader}>
                <Text style={styles.fieldLabel}>Разрешения Android</Text>
                <Pressable
                  onPress={loadPermissions}
                  style={({ pressed }) => [styles.permissionsRefresh, pressed && { opacity: 0.6 }]}
                  hitSlop={8}
                >
                  <RefreshCw size={16} color={colors.textMuted} />
                </Pressable>
              </View>
              <View style={styles.divider} />
              {permissionsStatus.length === 0 ? (
                <View style={{ padding: spacing.xl }}>
                  <Text style={styles.fieldHint}>Проверка разрешений…</Text>
                </View>
              ) : (
                (() => {
                  const groups = new Map<string, typeof permissionsStatus>();
                  for (const p of permissionsStatus) {
                    const arr = groups.get(p.group) || [];
                    arr.push(p);
                    groups.set(p.group, arr);
                  }
                  const entries = Array.from(groups.entries()).filter(([, perms]) => perms.length > 0);
                  return entries.map(([groupName, perms], gi) => (
                    <View key={groupName}>
                      {gi > 0 && <View style={styles.divider} />}
                      <Text style={styles.permissionGroupLabel}>{groupName}</Text>
                      {perms.map((perm, pi) => (
                        <View key={perm.key}>
                          {pi > 0 && <View style={styles.permissionDivider} />}
                          <View style={styles.permissionRow}>
                            <Text style={styles.permissionLabel}>{perm.label}</Text>
                            <View style={styles.permissionBadge}>
                              {perm.granted ? (
                                <Check size={14} color={colors.success} />
                              ) : (
                                <X size={14} color={colors.danger} />
                              )}
                              <Text style={[styles.permissionStatus, perm.granted ? styles.grantedText : styles.deniedText]}>
                                {perm.granted ? 'Вкл' : 'Выкл'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  ));
                })()
              )}
            </View>
          </>
        );

      case 'stats':
        return tokenStats ? (
          <>
            <Text style={styles.modalTitle}>СТАТИСТИКА</Text>
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
                onPress={() => { closeModal(); openStatsDetail(); }}
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
          </>
        ) : null;

      case 'update':
        return (
          <>
            <Text style={styles.modalTitle}>ОБНОВЛЕНИЕ</Text>
            <View style={styles.card}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Текущая версия</Text>
                <Text style={{ color: colors.text, fontSize: typography.body }}>build {CURRENT_BUILD}</Text>
                <Text style={styles.fieldHint}>Проверяет релизы GitHub</Text>
              </View>
              <View style={styles.divider} />
              {updateStatus === 'checking' && (
                <View style={styles.fieldRow}>
                  <Text style={{ color: colors.textMuted }}>Проверка обновлений…</Text>
                </View>
              )}
              {updateStatus === 'idle' && (
                <Pressable
                  onPress={handleCheckUpdate}
                  style={({ pressed }) => [styles.nestedRow, pressed && styles.pressed]}
                >
                  <View style={styles.nestedRowLeft}>
                    <RefreshCw size={16} color={colors.textMuted} />
                    <Text style={styles.nestedRowText}>Проверить обновления</Text>
                  </View>
                </Pressable>
              )}
              {updateStatus === 'available' && updateInfo && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Доступно</Text>
                    <Text style={{ color: colors.success, fontSize: typography.body, fontWeight: '600' }}>{updateInfo.version}</Text>
                    {updateInfo.size ? <Text style={styles.fieldHint}>{formatFileSize(updateInfo.size)}</Text> : null}
                    {updateInfo.changelog ? <Text style={styles.fieldHint}>{updateInfo.changelog}</Text> : null}
                  </View>
                  <View style={styles.divider} />
                  <Pressable
                    onPress={handleDownloadUpdate}
                    style={({ pressed }) => [styles.nestedRow, pressed && styles.pressed]}
                  >
                    <View style={styles.nestedRowLeft}>
                      <Download size={16} color={colors.accent} />
                      <Text style={[styles.nestedRowText, { color: colors.accent }]}>Скачать и установить</Text>
                    </View>
                  </Pressable>
                </>
              )}
              {updateStatus === 'downloading' && (
                <View style={styles.fieldRow}>
                  <Text style={{ color: colors.textMuted }}>Загрузка…</Text>
                </View>
              )}
              {updateStatus === 'downloaded' && (
                <View style={styles.fieldRow}>
                  <Text style={{ color: colors.success }}>APK скачан. Откройте файл для установки.</Text>
                </View>
              )}
              {updateStatus === 'error' && (
                <View style={styles.fieldRow}>
                  <Text style={{ color: colors.danger }}>{updateError || 'Ошибка'}</Text>
                  <Pressable
                    onPress={handleCheckUpdate}
                    style={({ pressed }) => [styles.nestedRow, pressed && styles.pressed]}
                  >
                    <Text style={[styles.nestedRowText, { color: colors.accent }]}>Повторить</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </>
        );

      case 'skills':
        return (
          <>
            <Text style={styles.modalTitle}>СКИЛЛЫ</Text>
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
          </>
        );

      default:
        return null;
    }
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
          {/* Provider badge */}
          <Pressable
            onPress={() => openModal('provider')}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          >
            <Text style={styles.menuItemLabel}>ПРОВАЙДЕР</Text>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuItemBadge}>{PROVIDER_META[provider].label}</Text>
              <ChevronRight size={16} color={colors.textDim} />
            </View>
          </Pressable>

          {/* Section: Подключение */}
          <Pressable
            onPress={() => openModal('connection')}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          >
            <Text style={styles.menuItemLabel}>ПОДКЛЮЧЕНИЕ</Text>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuItemBadge}>
                {meta.authSchemes.map(authSchemeLabel).join(' / ')}
              </Text>
              <ChevronRight size={16} color={colors.textDim} />
            </View>
          </Pressable>

          {/* Section: Разрешения */}
          <Pressable
            onPress={() => openModal('permissions')}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          >
            <Text style={styles.menuItemLabel}>РАЗРЕШЕНИЯ</Text>
            <ChevronRight size={16} color={colors.textDim} />
          </Pressable>

          {/* Section: Статистика */}
          {tokenStats && (
            <Pressable
              onPress={() => openModal('stats')}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <Text style={styles.menuItemLabel}>СТАТИСТИКА</Text>
              <ChevronRight size={16} color={colors.textDim} />
            </Pressable>
          )}

          {/* Section: Скиллы */}
          <Pressable
            onPress={() => openModal('skills')}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          >
            <Text style={styles.menuItemLabel}>СКИЛЛЫ</Text>
            <ChevronRight size={16} color={colors.textDim} />
          </Pressable>

          {/* Section: Обновление */}
          <Pressable
            onPress={() => { setUpdateStatus('idle'); setUpdateInfo(null); setUpdateError(''); openModal('update'); }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          >
            <Text style={styles.menuItemLabel}>ОБНОВЛЕНИЕ</Text>
            <ChevronRight size={16} color={colors.textDim} />
          </Pressable>

          <View style={{ height: spacing.xxl }} />
        </Animated.ScrollView>

        {/* Section Modal */}
        {modalSection && (
          <Animated.View
            style={[
              styles.modalOverlay,
              { opacity: modalOpacity },
            ]}
            pointerEvents="box-none"
          >
            <Pressable style={styles.modalBackdrop} onPress={closeModal} />
            <Animated.View
              style={[
                styles.modalCard,
                { transform: [{ scale: modalScale }] },
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={{ width: 32 }} />
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={closeModal}
                  style={({ pressed }) => [styles.modalCloseBtn, pressed && styles.pressed]}
                  hitSlop={12}
                >
                  <XIcon size={20} color={colors.textMuted} />
                </Pressable>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.modalContent}
              >
                {renderModalContent()}
              </ScrollView>
            </Animated.View>
          </Animated.View>
        )}
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

  /* Menu items */
  menuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  menuItemLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '500',
  },
  menuItemRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  menuItemBadge: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },

  /* Modal */
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl + 4,
    elevation: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    width: '92%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  modalCloseBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  modalTitle: {
    color: colors.textDim,
    fontSize: typography.caption,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalContent: {
    padding: spacing.xl,
    paddingTop: 0,
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

  /* Provider picker */
  providerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  providerRowLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    flex: 1,
  },
  providerDot: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 10,
    width: 10,
  },
  providerDotActive: {
    backgroundColor: colors.success,
  },
  providerLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  providerLabelActive: {
    color: colors.text,
    fontWeight: '600',
  },
  providerAuthHint: {
    color: colors.textDim,
    fontSize: typography.caption - 1,
    marginTop: 2,
  },

  /* Auth badges */
  authBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  authBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  authBadgeText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
  },

  /* Field label row with link */
  fieldLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
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

  /* Permissions */
  permissionsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  permissionsRefresh: {
    padding: spacing.xs,
  },
  permissionGroupLabel: {
    color: colors.textDim,
    fontSize: typography.caption,
    fontWeight: '600',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  permissionDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.xl,
  },
  permissionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  permissionLabel: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  permissionBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  permissionStatus: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
  grantedText: {
    color: colors.success,
  },
  deniedText: {
    color: colors.danger,
  },
});
