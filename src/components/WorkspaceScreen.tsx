import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MessageBubble } from './MessageBubble';
import { requestChatCompletion } from '../services/openaiClient';
import { TOOL_DEFINITIONS } from '../services/tools';
import { AgentSettings, AgentStatus, ChatCompletionMessage, ChatMessage, StoredChat } from '../types';
import { colors, motion, radius, spacing, typography } from '../styles/theme';
import { DocumentContext, pickAndParseDocument, searchContext } from '../services/rag';
import * as VoiceService from '../services/voice';
import { ContactSafePreview, normalizePhone, searchContacts, toSafeContactPreview } from '../services/contacts';
import { loadChats, saveChats } from '../services/storage';
import { setWidgetData } from '@bittingz/expo-widgets';

import {
  listWorkspaceFiles,
  readWorkspaceFile,
  exportWorkspaceFile,
  exportWorkspaceArchive,
} from '../services/workspace';
import type { WorkspaceFile } from '../services/workspace';
import * as ImagePicker from 'expo-image-picker';
import { estimateTokens, estimateMessagesTokens } from '../services/context';
import { searchSessions } from '../services/sessionSearch';
import { WebView } from 'react-native-webview';
import { SvgXml } from 'react-native-svg';
import { GestureBottomSheet, BOTTOM_SHEET_HEIGHT } from './GestureBottomSheet';
import { ArrowLeft, ArrowUp, Bot, Camera, Check, ChevronDown, Download, Folder, Globe, Image, Layers, Menu, Mic, Paperclip, Plus, Search, Settings, Trash2, Users, X } from 'lucide-react-native';

const useAnimatedValue = (target: number): number => {
  const [current, setCurrent] = useState(target);
  const rafRef = useRef<number | undefined>(undefined);
  const animRef = useRef({ from: 0, time: 0, target: 0 });

  useEffect(() => {
    if (target === current) { animRef.current.target = target; return; }
    const from = current;
    animRef.current = { from, time: performance.now(), target };

    const animate = (now: number) => {
      const t = Math.min((now - animRef.current.time) / 350, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (animRef.current.target - from) * eased);
      setCurrent(next);
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current); };
  }, [target]);

  return current;
};

type Props = {
  settings: AgentSettings;
  apiKey: string;
  onOpenSettings: () => void;
  onOpenSandbox: () => void;
  onOpenFiles: () => void;
  onSaveSettings: (settings: AgentSettings, apiKey: string) => Promise<void>;
  pendingAttach?: { name: string; content: string } | null;
  onClearPendingAttach?: () => void;
};

const initialAssistantMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Привет! Чем могу помочь?',
  createdAt: Date.now(),
};



type ModelGroup = { provider: string; models: string[] };

const guessProvider = (modelId: string): string => {
  const id = modelId.toLowerCase();
  if (id.startsWith('gpt-') || id.startsWith('o3-') || id.startsWith('o4-')) return 'OpenAI';
  if (id.startsWith('claude-')) return 'Anthropic';
  if (id.startsWith('gemini-') || id.startsWith('gemma-')) return 'Google';
  if (id.includes('/')) return id.split('/')[0];
  if (id.startsWith('deepseek-')) return 'DeepSeek';
  if (id.startsWith('qwen-') || id.startsWith('qwen/')) return 'Qwen';
  if (id.startsWith('mistral-') || id.startsWith('mixtral-')) return 'Mistral';
  if (id.startsWith('llama-')) return 'Meta';
  if (id.startsWith('phi-')) return 'Microsoft';
  return 'Другие';
};

const groupModels = (ids: string[]): ModelGroup[] => {
  const map = new Map<string, string[]>();
  for (const id of ids) {
    const provider = guessProvider(id);
    if (!map.has(provider)) map.set(provider, []);
    map.get(provider)!.push(id);
  }
  const sorted: ModelGroup[] = [];
  for (const [provider, models] of map) {
    sorted.push({ provider, models: models.sort() });
  }
  const otherIdx = sorted.findIndex((g) => g.provider === 'Другие');
  if (otherIdx > 0) sorted.push(sorted.splice(otherIdx, 1)[0]);
  return sorted;
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createChatTitle = (content: string) => {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine.length > 36 ? `${oneLine.slice(0, 36).trim()}…` : oneLine || 'Новый чат';
};

const formatChatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
  });

const formatTokenNumber = (n: number) => n.toLocaleString('ru-RU');

type PreviewMode = 'text' | 'html' | 'svg';
const detectPreviewMode = (path: string): PreviewMode => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'svg') return 'svg';
  return 'text';
};

const toStoredMessages = (chatMessages: ChatMessage[]) =>
  chatMessages
    .filter((m) => m.id !== 'welcome')
    .filter((m) => m.content.trim().length > 0)
    .filter((m) => !m.content.startsWith('Ошибка:') || m.role === 'assistant');

const toApiMessages = (messages: ChatMessage[]): ChatCompletionMessage[] =>
  messages
    .filter((m) => m.id !== 'welcome')
    .filter((m) => !m.content.startsWith('Ошибка:'))
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));

