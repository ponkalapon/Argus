/**
 * Compatibility layer — wraps API calls under the same function names
 * that the existing components expect. Swap imports from '../services/*' to '../api'.
 *
 * Native-only services (voice, contacts, document picker) still import from their original paths.
 */

// Re-export the raw client
export * from './client';

// ─── OpenAI Client compatibility ───
// The old requestChatCompletion ran the full tool loop client-side.
// Now the server handles tools, memory, RAG, compression — the app just sends a message.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { chatStream, chat, listSessions, createSession, setBaseUrl, getBaseUrl } from './client';
import type { StoredChat, ChatMessage } from '../types';

export const requestChatCompletion = async (opts: {
  settings: { baseUrl: string; model: string };
  apiKey: string;
  messages: { role: string; content: string | null }[];
  onToken?: (token: string) => void;
  tools?: unknown[];
  context?: {
    workspaceId?: string;
    contactsAccessEnabled?: boolean;
    requestContactDisclosure?: (payload: {
      query: string;
      results: { id: string; name: string; phoneCount: number; maskedPhones: string[] }[];
    }) => Promise<boolean>;
    confirmCommunication?: (payload: { action: 'call' | 'sms'; phone: string; name?: string }) => Promise<boolean>;
  };
}): Promise<{ text: string; usage?: { input: number; output: number; total: number } }> => {
  const { onToken, messages, settings } = opts;

  // Use the server URL from settings (allows phone to point to computer's LAN IP)
  if (settings.baseUrl) {
    setBaseUrl(settings.baseUrl);
  }

  // Extract last user message
  const userMessages = messages.filter(m => m.role === 'user');
  const lastUserMsg = userMessages[userMessages.length - 1]?.content || '';

  // Get or create session
  const sessionsRes = await listSessions();
  let sessionId = sessionsRes.sessions?.[0]?.id;
  if (!sessionId) {
    const created = await createSession();
    sessionId = created.sessionId;
  }

  if (onToken) {
    const result = await chatStream(sessionId, lastUserMsg, onToken);
    return { text: result.text, usage: result.usage };
  } else {
    const result = await chat(sessionId, lastUserMsg);
    return { text: result.response };
  }
};

// ─── Memory compatibility ───
import { listMemory, addMemory } from './client';
export { listMemory, addMemory };
export const searchMemory = async (query: string): Promise<{ key: string; value: string; type: string }[]> => {
  const res = await listMemory();
  const q = query.toLowerCase();
  return (res.entries || []).filter(
    e => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q),
  );
};

// ─── Token stats compatibility ───
import { getStats } from './client';

export const getTokenStats = async (): Promise<{ input: number; output: number; total: number }> => {
  try {
    const res = await getStats();
    return res.stats || { input: 0, output: 0, total: 0 };
  } catch {
    return { input: 0, output: 0, total: 0 };
  }
};

export const getDailyStats = async (): Promise<DailyRecord[]> => {
  // Server manages stats; daily detail TBD
  return [];
};

export const resetTokenStats = async (): Promise<void> => {
  // Not applicable — server persists stats
};

export const recordTokenUsage = async (_input: number, _output: number): Promise<void> => {
  // Server auto-records token usage
};

// ─── Storage compatibility ───
// API key and settings are stored on the server; we keep a local copy for quick access.

const STORAGE_KEYS = {
  API_KEY: '@api_key',
  SETTINGS: '@agent_settings',
};

export const loadApiKey = async (): Promise<string> => {
  try {
    const local = await AsyncStorage.getItem(STORAGE_KEYS.API_KEY);
    return local || '';
  } catch {
    return '';
  }
};

