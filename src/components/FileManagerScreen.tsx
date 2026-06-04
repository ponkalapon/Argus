import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, File as FileIcon, FileText, Folder, Image, Search, Trash2 } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../styles/theme';
import { setExternalSearchRoot } from '../services/localSearch';

type FileEntry = {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modificationTime?: number;
};

type Props = {
  onBack: () => void;
  onAttach: (name: string, content: string) => void;
  initialPath?: string;
};

const ICON_SIZE = 20;

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '')) return Image;
  if (['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'tsx', 'jsx', 'py', 'java', 'kt', 'swift'].includes(ext || '')) return FileText;
  return FileIcon;
};

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const FileManagerScreen = ({ onBack, onAttach, initialPath }: Props) => {
  const [currentPath, setCurrentPath] = useState(initialPath || Paths.document.uri);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');

  const loadDirectory = useCallback(async (dirPath: string) => {
    setLoading(true);
    try {
      const dir = new Directory(dirPath);
      if (!dir.exists) {
        setEntries([]);
        return;
      }
      const list = dir.list();
      const fileEntries: FileEntry[] = list.map((entry) => {
        const isDir = entry instanceof Directory;
        const file = isDir ? null : (entry as File);
        return {
          name: entry.name,
          path: entry.uri,
          size: file ? file.size : 0,
          isDirectory: isDir,
          modificationTime: file ? file.lastModified ?? undefined : undefined,
        };
      });

      fileEntries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      setEntries(fileEntries);
    } catch {
      Alert.alert('Ошибка', 'Не удалось прочитать папку');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const navigateToDir = (dirPath: string) => {
    setSearchQuery('');
    setCurrentPath(dirPath);
  };

  const navigateUp = () => {
    const parent = currentPath.replace(/\/$/, '').split('/').slice(0, -1).join('/');
    if (parent && parent.length > 0) {
      setSearchQuery('');
      setCurrentPath(parent + '/');
    }
  };

  const handleOpenFile = async (entry: FileEntry) => {
    if (entry.isDirectory) {
      navigateToDir(entry.path);
      return;
    }

    const ext = entry.name.split('.').pop()?.toLowerCase();
    const isViewable = ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'tsx', 'jsx', 'py', 'java', 'kt', 'swift', 'log', 'env', 'yml', 'yaml', 'toml', 'cfg', 'ini'].includes(ext || '');

    if (isViewable) {
      try {
        const content = await new File(entry.path).text();
        setPreviewTitle(entry.name);
        setPreviewContent(content);
      } catch {
        Alert.alert('Ошибка', 'Не удалось прочитать файл');
      }
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      try {
        Linking.openURL(entry.path);
      } catch {
        Alert.alert('Ошибка', 'Не удалось открыть файл');
      }
    } else {
      try {
        await Sharing.shareAsync(entry.path);
      } catch {
        Alert.alert('Ошибка', 'Не удалось открыть файл');
      }
    }
  };

  const handleAttach = async (entry: FileEntry) => {
    try {
      const content = await new File(entry.path).text();
      setExternalSearchRoot(currentPath);
      onAttach(entry.name, content);
      onBack();
    } catch {
      Alert.alert('Ошибка', 'Не удалось прочитать файл для прикрепления');
    }
  };

  const handleDelete = (entry: FileEntry) => {
    Alert.alert('Удалить', `Удалить "${entry.name}"?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            if (entry.isDirectory) {
              new Directory(entry.path).delete();
            } else {
              new File(entry.path).delete();
            }
            loadDirectory(currentPath);
          } catch {
            Alert.alert('Ошибка', 'Не удалось удалить');
          }
        },
      },
    ]);
  };

  const filteredEntries = searchQuery.trim()
    ? entries.filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : entries;

  const rootLabel = currentPath === Paths.document.uri ? 'App данных'
    : currentPath.includes('/Android/') ? 'Android'
    : currentPath.includes('/Download') ? 'Загрузки'
    : currentPath.includes('/DCIM') ? 'Фото'
    : currentPath.includes('/Documents') ? 'Документы'
    : currentPath.split('/').filter(Boolean).pop() || 'Файлы';

  if (previewContent !== null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => { setPreviewContent(null); setPreviewTitle(''); }} style={styles.headerBtn}>
            <ArrowLeft size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{previewTitle}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.previewContent}>
          <Text style={styles.previewText} selectable>{previewContent}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.headerBtn}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{rootLabel}</Text>
        <Pressable onPress={navigateUp} style={styles.headerBtn} disabled={currentPath === Paths.document.uri || currentPath === '/'}>
          <Text style={[styles.upBtn, { opacity: (currentPath === Paths.document.uri || currentPath === '/') ? 0.3 : 1 }]}>..</Text>
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <Search size={16} color={colors.textDim} style={{ marginRight: spacing.sm }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск файлов..."
          placeholderTextColor={colors.textDim}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.path}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
          ) : (
            <Text style={styles.emptyText}>Папка пуста</Text>
          )
        }
        renderItem={({ item }) => {
          const Icon = item.isDirectory ? Folder : getFileIcon(item.name);
          return (
            <Pressable
              style={({ pressed }) => [styles.fileRow, pressed && styles.pressed]}
              onPress={() => handleOpenFile(item)}
            >
              <View style={styles.fileIcon}>
                <Icon size={ICON_SIZE} color={item.isDirectory ? colors.warning : colors.textMuted} />
              </View>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
                {!item.isDirectory && item.size > 0 && (
                  <Text style={styles.fileSize}>{formatSize(item.size)}</Text>
                )}
              </View>
              {!item.isDirectory && (
                <>
                  <Pressable onPress={() => handleAttach(item)} style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>+</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(item)} style={styles.actionBtn}>
                    <Trash2 size={16} color={colors.danger} />
                  </Pressable>
                </>
              )}
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>{currentPath}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerBtn: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTitle: {
    color: colors.text,
    flex: 1,
    fontSize: typography.subtitle,
    fontWeight: '700',
    textAlign: 'center',
  },
  upBtn: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    paddingVertical: spacing.sm,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing.lg,
  },
  fileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: {
    backgroundColor: colors.accentSoft,
  },
  fileIcon: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 36,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: colors.text,
    fontSize: typography.body,
  },
  fileSize: {
    color: colors.textDim,
    fontSize: typography.caption,
    marginTop: 2,
  },
  actionBtn: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    marginLeft: spacing.xs,
    width: 36,
  },
  actionBtnText: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textDim,
    fontSize: typography.body,
    marginTop: spacing.xxl,
    textAlign: 'center',
  },
  previewContent: {
    backgroundColor: colors.codeSurface,
    flex: 1,
    padding: spacing.md,
  },
  previewText: {
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: typography.mono,
    lineHeight: 20,
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  footerText: {
    color: colors.textDim,
    fontSize: typography.caption,
  },
});
