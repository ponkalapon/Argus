import { Platform, Alert, Linking } from 'react-native';

const REPO_OWNER = 'ponkalapon';
const REPO_NAME = 'Argus';
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
export const CURRENT_VERSION = '0.5.0';
export const CURRENT_BUILD = 3;

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

export type CheckUpdateResult = {
  hasUpdate: boolean;
  version?: string;
  tagName?: string;
  url?: string;
  size?: number;
  changelog?: string;
  error?: string;
  info?: string;
};

const parseVersion = (tagName: string): { version: string; date: string } | null => {
  const match = tagName.match(/v?(\d+\.\d+\.\d+)\s*\((\d{4}\.\d+\.\d+)\)/i)
    || tagName.match(/Argus\s+v?(\d+\.\d+\.\d+)/i);
  if (match) {
    return { version: match[1], date: match[2] };
  }
  return null;
};

const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
};

export async function checkForUpdate(): Promise<CheckUpdateResult> {
  try {
    if (Platform.OS !== 'android') {
      return { hasUpdate: false, error: 'Не Android' };
    }

    const response = await fetch(GITHUB_API, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'ArgusApp',
      },
    });

    if (response.status === 403) {
      return { hasUpdate: false, error: 'GitHub API лимит (403). Попробуй позже.' };
    }
    if (response.status === 404) {
      return { hasUpdate: false, error: 'Релизы не найдены на GitHub' };
    }
    if (!response.ok) {
      return { hasUpdate: false, error: `GitHub API: HTTP ${response.status}` };
    }

    const release: GitHubRelease = await response.json();
    const parsed = parseVersion(release.tag_name);

    if (!parsed) {
      return { hasUpdate: false, error: `Тег "${release.tag_name}" не распознан` };
    }

    if (compareVersions(parsed.version, CURRENT_VERSION) <= 0) {
      return { hasUpdate: false, info: `Установлена актуальная версия ${parsed.version}` };
    }

    const apkAsset = release.assets.find((a) => a.name.endsWith('.apk'));
    if (!apkAsset) {
      return { hasUpdate: false, error: 'APK не найден в релизе' };
    }

    return {
      hasUpdate: true,
      version: parsed.version,
      tagName: release.tag_name,
      url: apkAsset.browser_download_url,
      size: apkAsset.size,
      changelog: release.body,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    return { hasUpdate: false, error: `Ошибка: ${message}` };
  }
}

export async function downloadAndInstallUpdate(url: string): Promise<void> {
  try {
    const { File, Directory, Paths } = require('expo-file-system');

    const cacheDir = new Directory(Paths.cache, 'argus-updates');
    if (!cacheDir.exists) {
      await cacheDir.create({ intermediates: true });
    }

    const oldFile = new File(cacheDir, 'argus-update.apk');
    if (oldFile.exists) {
      await oldFile.delete();
    }

    console.log('[Update] Downloading APK...');
    const apkFile = await File.downloadFileAsync(url, cacheDir, { idempotent: true });
    console.log('[Update] Download complete.');

    try {
      await Linking.openURL(apkFile.uri);
    } catch {
      Alert.alert(
        'Обновление скачано',
        `Найди файл в проводнике и открой его для установки:\n${apkFile.uri}`
      );
    }
  } catch (error) {
    console.error('[Update] Download/install failed:', error);
    throw error;
  }
}

export async function checkAndPromptUpdate(): Promise<void> {
  const update = await checkForUpdate();
  if (!update.hasUpdate || !update.url) return;

  Alert.alert(
    'Доступно обновление',
    `Версия: ${update.version}\n\n${update.changelog || ''}\n\nУстановить?`,
    [
      { text: 'Позже', style: 'cancel' },
      {
        text: 'Скачать',
        onPress: () => downloadAndInstallUpdate(update.url!),
      },
    ]
  );
}
