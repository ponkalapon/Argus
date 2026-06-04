import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, motion, radius, spacing, typography } from '../styles/theme';
import { AgentSettings, StoredChat } from '../types';
import {
  listWorkspaceFiles,
  readWorkspaceFile,
  exportWorkspaceFile,
  exportWorkspaceArchive,
} from '../services/workspace';
import type { WorkspaceFile } from '../services/workspace';
import { searchSessions } from '../services/sessionSearch';
import { WebView } from 'react-native-webview';
import { SvgXml } from 'react-native-svg';
import { GestureBottomSheet } from './GestureBottomSheet';
import { ArrowLeft, Check, Download, Folder, Globe, Plus, Search, Settings, Trash2, X } from 'lucide-react-native';
import { useAttachments } from '../hooks/useAttachments';
import { useChatSession } from '../hooks/useChatSession';
import { useModelCatalog } from '../hooks/useModelCatalog';
import { WorkspaceActionSheet } from './workspace/WorkspaceActionSheet';
import { WorkspaceComposer } from './workspace/WorkspaceComposer';
import { WorkspaceHeader } from './workspace/WorkspaceHeader';
import { MessageList } from './workspace/MessageList';

const useAnimatedValue = (target: number): number => {
  const [current, setCurrent] = useState(target);
  const rafRef = useRef<number | undefined>(undefined);
  const animRef = useRef({ from: 0, time: 0, target: 0 });

  useEffect(() => {
    if (target === current) { animRef.current.target = target; return; }
    const from = current;
    animRef.current = { from, time: performance.now(), target };

    const animate = (now: number) => {
      const t = Math.min((now - animRef.current.time) / 350, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (animRef.current.target - from) * eased);
      setCurrent(next);
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current); };
  }, [target]);

  return current;
};

type Props = {
  settings: AgentSettings;
  apiKey: string;
  onOpenSettings: () => void;
  onOpenSandbox: () => void;
  onOpenFiles: () => void;
  onSaveSettings: (settings: AgentSettings, apiKey: string) => Promise<void>;
  pendingAttach?: { name: string; content: string } | null;
  onClearPendingAttach?: () => void;
};

const formatChatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
  });

const formatTokenNumber = (n: number) => n.toLocaleString('ru-RU');

type PreviewMode = 'text' | 'html' | 'svg';
const detectPreviewMode = (path: string): PreviewMode => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'svg') return 'svg';
  return 'text';
};

