import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@token_stats';

export type TokenStats = {
  totalInput: number;
  totalOutput: number;
  totalRequests: number;
};

const defaultStats: TokenStats = {
  totalInput: 0,
  totalOutput: 0,
  totalRequests: 0,
};

let cache: TokenStats | null = null;

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

export const recordTokenUsage = async (input: number, output: number) => {
  const stats = await load();
  stats.totalInput += input;
  stats.totalOutput += output;
  stats.totalRequests += 1;
  await save(stats);
};

export const getTokenStats = async (): Promise<TokenStats> => {
  return await load();
};

export const resetTokenStats = async () => {
  cache = { ...defaultStats };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
};
