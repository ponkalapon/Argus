import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  LayoutAnimation,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, ChevronRight, ChevronDown, BarChart3, ArrowLeft, RefreshCw, Check, X, X as XIcon, Download, Shield, ShieldCheck, ShieldOff } from 'lucide-react-native';
import { AgentSettings, ApiFormat } from '../types';
import { loadApiKey, saveApiKey, sanitizeSettings } from '../services/storage';
import { getTokenStats, getDailyStats, resetTokenStats, TokenStats, DailyRecord } from '../services/tokenStats';
import { listSkills, deleteSkill, Skill } from '../services/skills';
import { checkForUpdate, downloadAndInstallUpdate, CURRENT_VERSION } from '../services/autoUpdate';
import { UsageChart } from './UsageChart';
import { colors, fontFamily, motion, radius, spacing, typography } from '../styles/theme';
import { t } from '../i18n';

type Props = {
  initialSettings: AgentSettings;
  onBack: () => void;
  onSave: (settings: AgentSettings, apiKey: string) => Promise<void>;
};

const MODEL_SUGGESTIONS = ['gpt-4.1-mini', 'gpt-4o-mini', 'qwen/qwen3-coder'];

type Provider = {
  id: string;
  name: string;
  baseUrl: string;
  auth: 'api_key' | 'token' | 'none';
  models: string[];
  description: string;
  apiFormat?: ApiFormat;
};

