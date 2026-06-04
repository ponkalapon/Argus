import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { setWidgetData } from '@bittingz/expo-widgets';

import { requestChatCompletion } from '../services/openaiClient';
import { TOOL_DEFINITIONS } from '../services/tools';
import { estimateMessagesTokens, estimateTokens } from '../services/context';
import { loadChats, saveChats } from '../services/storage';
import { searchContext } from '../services/rag';
import type { DocumentContext } from '../services/rag';
import type { AgentSettings, AgentStatus, ChatCompletionMessage, ChatMessage, StoredChat } from '../types';

export const initialAssistantMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Привет! Чем могу помочь?',
  createdAt: Date.now(),
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createChatTitle = (content: string) => {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine.length > 36 ? `${oneLine.slice(0, 36).trim()}…` : oneLine || 'Новый чат';
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

type UseChatSessionParams = {
  settings: AgentSettings;
  apiKey: string;
  hasRequiredSettings: boolean;
  attachedDocs: DocumentContext[];
  internetEnabled: boolean;
  onOpenSettings: () => void;
  setAttachedDocs: Dispatch<SetStateAction<DocumentContext[]>>;
  setDraft: Dispatch<SetStateAction<string>>;
  scrollToEnd: () => void;
};

export const useChatSession = ({
  settings,
  apiKey,
  hasRequiredSettings,
  attachedDocs,
  internetEnabled,
  onOpenSettings,
  setAttachedDocs,
  setDraft,
  scrollToEnd,
}: UseChatSessionParams) => {
  const [messages, setMessages] = useState<ChatMessage[]>([initialAssistantMessage]);
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [error, setError] = useState('');
  const [chats, setChats] = useState<StoredChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [inputTokens, setInputTokens] = useState(0);
  const [outputTokens, setOutputTokens] = useState(0);

  const streamedTextRef = useRef('');
  const streamQueue = useRef('');
  const streamTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamMessageId = useRef<string | null>(null);
  const chatsRef = useRef<StoredChat[]>([]);

  const isEmptyChat = messages.length === 1 && messages[0].id === 'welcome';
  const messageCount = useMemo(() => messages.filter(m => m.id !== 'welcome').length, [messages]);

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
        context: { workspaceId: chatId },
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

      setMessages(finalMessages);
      void saveChatSnapshot(chatId, chatTitle, finalMessages);

      if (result.usage) {
        const { recordTokenUsage } = await import('../services/tokenStats');
        void recordTokenUsage(result.usage.input, result.usage.output);
      }

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

  return {
    activeChatId,
    chats,
    deleteChat,
    error,
    inputTokens,
    isEmptyChat,
    messageCount,
    messages,
    openChat,
    outputTokens,
    sendMessage,
    startNewChat,
    status,
  };
};
