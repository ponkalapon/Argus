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
import { requestChatCompletion, normalizeBaseUrl } from '../services/openaiClient';
import { TOOL_DEFINITIONS } from '../services/tools';
import { AgentSettings, AgentStatus, ChatCompletionMessage, ChatMessage, StoredChat } from '../types';
import { colors, motion, radius, spacing, typography } from '../styles/theme';
import { DocumentContext, PDF_UNSUPPORTED_MESSAGE, pickAndParseDocument, searchContext } from '../services/rag';
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
import { ArrowLeft, ArrowUp, Bot, Camera, Check, ChevronDown, Download, Folder, Globe, Image, Layers, Menu, Mic, Paperclip, Plus, RefreshCw, Search, Settings, Trash2, Users, X } from 'lucide-react-native';

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

  const [modelLoadError, setModelLoadError] = useState('');
  // Счётчик для принудительного перезапуска fetch при нажатии "Повторить"
  const [modelFetchTrigger, setModelFetchTrigger] = useState(0);

  const fetchModels = useCallback(() => {
    setModelFetchTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!showModelPicker || !settings.baseUrl.trim()) return;
    let cancelled = false;
    setModelLoadError('');
    setIsLoadingModels(true);
    setModelGroups([]);

    // Use normalizeBaseUrl to strip trailing /v1 — prevents double /v1/v1/models
    let baseUrl: string;
    try {
      baseUrl = norma