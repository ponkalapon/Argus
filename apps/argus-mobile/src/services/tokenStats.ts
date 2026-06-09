import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@token_stats';
const DAILY_KEY = '@token_stats_daily';

export type TokenStats = {
  totalInput: number;
  totalOutput: number;
  totalRequests: number;
};

export type DailyRecord = {
  date: string;
  input: number;
  output: number;
  requests: number;
};

const defaultStats: TokenStats = {
  totalInput: 0,
  totalOutput: 0,
  totalRequests: 0,
};

let cache: TokenStats | null = null;
let dailyCache: DailyRecord[] | null = null;

const today = () => new Date().toISOString().slice(0, 10);

const load = async (): Promise<TokenStats> => {
  if (cache) return cache;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  cache = raw ? JSON.parse(raw) : { ...defaultStats };
  return cache!;
};

const save = async (stats: TokenStats) => {
  cache = stats;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
};

const loadDaily = async (): Promise<DailyRecord[]> => {
  if (dailyCache) return dailyCache;
  const raw = await AsyncStorage.getItem(DAILY_KEY);
  dailyCache = raw ? JSON.parse(raw) : [];
  return dailyCache!;
};

const saveDaily = async (records: DailyRecord[]) => {
  dailyCache = records;
  await AsyncStorage.setItem(DAILY_KEY, JSON.stringify(records));
};

let recordQueue: Promise<void> = Promise.resolve();

export const recordTokenUsage = async (input: number, output: number) => {
  const task = async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const stats: TokenStats = raw ? JSON.parse(raw) : { ...defaultStats };
    stats.totalInput += input;
    stats.totalOutput += output;
    stats.totalRequests += 1;
    cache = stats;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stats));

    const dailyRaw = await AsyncStorage.getItem(DAILY_KEY);
    const daily: DailyRecord[] = dailyRaw ? JSON.parse(dailyRaw) : [];
    const key = today();
    const existing = daily.find((r) => r.date === key);
    if (existing) {
      existing.input += input;
      existing.output += output;
      existing.requests += 1;
    } else {
      daily.push({ date: key, input, output, requests: 1 });
    }
    if (daily.length > 365) daily.splice(0, daily.length - 365);
    dailyCache = daily;
    await AsyncStorage.setItem(DAILY_KEY, JSON.stringify(daily));
  };

  recordQueue = recordQueue.then(task, task);
  return recordQueue;
};

export const getTokenStats = async (): Promise<TokenStats> => {
  return await load();
};

export const getDailyStats = async (): Promise<DailyRecord[]> => {
  return await loadDaily();
};

export const resetTokenStats = async () => {
  cache = { ...defaultStats };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  dailyCache = [];
  await AsyncStorage.setItem(DAILY_KEY, JSON.stringify([]));
};
