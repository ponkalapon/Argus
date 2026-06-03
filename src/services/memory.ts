import AsyncStorage from '@react-native-async-storage/async-storage';

export type MemoryType = 'fact' | 'preference' | 'project' | 'habit' | 'tool_skill';
export type MemoryTier = 'agent' | 'user';

export type MemoryItem = {
  id: string;
  text: string;
  type: MemoryType;
  tier: MemoryTier;
  importance: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY_MEMORY = '@memory_store';
const MAX_ITEMS = 60;
const MAX_CHARS_MEMORY = 2200;
const MAX_CHARS_USER = 1375;

let cache: MemoryItem[] | null = null;

const load = async (): Promise<MemoryItem[]> => {
  if (cache) return cache;
  const raw = await AsyncStorage.getItem(STORAGE_KEY_MEMORY);
  cache = raw ? JSON.parse(raw) : [];
  return cache!;
};

const save = async (items: MemoryItem[]) => {
  cache = items;
  await AsyncStorage.setItem(STORAGE_KEY_MEMORY, JSON.stringify(items));
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

export const rememberFact = async (
  text: string,
  options?: {
    type?: MemoryType;
    tier?: MemoryTier;
    importance?: number;
    tags?: string[];
  },
): Promise<MemoryItem> => {
  const items = await load();
  const now = Date.now();

  const item: MemoryItem = {
    id: createId(),
    text: text.trim(),
    type: options?.type || 'fact',
    tier: options?.tier || 'agent',
    importance: options?.importance ?? 0.6,
    tags: options?.tags || [],
    createdAt: now,
    updatedAt: now,
  };

  const maxChars = item.tier === 'user' ? MAX_CHARS_USER : MAX_CHARS_MEMORY;
  const tierItems = items.filter((m) => m.tier === item.tier);
  const tierChars = tierItems.reduce((s, m) => s + m.text.length, 0);

  if (tierChars + item.text.length > maxChars || tierItems.length >= MAX_ITEMS) {
    const merged = await consolidate(items, item.tier);
    merged.push(item);
    await save(merged);
  } else {
    items.push(item);
    await save(items);
  }

  return item;
};

export const rememberPreference = async (
  text: string,
  options?: { importance?: number; tags?: string[] },
): Promise<MemoryItem> =>
  rememberFact(text, { type: 'preference', tier: 'user', importance: 0.7, ...options });

export const searchMemory = async (
  query: string,
  options?: { tier?: MemoryTier; type?: MemoryType; minImportance?: number },
): Promise<MemoryItem[]> => {
  const items = await load();
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];

  let filtered = items;
  if (options?.tier) filtered = filtered.filter((m) => m.tier === options.tier);
  if (options?.type) filtered = filtered.filter((m) => m.type === options.type);
  if (options?.minImportance) filtered = filtered.filter((m) => m.importance >= options.minImportance!);

  const scored = filtered.map((item) => {
    const itemTokens = tokenize(item.text);
    const tagsTokens = tokenize(item.tags.join(' '));
    const allTokens = new Set([...itemTokens, ...tagsTokens]);

    let matches = 0;
    for (const qt of queryTokens) {
      for (const it of allTokens) {
        if (it.includes(qt) || qt.includes(it)) {
          matches++;
          break;
        }
      }
    }

    const recall = matches / queryTokens.length;
    const score = recall * 0.7 + item.importance * 0.3;
    return { item, score };
  });

  return scored
    .filter((s) => s.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((s) => s.item);
};

export const formatMemoryContext = (items: MemoryItem[]): string => {
  if (!items.length) return '';

  const agentItems = items.filter((m) => m.tier === 'agent');
  const userItems = items.filter((m) => m.tier === 'user');

  const parts: string[] = [];

  if (agentItems.length) {
    const chars = agentItems.reduce((s, m) => s + m.text.length, 0);
    const pct = Math.round((chars / MAX_CHARS_MEMORY) * 100);
    const entries = agentItems.map((m) => m.text).join('\n§ ');
    parts.push(`MEMORY [${pct}% — ${chars}/${MAX_CHARS_MEMORY} chars]\n${entries}`);
  }

  if (userItems.length) {
    const chars = userItems.reduce((s, m) => s + m.text.length, 0);
    const pct = Math.round((chars / MAX_CHARS_USER) * 100);
    const entries = userItems.map((m) => m.text).join('\n§ ');
    parts.push(`USER [${pct}% — ${chars}/${MAX_CHARS_USER} chars]\n${entries}`);
  }

  return parts.join('\n\n');
};

export const memorySummary = async (tier?: MemoryTier): Promise<string> => {
  const items = await load();
  const filtered = tier ? items.filter((m) => m.tier === tier) : items;
  if (!filtered.length) return 'Память пуста.';

  return filtered
    .map((m) => `[${m.type}] (${m.importance.toFixed(1)}) ${m.text}`)
    .join('\n');
};

export const deleteMemory = async (id: string) => {
  const items = await load();
  await save(items.filter((m) => m.id !== id));
};

export const updateMemoryImportance = async (id: string, importance: number) => {
  const items = await load();
  const idx = items.findIndex((m) => m.id === id);
  if (idx !== -1) {
    items[idx].importance = Math.max(0, Math.min(1, importance));
    items[idx].updatedAt = Date.now();
    await save(items);
  }
};

export const replaceMemory = async (
  oldText: string,
  newText: string,
): Promise<{ replaced: boolean; count: number }> => {
  const items = await load();
  const q = oldText.toLowerCase().trim();
  let count = 0;

  for (const item of items) {
    if (item.text.toLowerCase().includes(q)) {
      item.text = newText.trim();
      item.updatedAt = Date.now();
      count++;
    }
  }

  if (count > 0) {
    await save(items);
  }

  return { replaced: count > 0, count };
};

const consolidate = async (items: MemoryItem[], tier: MemoryTier): Promise<MemoryItem[]> => {
  const tierItems = items.filter((m) => m.tier === tier);
  const others = items.filter((m) => m.tier !== tier);

  const maxChars = tier === 'user' ? MAX_CHARS_USER : MAX_CHARS_MEMORY;
  const chars = tierItems.reduce((s, m) => s + m.text.length, 0);
  if (chars <= maxChars * 0.85 && tierItems.length < MAX_ITEMS) return items;

  const sorted = [...tierItems].sort((a, b) => b.importance - a.importance);
  const keep: MemoryItem[] = [];
  const mergeable: MemoryItem[] = [];
  let totalChars = 0;

  for (const item of sorted) {
    if (totalChars + item.text.length <= maxChars * 0.7 || keep.length < 10) {
      keep.push(item);
      totalChars += item.text.length;
    } else {
      mergeable.push(item);
    }
  }

  if (mergeable.length <= 1) return [...keep, ...mergeable, ...others];

  const mergedText = mergeable
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 5)
    .map((m, i) => `${i + 1}. ${m.text}`)
    .join('\n');

  const merged: MemoryItem = {
    id: createId(),
    text: mergedText,
    type: 'fact',
    tier,
    importance: 0.3,
    tags: ['consolidated'],
    createdAt: mergeable[0].createdAt,
    updatedAt: Date.now(),
  };

  return [...keep, merged, ...others];
};
