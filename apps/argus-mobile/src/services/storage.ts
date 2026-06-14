import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AgentSettings, AuthScheme, LLMProvider, StoredChat } from '../types';

const SETTINGS_KEY = 'argus.settings.v1';
const API_KEY_PREFIX = 'argus.apiKey.v2.';
const CHATS_KEY = 'argus.chats.v1';
const INTERNET_KEY = 'argus.internet.v1';

export const loadInternetEnabled = async (): Promise<boolean> => {
  const raw = await AsyncStorage.getItem(INTERNET_KEY);
  return raw === 'true';
};

export const saveInternetEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem(INTERNET_KEY, enabled ? 'true' : 'false');
};

export type ProviderMeta = {
  label: string;
  baseUrl: string;
  model: string;
  /** Поддерживаемые схемы авторизации. Первая — дефолтная. */
  authSchemes: AuthScheme[];
  /** Подсказка для поля API Key */
  keyHint?: string;
  /** Ссылка для получения ключа */
  keyUrl?: string;
  /** Заголовок для передачи ключа (если отличается от Authorization: Bearer) */
  authHeader?: 'Authorization' | 'x-api-key' | 'api-key';
  /** Передавать ключ как query-параметр вместо заголовка */
  keyAsQuery?: string;
  /** Использует OpenAI-совместимый формат чата */
  openAICompat: boolean;
};

export const PROVIDER_META: Record<LLMProvider, ProviderMeta> = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4.1-mini',
    authSchemes: ['apiKey'],
    keyHint: 'sk-...',
    keyUrl: 'https://platform.openai.com/api-keys',
    authHeader: 'Authorization',
    openAICompat: true,
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-haiku-20241022',
    authSchemes: ['apiKey'],
    keyHint: 'sk-ant-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    authHeader: 'x-api-key',
    openAICompat: false,
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.0-flash',
    authSchemes: ['apiKey', 'oauth'],
    keyHint: 'AIza...',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyAsQuery: 'key',
    openAICompat: false,
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api',
    model: 'openai/gpt-4o-mini',
    authSchemes: ['apiKey', 'oauth'],
    keyHint: 'sk-or-...',
    keyUrl: 'https://openrouter.ai/keys',
    authHeader: 'Authorization',
    openAICompat: true,
  },
  ollama: {
    label: 'Ollama (локальный)',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
    authSchemes: ['none'],
    keyHint: 'не требуется',
    openAICompat: true,
  },
  mistral: {
    label: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai',
    model: 'mistral-small-latest',
    authSchemes: ['apiKey'],
    keyHint: 'ваш Mistral API ключ',
    keyUrl: 'https://console.mistral.ai/api-keys',
    authHeader: 'Authorization',
    openAICompat: true,
  },
  cohere: {
    label: 'Cohere',
    baseUrl: 'https://api.cohere.com',
    model: 'command-r-plus',
    authSchemes: ['apiKey'],
    keyHint: 'ваш Cohere API ключ',
    keyUrl: 'https://dashboard.cohere.com/api-keys',
    authHeader: 'Authorization',
    openAICompat: false,
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai',
    model: 'llama-3.1-8b-instant',
    authSchemes: ['apiKey'],
    keyHint: 'gsk_...',
    keyUrl: 'https://console.groq.com/keys',
    authHeader: 'Authorization',
    openAICompat: true,
  },
  together: {
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz',
    model: 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
    authSchemes: ['apiKey'],
    keyHint: 'ваш Together API ключ',
    keyUrl: 'https://api.together.ai/settings/api-keys',
    authHeader: 'Authorization',
    openAICompat: true,
  },
  xai: {
    label: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai',
    model: 'grok-3-mini',
    authSchemes: ['apiKey'],
    keyHint: 'xai-...',
    keyUrl: 'https://console.x.ai/',
    authHeader: 'Authorization',
    openAICompat: true,
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    authSchemes: ['apiKey'],
    keyHint: 'ваш DeepSeek API ключ',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    authHeader: 'Authorization',
    openAICompat: true,
  },
  azure: {
    label: 'Azure OpenAI',
    baseUrl: 'https://{resource}.openai.azure.com',
    model: 'gpt-4o',
    authSchemes: ['azure', 'oauth'],
    keyHint: 'ваш Azure API ключ',
    keyUrl: 'https://portal.azure.com',
    authHeader: 'api-key',
    openAICompat: true,
  },
  custom: {
    label: 'Свой endpoint',
    baseUrl: '',
    model: '',
    authSchemes: ['apiKey', 'none'],
    keyHint: 'ключ если нужен',
    openAICompat: true,
  },
};

/** Обратная совместимость */
export const PROVIDER_DEFAULTS: Record<LLMProvider, { baseUrl: string; model: string }> = Object.fromEntries(
  Object.entries(PROVIDER_META).map(([k, v]) => [k, { baseUrl: v.baseUrl, model: v.model }])
) as Record<LLMProvider, { baseUrl: string; model: string }>;

export const ALL_PROVIDERS = Object.keys(PROVIDER_META) as LLMProvider[];

const VALID_PROVIDERS = ALL_PROVIDERS;

export const defaultSettings: AgentSettings = {
  provider: 'openai',
  baseUrl: PROVIDER_META.openai.baseUrl,
  model: PROVIDER_META.openai.model,
  allowAssistantContacts: false,
};

export const sanitizeSettings = (settings: Partial<AgentSettings> | null | undefined): AgentSettings => {
  const provider: LLMProvider = VALID_PROVIDERS.includes(settings?.provider as LLMProvider)
    ? (settings!.provider as LLMProvider)
    : defaultSettings.provider;
  return {
    provider,
    baseUrl: String(settings?.baseUrl ?? PROVIDER_META[provider].baseUrl).trim(),
    model: String(settings?.model ?? PROVIDER_META[provider].model).trim(),
    allowAssistantContacts: settings?.allowAssistantContacts === true,
    azureResourceName: settings?.azureResourceName,
    azureDeploymentId: settings?.azureDeploymentId,
    azureApiVersion: settings?.azureApiVersion,
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

/** Ключ хранится отдельно на каждого провайдера */
const apiKeyStorageKey = (provider: LLMProvider) => `${API_KEY_PREFIX}${provider}`;

export const loadApiKey = async (provider?: LLMProvider): Promise<string> => {
  // обратная совместимость со старым ключом
  const legacyKey = 'argus.apiKey.v1';
  if (!provider) {
    const legacy = await SecureStore.getItemAsync(legacyKey);
    return legacy || '';
  }
  const val = await SecureStore.getItemAsync(apiKeyStorageKey(provider));
  if (val) return val;
  // fallback: попробовать старый единый ключ
  const legacy = await SecureStore.getItemAsync(legacyKey);
  return legacy || '';
};

export const saveApiKey = async (apiKey: string, provider?: LLMProvider): Promise<void> => {
  const normalized = apiKey.trim();
  const key = provider ? apiKeyStorageKey(provider) : 'argus.apiKey.v1';
  if (!normalized) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await SecureStore.setItemAsync(key, normalized, {
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
