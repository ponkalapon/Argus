import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AgentSettings, StoredChat } from '../types';

const SETTINGS_KEY = 'argus.settings.v1';
const API_KEY = 'argus.apiKey.v1';
const CHATS_KEY = 'argus.chats.v1';

export const defaultSettings: AgentSettings = {
  baseUrl: 'https://api.openai.com',
  model: '',
  allowAssistantContacts: false,
};

export const sanitizeSettings = (settings: Partial<AgentSettings> | null | undefined): AgentSettings => ({
  baseUrl: String(settings?.baseUrl || defaultSettings.baseUrl).trim(),
  model: String(settings?.model || defaultSettings.model).trim(),
  allowAssistantContacts: settings?.allowAssistantContacts === true,
});

export const loadSettings = async (): Promise<AgentSettings> => {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return defaultSettings;
  }
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
  try {
    const val = await AsyncStorage.getItem(API_KEY);
    if (val) return val;
    const legacy = await AsyncStorage.getItem('@api_key');
    if (legacy) return legacy;
  } catch {}
  return '';
};

export const saveApiKey = async (apiKey: string): Promise<void> => {
  const normalized = apiKey.trim();
  try {
    if (!normalized) {
      await AsyncStorage.removeItem(API_KEY);
      await AsyncStorage.removeItem('@api_key');
      return;
    }
    await AsyncStorage.setItem(API_KEY, normalized);
    await AsyncStorage.setItem('@api_key', normalized);
  } catch {}
};

const sanitizeChat = (chat: Partial<StoredChat> | null | undefined): StoredChat | null => {
  const id = String(chat?.id || '').trim();
  const messages = Array.isArray(chat?.messages) ? chat.messages : [];
  if (!id) return null;
  return {
    id,
    title: String(chat?.title || 'Новый чат').trim(),
    messages,
    createdAt: typeof chat?.createdAt === 'number' ? chat.createdAt : Date.now(),
    updatedAt: typeof chat?.updatedAt === 'number' ? chat.updatedAt : Date.now(),
  };
};

export const loadChats = async (): Promise<StoredChat[]> => {
  const raw = (await AsyncStorage.getItem(CHATS_KEY)) || (await AsyncStorage.getItem('@chats'));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeChat).filter((c): c is StoredChat => c !== null);
  } catch {
    return [];
  }
};

export const saveChats = async (chats: StoredChat[]): Promise<void> => {
  const data = JSON.stringify(chats);
  await AsyncStorage.setItem(CHATS_KEY, data);
  await AsyncStorage.setItem('@chats', data);
};

const INTERNET_KEY = '@internet_enabled_v1';

export const loadInternetEnabled = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem(INTERNET_KEY);
    return val === 'true';
  } catch {
    return false;
  }
};

export const saveInternetEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(INTERNET_KEY, enabled ? 'true' : 'false');
  } catch {}
};
