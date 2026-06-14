import { Platform, Alert, Linking } from 'react-native';

const REPO_OWNER = 'ponkalapon';
const REPO_NAME = 'Argus';
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
export const CURRENT_BUILD = 1; // minor version number, patched automatically by CI

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

export type CheckUpdateResult = {
  hasUpdate: boolean;
  version?: string;
  url?: string;
  size?: number;
  changelog?: string;
  error?: string;
  info?: string;
};

/**
 * Extracts a comparable build number from a tag.
 * Supports both legacy "build6" and new "v0.7.0" formats.
 */
function parseBuildNumber(tag: string): number | null {
  // New format: v0.X.0
  const semverMatch = tag.match(/^v0\.(\d+)\.\d+$/);
  if (semverMatch) return parseInt(semverMatch[1], 10);

  // Legacy format: build6
  const legacyMatch = tag.match(/build(\d+)$/i);
  if (legacyMatch) return parseInt(legacyMatch[1], 10);

  return null;
}

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

    const latestBuild = parseBuildNumber(release.tag_name);
    if (latestBuild === null) {
      return { hasUpdate: false, error: `Неизвестный формат тега: "${release.tag_name}"` };
    }

    if (latestBuild <= CURRENT_BUILD) {
      return { hasUpdate: false, info: `Установлена актуальная версия (build ${CURRENT_BUILD})` };
    }

    const apkAsset = release.assets.find((a) => a.name.endsWith('.apk'));
    if (!apkAsset) {
      return { hasUpdate: false, error: 'APK не найден в релизе' };
    }

    return {
      hasUpdate: true,
      version: release.name || release.tag_name,
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