export const saveApiKey = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.API_KEY, key);
    // Also sync to server config
    fetch(`${getBaseUrl()}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key }),
    }).catch(() => {});
  } catch {}
};

export const sanitizeSettings = (settings: { baseUrl: string; model: string; allowAssistantContacts?: boolean }) => ({
  baseUrl: settings.baseUrl?.replace(/\/+$/, '') || 'http://localhost:3456',
  model: settings.model?.trim() || 'gpt-4o-mini',
  allowAssistantContacts: !!settings.allowAssistantContacts,
});

// ─── Settings storage ───

const SETTINGS_KEY = '@agent_settings_v2';
const CHATS_KEY = '@chats';

const defaultSettings = { baseUrl: 'http://localhost:3456', model: 'gpt-4o-mini', allowAssistantContacts: false };

export const loadSettings = async (): Promise<{ baseUrl: string; model: string; allowAssistantContacts: boolean }> => {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const settings = raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
    // Sync the API client's base URL to the loaded setting
    setBaseUrl(settings.baseUrl);
    return settings;
  } catch {
    return { ...defaultSettings };
  }
};

export const saveSettings = async (settings: { baseUrl: string; model: string; allowAssistantContacts?: boolean }): Promise<void> => {
  const sanitized = sanitizeSettings(settings);
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitized));
  // Apply the new server URL immediately
  setBaseUrl(sanitized.baseUrl);
  // Sync model to server
  fetch(`${getBaseUrl()}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: settings.model, baseUrl: settings.baseUrl }),
  }).catch(() => {});
};

export const loadChats = async (): Promise<StoredChat[]> => {
  try {
    const raw = await AsyncStorage.getItem(CHATS_KEY);
    const chats: StoredChat[] = raw ? JSON.parse(raw) : [];
    return chats;
  } catch {
    return [];
  }
};

export const saveChats = async (chats: unknown[]): Promise<void> => {
  await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
};

export const loadInternetEnabled = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem('@internet_enabled')) === 'true';
  } catch {
    return false;
  }
};

export const saveInternetEnabled = async (enabled: boolean): Promise<void> => {
  await AsyncStorage.setItem('@internet_enabled', enabled ? 'true' : 'false');
};

// ─── Token stats types ───
export interface DailyRecord {
  date: string;
  input: number;
  output: number;
  total: number;
}

export type TokenStatsType = { input: number; output: number; total: number };

export type { ChatCompletionResult, ChatCompletionMessage, TokenUsage } from '../types';

// ─── Skills compatibility ───

export interface Skill { name: string; description: string; content: string; category: string; id?: string; usageCount?: number; triggerKeywords?: string[] }

export const listSkills = async (): Promise<Skill[]> => {
  // Skills live on server; for now return empty
  return [];
};

export const deleteSkill = async (_name: string): Promise<void> => {
  // Skills live on server
};

// ─── Workspace compatibility ───
// Workspace operations now hit the API

export interface WorkspaceFile {
  path: string;
  createdAt: number;
  updatedAt: number;
}

let _fileCache: Record<string, string> = {};

export const setExternalSearchRoot = (root: string) => {
  // Local file search root — keep on device
};

export const listWorkspaceFiles = async (workspaceId: string): Promise<WorkspaceFile[]> => {
  // Files are managed server-side via workspace
  return [
    ...Object.keys(_fileCache).map((path) => ({
      path,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })),
  ];
};

export const readWorkspaceFile = async (_workspaceId: string, path: string): Promise<string | null> => {
  return _fileCache[path] || null;
};

export const exportWorkspaceFile = async (_workspaceId: string, _path: string): Promise<void> => {
  // Server export
};

export const exportWorkspaceArchive = async (_workspaceId: string): Promise<Record<string, string> | null> => {
  return _fileCache;
};

export const workspaceSummary = async (_workspaceId: string): Promise<string> => {
  // Could fetch from server in future
  return '';
};

// ─── Session search compatibility ───

export const searchSessions = async (_query: string): Promise<{ sessionId: string; title: string; content: string }[]> => {
  // Server-side search
  return [];
};

export const indexChat = async (_session: unknown): Promise<void> => {
  // Server indexes automatically
};

// ─── Tool definitions compatibility ───
// Tools run server-side now — no need to send definitions from the app

export const TOOL_DEFINITIONS: unknown[] = [];

// ─── Contacts (still native) ───
// Should stay native — import from the original services/contacts
