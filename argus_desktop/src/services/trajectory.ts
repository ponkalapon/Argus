import AsyncStorage from '@react-native-async-storage/async-storage';

export type TrajectoryStep = {
  iteration: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
};

export type Trajectory = {
  id: string;
  summary: string;
  steps: TrajectoryStep[];
  toolCount: number;
  success: boolean;
  createdAt: number;
};

const STORAGE_KEY_SUCCESS = '@trajectory_success';
const STORAGE_KEY_FAILED = '@trajectory_failed';
const MAX_TRAJECTORIES = 20;

let successCache: Trajectory[] | null = null;
let failedCache: Trajectory[] | null = null;

const loadSuccess = async (): Promise<Trajectory[]> => {
  if (successCache) return successCache;
  const raw = await AsyncStorage.getItem(STORAGE_KEY_SUCCESS);
  successCache = raw ? JSON.parse(raw) : [];
  return successCache!;
};

const loadFailed = async (): Promise<Trajectory[]> => {
  if (failedCache) return failedCache;
  const raw = await AsyncStorage.getItem(STORAGE_KEY_FAILED);
  failedCache = raw ? JSON.parse(raw) : [];
  return failedCache!;
};

const saveSuccess = async (items: Trajectory[]) => {
  successCache = items;
  await AsyncStorage.setItem(STORAGE_KEY_SUCCESS, JSON.stringify(items));
};

const saveFailed = async (items: Trajectory[]) => {
  failedCache = items;
  await AsyncStorage.setItem(STORAGE_KEY_FAILED, JSON.stringify(items));
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const saveTrajectory = async (
  summary: string,
  steps: TrajectoryStep[],
  success: boolean,
): Promise<Trajectory> => {
  const storage = success ? loadSuccess : loadFailed;
  const saver = success ? saveSuccess : saveFailed;
  const items = await storage();

  const trajectory: Trajectory = {
    id: createId(),
    summary: summary.trim(),
    steps,
    toolCount: steps.filter((s) => s.role === 'tool').length,
    success,
    createdAt: Date.now(),
  };

  if (items.length >= MAX_TRAJECTORIES) {
    items.sort((a, b) => a.createdAt - b.createdAt);
    items[0] = trajectory;
  } else {
    items.push(trajectory);
  }

  await saver(items);
  return trajectory;
};

export const listTrajectories = async (
  success?: boolean,
): Promise<{ id: string; summary: string; toolCount: number; success: boolean; createdAt: number }[]> => {
  if (success === true) {
    const items = await loadSuccess();
    return items
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((t) => ({ id: t.id, summary: t.summary, toolCount: t.toolCount, success: t.success, createdAt: t.createdAt }));
  }
  if (success === false) {
    const items = await loadFailed();
    return items
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((t) => ({ id: t.id, summary: t.summary, toolCount: t.toolCount, success: t.success, createdAt: t.createdAt }));
  }

  const [sItems, fItems] = await Promise.all([loadSuccess(), loadFailed()]);
  return [...sItems, ...fItems]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((t) => ({ id: t.id, summary: t.summary, toolCount: t.toolCount, success: t.success, createdAt: t.createdAt }));
};

export const getTrajectoryDetail = async (id: string): Promise<Trajectory | null> => {
  const [sItems, fItems] = await Promise.all([loadSuccess(), loadFailed()]);
  return sItems.find((t) => t.id === id) || fItems.find((t) => t.id === id) || null;
};