export const WorkspaceScreen = ({ settings, apiKey, onOpenSettings, onOpenSandbox, onOpenFiles, onSaveSettings, pendingAttach, onClearPendingAttach }: Props) => {
  const [messages, setMessages] = useState<ChatMessage[]>([initialAssistantMessage]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [error, setError] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showChatList, setShowChatList] = useState(false);
  const [attachedDocs, setAttachedDocs] = useState<DocumentContext[]>([]);
  const [chats, setChats] = useState<StoredChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [inputTokens, setInputTokens] = useState(0);
  const [outputTokens, setOutputTokens] = useState(0);
  const [internetEnabled, setInternetEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const streamedTextRef = useRef('');
  const confirmedContactPhonesRef = useRef<Set<string>>(new Set());
  const tokenPulse = useRef(new Animated.Value(1)).current;

  const animInputTokens = useAnimatedValue(inputTokens);
  const animOutputTokens = useAnimatedValue(outputTokens);

  useEffect(() => {
    if (status === 'thinking') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(tokenPulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
          Animated.timing(tokenPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    tokenPulse.setValue(1);
    return undefined;
  }, [status === 'thinking']);

  useEffect(() => {
    VoiceService.onResult((text) => {
      setDraft((prev) => prev ? `${prev} ${text}` : text);
      setIsRecording(false);
    });
    VoiceService.onError(() => setIsRecording(false));
    return () => { VoiceService.destroy(); };
  }, []);

  useEffect(() => {
    if (pendingAttach && onClearPendingAttach) {
      setAttachedDocs((prev) => [...prev, { name: pendingAttach.name, content: pendingAttach.content }]);
      onClearPendingAttach();
    }
  }, [pendingAttach]);

  const [wsFiles, setWsFiles] = useState<WorkspaceFile[]>([]);
  const [showWsModal, setShowWsModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<WorkspaceFile | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ chatId: string; title: string; excerpt: string; score: number; updatedAt: number }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const drawerAnim = useRef(new Animated.Value(0)).current;
  const DRAWER_WIDTH = 290;

  useEffect(() => {
    Animated.spring(drawerAnim, {
      toValue: showChatList ? 1 : 0,
      useNativeDriver: true,
      damping: 26,
      stiffness: 250,
    }).start();
  }, [showChatList]);

  const wsAnim = useRef(new Animated.Value(0)).current;
  const WS_WIDTH = 290;

  useEffect(() => {
    Animated.spring(wsAnim, {
      toValue: showWsModal ? 1 : 0,
      useNativeDriver: true,
      damping: 26,
      stiffness: 250,
    }).start();
  }, [showWsModal]);

  const drawerTranslate = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_WIDTH, 0],
  });
  const contentTranslate = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, DRAWER_WIDTH],
  });
  const drawerOverlayOpacity = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });
  const wsTranslate = wsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [WS_WIDTH, 0],
  });
  const wsOverlayOpacity = wsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const modelPickerAnim = useRef(new Animated.Value(0)).current;
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    Animated.spring(modelPickerAnim, {
      toValue: showModelPicker ? 1 : 0,
      useNativeDriver: true,
      damping: 26,
      stiffness: 250,
    }).start();
  }, [showModelPicker]);

  const modelOverlayOpacity = modelPickerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });
  const modelPanelTranslate = modelPickerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 0],
  });

  const streamQueue = useRef('');
  const streamTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamMessageId = useRef<string | null>(null);
  const chatsRef = useRef<StoredChat[]>([]);

  const canSend = useMemo(() => draft.trim().length > 0 && status !== 'thinking', [draft, status]);

  const sendAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(sendAnim, {
      toValue: canSend ? 1 : 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 260,
    }).start();
  }, [canSend]);
  const hasRequiredSettings = Boolean(settings.baseUrl.trim() && settings.model.trim());
  const isEmptyChat = messages.length === 1 && messages[0].id === 'welcome';
  const modelLabel = settings.model.trim() || 'Выбрать модель';
  const messageCount = useMemo(() => messages.filter(m => m.id !== 'welcome').length, [messages]);
  const contextPressureColor: string = useMemo(() => {
    if (messageCount < 10) return colors.success;
    if (messageCount < 20) return colors.warning;
    return colors.danger;
  }, [messageCount]);
  const filteredGroups = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return modelGroups;
    return modelGroups.map(g => ({
      ...g,
      models: g.models.filter(m => m.toLowerCase().includes(q)),
    })).filter(g => g.models.length > 0);
  }, [modelSearch, modelGroups]);

  useEffect(() => {
    Animated.timing(entrance, {
      duration: motion.slow,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  useEffect(() => {
    if (!showModelPicker || !settings.baseUrl.trim()) return;
    let cancelled = false;
    setIsLoadingModels(true);
    const baseUrl = settings.baseUrl.trim().replace(/\/+$/, '');
    fetch(`${baseUrl}/v1/models`, {
      headers: apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : undefined,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json: { data?: { id: string }[] }) => {
        if (cancelled) return;
        const ids = json.data?.map((m) => m.id).filter(Boolean) || [];
        setModelGroups(groupModels(ids));
        if (!cancelled) setIsLoadingModels(false);
      })
      .catch(() => {
        if (cancelled) return;
        setModelGroups([]);
        if (!cancelled) setIsLoadingModels(false);
      });
    return () => { cancelled = true; };
  }, [showModelPicker]);

  useEffect(() => {
    loadChats().then((storedChats) => {
      chatsRef.current = storedChats;
      setChats(storedChats);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (streamTimer.current) clearInterval(streamTimer.current);
    };
  }, []);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const persistChats = async (nextChats: StoredChat[]) => {
    const sorted = [...nextChats].sort((a, b) => b.updatedAt - a.updatedAt);
    chatsRef.current = sorted;
    setChats(sorted);
    try {
      await saveChats(sorted);
    } catch {
      // Keep the UI responsive even if local persistence fails.
    }
  };

  const saveChatSnapshot = async (chatId: string, title: string, chatMessages: ChatMessage[]) => {
    const storedMessages = toStoredMessages(chatMessages);
    if (!storedMessages.length) return;

    const existing = chatsRef.current.find((chat) => chat.id === chatId);
    const now = Date.now();
    const nextChat: StoredChat = {
      id: chatId,
      title: existing?.title || title,
      messages: storedMessages,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await persistChats([nextChat, ...chatsRef.current.filter((chat) => chat.id !== chatId)]);

    try {
      const { indexChat } = await import('../services/sessionSearch');
      await indexChat(chatId, title, storedMessages);
    } catch { /* indexing non-critical */ }
  };

  const updateMessageContent = (id: string, append: string) => {
    if (!append) return;
    setMessages((current) =>
      current.map((m) => (m.id === id ? { ...m, content: m.content + append } : m)),
    );
    scrollToEnd();
  };

  const flushAllStreamText = () => {
    const id = streamMessageId.current;
    const rest = streamQueue.current;
    streamQueue.current = '';
    if (id && rest) updateMessageContent(id, rest);
  };

  const stopStreamTicker = () => {
    if (streamTimer.current) {
      clearInterval(streamTimer.current);
      streamTimer.current = null;
    }
  };

  const startStreamTicker = (messageId: string) => {
    stopStreamTicker();
    streamMessageId.current = messageId;
    streamQueue.current = '';
    streamTimer.current = setInterval(() => {
      if (!streamQueue.current) return;
      const nextChunkSize = Math.min(Math.max(Math.ceil(streamQueue.current.length / 2), 4), 42);
      const chunk = streamQueue.current.slice(0, nextChunkSize);
      streamQueue.current = streamQueue.current.slice(nextChunkSize);
      updateMessageContent(messageId, chunk);
    }, 16);
  };

  const attachImage = async (uri: string, name: string) => {
    setAttachedDocs((prev) => [...prev, { name, content: `[Image: ${name}]\nURI: ${uri}` }]);
  };

  const handleCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нет доступа', 'Разреши доступ к камере в настройках');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false });
    if (!result.canceled && result.assets?.[0]) {
      await attachImage(result.assets[0].uri, result.assets[0].fileName || 'photo.jpg');
    }
  };

  const handlePhotoLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Нет доступа', 'Разреши доступ к галерее в настройках');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: false });
    if (!result.canceled && result.assets?.[0]) {
      await attachImage(result.assets[0].uri, result.assets[0].fileName || 'photo.jpg');
    }
  };

  const handleAttachDocument = async () => {
    try {
      const doc = await pickAndParseDocument();
      if (doc) {
        setAttachedDocs((prev) => [...prev, doc]);
      }
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось загрузить файл');
    }
  };

  const handleOpenFiles = () => {
    onOpenFiles();
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      setIsRecording(false);
      await VoiceService.stopListening();
    } else {
      const { PermissionsAndroid } = require('react-native');
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Нет доступа', 'Разреши доступ к микрофону в настройках');
        return;
      }
      setIsRecording(true);
      try {
        await VoiceService.startListening('ru-RU');
      } catch {
        setIsRecording(false);
        Alert.alert('Ошибка', 'Не удалось запустить запись');
      }
    }
  };

  const requestContactDisclosure = useCallback((payload: { query: string; results: ContactSafePreview[] }) => {
    const preview = payload.results
      .slice(0, 5)
      .map((contact) => `${contact.name} (${contact.phoneCount})`)
      .join('\n');

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'Разрешить номера контактов?',
        `Ассистент хочет получить полные номера по запросу «${payload.query}».

${preview}

Без разрешения модель увидит только имена и скрытые номера.`,
        [
          { text: 'Не разрешать', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Разрешить', onPress: () => resolve(true) },
        ],
      );
    });
  }, []);

  const confirmCommunication = useCallback((payload: { action: 'call' | 'sms'; phone: string; name?: string }) => {
    const normalizedPhone = normalizePhone(payload.phone);
    const actionLabel = payload.action === 'call' ? 'Позвонить' : 'Написать SMS';

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'Подтвердить действие',
        `Контакт: ${payload.name || 'Без имени'}
Номер: ${payload.phone}
Действие: ${payload.action}`,
        [
          { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
          {
            text: actionLabel,
            onPress: () => {
              if (normalizedPhone) confirmedContactPhonesRef.current.add(normalizedPhone);
              resolve(true);
            },
          },
        ],
      );
    });
  }, []);

  const handleContactsSearch = async () => {
    if (!settings.allowAssistantContacts) {
      Alert.alert('Доступ к контактам выключен', 'Включи «Разрешать ассистенту доступ к контактам» в настройках.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Настройки', onPress: onOpenSettings },
      ]);
      return;
    }

    try {
      const results = await searchContacts('');
      if (results.length === 0) {
        Alert.alert('Контакты не найдены');
        return;
      }
      const safeResults = results.map(toSafeContactPreview);
      const names = safeResults.map((c) => `${c.name} — ${c.maskedPhones.join(', ')}`).join('\n');
      setDraft(`Найди контакт (номера скрыты до подтверждения):
${names}`);
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить контакты');
    }
  };

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || status === 'thinking') return;

    if (!hasRequiredSettings) {
      Alert.alert('Нужны настройки', 'Укажи Base URL и Model перед отправкой.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Открыть настройки', onPress: onOpenSettings },
      ]);
      return;
    }

    // RAG Logic: Search in attached documents
    const context = searchContext(content, attachedDocs);
    const augmentedContent = context 
      ? `Контекст из прикрепленных файлов:\n${context}\n\nВопрос пользователя: ${content}`
      : content;

    const chatId = activeChatId || createId();
    const chatTitle = chatsRef.current.find((chat) => chat.id === chatId)?.title || createChatTitle(content);

    if (!activeChatId) {
      setActiveChatId(chatId);
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content,
      createdAt: Date.now(),
    };
    const assistantMessage: ChatMessage = {
      id: createId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    };

    const previousMessages = messages.filter((message) => message.id !== 'welcome');
    const visibleMessages = previousMessages.concat(userMessage, assistantMessage);
    const userOnlySnapshot = previousMessages.concat(userMessage);
    setMessages(visibleMessages);
    setDraft('');
    setError('');
    setStatus('thinking');
    startStreamTicker(assistantMessage.id);
    scrollToEnd();
    await saveChatSnapshot(chatId, chatTitle, userOnlySnapshot);

    // Prepare messages for API with augmented content for the last message
    const apiMessages = toApiMessages(previousMessages);
    apiMessages.push({ role: 'user', content: augmentedContent });

    setInputTokens(estimateMessagesTokens(apiMessages));
    setOutputTokens(0);
    streamedTextRef.current = '';

    try {
      const activeTools = internetEnabled
        ? TOOL_DEFINITIONS
        : TOOL_DEFINITIONS.filter((t) => !['web_search', 'visit_page'].includes(t.function?.name));

      const result = await requestChatCompletion({
        settings,
        apiKey,
        messages: apiMessages,
        context: {
          workspaceId: chatId,
          contactsAccessEnabled: settings.allowAssistantContacts,
          requestContactDisclosure,
          confirmCommunication,
        },
        tools: activeTools,
        onToken: (token) => {
          streamQueue.current += token;
          streamedTextRef.current += token;
          setOutputTokens(estimateTokens(streamedTextRef.current));
        },
      });

      flushAllStreamText();
      stopStreamTicker();
      streamMessageId.current = null;
      setStatus('idle');
      scrollToEnd();

      const finalMessages = visibleMessages.map((m) =>
        m.id === assistantMessage.id && !m.content.trim()
          ? { ...m, content: result.text }
          : m,
      );

      // Update message list and persistent chat
      setMessages(finalMessages);
      void saveChatSnapshot(chatId, chatTitle, finalMessages);

      // Record token usage for cumulative stats
      if (result.usage) {
        const { recordTokenUsage } = await import('../services/tokenStats');
        void recordTokenUsage(result.usage.input, result.usage.output);
      }

      // Update Android home-screen widget data. Never block chat if widget update fails.
      try {
        setWidgetData(JSON.stringify({ lastResponse: result.text }), 'com.dimap.argus');
      } catch {
        // Widget module can be unavailable on some builds/dev environments.
      }

    } catch (requestError) {
      flushAllStreamText();
      stopStreamTicker();
      streamMessageId.current = null;
      let message =
        requestError instanceof Error ? requestError.message : 'Неизвестная ошибка запроса';

      if (attachedDocs.some(d => d.name?.match(/\.(png|jpg|jpeg|gif|webp|bmp|heic|heif)$/i))) {
        const lower = message.toLowerCase();
        if (lower.includes('image') || lower.includes('vision') || lower.includes('picture') || lower.includes('photo')) {
          message = 'Эта модель не поддерживает изображения. Удали фото из сообщения или выбери другую модель.';
        }
      }

      setError(message);
      setStatus('error');
      const errorMessages = visibleMessages.map((item) =>
        item.id === assistantMessage.id
          ? { ...item, content: item.content.trim() ? item.content : `Ошибка: ${message}` }
          : item,
      );
      setMessages(errorMessages);
      void saveChatSnapshot(chatId, chatTitle, errorMessages);
      scrollToEnd();
    }
  };

  const startNewChat = () => {
    if (status === 'thinking') return;
    stopStreamTicker();
    streamQueue.current = '';
    streamMessageId.current = null;
    setActiveChatId(null);
    setMessages([initialAssistantMessage]);
    setAttachedDocs([]);
    setError('');
    setStatus('idle');
  };

  const openChat = (chat: StoredChat) => {
    if (status === 'thinking') return;
    setActiveChatId(chat.id);
    setMessages(chat.messages.length ? chat.messages : [initialAssistantMessage]);
    setAttachedDocs([]);
    setError('');
    setStatus('idle');
    setShowChatList(false);
    scrollToEnd();
  };

  const deleteChat = (chatId: string) => {
    Alert.alert('Удалить чат?', 'Диалог будет удален без восстановления.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          void persistChats(chatsRef.current.filter((chat) => chat.id !== chatId));
          if (activeChatId === chatId) {
            startNewChat();
          }
        },
      },
    ]);
  };

  const openDrawer = useCallback(() => setShowChatList(true), []);
  const closeDrawer = useCallback(() => setShowChatList(false), []);

  const openSearch = () => {
    setIsSearching(true);
    setSearchQuery('');
    setSearchResults([]);
    setTimeout(() => searchInputRef.current?.focus(), 300);
  };

  const closeSearch = () => {
    setIsSearching(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSearchQuery = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await searchSessions(text, 5);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
  };

  const openSettingsAnimated = () => {
    closeDrawer();
    setTimeout(() => onOpenSettings(), 350);
  };

  return (
    <View style={styles.slideRoot}>
      {/* Main content - slides right when drawer opens */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: contentTranslate }] }]}>
        {/* Invisible edge zone to open drawer */}
        {!showChatList && (
          <Pressable
            onPress={openDrawer}
            hitSlop={{ right: 20, top: 20, bottom: 20 }}
            style={styles.edgeZone}
          />
        )}
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.container}
          >
            {/* ── Header ── */}
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                onPress={openDrawer}
                style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
              >
                <Menu size={20} color={colors.text} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.modelPill, pressed && styles.pressed]}
                onPress={() => { setModelSearch(''); setShowModelPicker(true); }}
                accessibilityRole="button"
              >
                <Bot size={14} color="#a78bfa" style={{ marginRight: 4 }} />
                <Text style={styles.modelPillLabel} numberOfLines={1}>
                  {modelLabel}
                </Text>
                <ChevronDown size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
              </Pressable>

              <View style={styles.headerRight}>
                <Pressable
                  accessibilityRole="button"
                  onPress={async () => {
                    if (activeChatId) {
                      const files = await listWorkspaceFiles(activeChatId);
                      setWsFiles(files);
                    }
                    setShowWsModal(true);
                  }}
                  style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
                >
                  <Folder size={20} color={colors.text} />
                </Pressable>
                </View>
            </View>

            {/* ── Messages ── */}
            <Animated.ScrollView
              ref={scrollRef}
              contentContainerStyle={[
                styles.scrollContent,
                isEmptyChat && styles.scrollContentEmpty,
              ]}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              onContentSizeChange={scrollToEnd}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1, opacity: entrance }}
            >
              {isEmptyChat ? (
                <View style={styles.welcomeWrap}>
                  <Text style={styles.welcomeTitle}>Чем могу помочь?</Text>
                  {!hasRequiredSettings && (
                    <Pressable
                      onPress={onOpenSettings}
                      style={({ pressed }) => [styles.connectHint, pressed && styles.pressed]}
                    >
                      <Settings size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
                      <Text style={styles.connectHintText}>Настроить подключение</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                messages
                  .filter((m) => m.id !== 'welcome')
                  .map((m) => <MessageBubble key={m.id} message={m} />)
              )}

              {!!error && (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </Animated.ScrollView>

            {/* ── Composer ── */}
            <View style={styles.composerWrap}>
              {attachedDocs.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.docScroll}>
                  {attachedDocs.map((doc, i) => (
                    <View key={i} style={styles.docChip}>
                      <Text style={styles.docChipText}>{doc.name}</Text>
                      <TouchableOpacity onPress={() => setAttachedDocs(prev => prev.filter((_, idx) => idx !== i))}>
                        <X size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={[styles.composer, isFocused && styles.composerFocused]}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowAttachMenu(true)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.attachIcon}>+</Text>
                </Pressable>

                <TextInput
                  multiline
                  onChangeText={setDraft}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Спросить Agent…"
                  placeholderTextColor={colors.textDim}
                  style={styles.input}
                  textAlignVertical="top"
                  value={draft}
                />

                <Animated.View
                  style={styles.sendBtnWrap}
                  pointerEvents={draft.trim().length > 0 ? 'auto' : 'auto'}
                >
                  <Pressable
                    accessibilityRole="button"
                    onPress={draft.trim().length > 0 ? () => sendMessage(draft) : handleVoiceToggle}
                    style={({ pressed }) => [styles.sendBtn, pressed && styles.sendBtnPressed]}
                  >
                    {draft.trim().length > 0 ? (
                      <ArrowUp size={20} color={colors.background} />
                    ) : (
                      <Mic size={20} color={isRecording ? '#ef4444' : colors.background} />
                    )}
                  </Pressable>
                </Animated.View>
              </View>

              {/* ── Status bar ── */}
              <View style={styles.statusBar}>
                <View style={styles.statusLeft}>
                  <View style={[styles.statusDot, { backgroundColor: contextPressureColor }]} />
                  <Animated.View style={{ opacity: tokenPulse }}>
                    <Layers size={11} color={colors.textMuted} style={{ marginRight: 2 }} />
                  </Animated.View>
                  <Text style={styles.tokenText}>
                    Вх: {formatTokenNumber(animInputTokens)}
                    {' / '}
                    Вых: {formatTokenNumber(animOutputTokens)}
                  </Text>
                </View>
                <Text style={styles.statusModel} numberOfLines={1}>{modelLabel}</Text>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Animated.View>

      {/* Drawer overlay */}
      <Animated.View
        style={[styles.drawerOverlay, { opacity: drawerOverlayOpacity }]}
        pointerEvents={showChatList ? 'auto' : 'none'}
      >
        <Pressable style={{ flex: 1 }} onPress={closeDrawer} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View style={[styles.drawerPanelContainer, { transform: [{ translateX: drawerTranslate }] }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={[styles.chatPanelHeader, { marginBottom: 0 }]}>
            {isSearching ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={closeSearch}
                  style={({ pressed }) => [styles.chatCloseBtn, pressed && styles.pressed]}
                >
                  <ArrowLeft size={18} color={colors.textMuted} />
                </Pressable>
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Поиск по истории..."
                  placeholderTextColor={colors.textDim}
                  value={searchQuery}
                  onChangeText={handleSearchQuery}
                  returnKeyType="search"
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={closeDrawer}
                  style={({ pressed }) => [styles.chatCloseBtn, pressed && styles.pressed]}
                >
                  <X size={18} color={colors.textMuted} />
                </Pressable>
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={closeDrawer}
                style={({ pressed }) => [styles.chatCloseBtn, pressed && styles.pressed]}
              >
                <X size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {isSearching ? (
              <>
                {searchQuery.trim() === '' ? (
                  <View style={styles.emptyChatsBox}>
                    <Text style={styles.emptyChatsTitle}>Введите запрос</Text>
                    <Text style={styles.emptyChatsText}>Начни вводить текст для поиска по истории диалогов.</Text>
                  </View>
                ) : searchResults.length === 0 ? (
                  <View style={styles.emptyChatsBox}>
                    <Text style={styles.emptyChatsTitle}>Ничего не найдено</Text>
                    <Text style={styles.emptyChatsText}>Попробуй изменить запрос.</Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.navSectionHeader, { marginTop: spacing.sm }]}>РЕЗУЛЬТАТЫ ПОИСКА</Text>
                    {searchResults.map((result) => (
                      <Pressable
                        key={result.chatId}
                        accessibilityRole="button"
                        onPress={() => {
                          const chat = chatsRef.current.find((c) => c.id === result.chatId);
                          if (chat) { closeSearch(); openChat(chat); }
                        }}
                        style={({ pressed }) => [
                          styles.chatItem,
                          pressed && styles.chatItemPressed,
                        ]}
                      >
                        <View style={styles.chatItemTextWrap}>
                          <Text style={styles.chatItemTitle} numberOfLines={1}>{result.title}</Text>
                          <Text style={styles.searchExcerpt} numberOfLines={2}>{result.excerpt}</Text>
                          <Text style={styles.chatItemMeta}>{formatChatDate(result.updatedAt)} · совпадение {Math.round(result.score * 100)}%</Text>
                        </View>
                      </Pressable>
                    ))}
                  </>
                )}
              </>
            ) : (
              <>
                {/* Навигация */}
                <Text style={[styles.navSectionHeader, { marginTop: spacing.sm }]}>НАВИГАЦИЯ</Text>
                <View style={styles.navCol}>
                  <Pressable
                    onPress={() => { closeDrawer(); startNewChat(); }}
                    style={({ pressed }) => [styles.navRowItem, pressed && styles.pressed]}
                  >
                    <View style={styles.navRowIcon}>
                      <Plus size={18} color={colors.text} />
                    </View>
                    <Text style={styles.navRowLabel}>Новый чат</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openSearch()}
                    style={({ pressed }) => [styles.navRowItem, pressed && styles.pressed]}
                  >
                    <View style={styles.navRowIcon}>
                      <Search size={18} color={colors.text} />
                    </View>
                    <Text style={styles.navRowLabel}>Поиск</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      if (activeChatId) {
                        const files = await listWorkspaceFiles(activeChatId);
                        setWsFiles(files);
                      }
                      closeDrawer();
                      setShowWsModal(true);
                    }}
                    style={({ pressed }) => [styles.navRowItem, pressed && styles.pressed]}
                  >
                    <View style={styles.navRowIcon}>
                      <Folder size={18} color={colors.text} />
                    </View>
                    <Text style={styles.navRowLabel}>Библиотека</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { closeDrawer(); onOpenSandbox(); }}
                    style={({ pressed }) => [styles.navRowItem, pressed && styles.pressed]}
                  >
                    <View style={styles.navRowIcon}>
                      <Globe size={18} color={colors.text} />
                    </View>
                    <Text style={styles.navRowLabel}>Песочница</Text>
                  </Pressable>
                </View>

                {/* Недавние */}
                <Text style={styles.navSectionHeader}>НЕДАВНИЕ</Text>

                {chats.length === 0 ? (
                  <View style={styles.emptyChatsBox}>
                    <Text style={styles.emptyChatsTitle}>Пока нет диалогов</Text>
                    <Text style={styles.emptyChatsText}>Первый чат создастся автоматически после отправки сообщения.</Text>
                  </View>
                ) : (
                  chats.map((chat) => {
                    const isActive = chat.id === activeChatId;
                    return (
                      <Pressable
                        key={chat.id}
                        accessibilityRole="button"
                        onPress={() => openChat(chat)}
                        style={({ pressed }) => [
                          styles.chatItem,
                          isActive && styles.chatItemActive,
                          pressed && styles.chatItemPressed,
                        ]}
                      >
                        <View style={styles.chatItemTextWrap}>
                          <Text style={styles.chatItemTitle} numberOfLines={1}>{chat.title}</Text>
                          <Text style={styles.chatItemMeta} numberOfLines={1}>
                            {formatChatDate(chat.updatedAt)} · {chat.messages.length} сообщ.
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => deleteChat(chat.id)}
                          hitSlop={10}
                          style={({ pressed }) => [styles.chatDeleteBtn, pressed && styles.chatDeleteBtnPressed]}
                        >
                          <Trash2 size={16} color={colors.textMuted} />
                        </Pressable>
                      </Pressable>
                    );
                  })
                )}
              </>
            )}
            <View style={{ height: 80 }} />
          </ScrollView>

          {/* Bottom: настройки + статус */}
          <View style={styles.drawerBottom}>
            <Pressable
              onPress={openSettingsAnimated}
              style={({ pressed }) => [styles.drawerBottomBtn, pressed && styles.pressed]}
            >
              <Settings size={20} color={colors.text} />
            </Pressable>
            <View style={styles.drawerBottomStatus}>
              <View style={[styles.statusDot, { backgroundColor: hasRequiredSettings ? colors.success : colors.danger }]} />
              <Text style={styles.drawerBottomStatusText}>
                {hasRequiredSettings ? 'Подключено' : 'Не настроено'}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* ── Workspace file browser overlay ── */}
      <Animated.View
        style={[styles.drawerOverlay, { opacity: wsOverlayOpacity }]}
        pointerEvents={showWsModal ? 'auto' : 'none'}
      >
        <Pressable style={{ flex: 1 }} onPress={() => { setPreviewFile(null); setShowWsModal(false); }} />
      </Animated.View>

      <Animated.View style={[styles.wsPanelContainer, { transform: [{ translateX: wsTranslate }] }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.chatPanelHeader}>
            <Text style={styles.chatPanelTitle}>Файлы рабочей области</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPreviewFile(null);
                setShowWsModal(false);
              }}
              style={({ pressed }) => [styles.chatCloseBtn, pressed && styles.pressed]}
            >
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {!activeChatId ? (
            <View style={styles.emptyChatsBox}>
              <Text style={styles.emptyChatsTitle}>Нет активного чата</Text>
              <Text style={styles.emptyChatsText}>Создай чат, чтобы появилась рабочая область.</Text>
            </View>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  setShowWsModal(false);
                  await exportWorkspaceArchive(activeChatId);
                }}
                style={({ pressed }) => [styles.newChatButton, pressed && styles.pressed]}
              >
                <Download size={18} color={colors.text} />
                <Text style={styles.newChatText}>Экспорт архива</Text>
              </Pressable>

              {wsFiles.length === 0 ? (
                <View style={styles.emptyChatsBox}>
                  <Text style={styles.emptyChatsTitle}>Рабочая область пуста</Text>
                  <Text style={styles.emptyChatsText}>Попроси AI сохранить файл, и он появится здесь.</Text>
                </View>
              ) : (
                <ScrollView style={styles.chatList} showsVerticalScrollIndicator={false}>
                  {wsFiles.map((file) => (
                    <Pressable
                      key={file.path}
                      accessibilityRole="button"
                      onPress={() => setPreviewFile(file)}
                      style={({ pressed }) => [
                        styles.chatItem,
                        pressed && styles.chatItemPressed,
                      ]}
                    >
                      <View style={styles.chatItemTextWrap}>
                        <Text style={styles.chatItemTitle} numberOfLines={1}>
                          {file.path}
                        </Text>
                        <Text style={styles.chatItemMeta}>
                          {file.size} bytes
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={async () => {
                          await exportWorkspaceFile(activeChatId, file.path);
                        }}
                        hitSlop={10}
                        style={({ pressed }) => [
                          styles.chatDeleteBtn,
                          pressed && styles.chatDeleteBtnPressed,
                        ]}
                      >
                        <Download size={16} color={colors.textMuted} />
                      </Pressable>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </>
          )}
        </SafeAreaView>
      </Animated.View>

      {/* ── File preview sheet ── */}
      <GestureBottomSheet
        visible={!!previewFile}
        onClose={() => setPreviewFile(null)}
        snapPoints={{ full: 60, closed: 3000 }}
        springConfig={{ damping: 30, stiffness: 250 }}
      >
        {previewFile && (
          <>
            <View style={styles.chatPanelHeader}>
              <Text style={styles.chatPanelTitle} numberOfLines={1}>
                {previewFile.path}
              </Text>
            </View>
            {(() => {
              const mode = detectPreviewMode(previewFile.path);
              if (mode === 'html') {
                return (
                  <WebView
                    style={{ height: 400, marginHorizontal: spacing.lg }}
                    source={{ html: previewFile.content }}
                    originWhitelist={['*']}
                    javaScriptEnabled={false}
                  />
                );
              }
              if (mode === 'svg') {
                return (
                  <View style={styles.previewSvgWrap}>
                    <SvgXml xml={previewFile.content} />
                  </View>
                );
              }
              return (
                <ScrollView style={[styles.previewContent, { maxHeight: 400 }]}>
                  <Text style={styles.previewCode} selectable>
                    {previewFile.content}
                  </Text>
                </ScrollView>
              );
            })()}
          </>
        )}
      </GestureBottomSheet>

      {/* ── Model picker overlay ── */}
      {showModelPicker && (
        <>
          <Animated.View
            style={[styles.modelOverlay, { opacity: modelOverlayOpacity }]}
            pointerEvents={showModelPicker ? 'auto' : 'none'}
          >
            <Pressable style={{ flex: 1 }} onPress={() => setShowModelPicker(false)} />
          </Animated.View>
          <Animated.View
            style={[
              styles.modelPanelOuter,
              {
                opacity: modelPickerAnim,
                transform: [{ translateY: modelPanelTranslate }],
              },
            ]}
          >
            <Pressable style={styles.modelPanel} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modelPanelTitle}>Выбрать модель</Text>

              <View style={styles.modelSearchWrap}>
                <Search size={16} color={colors.textMuted} />
                <TextInput
                  autoFocus
                  onChangeText={setModelSearch}
                  placeholder="Поиск…"
                  placeholderTextColor={colors.textDim}
                  style={styles.modelSearchInput}
                  value={modelSearch}
                />
              </View>

              <ScrollView style={styles.modelList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {isLoadingModels ? (
                  <View style={styles.modelEmpty}>
                    <Animated.View style={{ opacity: modelPickerAnim }}>
                      <Text style={styles.modelEmptyText}>Загрузка моделей…</Text>
                    </Animated.View>
                  </View>
                ) : (
                  <>
                    {filteredGroups.map((group) => (
                      <View key={group.provider}>
                        <Text style={styles.modelProviderLabel}>{group.provider}</Text>
                        {group.models.map((m) => {
                          const isActive = settings.model === m;
                          return (
                            <Pressable
                              key={m}
                              onPress={() => {
                                setShowModelPicker(false);
                                void onSaveSettings({ ...settings, model: m }, apiKey);
                              }}
                              style={({ pressed }) => [
                                styles.modelItem,
                                isActive && styles.modelItemActive,
                                pressed && styles.modelItemPressed,
                              ]}
                            >
                              <Text style={[styles.modelItemText, isActive && styles.modelItemTextActive]}>
                                {m}
                              </Text>
                              {isActive && <Check size={16} color="#a78bfa" />}
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}

                    {modelSearch.trim().length > 0 && (
                      <View>
                        <Text style={styles.modelProviderLabel}>Другое</Text>
                        <Pressable
                          onPress={() => {
                            setShowModelPicker(false);
                            void onSaveSettings({ ...settings, model: modelSearch.trim() }, apiKey);
                          }}
                          style={({ pressed }) => [styles.modelItem, pressed && styles.modelItemPressed]}
                        >
                          <Text style={styles.modelItemText}>«{modelSearch.trim()}»</Text>
                        </Pressable>
                      </View>
                    )}

                    {filteredGroups.length === 0 && modelSearch.trim().length === 0 && (
                      <View style={styles.modelEmpty}>
                        <Text style={styles.modelEmptyText}>Нет моделей</Text>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </>
      )}

      {/* ── Attach Bottom Sheet ── */}
      <GestureBottomSheet
        visible={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        snapPoints={{ partial: BOTTOM_SHEET_HEIGHT - 260, closed: 3000 }}
        springConfig={{ damping: 28, stiffness: 220 }}
      >
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.md }}>
          {[
            { label: 'Камера', icon: Camera, onPress: handleCamera },
            { label: 'Фото', icon: Image, onPress: handlePhotoLibrary },
            { label: 'Файлы', icon: Paperclip, onPress: handleAttachDocument },
            { label: 'Файл. менеджер', icon: Folder, onPress: handleOpenFiles },
            { label: 'Контакты', icon: Users, onPress: handleContactsSearch },
            { label: internetEnabled ? 'Интернет: вкл' : 'Интернет: выкл', icon: Globe, onPress: () => setInternetEnabled((p) => !p), iconColor: internetEnabled ? '#60a5fa' : colors.textMuted },
          ].map((item) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [styles.attachItem, pressed && styles.attachItemPressed]}
              onPress={() => {
                setShowAttachMenu(false);
                item.onPress();
              }}
            >
              <View style={styles.attachItemIcon}>
                <item.icon size={22} color={(item as any).iconColor || colors.textMuted} />
              </View>
              <Text style={styles.attachItemLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </GestureBottomSheet>
    </View>
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
  slideRoot: {
    backgroundColor: colors.background,
    flex: 1,
  },
  edgeZone: {
    height: 60,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 30,
    zIndex: 100,
  },
  drawerOverlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  drawerPanelContainer: {
    backgroundColor: colors.backgroundSoft,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    height: '100%',
    left: 0,
    paddingTop: 0,
    position: 'absolute',
    top: 0,
    width: 290,
    zIndex: 2,
  },
  wsPanelContainer: {
    backgroundColor: colors.backgroundSoft,
    borderLeftColor: colors.border,
    borderLeftWidth: 1,
    height: '100%',
    paddingTop: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 290,
    zIndex: 3,
  },

  /* Header */
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  headerBtnIcon: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '400',
  },
  pressed: {
    opacity: 0.6,
  },
  headerRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  modelPill: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    maxWidth: 220,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  modelPillStar: {
    color: '#a78bfa',
    fontSize: typography.body,
    fontWeight: '600',
  },
  modelPillLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '500',
    flexShrink: 1,
  },
  modelPillChevron: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
  },

  /* Model picker */
  modelOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },
  modelPanelOuter: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: Platform.OS === 'ios' ? 100 : 70,
    zIndex: 11,
  },
  modelPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    maxHeight: '70%',
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 14,
  },
  modelPanelTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  modelSearchWrap: {
    alignItems: 'center',
    backgroundColor: colors.userBubble,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  modelSearchIcon: {
    fontSize: 14,
  },
  modelSearchInput: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    paddingVertical: spacing.sm,
  },
  modelList: {
    maxHeight: 340,
  },
  modelProviderLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
    textTransform: 'uppercase',
  },
  modelItem: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  modelItemActive: {
    backgroundColor: 'rgba(167,139,250,0.1)',
  },
  modelItemPressed: {
    backgroundColor: colors.userBubble,
    opacity: 0.8,
  },
  modelItemText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '400',
    flexShrink: 1,
  },
  modelItemTextActive: {
    color: '#a78bfa',
    fontWeight: '600',
  },
  modelItemCheck: {
    color: '#a78bfa',
    fontSize: typography.body,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  modelEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  modelEmptyText: {
    color: colors.textDim,
    fontSize: typography.body,
  },

  /* Chat history */
  chatOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
  },
  chatPanel: {
    backgroundColor: colors.backgroundSoft,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    height: '100%',
    paddingTop: Platform.OS === 'ios' ? 54 : 28,
    paddingHorizontal: spacing.lg,
    width: '84%',
    maxWidth: 360,
  },
  chatPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  chatPanelTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  chatCloseBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  chatCloseText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  newChatButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  newChatIcon: {
    color: '#a78bfa',
    fontSize: 17,
    fontWeight: '700',
  },
  newChatText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  emptyChatsBox: {
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderStyle: 'dashed',
    borderWidth: 1,
    padding: spacing.lg,
  },
  emptyChatsTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptyChatsText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    alignItems: 'center',
    borderRadius: radius.xl,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  chatItemActive: {
    backgroundColor: colors.surface,
  },
  chatItemPressed: {
    backgroundColor: colors.userBubble,
  },
  chatItemTextWrap: {
    flex: 1,
  },
  chatItemTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  chatItemMeta: {
    color: colors.textDim,
    fontSize: typography.caption,
    marginTop: 3,
  },
  chatDeleteBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  chatDeleteBtnPressed: {
    backgroundColor: colors.dangerSoft,
  },
  chatDeleteText: {
    fontSize: 16,
  },

  /* Scroll */
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  scrollContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  /* Welcome */
  welcomeWrap: {
    alignItems: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  welcomeTitle: {
    color: colors.text,
    fontSize: typography.hero,
    fontWeight: '600',
    textAlign: 'center',
  },
  connectHint: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  connectHintText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '500',
  },


  /* Error */
  errorCard: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.caption,
    lineHeight: 18,
  },

  /* Composer */
  composerWrap: {
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  composer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xxl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  composerFocused: {
    borderColor: colors.borderStrong,
  },
  statusBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  statusLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statusDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  tokenText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  statusModel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '400',
    maxWidth: '50%',
  },
  attachIcon: {
    color: colors.textMuted,
    fontSize: 22,
    fontWeight: '300',
    paddingHorizontal: spacing.xs,
  },
  voiceBtn: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    lineHeight: 22,
    maxHeight: 120,
    minHeight: 26,
    paddingVertical: spacing.xs,
  },

  sendBtnWrap: {
    height: 34,
    width: 34,
  },
  sendBtn: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  sendBtnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.93 }],
  },
  sendBtnText: {
    color: colors.background,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 20,
  },

  /* Attach bottom sheet */
  attachOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
  },
  attachSheet: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xxl,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  attachItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    borderRadius: radius.lg,
  },
  attachItemPressed: {
    backgroundColor: colors.userBubble,
    opacity: 0.9,
  },
  attachItemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.userBubble,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachItemLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '500',
  },

  /* Attach icons */
  icCamera: {
    alignItems: 'center',
    borderColor: colors.textMuted,
    borderRadius: 3,
    borderWidth: 2,
    height: 16,
    justifyContent: 'center',
    width: 20,
  },
  icCameraLens: {
    borderColor: colors.textMuted,
    borderRadius: 4,
    borderWidth: 2,
    height: 8,
    width: 8,
  },
  icPhoto: {
    alignItems: 'center',
    borderColor: colors.textMuted,
    borderRadius: 3,
    borderWidth: 2,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  icPhotoEl: {
    borderColor: colors.textMuted,
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    width: 10,
  },
  icFile: {
    borderBottomRightRadius: 2,
    borderColor: colors.textMuted,
    borderRadius: 2,
    borderTopRightRadius: 4,
    borderWidth: 2,
    height: 18,
    width: 14,
  },
  icDiamond: {
    borderColor: colors.textMuted,
    borderWidth: 2,
    height: 12,
    margin: 3,
    transform: [{ rotate: '45deg' }],
    width: 12,
  },
  icCircle: {
    borderColor: colors.textMuted,
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    width: 16,
  },

  /* Preview */
  previewSheet: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xxl,
    borderWidth: 1,
    maxHeight: '80%',
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  previewContent: {
    marginTop: spacing.md,
    maxHeight: 400,
  },
  previewCode: {
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  previewWebview: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    height: 400,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  previewSvgWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 200,
    padding: spacing.xl,
  },

  /* Docs */
  docScroll: {
    marginBottom: spacing.sm,
  },
  docChip: {
    backgroundColor: '#2d2d4e',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginRight: spacing.sm,
  },
  docChipText: {
    color: '#a78bfa',
    fontSize: 12,
  },
  docDelete: {
    color: colors.textMuted,
    fontSize: 14,
  },

  /* Navigation drawer */
  navScroll: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  navSectionHeader: {
    color: colors.textDim,
    fontSize: typography.caption,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  navCol: {
    gap: 2,
  },
  navRowItem: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  navRowIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  navRowLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '500',
  },
  drawerBottom: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  drawerBottomBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  drawerBottomStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  drawerBottomStatusText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '500',
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    height: 36,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchExcerpt: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
    marginTop: 2,
  },
});
