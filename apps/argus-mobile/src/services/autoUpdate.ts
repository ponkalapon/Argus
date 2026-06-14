import { Platform, Alert } from 'react-native';

const REPO_OWNER = 'ponkalapon';
const REPO_NAME = 'Argus';
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
const CURRENT_BUILD = 2; // increment for each release

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

export async function checkForUpdate(): Promise<{
  hasUpdate: boolean;
  version?: string;
  url?: string;
  size?: number;
  changelog?: string;
}> {
  try {
    if (Platform.OS !== 'android') {
      return { hasUpdate: false };
    }

    const response = await fetch(GITHUB_API, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'ArgusApp',
      },
    });

    if (!response.ok) {
      return { hasUpdate: false };
    }

    const release: GitHubRelease = await response.json();

    const tagMatch = release.tag_name.match(/build(\d+)$/i);
    if (!tagMatch) return { hasUpdate: false };

    const latestBuild = parseInt(tagMatch[1], 10);
    if (latestBuild <= CURRENT_BUILD) return { hasUpdate: false };

    const apkAsset = release.assets.find((a) => a.name.endsWith('.apk'));
    if (!apkAsset) return { hasUpdate: false };

    return {
      hasUpdate: true,
      version: release.tag_name,
      url: apkAsset.browser_download_url,
      size: apkAsset.size,
      changelog: release.body,
    };
  } catch (error) {
    console.error('[Update] Check failed:', error);
    return { hasUpdate: false };
  }
}

export async function downloadAndInstallUpdate(url: string): Promise<void> {
  try {
    // Lazy-require native modules to avoid crash on startup
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