export const WorkspaceScreen = ({ settings, apiKey, onOpenSettings, onOpenSandbox, onOpenFiles, onSaveSettings, pendingAttach, onClearPendingAttach }: Props) => {
  const [draft, setDraft] = useState('');
  const [showChatList, setShowChatList] = useState(false);
  const [wsFiles, setWsFiles] = useState<WorkspaceFile[]>([]);
  const [showWsModal, setShowWsModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<WorkspaceFile | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ chatId: string; title: string; excerpt: string; score: number; updatedAt: number }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const drawerAnim = useRef(new Animated.Value(0)).current;
  const tokenPulse = useRef(new Animated.Value(1)).current;
  const DRAWER_WIDTH = 290;

  const hasRequiredSettings = Boolean(settings.baseUrl.trim() && settings.model.trim());

  const {
    attachedDocs,
    handleAttachDocument,
    handleCamera,
    handleContactsSearch,
    handleOpenFiles,
    handlePhotoLibrary,
    handleVoiceToggle,
    internetEnabled,
    isRecording,
    setAttachedDocs,
    setInternetEnabled,
    setShowAttachMenu,
    showAttachMenu,
  } = useAttachments({ onOpenFiles, pendingAttach, onClearPendingAttach, setDraft });

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const {
    activeChatId,
    chats,
    deleteChat,
    error,
    inputTokens,
    isEmptyChat,
    messageCount,
    messages,
    openChat,
    outputTokens,
    sendMessage,
    startNewChat,
    status,
  } = useChatSession({
    settings,
    apiKey,
    hasRequiredSettings,
    attachedDocs,
    internetEnabled,
    onOpenSettings,
    setAttachedDocs,
    setDraft,
    scrollToEnd,
  });

  const {
    filteredGroups,
    isLoadingModels,
    modelLabel,
    modelPanelTranslate,
    modelPickerAnim,
    modelSearch,
    modelOverlayOpacity,
    openModelPicker,
    setModelSearch,
    setShowModelPicker,
    showModelPicker,
  } = useModelCatalog(settings, apiKey);

  const animInputTokens = useAnimatedValue(inputTokens);
  const animOutputTokens = useAnimatedValue(outputTokens);

  useEffect(() => {
    if (status === 'thinking') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(tokenPulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
          Animated.timing(tokenPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    tokenPulse.setValue(1);
    return undefined;
  }, [status === 'thinking']);

  useEffect(() => {
    Animated.spring(drawerAnim, {
      toValue: showChatList ? 1 : 0,
      useNativeDriver: true,
      damping: 26,
      stiffness: 250,
    }).start();
  }, [showChatList]);

  const wsAnim = useRef(new Animated.Value(0)).current;
  const WS_WIDTH = 290;

  useEffect(() => {
    Animated.spring(wsAnim, {
      toValue: showWsModal ? 1 : 0,
      useNativeDriver: true,
      damping: 26,
      stiffness: 250,
    }).start();
  }, [showWsModal]);

  const drawerTranslate = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_WIDTH, 0],
  });
  const contentTranslate = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, DRAWER_WIDTH],
  });
  const drawerOverlayOpacity = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });
  const wsTranslate = wsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [WS_WIDTH, 0],
  });
  const wsOverlayOpacity = wsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const contextPressureColor: string = useMemo(() => {
    if (messageCount < 10) return colors.success;
    if (messageCount < 20) return colors.warning;
    return colors.danger;
  }, [messageCount]);

  useEffect(() => {
    Animated.timing(entrance, {
      duration: motion.slow,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const openDrawer = useCallback(() => setShowChatList(true), []);
  const closeDrawer = useCallback(() => setShowChatList(false), []);

  const openSearch = () => {
    setIsSearching(true);
    setSearchQuery('');
    setSearchResults([]);
    setTimeout(() => searchInputRef.current?.focus(), 300);
  };

  const closeSearch = () => {
    setIsSearching(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSearchQuery = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await searchSessions(text, 5);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
  };

  const openSettingsAnimated = () => {
    closeDrawer();
    setTimeout(() => onOpenSettings(), 350);
  };

  const openWorkspaceFiles = async () => {
    if (activeChatId) {
      const files = await listWorkspaceFiles(activeChatId);
      setWsFiles(files);
    }
    setShowWsModal(true);
  };

  const handleOpenChat = (chat: StoredChat) => {
    openChat(chat);
    setShowChatList(false);
  };

  return (
    <View style={styles.slideRoot}>
      {/* Main content - slides right when drawer opens */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: contentTranslate }] }]}>
        {/* Invisible edge zone to open drawer */}
        {!showChatList && (
          <Pressable
            onPress={openDrawer}
            hitSlop={{ right: 20, top: 20, bottom: 20 }}
            style={styles.edgeZone}
          />
        )}
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.container}
          >
            <WorkspaceHeader
              modelLabel={modelLabel}
              onOpenDrawer={openDrawer}
              onOpenModelPicker={openModelPicker}
              onOpenWorkspaceFiles={openWorkspaceFiles}
              styles={styles}
            />

            <MessageList
              entrance={entrance}
              error={error}
              hasRequiredSettings={hasRequiredSettings}
              isEmptyChat={isEmptyChat}
              messages={messages}
              onContentSizeChange={scrollToEnd}
              onOpenSettings={onOpenSettings}
              scrollRef={scrollRef}
              styles={styles}
            />

            <WorkspaceComposer
              animInputTokens={animInputTokens}
              animOutputTokens={animOutputTokens}
              attachedDocs={attachedDocs}
              contextPressureColor={contextPressureColor}
              draft={draft}
              formatTokenNumber={formatTokenNumber}
              handleVoiceToggle={handleVoiceToggle}
              isFocused={isFocused}
              isRecording={isRecording}
              modelLabel={modelLabel}
              onOpenAttachMenu={() => setShowAttachMenu(true)}
              onSendMessage={sendMessage}
              setAttachedDocs={setAttachedDocs}
              setDraft={setDraft}
              setIsFocused={setIsFocused}
              styles={styles}
              tokenPulse={tokenPulse}
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Animated.View>

      {/* Drawer overlay */}
      <Animated.View
        style={[styles.drawerOverlay, { opacity: drawerOverlayOpacity }]}
        pointerEvents={showChatList ? 'auto' : 'none'}
      >
        <Pressable style={{ flex: 1 }} onPress={closeDrawer} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View style={[styles.drawerPanelContainer, { transform: [{ translateX: drawerTranslate }] }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={[styles.chatPanelHeader, { marginBottom: 0 }]}>
            {isSearching ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={closeSearch}
                  style={({ pressed }) => [styles.chatCloseBtn, pressed && styles.pressed]}
                >
                  <ArrowLeft size={18} color={colors.textMuted} />
                </Pressable>
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Поиск по истории..."
                  placeholderTextColor={colors.textDim}
                  value={searchQuery}
                  onChangeText={handleSearchQuery}
                  returnKeyType="search"
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={closeDrawer}
                  style={({ pressed }) => [styles.chatCloseBtn, pressed && styles.pressed]}
                >
                  <X size={18} color={colors.textMuted} />
                </Pressable>
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={closeDrawer}
                style={({ pressed }) => [styles.chatCloseBtn, pressed && styles.pressed]}
              >
                <X size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          <ScrollView style={styles.navScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {isSearching ? (
              <>
                {searchQuery.trim() === '' ? (
                  <View style={styles.emptyChatsBox}>
                    <Text style={styles.emptyChatsTitle}>Введите запрос</Text>
                    <Text style={styles.emptyChatsText}>Начни вводить текст для поиска по истории диалогов.</Text>
                  </View>
                ) : searchResults.length === 0 ? (
                  <View style={styles.emptyChatsBox}>
                    <Text style={styles.emptyChatsTitle}>Ничего не найдено</Text>
                    <Text style={styles.emptyChatsText}>Попробуй изменить запрос.</Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.navSectionHeader, { marginTop: spacing.sm }]}>РЕЗУЛЬТАТЫ ПОИСКА</Text>
                    {searchResults.map((result) => (
                      <Pressable
                        key={result.chatId}
                        accessibilityRole="button"
                        onPress={() => {
                          const chat = chats.find((c) => c.id === result.chatId);
                          if (chat) { closeSearch(); handleOpenChat(chat); }
                        }}
                        style={({ pressed }) => [
                          styles.chatItem,
                          pressed && styles.chatItemPressed,
                        ]}
                      >
                        <View style={styles.chatItemTextWrap}>
                          <Text style={styles.chatItemTitle} numberOfLines={1}>{result.title}</Text>
                          <Text style={styles.searchExcerpt} numberOfLines={2}>{result.excerpt}</Text>
                          <Text style={styles.chatItemMeta}>{formatChatDate(result.updatedAt)} · совпадение {Math.round(result.score * 100)}%</Text>
                        </View>
                      </Pressable>
                    ))}
                  </>
                )}
              </>
            ) : (
              <>
                {/* Навигация */}
                <Text style={[styles.navSectionHeader, { marginTop: spacing.sm }]}>НАВИГАЦИЯ</Text>
                <View style={styles.navCol}>
                  <Pressable
                    onPress={() => { closeDrawer(); startNewChat(); }}
                    style={({ pressed }) => [styles.navRowItem, pressed && styles.pressed]}
                  >
                    <View style={styles.navRowIcon}>
                      <Plus size={18} color={colors.text} />
                    </View>
                    <Text style={styles.navRowLabel}>Новый чат</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openSearch()}
                    style={({ pressed }) => [styles.navRowItem, pressed && styles.pressed]}
                  >
                    <View style={styles.navRowIcon}>
                      <Search size={18} color={colors.text} />
                    </View>
                    <Text style={styles.navRowLabel}>Поиск</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      if (activeChatId) {
                        const files = await listWorkspaceFiles(activeChatId);
                        setWsFiles(files);
                      }
                      closeDrawer();
                      setShowWsModal(true);
                    }}
                    style={({ pressed }) => [styles.navRowItem, pressed && styles.pressed]}
                  >
                    <View style={styles.navRowIcon}>
                      <Folder size={18} color={colors.text} />
                    </View>
                    <Text style={styles.navRowLabel}>Библиотека</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { closeDrawer(); onOpenSandbox(); }}
                    style={({ pressed }) => [styles.navRowItem, pressed && styles.pressed]}
                  >
                    <View style={styles.navRowIcon}>
                      <Globe size={18} color={colors.text} />
                    </View>
                    <Text style={styles.navRowLabel}>Песочница</Text>
                  </Pressable>
                </View>

                {/* Недавние */}
                <Text style={styles.navSectionHeader}>НЕДАВНИЕ</Text>

                {chats.length === 0 ? (
                  <View style={styles.emptyChatsBox}>
                    <Text style={styles.emptyChatsTitle}>Пока нет диалогов</Text>
                    <Text style={styles.emptyChatsText}>Первый чат создастся автоматически после отправки сообщения.</Text>
                  </View>
                ) : (
                  chats.map((chat) => {
                    const isActive = chat.id === activeChatId;
                    return (
                      <Pressable
                        key={chat.id}
                        accessibilityRole="button"
                        onPress={() => handleOpenChat(chat)}
                        style={({ pressed }) => [
                          styles.chatItem,
                          isActive && styles.chatItemActive,
                          pressed && styles.chatItemPressed,
                        ]}
                      >
                        <View style={styles.chatItemTextWrap}>
                          <Text style={styles.chatItemTitle} numberOfLines={1}>{chat.title}</Text>
                          <Text style={styles.chatItemMeta} numberOfLines={1}>
                            {formatChatDate(chat.updatedAt)} · {chat.messages.length} сообщ.
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => deleteChat(chat.id)}
                          hitSlop={10}
                          style={({ pressed }) => [styles.chatDeleteBtn, pressed && styles.chatDeleteBtnPressed]}
                        >
                          <Trash2 size={16} color={colors.textMuted} />
                        </Pressable>
                      </Pressable>
                    );
                  })
                )}
              </>
            )}
            <View style={{ height: 80 }} />
          </ScrollView>

          {/* Bottom: настройки + статус */}
          <View style={styles.drawerBottom}>
            <Pressable
              onPress={openSettingsAnimated}
              style={({ pressed }) => [styles.drawerBottomBtn, pressed && styles.pressed]}
            >
              <Settings size={20} color={colors.text} />
            </Pressable>
            <View style={styles.drawerBottomStatus}>
              <View style={[styles.statusDot, { backgroundColor: hasRequiredSettings ? colors.success : colors.danger }]} />
              <Text style={styles.drawerBottomStatusText}>
                {hasRequiredSettings ? 'Подключено' : 'Не настроено'}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* ── Workspace file browser overlay ── */}
      <Animated.View
        style={[styles.drawerOverlay, { opacity: wsOverlayOpacity }]}
        pointerEvents={showWsModal ? 'auto' : 'none'}
      >
        <Pressable style={{ flex: 1 }} onPress={() => { setPreviewFile(null); setShowWsModal(false); }} />
      </Animated.View>

      <Animated.View style={[styles.wsPanelContainer, { transform: [{ translateX: wsTranslate }] }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.chatPanelHeader}>
            <Text style={styles.chatPanelTitle}>Файлы рабочей области</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPreviewFile(null);
                setShowWsModal(false);
              }}
              style={({ pressed }) => [styles.chatCloseBtn, pressed && styles.pressed]}
            >
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {!activeChatId ? (
            <View style={styles.emptyChatsBox}>
              <Text style={styles.emptyChatsTitle}>Нет активного чата</Text>
              <Text style={styles.emptyChatsText}>Создай чат, чтобы появилась рабочая область.</Text>
            </View>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  setShowWsModal(false);
                  await exportWorkspaceArchive(activeChatId);
                }}
                style={({ pressed }) => [styles.newChatButton, pressed && styles.pressed]}
              >
                <Download size={18} color={colors.text} />
                <Text style={styles.newChatText}>Экспорт архива</Text>
              </Pressable>

              {wsFiles.length === 0 ? (
                <View style={styles.emptyChatsBox}>
                  <Text style={styles.emptyChatsTitle}>Рабочая область пуста</Text>
                  <Text style={styles.emptyChatsText}>Попроси AI сохранить файл, и он появится здесь.</Text>
                </View>
              ) : (
                <ScrollView style={styles.chatList} showsVerticalScrollIndicator={false}>
                  {wsFiles.map((file) => (
                    <Pressable
                      key={file.path}
                      accessibilityRole="button"
                      onPress={() => setPreviewFile(file)}
                      style={({ pressed }) => [
                        styles.chatItem,
                        pressed && styles.chatItemPressed,
                      ]}
                    >
                      <View style={styles.chatItemTextWrap}>
                        <Text style={styles.chatItemTitle} numberOfLines={1}>
                          {file.path}
                        </Text>
                        <Text style={styles.chatItemMeta}>
                          {file.size} bytes
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={async () => {
                          await exportWorkspaceFile(activeChatId, file.path);
                        }}
                        hitSlop={10}
                        style={({ pressed }) => [
                          styles.chatDeleteBtn,
                          pressed && styles.chatDeleteBtnPressed,
                        ]}
                      >
                        <Download size={16} color={colors.textMuted} />
                      </Pressable>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </>
          )}
        </SafeAreaView>
      </Animated.View>

      {/* ── File preview sheet ── */}
      <GestureBottomSheet
        visible={!!previewFile}
        onClose={() => setPreviewFile(null)}
        snapPoints={{ full: 60, closed: 3000 }}
        springConfig={{ damping: 30, stiffness: 250 }}
      >
        {previewFile && (
          <>
            <View style={styles.chatPanelHeader}>
              <Text style={styles.chatPanelTitle} numberOfLines={1}>
                {previewFile.path}
              </Text>
            </View>
            {(() => {
              const mode = detectPreviewMode(previewFile.path);
              if (mode === 'html') {
                return (
                  <WebView
                    style={{ height: 400, marginHorizontal: spacing.lg }}
                    source={{ html: previewFile.content }}
                    originWhitelist={['*']}
                    javaScriptEnabled={false}
                  />
                );
              }
              if (mode === 'svg') {
                return (
                  <View style={styles.previewSvgWrap}>
                    <SvgXml xml={previewFile.content} />
                  </View>
                );
              }
              return (
                <ScrollView style={[styles.previewContent, { maxHeight: 400 }]}>
                  <Text style={styles.previewCode} selectable>
                    {previewFile.content}
                  </Text>
                </ScrollView>
              );
            })()}
          </>
        )}
      </GestureBottomSheet>

      {/* ── Model picker overlay ── */}
      {showModelPicker && (
        <>
          <Animated.View
            style={[styles.modelOverlay, { opacity: modelOverlayOpacity }]}
            pointerEvents={showModelPicker ? 'auto' : 'none'}
          >
            <Pressable style={{ flex: 1 }} onPress={() => setShowModelPicker(false)} />
          </Animated.View>
          <Animated.View
            style={[
              styles.modelPanelOuter,
              {
                opacity: modelPickerAnim,
                transform: [{ translateY: modelPanelTranslate }],
              },
            ]}
          >
            <Pressable style={styles.modelPanel} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modelPanelTitle}>Выбрать модель</Text>

              <View style={styles.modelSearchWrap}>
                <Search size={16} color={colors.textMuted} />
                <TextInput
                  autoFocus
                  onChangeText={setModelSearch}
                  placeholder="Поиск…"
                  placeholderTextColor={colors.textDim}
                  style={styles.modelSearchInput}
                  value={modelSearch}
                />
              </View>

              <ScrollView style={styles.modelList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {isLoadingModels ? (
                  <View style={styles.modelEmpty}>
                    <Animated.View style={{ opacity: modelPickerAnim }}>
                      <Text style={styles.modelEmptyText}>Загрузка моделей…</Text>
                    </Animated.View>
                  </View>
                ) : (
                  <>
                    {filteredGroups.map((group) => (
                      <View key={group.provider}>
                        <Text style={styles.modelProviderLabel}>{group.provider}</Text>
                        {group.models.map((m) => {
                          const isActive = settings.model === m;
                          return (
                            <Pressable
                              key={m}
                              onPress={() => {
                                setShowModelPicker(false);
                                void onSaveSettings({ ...settings, model: m }, apiKey);
                              }}
                              style={({ pressed }) => [
                                styles.modelItem,
                                isActive && styles.modelItemActive,
                                pressed && styles.modelItemPressed,
                              ]}
                            >
                              <Text style={[styles.modelItemText, isActive && styles.modelItemTextActive]}>
                                {m}
                              </Text>
                              {isActive && <Check size={16} color="#a78bfa" />}
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}

                    {modelSearch.trim().length > 0 && (
                      <View>
                        <Text style={styles.modelProviderLabel}>Другое</Text>
                        <Pressable
                          onPress={() => {
                            setShowModelPicker(false);
                            void onSaveSettings({ ...settings, model: modelSearch.trim() }, apiKey);
                          }}
                          style={({ pressed }) => [styles.modelItem, pressed && styles.modelItemPressed]}
                        >
                          <Text style={styles.modelItemText}>«{modelSearch.trim()}»</Text>
                        </Pressable>
                      </View>
                    )}

                    {filteredGroups.length === 0 && modelSearch.trim().length === 0 && (
                      <View style={styles.modelEmpty}>
                        <Text style={styles.modelEmptyText}>Нет моделей</Text>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </>
      )}

      <WorkspaceActionSheet
        handleAttachDocument={handleAttachDocument}
        handleCamera={handleCamera}
        handleContactsSearch={handleContactsSearch}
        handleOpenFiles={handleOpenFiles}
        handlePhotoLibrary={handlePhotoLibrary}
        internetEnabled={internetEnabled}
        onToggleInternet={() => setInternetEnabled((p) => !p)}
        setShowAttachMenu={setShowAttachMenu}
        showAttachMenu={showAttachMenu}
        styles={styles}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    flex: 1,
  },
  slideRoot: {
    backgroundColor: colors.background,
    flex: 1,
  },
  edgeZone: {
    height: 60,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 30,
    zIndex: 100,
  },
  drawerOverlay: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  drawerPanelContainer: {
    backgroundColor: colors.backgroundSoft,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    height: '100%',
    left: 0,
    paddingTop: 0,
    position: 'absolute',
    top: 0,
    width: 290,
    zIndex: 2,
  },
  wsPanelContainer: {
    backgroundColor: colors.backgroundSoft,
    borderLeftColor: colors.border,
    borderLeftWidth: 1,
    height: '100%',
    paddingTop: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 290,
    zIndex: 3,
  },

  /* Header */
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  headerBtnIcon: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '400',
  },
  pressed: {
    opacity: 0.6,
  },
  headerRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  modelPill: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    maxWidth: 220,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  modelPillStar: {
    color: '#a78bfa',
    fontSize: typography.body,
    fontWeight: '600',
  },
  modelPillLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '500',
    flexShrink: 1,
  },
  modelPillChevron: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
  },

  /* Model picker */
  modelOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },
  modelPanelOuter: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: Platform.OS === 'ios' ? 100 : 70,
    zIndex: 11,
  },
  modelPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    maxHeight: '70%',
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 14,
  },
  modelPanelTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  modelSearchWrap: {
    alignItems: 'center',
    backgroundColor: colors.userBubble,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  modelSearchIcon: {
    fontSize: 14,
  },
  modelSearchInput: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    paddingVertical: spacing.sm,
  },
  modelList: {
    maxHeight: 340,
  },
  modelProviderLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
    textTransform: 'uppercase',
  },
  modelItem: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  modelItemActive: {
    backgroundColor: 'rgba(167,139,250,0.1)',
  },
  modelItemPressed: {
    backgroundColor: colors.userBubble,
    opacity: 0.8,
  },
  modelItemText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '400',
    flexShrink: 1,
  },
  modelItemTextActive: {
    color: '#a78bfa',
    fontWeight: '600',
  },
  modelItemCheck: {
    color: '#a78bfa',
    fontSize: typography.body,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  modelEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  modelEmptyText: {
    color: colors.textDim,
    fontSize: typography.body,
  },

  /* Chat history */
  chatOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
  },
  chatPanel: {
    backgroundColor: colors.backgroundSoft,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    height: '100%',
    paddingTop: Platform.OS === 'ios' ? 54 : 28,
    paddingHorizontal: spacing.lg,
    width: '84%',
    maxWidth: 360,
  },
  chatPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  chatPanelTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  chatCloseBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  chatCloseText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  newChatButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  newChatIcon: {
    color: '#a78bfa',
    fontSize: 17,
    fontWeight: '700',
  },
  newChatText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  emptyChatsBox: {
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderStyle: 'dashed',
    borderWidth: 1,
    padding: spacing.lg,
  },
  emptyChatsTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptyChatsText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    alignItems: 'center',
    borderRadius: radius.xl,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  chatItemActive: {
    backgroundColor: colors.surface,
  },
  chatItemPressed: {
    backgroundColor: colors.userBubble,
  },
  chatItemTextWrap: {
    flex: 1,
  },
  chatItemTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  chatItemMeta: {
    color: colors.textDim,
    fontSize: typography.caption,
    marginTop: 3,
  },
  chatDeleteBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  chatDeleteBtnPressed: {
    backgroundColor: colors.dangerSoft,
  },
  chatDeleteText: {
    fontSize: 16,
  },

  /* Scroll */
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  scrollContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  /* Welcome */
  welcomeWrap: {
    alignItems: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  welcomeTitle: {
    color: colors.text,
    fontSize: typography.hero,
    fontWeight: '600',
    textAlign: 'center',
  },
  connectHint: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  connectHintText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '500',
  },


  /* Error */
  errorCard: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.caption,
    lineHeight: 18,
  },

  /* Composer */
  composerWrap: {
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  composer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xxl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  composerFocused: {
    borderColor: colors.borderStrong,
  },
  statusBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  statusLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statusDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  tokenText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  statusModel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '400',
    maxWidth: '50%',
  },
  attachIcon: {
    color: colors.textMuted,
    fontSize: 22,
    fontWeight: '300',
    paddingHorizontal: spacing.xs,
  },
  voiceBtn: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    lineHeight: 22,
    maxHeight: 120,
    minHeight: 26,
    paddingVertical: spacing.xs,
  },

  sendBtnWrap: {
    height: 34,
    width: 34,
  },
  sendBtn: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  sendBtnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.93 }],
  },
  sendBtnText: {
    color: colors.background,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 20,
  },

  /* Attach bottom sheet */
  attachOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
  },
  attachSheet: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xxl,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  attachItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    borderRadius: radius.lg,
  },
  attachItemPressed: {
    backgroundColor: colors.userBubble,
    opacity: 0.9,
  },
  attachItemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.userBubble,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachItemLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '500',
  },

  /* Attach icons */
  icCamera: {
    alignItems: 'center',
    borderColor: colors.textMuted,
    borderRadius: 3,
    borderWidth: 2,
    height: 16,
    justifyContent: 'center',
    width: 20,
  },
  icCameraLens: {
    borderColor: colors.textMuted,
    borderRadius: 4,
    borderWidth: 2,
    height: 8,
    width: 8,
  },
  icPhoto: {
    alignItems: 'center',
    borderColor: colors.textMuted,
    borderRadius: 3,
    borderWidth: 2,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  icPhotoEl: {
    borderColor: colors.textMuted,
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    width: 10,
  },
  icFile: {
    borderBottomRightRadius: 2,
    borderColor: colors.textMuted,
    borderRadius: 2,
    borderTopRightRadius: 4,
    borderWidth: 2,
    height: 18,
    width: 14,
  },
  icDiamond: {
    borderColor: colors.textMuted,
    borderWidth: 2,
    height: 12,
    margin: 3,
    transform: [{ rotate: '45deg' }],
    width: 12,
  },
  icCircle: {
    borderColor: colors.textMuted,
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    width: 16,
  },

  /* Preview */
  previewSheet: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xxl,
    borderWidth: 1,
    maxHeight: '80%',
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  previewContent: {
    marginTop: spacing.md,
    maxHeight: 400,
  },
  previewCode: {
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  previewWebview: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    height: 400,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  previewSvgWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 200,
    padding: spacing.xl,
  },

  /* Docs */
  docScroll: {
    marginBottom: spacing.sm,
  },
  docChip: {
    backgroundColor: '#2d2d4e',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginRight: spacing.sm,
  },
  docChipText: {
    color: '#a78bfa',
    fontSize: 12,
  },
  docDelete: {
    color: colors.textMuted,
    fontSize: 14,
  },

  /* Navigation drawer */
  navScroll: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  navSectionHeader: {
    color: colors.textDim,
    fontSize: typography.caption,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  navCol: {
    gap: 2,
  },
  navRowItem: {
    alignItems: 'center',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  navRowIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  navRowLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '500',
  },
  drawerBottom: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  drawerBottomBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  drawerBottomStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  drawerBottomStatusText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '500',
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    height: 36,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchExcerpt: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
    marginTop: 2,
  },
});
