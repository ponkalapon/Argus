import AsyncStorage from '@react-native-async-storage/async-storage';

export type GitStatusResult = {
  available: boolean;
  commitCount: number;
  commits: string[];
  currentSha?: string;
  error?: string;
};

const AUTO_UPDATE_KEY = '@argus_auto_check_updates_v1';

export const loadAutoCheckUpdates = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem(AUTO_UPDATE_KEY);
    return val !== 'false'; // default true
  } catch {
    return true;
  }
};

export const saveAutoCheckUpdates = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(AUTO_UPDATE_KEY, String(enabled));
  } catch {}
};

export const checkGitUpdates = async (): Promise<GitStatusResult> => {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.gitCheckUpdates) {
    try {
      return await (window as any).electronAPI.gitCheckUpdates();
    } catch (e: any) {
      return { available: false, commitCount: 0, commits: [], error: e?.message || 'Ошибка IPC' };
    }
  }

  // Fallback for Web/Dev mode: Check GitHub public API
  try {
    const res = await fetch('https://api.github.com/repos/ponkalapon/Argus/commits/main');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const sha = json.sha?.slice(0, 7) || '';
    const msg = json.commit?.message?.split('\n')[0] || '';
    const date = json.commit?.committer?.date ? new Date(json.commit.committer.date).toLocaleString('ru-RU') : '';
    return {
      available: true,
      commitCount: 1,
      commits: [`${sha} ${msg} (${date})`],
      currentSha: sha,
    };
  } catch (e: any) {
    return { available: false, commitCount: 0, commits: [], error: 'Не удалось получить данные с GitHub' };
  }
};

export const runGitUpdateAndBuild = async (): Promise<{ success: boolean; built: boolean; log: string }> => {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.gitPullAndBuild) {
    return await (window as any).electronAPI.gitPullAndBuild();
  }
  return {
    success: false,
    built: false,
    log: 'Локальное автообновление через Git доступно при запуске через Electron (десктопное приложение).',
  };
};

export const reloadApp = () => {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.appReload) {
    (window as any).electronAPI.appReload();
  } else if (typeof window !== 'undefined') {
    window.location.reload();
  }
};
