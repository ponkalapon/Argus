import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage } from '../types';

export type SessionEntry = {
  chatId: string;
  title: string;
  messages: { role: string; content: string }[];
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = '@session_search_index';
const MAX_SESSIONS = 50;

let cache: SessionEntry[] | null = null;

const load = async (): Promise<SessionEntry[]> => {
  if (cache) return cache;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  cache = raw ? JSON.parse(raw) : [];
  return cache!;
};

const save = async (entries: SessionEntry[]) => {
  cache = entries;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
};

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

export const indexChat = async (
  chatId: string,
  title: string,
  messages: ChatMessage[],
) => {
  const entries = await load();
  const existing = entries.findIndex((e) => e.chatId === chatId);

  const entry: SessionEntry = {
    chatId,
    title,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    createdAt: existing !== -1 ? entries[existing].createdAt : Date.now(),
    updatedAt: Date.now(),
  };

  if (existing !== -1) {
    entries[existing] = entry;
  } else {
    if (entries.length >= MAX_SESSIONS) {
      entries.sort((a, b) => a.updatedAt - b.updatedAt);
      entries[0] = entry;
    } else {
      entries.push(entry);
    }
  }

  await save(entries);
};

export const searchSessions = async (
  query: string,
  limit = 5,
): Promise<
  { chatId: string; title: string; excerpt: string; score: number; updatedAt: number }[]
> => {
  const entries = await load();
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];

  const scored = entries.map((entry) => {
    const allText = `${entry.title} ${entry.messages.map((m) => m.content).join(' ')}`;
    const textTokens = tokenize(allText);

    let matches = 0;
    for (const qt of queryTokens) {
      for (const tt of textTokens) {
        if (tt.includes(qt) || qt.includes(tt)) {
          matches++;
          break;
        }
      }
    }

    const score = matches / queryTokens.length;

    const matchIdx = allText.toLowerCase().indexOf(queryTokens[0]);
    const excerpt =
      matchIdx !== -1
        ? allText.slice(Math.max(0, matchIdx - 40), matchIdx + 120) + '...'
        : entry.title;

    return { chatId: entry.chatId, title: entry.title, excerpt, score, updatedAt: entry.updatedAt };
  });

  return scored
    .filter((s) => s.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

export const sessionSearchSummary = async (): Promise<{
  indexed: number;
  totalMessages: number;
}> => {
  const entries = await load();
  const totalMessages = entries.reduce((s, e) => s + e.messages.length, 0);
  return { indexed: entries.length, totalMessages };
};
