import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AgentSettings, LLMProvider, StoredChat } from '../types';

const SETTINGS_KEY = 'argus.settings.v1';
const API_KEY = 'argus.apiKey.v1';
const CHATS_KEY = 'argus.chats.v1';
const INTERNET_KEY = 'argus.internet.v1';

export const loadInternetEnabled = async (): Promise<boolean> => {
  const raw = await AsyncStorage.getItem(INTERNET_KEY);
  return raw === 'true';
};

export const saveInternetEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(INTERNET_KEY, enabled ? 'true' : 'false');
};

export const PROVIDER_DEFAULTS: Record<LLMProvider, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com', model: 'gpt-4.1-mini' },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-3-5-haiku-20241022' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.0-flash' },
};

const VALID_PROVIDERS: LLMProvider[] = ['openai', 'anthropic', 'gemini'];

export const defaultSettings: AgentSettings = {
  provider: 'openai',
  baseUrl: PROVIDER_DEFAULTS.openai.baseUrl,
  model: PROVIDER_DEFAULTS.openai.model,
  allowAssistantContacts: false,
};

export const sanitizeSettings = (settings: Partial<AgentSettings> | null | undefined): AgentSettings => {
  const provider: LLMProvider = VALID_PROVIDERS.includes(settings?.provider as LLMProvider)
    ? (settings!.provider as LLMProvider)
    : defaultSettings.provider;
  return {
    provider,
    baseUrl: String(settings?.baseUrl || PROVIDER_DEFAULTS[provider].baseUrl).trim(),
    model: String(settings?.model || PROVIDER_DEFAULTS[provider].model).trim(),
    allowAssistantContacts: settings?.allowAssistantContacts === true,
  };
};

export const loadSettings = async (): Promise<AgentSettings> => {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return defaultSettings;
  try {
    return sanitizeSettings(JSON.parse(raw) as Partial<AgentSettings>);
  } catch {
    return defaultSettings;
  }
};

export const saveSettings = async (settings: AgentSettings): Promise<void> => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitizeSettings(settings)));
};

export const loadApiKey = async (): Promise<string> => {
  return (await SecureStore.getItemAsync(API_KEY)) || '';
};

export const saveApiKey = async (apiKey: string): Promise<void> => {
  const normalized = apiKey.trim();
  if (!normalized) {
    await SecureStore.deleteItemAsync(API_KEY);
    return;
  }
  await SecureStore.setItemAsync(API_KEY, normalized, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
};

const sanitizeChat = (chat: Partial<StoredChat> | null | undefined): StoredChat | null => {
  const id = String(chat?.id || '').trim();
  const messages = Array.isArray(chat?.messages) ? chat.messages : [];
  if (!id || messages.length === 0) return null;
  const now = Date.now();
  return {
    id,
    title: String(chat?.title || 'Новый чат').trim() || 'Новый чат',
    messages: messages
      .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
      .map((message) => ({
        id: String(message.id || `${now}-${Math.random().toString(16).slice(2)}`),
        role: message.role,
        content: String(message.content || ''),
        createdAt: typeof message.createdAt === 'number' ? message.createdAt : now,
      })),
    createdAt: typeof chat?.createdAt === 'number' ? chat.createdAt : now,
    updatedAt: typeof chat?.updatedAt === 'number' ? chat.updatedAt : now,
  };
};

export const loadChats = async (): Promise<StoredChat[]> => {
  const raw = await AsyncStorage.getItem(CHATS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((chat) => sanitizeChat(chat))
      .filter((chat): chat is StoredChat => Boolean(chat))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
};

export const saveChats = async (chats: StoredChat[]): Promise<void> => {
  const sanitized = chats
    .map((chat) => sanitizeChat(chat))
    .filter((chat): chat is StoredChat => Boolean(chat))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(sanitized));
};
