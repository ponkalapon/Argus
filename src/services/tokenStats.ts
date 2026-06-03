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

export const recordTokenUsage = async (input: number, output: number) => {
  const stats = await load();
  stats.totalInput += input;
  stats.totalOutput += output;
  stats.totalRequests += 1;
  await save(stats);

  const daily = await loadDaily();
  const key = today();
  const existing = daily.find((r) => r.date === key);
  if (existing) {
    existing.input += input;
    existing.output += output;
    existing.requests += 1;
  } else {
    daily.push({ date: key, input, output, requests: 1 });
  }
  await saveDaily(daily);
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