const PROVIDERS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    auth: 'api_key',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3-mini', 'gpt-4-turbo', 'gpt-4'],
    description: 'settings.providers.openai',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api',
    auth: 'api_key',
    models: ['anthropic/claude-sonnet-4', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash', 'meta-llama/llama-4-maverick', 'deepseek/deepseek-r1', 'qwen/qwen3-coder', 'openai/gpt-4o-mini'],
    description: 'settings.providers.openrouter',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    auth: 'api_key',
    models: ['claude-sonnet-4', 'claude-3.5-sonnet', 'claude-3.5-haiku', 'claude-3-opus', 'claude-3-haiku'],
    description: 'settings.providers.anthropic',
  },
  {
    id: 'google',
    name: 'Google AI (Gemini)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    auth: 'api_key',
    models: ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    description: 'settings.providers.google',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    auth: 'api_key',
    models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
    description: 'settings.providers.deepseek',
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai',
    auth: 'api_key',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    description: 'settings.providers.groq',
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    auth: 'api_key',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen3-235B-A22B', 'deepseek-ai/DeepSeek-V3', 'google/gemma-2-27b-it'],
    description: 'settings.providers.together',
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    auth: 'api_key',
    models: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/deepseek-v3', 'accounts/fireworks/models/qwen3-235b-a22b'],
    description: 'settings.providers.fireworks',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    auth: 'api_key',
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest', 'pixtral-large-latest'],
    description: 'settings.providers.mistral',
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    auth: 'api_key',
    models: ['grok-3', 'grok-3-mini', 'grok-2'],
    description: 'settings.providers.xai',
  },
  {
    id: 'zhipu',
    name: 'Zhipu AI (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    auth: 'token',
    models: ['glm-4-plus', 'glm-4-flash', 'glm-4-long'],
    description: 'settings.providers.zhipu',
  },
  {
    id: 'qwen-dashscope',
    name: 'Alibaba (DashScope)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    auth: 'api_key',
    models: ['qwen3-235b-a22b', 'qwen-turbo-latest', 'qwen-plus-latest', 'qwen-max-latest'],
    description: 'settings.providers.qwen-dashscope',
  },
  {
    id: 'sambanova',
    name: 'SambaNova',
    baseUrl: 'https://api.sambanova.ai/v1',
    auth: 'api_key',
    models: ['Meta-Llama-3.3-70B-Instruct', 'DeepSeek-V3-0324'],
    description: 'settings.providers.sambanova',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    auth: 'api_key',
    models: ['llama-3.3-70b', 'llama-3.1-8b'],
    description: 'settings.providers.cerebras',
  },
  {
    id: 'openai-compat',
    name: 'Custom',
    baseUrl: '',
    auth: 'api_key',
    models: [],
    description: 'settings.providers.custom',
    apiFormat: 'openai' as const,
  },
];
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const SettingsScreen = ({ initialSettings, onBack, onSave }: Props) => {
  const [baseUrl, setBaseUrl] = useState(initialSettings.baseUrl);
  const [model, setModel] = useState(initialSettings.model);
  const [allowAssistantContacts, setAllowAssistantContacts] = useState(initialSettings.allowAssistantContacts);
  const [apiKey, setApiKey] = useState('');
  const [isKeyLoaded, setIsKeyLoaded] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [showProviders, setShowProviders] = useState(false);
  const [apiFormat, setApiFormat] = useState<ApiFormat>(initialSettings.apiFormat || 'openai');
  const [language, setLanguage] = useState<string>(initialSettings.language || 'ru');
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyRecord[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showStatsDetail, setShowStatsDetail] = useState(false);
  const [permissionsStatus, setPermissionsStatus] = useState<{ group: string; key: string; label: string; description: string; granted: boolean; checked: boolean }[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [requestingPerm, setRequestingPerm] = useState<string | null>(null);
  const [modalSection, setModalSection] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<{ version?: string; tagName?: string; size?: number; changelog?: string; url?: string } | null>(null);
  const [updateError, setUpdateError] = useState('');
  const entrance = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  const loadDaily = useCallback(async () => {
    const stats = await getDailyStats();
    setDailyStats(stats);
  }, []);

  const loadPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    const groups: { label: string; perms: { key: string; label: string; description: string }[] }[] = [
      {
        label: t('settings.permissionsGroup.microphoneCamera'),
        perms: [
          { key: 'RECORD_AUDIO', label: t('settings.permissionsGroup.microphone'), description: t('settings.permissionsGroup.microphoneDesc') },
          { key: 'CAMERA', label: t('settings.permissionsGroup.camera'), description: t('settings.permissionsGroup.cameraDesc') },
        ],
      },
      {
        label: t('settings.permissionsGroup.contacts'),
        perms: [
          { key: 'READ_CONTACTS', label: t('settings.permissionsGroup.readContacts'), description: t('settings.permissionsGroup.readContactsDesc') },
          { key: 'WRITE_CONTACTS', label: t('settings.permissionsGroup.writeContacts'), description: t('settings.permissionsGroup.writeContactsDesc') },
          { key: 'GET_ACCOUNTS', label: t('settings.permissionsGroup.accounts'), description: t('settings.permissionsGroup.accountsDesc') },
        ],
      },
      {
        label: t('settings.permissionsGroup.calendar'),
        perms: [
          { key: 'READ_CALENDAR', label: t('settings.permissionsGroup.readCalendar'), description: t('settings.permissionsGroup.readCalendarDesc') },
          { key: 'WRITE_CALENDAR', label: t('settings.permissionsGroup.writeCalendar'), description: t('settings.permissionsGroup.writeCalendarDesc') },
        ],
      },
      {
        label: t('settings.permissionsGroup.phone'),
        perms: [
          { key: 'READ_PHONE_STATE', label: t('settings.permissionsGroup.phoneState'), description: t('settings.permissionsGroup.phoneStateDesc') },
          { key: 'READ_PHONE_NUMBERS', label: t('settings.permissionsGroup.phoneNumber'), description: t('settings.permissionsGroup.phoneNumberDesc') },
          { key: 'CALL_PHONE', label: t('settings.permissionsGroup.calls'), description: t('settings.permissionsGroup.callsDesc') },
          { key: 'READ_CALL_LOG', label: t('settings.permissionsGroup.callLog'), description: t('settings.permissionsGroup.callLogDesc') },
          { key: 'WRITE_CALL_LOG', label: t('settings.permissionsGroup.writeCallLog'), description: t('settings.permissionsGroup.writeCallLogDesc') },
          { key: 'ANSWER_PHONE_CALLS', label: t('settings.permissionsGroup.answerCalls'), description: t('settings.permissionsGroup.answerCallsDesc') },
        ],
      },
      {
        label: 'SMS',
        perms: [
          { key: 'SEND_SMS', label: t('settings.permissionsGroup.sendSms'), description: t('settings.permissionsGroup.sendSmsDesc') },
          { key: 'RECEIVE_SMS', label: t('settings.permissionsGroup.receiveSms'), description: t('settings.permissionsGroup.receiveSmsDesc') },
          { key: 'READ_SMS', label: t('settings.permissionsGroup.readSms'), description: t('settings.permissionsGroup.readSmsDesc') },
        ],
      },
      {
        label: t('settings.permissionsGroup.storageMedia'),
        perms: [
          { key: 'READ_EXTERNAL_STORAGE', label: t('settings.permissionsGroup.readStorage'), description: t('settings.permissionsGroup.readStorageDesc') },
          { key: 'WRITE_EXTERNAL_STORAGE', label: t('settings.permissionsGroup.writeStorage'), description: t('settings.permissionsGroup.writeStorageDesc') },
          { key: 'READ_MEDIA_IMAGES', label: t('settings.permissionsGroup.images'), description: t('settings.permissionsGroup.imagesDesc') },
          { key: 'READ_MEDIA_VIDEO', label: t('settings.permissionsGroup.video'), description: t('settings.permissionsGroup.videoDesc') },
          { key: 'READ_MEDIA_AUDIO', label: t('settings.permissionsGroup.audio'), description: t('settings.permissionsGroup.audioDesc') },
        ],
      },
      {
        label: t('settings.permissionsGroup.location'),
        perms: [
          { key: 'ACCESS_FINE_LOCATION', label: t('settings.permissionsGroup.fineLocation'), description: t('settings.permissionsGroup.fineLocationDesc') },
          { key: 'ACCESS_COARSE_LOCATION', label: t('settings.permissionsGroup.coarseLocation'), description: t('settings.permissionsGroup.coarseLocationDesc') },
          { key: 'ACCESS_BACKGROUND_LOCATION', label: t('settings.permissionsGroup.backgroundLocation'), description: t('settings.permissionsGroup.backgroundLocationDesc') },
        ],
      },
      {
        label: t('settings.permissionsGroup.bluetoothNetwork'),
        perms: [
          { key: 'BLUETOOTH_CONNECT', label: t('settings.permissionsGroup.bluetoothConnect'), description: t('settings.permissionsGroup.bluetoothConnectDesc') },
          { key: 'BLUETOOTH_SCAN', label: t('settings.permissionsGroup.bluetoothScan'), description: t('settings.permissionsGroup.bluetoothScanDesc') },
          { key: 'ACCESS_WIFI_STATE', label: t('settings.permissionsGroup.wifiState'), description: t('settings.permissionsGroup.wifiStateDesc') },
          { key: 'CHANGE_WIFI_STATE', label: t('settings.permissionsGroup.changeWifi'), description: t('settings.permissionsGroup.changeWifiDesc') },
          { key: 'INTERNET', label: t('settings.permissionsGroup.internet'), description: t('settings.permissionsGroup.internetDesc') },
          { key: 'ACCESS_NETWORK_STATE', label: t('settings.permissionsGroup.networkState'), description: t('settings.permissionsGroup.networkStateDesc') },
        ],
      },
      {
        label: t('settings.permissionsGroup.notifications'),
        perms: [
          { key: 'POST_NOTIFICATIONS', label: t('settings.permissionsGroup.notifications'), description: t('settings.permissionsGroup.notificationsDesc') },
        ],
      },
      {
        label: t('settings.permissionsGroup.sensors'),
        perms: [
          { key: 'BODY_SENSORS', label: t('settings.permissionsGroup.bodySensors'), description: t('settings.permissionsGroup.bodySensorsDesc') },
          { key: 'ACTIVITY_RECOGNITION', label: t('settings.permissionsGroup.activityRecognition'), description: t('settings.permissionsGroup.activityRecognitionDesc') },
        ],
      },
      {
        label: t('settings.permissionsGroup.system'),
        perms: [
          { key: 'SYSTEM_ALERT_WINDOW', label: t('settings.permissionsGroup.overlayWindow'), description: t('settings.permissionsGroup.overlayWindowDesc') },
          { key: 'REQUEST_INSTALL_PACKAGES', label: t('settings.permissionsGroup.installPackages'), description: t('settings.permissionsGroup.installPackagesDesc') },
        ],
      },
    ];
    const flat: { group: string; key: string; label: string; description: string; granted: boolean; checked: boolean }[] = [];
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
    setCollapsedGroups(new Set(groups.map(g => g.label)));
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

    loadApiKey()
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
    const normalized = baseUrl.trim().replace(/\/+$/, '');
    return normalized ? `${normalized}/v1/chat/completions` : t('settings.baseUrlNotSet');
  }, [baseUrl]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const settings = sanitizeSettings({ baseUrl, model, allowAssistantContacts, internetEnabled: initialSettings.internetEnabled, apiFormat, language });
      if (!settings.baseUrl.trim() || !settings.model.trim()) return;
      await saveApiKey(apiKey);
      await onSave(settings, apiKey.trim());
    }, 600);
    return () => clearTimeout(timer);
  }, [baseUrl, model, apiKey, allowAssistantContacts, apiFormat, language]);

  const handleResetStats = () => {
    Alert.alert(t('settings.resetStatsTitle'), t('settings.resetStatsMessage'), [
      { text: t('settings.cancelAction'), style: 'cancel' },
      {
        text: t('settings.resetStatsConfirm'),
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
        setUpdateInfo({ version: result.version, tagName: result.tagName, size: result.size, changelog: result.changelog, url: result.url });
        setUpdateStatus('available');
      } else {
        setUpdateInfo(null);
        if (result.error) {
          setUpdateError(result.error);
          setUpdateStatus('error');
        } else {
          setUpdateStatus('idle');
          Alert.alert(t('settings.noUpdates'), result.info || t('settings.noUpdatesHint'));
        }
      }
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : t('settings.checkError'));
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
      setUpdateError(e instanceof Error ? e.message : t('settings.downloadError'));
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

  const requestPermission = useCallback(async (permKey: string) => {
    if (Platform.OS !== 'android') return;
    setRequestingPerm(permKey);
    try {
      const permissionConst = (PermissionsAndroid.PERMISSIONS as any)[permKey];
      if (!permissionConst) return;
      const result = await PermissionsAndroid.request(permissionConst, {
        title: t('settings.permissionTitle'),
        message: t('settings.permissionMessage'),
        buttonPositive: t('settings.permissionAllow'),
        buttonNegative: t('settings.permissionDeny'),
      });
      setPermissionsStatus((prev) =>
        prev.map((p) =>
          p.key === permKey ? { ...p, granted: result === PermissionsAndroid.RESULTS.GRANTED } : p,
        ),
      );
    } catch {
      /* ignore */
    } finally {
      setRequestingPerm(null);
    }
  }, []);

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
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

  const renderModalContent = () => {
    switch (modalSection) {
      case 'connection':
        return (
          <>
            <Text style={styles.modalTitle}>{t('settings.connection')}</Text>

            <View style={styles.card}>
              <Pressable
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.create(
                    200,
                    LayoutAnimation.Types.easeInEaseOut,
                    LayoutAnimation.Properties.opacity,
                  ));
                  setShowProviders(!showProviders);
                }}
                style={({ pressed }) => [styles.providerToggle, pressed && styles.pressed]}
              >
                <View style={styles.providerToggleLeft}>
                  <Text style={styles.fieldLabel}>{t('settings.provider')}</Text>
                  <Text style={styles.providerName}>
                    {selectedProviderId
                      ? PROVIDERS.find(p => p.id === selectedProviderId)?.name || t('settings.custom')
                      : PROVIDERS.find(p => p.baseUrl && baseUrl.startsWith(p.baseUrl))?.name || t('settings.custom')}
                  </Text>
                </View>
                <Animated.View style={{ transform: [{ rotate: showProviders ? '180deg' : '0deg' }] }}>
                  <ChevronDown size={16} color={colors.textDim} />
                </Animated.View>
              </Pressable>

              {showProviders && (
                <View style={styles.providerList}>
                  <View style={styles.divider} />
                  {PROVIDERS.map((provider, index) => {
                    const isSelected = selectedProviderId === provider.id ||
                      (!selectedProviderId && baseUrl.trim().replace(/\/+$/, '').startsWith(provider.baseUrl) && provider.baseUrl !== '');
                    return (
                      <View key={provider.id}>
                        {index > 0 && <View style={styles.permissionDivider} />}
                        <Pressable
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.create(
                              200,
                              LayoutAnimation.Types.easeInEaseOut,
                              LayoutAnimation.Properties.opacity,
                            ));
                            setSelectedProviderId(provider.id);
                            if (provider.baseUrl) setBaseUrl(provider.baseUrl);
                            if (provider.models.length > 0 && !model.trim()) {
                              setModel(provider.models[0]);
                            }
                            if (provider.apiFormat) setApiFormat(provider.apiFormat);
                            setShowProviders(false);
                          }}
                          style={({ pressed }) => [
                            styles.providerItem,
                            isSelected && styles.providerItemSelected,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={styles.providerInfo}>
                            <View style={styles.providerNameRow}>
                              <Text style={[styles.providerItemName, isSelected && { color: colors.text }]}>{provider.name}</Text>
                              <Text style={[styles.providerAuthBadge,
                                provider.auth === 'none' && { color: colors.success },
                              ]}>
                                {provider.auth === 'api_key' ? 'API Key' : provider.auth === 'token' ? 'Token' : t('settings.noKey')}
                              </Text>
                            </View>
                            <Text style={styles.providerDesc}>{provider.description}</Text>
                          </View>
                          {isSelected && <Check size={14} color={colors.success} />}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.cardGap} />

            <View style={styles.card}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Base URL</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  onChangeText={(text) => {
                    setBaseUrl(text);
                    setSelectedProviderId(null);
                  }}
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
                <Text style={styles.fieldLabel}>{t('settings.model')}</Text>
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
                  {(selectedProviderId
                    ? PROVIDERS.find(p => p.id === selectedProviderId)?.models || MODEL_SUGGESTIONS
                    : MODEL_SUGGESTIONS
                  ).map((item) => (
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

            {selectedProviderId === 'openai-compat' && (
              <>
                <View style={styles.card}>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{t('settings.apiFormat')}</Text>
                    <View style={styles.chipRow}>
                      {([
                        { id: 'openai' as ApiFormat, label: 'OpenAI' },
                        { id: 'ollama' as ApiFormat, label: 'Ollama' },
                        { id: 'anthropic' as ApiFormat, label: 'Anthropic' },
                        { id: 'kobold' as ApiFormat, label: 'KoboldCpp' },
                      ]).map((fmt) => (
                        <Pressable
                          key={fmt.id}
                          onPress={() => setApiFormat(fmt.id)}
                          style={({ pressed }) => [
                            styles.chip,
                            apiFormat === fmt.id && styles.chipActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={[styles.chipText, apiFormat === fmt.id && styles.chipTextActive]}>{fmt.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.fieldHint}>
                      {apiFormat === 'openai' && 'POST /v1/chat/completions · Authorization: Bearer'}
                      {apiFormat === 'ollama' && t('settings.apiFormatOllama')}
                      {apiFormat === 'anthropic' && 'POST /v1/messages · x-api-key header'}
                      {apiFormat === 'kobold' && t('settings.apiFormatKobold')}
                    </Text>
                    {apiFormat === 'ollama' && (
                      <View style={styles.chipRow}>
                        <Pressable
                          onPress={() => setBaseUrl('http://localhost:11434')}
                          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                        >
                          <Text style={styles.chipText}>localhost:11434</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              </>
            )}

            <View style={styles.cardGap} />

            <View style={styles.card}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>
                  {(() => {
                    const p = PROVIDERS.find(pr => pr.id === selectedProviderId);
                    if (!p || p.auth === 'api_key') return 'API Key';
                    if (p.auth === 'token') return t('settings.token');
                    return t('settings.keyOptional');
                  })()}
                </Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setApiKey}
                  placeholder={isKeyLoaded ? 'sk-...' : t('settings.loading')}
                  placeholderTextColor={colors.textDim}
                  secureTextEntry
                  style={styles.fieldInput}
                  value={apiKey}
                />
                <Text style={styles.fieldHint}>
                  {(() => {
                    const p = PROVIDERS.find(pr => pr.id === selectedProviderId);
                    if (!p || p.auth === 'api_key') return t('settings.endpointHint1');
                    if (p.auth === 'token') return t('settings.endpointHint2');
                    return t('settings.endpointHint3');
                  })()}
                </Text>
              </View>
            </View>
          </>
        );
      case 'language':
        return (
          <>
            <Text style={styles.modalTitle}>{t('settings.language')}</Text>
            <View style={styles.card}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{t('settings.language')}</Text>
                <View style={styles.chipRow}>
                  {[
                    { id: 'ru', label: 'Русский', flag: '🇷🇺' },
                    { id: 'en', label: 'English', flag: '🇺🇸' },
                    { id: 'uk', label: 'Українська', flag: '🇺🇦' },
                    { id: 'zh', label: '中文', flag: '🇨🇳' },
                    { id: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
                    { id: 'es', label: 'Español', flag: '🇪🇸' },
                    { id: 'pt', label: 'Português', flag: '🇧🇷' },
                    { id: 'ar', label: 'العربية', flag: '🇸🇦' },
                    { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
                    { id: 'fr', label: 'Français', flag: '🇫🇷' },
                    { id: 'tr', label: 'Türkçe', flag: '🇹🇷' },
                    { id: 'ko', label: '한국어', flag: '🇰🇷' },
                    { id: 'ja', label: '日本語', flag: '🇯🇵' },
                    { id: 'pl', label: 'Polski', flag: '🇵🇱' },
                    { id: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
                    { id: 'th', label: 'ไทย', flag: '🇹🇭' },
                    { id: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
                    { id: 'fa', label: 'فارسی', flag: '🇮🇷' },
                  ].map((lang) => (
                    <Pressable
                      key={lang.id}
                      onPress={() => setLanguage(lang.id)}
                      style={({ pressed }) => [
                        styles.chip,
                        language === lang.id && styles.chipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.chipText, language === lang.id && styles.chipTextActive]}>{lang.flag} {lang.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </>
        );
      case 'permissions':
        return (
          <>
            <Text style={styles.modalTitle}>{t('settings.permissions')}</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextBlock}>
                  <Text style={styles.fieldLabel}>{t('settings.contactsAccess')}</Text>
                  <Text style={styles.fieldHint}>{t('settings.contactsHint')}</Text>
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
                <View style={styles.permissionsHeaderLeft}>
                  <Shield size={16} color={colors.textMuted} />
                  <Text style={styles.fieldLabel}>{t('settings.androidPermissions')}</Text>
                </View>
                <View style={styles.permissionsHeaderRight}>
                  <Text style={styles.permCountText}>
                    {permissionsStatus.filter(p => p.granted).length}/{permissionsStatus.length}
                  </Text>
                  <Pressable
                    onPress={loadPermissions}
                    style={({ pressed }) => [styles.permissionsRefresh, pressed && { opacity: 0.6 }]}
                    hitSlop={8}
                  >
                    <RefreshCw size={14} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.divider} />
              {permissionsStatus.length === 0 ? (
                <View style={{ padding: spacing.xl }}>
                  <Text style={styles.fieldHint}>{t('settings.checkingPermissions')}</Text>
                </View>
              ) : (
                (() => {
                  const groups = new Map<string, typeof permissionsStatus>();
                  for (const p of permissionsStatus) {
                    const arr = groups.get(p.group) || [];
                    arr.push(p);
                    groups.set(p.group, arr);
                  }
                  const entries = Array.from(groups.entries());
                  return entries.map(([groupName, perms], gi) => {
                    const collapsed = collapsedGroups.has(groupName);
                    const grantedCount = perms.filter(p => p.granted).length;
                    return (
                      <View key={groupName}>
                        {gi > 0 && <View style={styles.divider} />}
                        <Pressable
                          onPress={() => toggleGroup(groupName)}
                          style={({ pressed }) => [styles.permGroupHeader, pressed && styles.pressed]}
                        >
                          <View style={styles.permGroupLeft}>
                            {grantedCount === perms.length ? (
                              <ShieldCheck size={14} color={colors.success} />
                            ) : grantedCount > 0 ? (
                              <Shield size={14} color={colors.warning} />
                            ) : (
                              <ShieldOff size={14} color={colors.textDim} />
                            )}
                            <Text style={styles.permissionGroupLabel}>{groupName}</Text>
                          </View>
                          <View style={styles.permGroupRight}>
                            <Text style={styles.permGroupCount}>{grantedCount}/{perms.length}</Text>
                            <Animated.View style={{ transform: [{ rotate: collapsed ? '0deg' : '90deg' }] }}>
                              <ChevronDown size={14} color={colors.textDim} />
                            </Animated.View>
                          </View>
                        </Pressable>
                        {!collapsed && perms.map((perm, pi) => (
                          <View key={perm.key}>
                            {pi > 0 && <View style={styles.permissionDivider} />}
                            <Pressable
                              onPress={() => !perm.granted && requestPermission(perm.key)}
                              style={({ pressed }) => [styles.permissionRow, !perm.granted && pressed && { backgroundColor: colors.accentSoft }]}
                            >
                              <View style={styles.permInfo}>
                                <Text style={[styles.permissionLabel, perm.granted && { color: colors.text }]}>{perm.label}</Text>
                                <Text style={styles.permDesc}>{perm.description}</Text>
                              </View>
                              {requestingPerm === perm.key ? (
                                <RefreshCw size={14} color={colors.textMuted} style={{ transform: [{ rotate: '90deg' }] }} />
                              ) : perm.granted ? (
                                <View style={[styles.permToggle, styles.permToggleOn]}>
                                  <Check size={10} color={colors.background} />
                                </View>
                              ) : (
                                <View style={styles.permToggle}>
                                  <X size={10} color={colors.textDim} />
                                </View>
                              )}
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    );
                  });
                })()
              )}
            </View>
          </>
        );
      case 'stats':
        return tokenStats ? (
          <>
            <Text style={styles.modalTitle}>{t('settings.stats')}</Text>
            <View style={styles.card}>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatLargeNumber(tokenStats.totalInput)}</Text>
                  <Text style={styles.statLabel}>{t('settings.inputTokens')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatLargeNumber(tokenStats.totalOutput)}</Text>
                  <Text style={styles.statLabel}>{t('settings.outputTokens')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatLargeNumber(tokenStats.totalInput + tokenStats.totalOutput)}</Text>
                  <Text style={styles.statLabel}>{t('settings.totalTokens')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{tokenStats.totalRequests}</Text>
                  <Text style={styles.statLabel}>{t('settings.requests')}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <Pressable
                onPress={() => { closeModal(); openStatsDetail(); }}
                style={({ pressed }) => [styles.nestedRow, pressed && styles.pressed]}
              >
                <View style={styles.nestedRowLeft}>
                  <BarChart3 size={16} color={colors.textMuted} />
                  <Text style={styles.nestedRowText}>{t('settings.usageChart')}</Text>
                </View>
                <ChevronRight size={14} color={colors.textDim} />
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                onPress={handleResetStats}
                style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
              >
                <Text style={styles.resetBtnText}>{t('settings.resetStatsButton')}</Text>
              </Pressable>
            </View>
          </>
        ) : null;
      case 'update':
        return (
          <>
            <Text style={styles.modalTitle}>{t('settings.update')}</Text>
            <View style={styles.card}>
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{t('settings.currentVersion')}</Text>
                <Text style={{ color: colors.text, fontSize: typography.body }}>v{CURRENT_VERSION}</Text>
                <Text style={styles.fieldHint}>{t('settings.updateHint')}</Text>
              </View>
              <View style={styles.divider} />
              {updateStatus === 'checking' && (
                <View style={styles.fieldRow}>
                  <Text style={{ color: colors.textMuted }}>{t('settings.checkingUpdates')}</Text>
                </View>
              )}
              {updateStatus === 'idle' && (
                <Pressable
                  onPress={handleCheckUpdate}
                  style={({ pressed }) => [styles.nestedRow, pressed && styles.pressed]}
                >
                  <View style={styles.nestedRowLeft}>
                    <RefreshCw size={16} color={colors.textMuted} />
                    <Text style={styles.nestedRowText}>{t('settings.checkUpdates')}</Text>
                  </View>
                </Pressable>
              )}
              {updateStatus === 'available' && updateInfo && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{t('settings.updateAvailable')}</Text>
                    <Text style={{ color: colors.success, fontSize: typography.body, fontWeight: '600' }}>
                      {updateInfo.tagName || `v${updateInfo.version}`}
                    </Text>
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
                      <Text style={[styles.nestedRowText, { color: colors.accent }]}>{t('settings.downloadInstall')}</Text>
                    </View>
                  </Pressable>
                </>
              )}
              {updateStatus === 'downloading' && (
                <View style={styles.fieldRow}>
                  <Text style={{ color: colors.textMuted }}>{t('settings.downloading')}</Text>
                </View>
              )}
              {updateStatus === 'downloaded' && (
                <View style={styles.fieldRow}>
                  <Text style={{ color: colors.success }}>{t('settings.apkDownloaded')}</Text>
                </View>
              )}
              {updateStatus === 'error' && (
                <View style={styles.fieldRow}>
                  <Text style={{ color: colors.danger }}>{updateError || t('settings.errorFallback')}</Text>
                  <Pressable
                    onPress={handleCheckUpdate}
                    style={({ pressed }) => [styles.nestedRow, pressed && styles.pressed]}
                  >
                    <Text style={[styles.nestedRowText, { color: colors.accent }]}>{t('settings.retry')}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </>
        );
      case 'skills':
        return (
          <>
            <Text style={styles.modalTitle}>{t('settings.skills')}</Text>
            <View style={styles.card}>
              {skills.length === 0 ? (
                <View style={styles.emptySkillsBox}>
                  <Text style={styles.emptySkillsTitle}>{t('settings.noSkills')}</Text>
                  <Text style={styles.emptySkillsText}>{t('settings.skillsHint')}</Text>
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
                          <Text style={styles.skillMetaText}>{t('settings.usedCount', { count: skill.usageCount })}</Text>
                          {skill.triggerKeywords.length > 0 && (
                            <Text style={styles.skillMetaText}> · {skill.triggerKeywords.slice(0, 3).join(', ')}</Text>
                          )}
                        </View>
                      </View>
                      <Pressable
                        onPress={() => {
                          Alert.alert(t('settings.deleteSkillTitle'), t('settings.deleteSkillConfirm', { name: skill.name }), [
                            { text: t('settings.cancelAction'), style: 'cancel' },
                            { text: t('settings.deleteSkill'), style: 'destructive', onPress: () => handleDeleteSkill(skill.id) },
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
          <Text style={styles.headerTitle}>{t('settings.usageChart')}</Text>
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
          <Text style={styles.headerTitle}>{t('settings.settingsTitle')}</Text>
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
            onPress={() => openModal('connection')}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          >
            <Text style={styles.menuItemLabel}>{t('settings.connection')}</Text>
            <ChevronRight size={16} color={colors.textDim} />
          </Pressable>

          {/* Section: Язык */}
          <Pressable
            onPress={() => openModal('language')}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          >
            <Text style={styles.menuItemLabel}>{t('settings.language')}</Text>
            <ChevronRight size={16} color={colors.textDim} />
          </Pressable>

          {/* Section: Разрешения */}
          <Pressable
            onPress={() => openModal('permissions')}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          >
            <Text style={styles.menuItemLabel}>{t('settings.permissions')}</Text>
            <ChevronRight size={16} color={colors.textDim} />
          </Pressable>

          {/* Section: Статистика */}
          {tokenStats && (
            <Pressable
              onPress={() => openModal('stats')}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            >
              <Text style={styles.menuItemLabel}>{t('settings.stats')}</Text>
              <ChevronRight size={16} color={colors.textDim} />
            </Pressable>
          )}

          {/* Section: Скиллы */}
          <Pressable
            onPress={() => openModal('skills')}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          >
            <Text style={styles.menuItemLabel}>{t('settings.skills')}</Text>
            <ChevronRight size={16} color={colors.textDim} />
          </Pressable>

          {/* Section: Обновление */}
          <Pressable
            onPress={() => { setUpdateStatus('idle'); setUpdateInfo(null); setUpdateError(''); openModal('update'); }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
          >
            <Text style={styles.menuItemLabel}>{t('settings.update')}</Text>
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
    fontFamily: fontFamily.regular,
    fontSize: 22,
    fontWeight: '400',
  },
  pressed: {
    opacity: 0.55,
  },
  headerTitle: {
    color: colors.text,
    fontFamily: fontFamily.regular,
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
    fontFamily: fontFamily.regular,
    fontSize: typography.body,
    fontWeight: '500',
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
    maxHeight: SCREEN_HEIGHT * 0.8,
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
    fontFamily: fontFamily.regular,
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
    fontFamily: fontFamily.regular,
    fontSize: typography.caption,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  fieldInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: typography.body,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  fieldHint: {
    color: colors.textDim,
    fontFamily: fontFamily.regular,
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
    fontFamily: fontFamily.regular,
    fontSize: typography.caption,
    fontWeight: '500',
  },
  chipActive: {
    backgroundColor: colors.accentStrong,
  },
  chipTextActive: {
    color: colors.background,
  },

  /* Provider selector */
  providerToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  providerToggleLeft: {
    flex: 1,
  },
  providerName: {
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: typography.body,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  providerList: {
    paddingBottom: spacing.sm,
  },
  providerItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
  },
  providerItemSelected: {
    backgroundColor: colors.accentSoft,
  },
  providerInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  providerNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  providerItemName: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: typography.body,
    fontWeight: '500',
  },
  providerAuthBadge: {
    color: colors.accent,
    fontFamily: fontFamily.regular,
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  providerDesc: {
    color: colors.textDim,
    fontFamily: fontFamily.regular,
    fontSize: typography.caption,
    lineHeight: 16,
    marginTop: 2,
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
    fontFamily: fontFamily.regular,
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
    fontFamily: fontFamily.regular,
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
    fontFamily: fontFamily.regular,
    fontSize: typography.body,
  },

  /* Skills */
  emptySkillsBox: {
    padding: spacing.xl,
  },
  emptySkillsTitle: {
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptySkillsText: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
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
    fontFamily: fontFamily.regular,
    fontSize: typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  skillDesc: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
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
    fontFamily: fontFamily.regular,
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
  permissionsHeaderLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  permissionsHeaderRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  permCountText: {
    color: colors.textDim,
    fontFamily: fontFamily.regular,
    fontSize: typography.caption,
  },
  permissionsRefresh: {
    padding: spacing.xs,
  },
  permGroupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  permGroupLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  permGroupRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  permGroupCount: {
    color: colors.textDim,
    fontFamily: fontFamily.regular,
    fontSize: typography.caption,
  },
  permissionGroupLabel: {
    color: colors.textDim,
    fontFamily: fontFamily.regular,
    fontSize: typography.caption,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  permissionDivider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.xl + 20,
  },
  permissionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
  },
  permInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  permissionLabel: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: typography.body,
  },
  permDesc: {
    color: colors.textDim,
    fontFamily: fontFamily.regular,
    fontSize: typography.caption,
    lineHeight: 16,
    marginTop: 2,
  },
  permToggle: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 22,
    justifyContent: 'center',
    width: 22,
    backgroundColor: colors.surfaceMuted,
  },
  permToggleOn: {
    backgroundColor: colors.success,
  },
  permissionBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  permissionStatus: {
    fontFamily: fontFamily.regular,
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