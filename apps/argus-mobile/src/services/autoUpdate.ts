import { Platform, Alert } from 'react-native';

const REPO_OWNER = 'ponkalapon';
const REPO_NAME = 'Argus';
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
export const CURRENT_BUILD = 2; // increment for each release

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

    const tagMatch = release.tag_name.match(/build(\d+)$/i);
    if (!tagMatch) {
      return { hasUpdate: false, error: `Тег "${release.tag_name}" не содержит номер сборки` };
    }

    const latestBuild = parseInt(tagMatch[1], 10);
    if (latestBuild <= CURRENT_BUILD) {
      return { hasUpdate: false, info: `Установлена актуальная версия (build ${CURRENT_BUILD})` };
    }

    const apkAsset = release.assets.find((a) => a.name.endsWith('.apk'));
    if (!apkAsset) {
      return { hasUpdate: false, error: 'APK не найден в релизе' };
    }

    return {
      hasUpdate: true,
      version: release.tag_name,
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
    const Sharing = require('expo-sharing');

    const cacheDir = new Directory(Paths.cache, 'argus-updates');
    await cacheDir.create();

    console.log('[Update] Downloading APK...');
    const apkFile = await File.downloadFileAsync(url, cacheDir, { idempotent: true });
    console.log('[Update] Download complete.');

    const isShareAvailable = await Sharing.isAvailableAsync();
    if (isShareAvailable) {
      await Sharing.shareAsync(apkFile.uri, {
        mimeType: 'application/vnd.android.package-archive',
        dialogTitle: 'Установить обновление Argus?',
      });
    } else {
      Alert.alert(
        'Обновление скачано',
        `Файл: ${apkFile.uri}\nОткройте его в файловом менеджере для установки.`
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
