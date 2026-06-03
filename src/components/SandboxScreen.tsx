import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { colors, motion, radius, spacing, typography } from '../styles/theme';
import { listSandboxes, Sandbox, createSandbox, sandboxListFiles, sandboxDeleteFile } from '../services/sandbox';
import { ArrowLeft, FileCode, FolderOpen, Globe, Plus, Trash2, X } from 'lucide-react-native';

type Props = {
  onBack: () => void;
};

export const SandboxScreen = ({ onBack }: Props) => {
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [activeSbId, setActiveSbId] = useState<string | null>(null);
  const [sandboxFiles, setSandboxFiles] = useState<{ path: string; size: number; updatedAt: number }[]>([]);
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [showFileList, setShowFileList] = useState(false);

  const loadSandboxes = useCallback(async () => {
    const list = await listSandboxes();
    setSandboxes(list);
  }, []);

  useEffect(() => { loadSandboxes(); }, [loadSandboxes]);

  const selectSandbox = async (sbId: string) => {
    setActiveSbId(sbId);
    setRenderUrl(null);
    setShowFileList(false);
    const files = await sandboxListFiles(sbId);
    setSandboxFiles(files);
    const htmlFile = files.find((f) => f.path.endsWith('.html') || f.path.endsWith('.htm'));
    if (htmlFile) {
      const { sandboxReadFile } = await import('../services/sandbox');
      try {
        const content = await sandboxReadFile(sbId, htmlFile.path);
        setRenderUrl(content);
      } catch { /* ignore */ }
    }
  };

  const handleCreate = async () => {
    const count = sandboxes.length + 1;
    const sb = await createSandbox(`Песочница ${count}`);
    await loadSandboxes();
    selectSandbox(sb.id);
  };

  const handleDeleteSandbox = async (sbId: string) => {
    await sandboxDeleteFile(sbId, '');
    setSandboxFiles([]);
    if (activeSbId === sbId) setActiveSbId(null);
    await loadSandboxes();
  };

  const loadFileInWebview = async (path: string) => {
    if (!activeSbId) return;
    const { sandboxReadFile } = await import('../services/sandbox');
    try {
      const content = await sandboxReadFile(activeSbId, path);
      setRenderUrl(content);
    } catch { /* ignore */ }
  };

  const activeSandbox = useMemo(
    () => sandboxes.find((s) => s.id === activeSbId),
    [sandboxes, activeSbId],
  );

  const webviewSource = useMemo(() => {
    if (!renderUrl) return undefined;
    if (renderUrl.startsWith('http://') || renderUrl.startsWith('https://')) {
      return { uri: renderUrl };
    }
    return { html: renderUrl };
  }, [renderUrl]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {activeSandbox ? activeSandbox.name : 'Песочницы'}
        </Text>
        <View style={styles.headerRight}>
          {activeSandbox && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowFileList(!showFileList)}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <FolderOpen size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {activeSandbox ? (
        <View style={styles.sandboxBody}>
          {/* WebView */}
          <View style={styles.webviewWrap}>
            {webviewSource ? (
              <WebView
                style={styles.webview}
                source={webviewSource}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
              />
            ) : (
              <View style={styles.emptyPreview}>
                <Globe size={32} color={colors.textDim} />
                <Text style={styles.emptyPreviewTitle}>Нет контента</Text>
                <Text style={styles.emptyPreviewText}>
                  Попроси агента написать код — результат появится здесь
                </Text>
                {sandboxFiles.length > 0 && (
                  <Text style={styles.emptyPreviewHint}>
                    Есть файлы: выбери для предпросмотра
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* File list drawer */}
          {showFileList && (
            <View style={styles.filePanel}>
              <View style={styles.filePanelHeader}>
                <Text style={styles.filePanelTitle}>Файлы песочницы</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowFileList(false)}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                >
                  <X size={16} color={colors.textMuted} />
                </Pressable>
              </View>
              {sandboxFiles.length === 0 ? (
                <View style={styles.emptyFiles}>
                  <FileCode size={20} color={colors.textDim} />
                  <Text style={styles.emptyFilesText}>Файлов пока нет</Text>
                  <Text style={styles.emptyFilesHint}>Попроси агента создать файлы через sandbox_write_file</Text>
                </View>
              ) : (
                <ScrollView style={styles.fileList}>
                  {sandboxFiles.map((f) => (
                    <Pressable
                      key={f.path}
                      onPress={() => loadFileInWebview(f.path)}
                      style={({ pressed }) => [styles.fileItem, pressed && styles.pressed]}
                    >
                      <FileCode size={16} color={colors.textMuted} />
                      <Text style={styles.fileItemPath} numberOfLines={1}>{f.path}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      ) : (
        /* Sandbox list */
        <View style={styles.sandboxListBody}>
          <Text style={styles.sectionHeader}>ПЕСОЧНИЦЫ</Text>
          {sandboxes.length === 0 ? (
            <View style={styles.emptyState}>
              <Globe size={40} color={colors.textDim} />
              <Text style={styles.emptyStateTitle}>Нет песочниц</Text>
              <Text style={styles.emptyStateText}>
                Песочница — отдельная среда, где агент может запускать код, создавать HTML-страницы и SVG.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.sandboxList}>
              {sandboxes.map((sb) => (
                <Pressable
                  key={sb.id}
                  onPress={() => selectSandbox(sb.id)}
                  style={({ pressed }) => [styles.sandboxItem, pressed && styles.pressed]}
                >
                  <View style={styles.sandboxItemInfo}>
                    <Globe size={18} color={colors.text} />
                    <Text style={styles.sandboxItemName} numberOfLines={1}>{sb.name}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleDeleteSandbox(sb.id)}
                    hitSlop={10}
                    style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                  >
                    <Trash2 size={16} color={colors.textDim} />
                  </Pressable>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Pressable
            onPress={handleCreate}
            style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]}
          >
            <Plus size={20} color={colors.background} />
            <Text style={styles.createBtnText}>Новая песочница</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  backBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  headerTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: 38,
    justifyContent: 'flex-end',
  },
  iconBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  pressed: {
    opacity: 0.55,
  },

  /* Sandbox list */
  sandboxListBody: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  sectionHeader: {
    color: colors.textDim,
    fontSize: typography.caption,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxl * 2,
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '600',
  },
  emptyStateText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  sandboxList: {
    flex: 1,
  },
  sandboxItem: {
    alignItems: 'center',
    borderRadius: radius.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sandboxItemInfo: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  sandboxItemName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '500',
    flex: 1,
  },
  deleteBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  createBtn: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.xxl,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  createBtnText: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: '700',
  },

  /* Active sandbox */
  sandboxBody: {
    flex: 1,
  },
  webviewWrap: {
    flex: 1,
    margin: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyPreview: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyPreviewTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '600',
  },
  emptyPreviewText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyPreviewHint: {
    color: colors.textDim,
    fontSize: typography.caption,
    marginTop: spacing.sm,
  },

  /* File panel */
  filePanel: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    maxHeight: '40%',
    padding: spacing.md,
  },
  filePanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  filePanelTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  emptyFiles: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  emptyFilesText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '500',
  },
  emptyFilesHint: {
    color: colors.textDim,
    fontSize: typography.caption,
    textAlign: 'center',
  },
  fileList: {
    maxHeight: 160,
  },
  fileItem: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fileItemPath: {
    color: colors.textMuted,
    fontSize: typography.caption,
    flex: 1,
    fontFamily: 'monospace',
  },
});
