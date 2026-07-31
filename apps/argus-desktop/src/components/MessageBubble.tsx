import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Markdown, { ASTNode } from 'react-native-markdown-display';
import { Brain, Check, ChevronLeft, ChevronRight as ChevronRightIcon, Copy, Pencil, RotateCw } from 'lucide-react-native';
import { ChatMessage } from '../types';
import { colors, radius, spacing, typography } from '../styles/theme';
import MermaidChart from './MermaidChart';
import { t } from '../services/i18n';

const TypingDots = memo(() => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: -6,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.delay(350),
        ])
      );
    };

    const anim1 = animateDot(dot1, 0);
    const anim2 = animateDot(dot2, 120);
    const anim3 = animateDot(dot3, 240);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, height: 26, paddingHorizontal: 4 }}>
      <Animated.View
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: colors.accent,
          transform: [{ translateY: dot1 }],
        }}
      />
      <Animated.View
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: colors.accent,
          transform: [{ translateY: dot2 }],
          opacity: 0.85,
        }}
      />
      <Animated.View
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: colors.accent,
          transform: [{ translateY: dot3 }],
          opacity: 0.7,
        }}
      />
    </View>
  );
});

const getExtColor = (ext: string) => {
  const e = ext.toLowerCase();
  if (e === 'ts' || e === 'tsx' || e === 'jsx' || e === 'js') return 'rgba(59, 130, 246, 0.15)';
  if (e === 'json' || e === 'yml' || e === 'yaml') return 'rgba(234, 179, 8, 0.15)';
  if (e === 'py') return 'rgba(34, 197, 94, 0.15)';
  if (e === 'html' || e === 'css') return 'rgba(249, 115, 22, 0.15)';
  return 'rgba(168, 85, 247, 0.15)';
};

const getExtTextColor = (ext: string) => {
  const e = ext.toLowerCase();
  if (e === 'ts' || e === 'tsx' || e === 'jsx' || e === 'js') return '#60a5fa';
  if (e === 'json' || e === 'yml' || e === 'yaml') return '#facc15';
  if (e === 'py') return '#4ade80';
  if (e === 'html' || e === 'css') return '#fb923c';
  return '#c084fc';
};

type Props = {
  message: ChatMessage;
  onRegenerate?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  streamingSpeed?: string | null;
  /** Branch navigation */
  onBranchPrev?: () => void;
  onBranchNext?: () => void;
  branchIndex?: number;
  branchTotal?: number;
  /** In-chat search highlight */
  highlightText?: string;
};

export const MessageBubble = memo(({ message, onRegenerate, onDelete, onEdit, streamingSpeed, onBranchPrev, onBranchNext, branchIndex, branchTotal, highlightText }: Props) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const isUser = message.role === 'user';
  const isEmpty = !isUser && message.content.length === 0;
  const raw = isEmpty ? '...' : message.content;

  const copyFullMessage = async () => {
    if (!message.content.trim()) return;
    await Clipboard.setStringAsync(message.content);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 1500);
  };


  /** Render text with optional search highlight */
  const renderHighlightedText = (text: string, style: any) => {
    if (!highlightText || !highlightText.trim()) {
      return <Text style={style}>{text}</Text>;
    }
    const parts = text.split(new RegExp(`(${highlightText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <Text style={style}>
        {parts.map((part, i) =>
          part.toLowerCase() === highlightText.toLowerCase() ? (
            <Text key={i} style={[style, styles.highlight]}>{part}</Text>
          ) : (
            part
          )
        )}
      </Text>
    );
  };

  if (isUser) {
    return (
      <View style={[styles.row, styles.rowUser]}>
        <View style={styles.userContainer}>
          <View style={styles.userBubble}>
            {renderHighlightedText(raw, styles.userContent)}
          </View>
          <View style={[styles.actionBar, { justifyContent: 'flex-end', marginTop: 2 }]}>
            {onEdit && (
              <Pressable
                onPress={onEdit}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              >
                <Pencil size={13} color={colors.textMuted} />
              </Pressable>
            )}
            <Pressable
              onPress={copyFullMessage}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
            >
              {copiedMessage ? <Check size={13} color={colors.success} /> : <Copy size={13} color={colors.textMuted} />}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const copyCode = async (key: string, code: string) => {
    if (!code.trim()) return;
    await Clipboard.setStringAsync(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1200);
  };

  const renderCodeBlock = (node: ASTNode) => {
    const content = node.content || '';
    const sourceInfo = (node as ASTNode & { sourceInfo?: string }).sourceInfo;
    const lang = sourceInfo ? sourceInfo.trim().toLowerCase() : '';
    const isCopied = copiedKey === node.key;

    if (lang === 'mermaid' && content.trim()) {
      return <MermaidChart key={node.key} chart={content} />;
    }

    return (
      <Pressable
        key={node.key}
        onPress={() => copyCode(node.key, content)}
        style={({ pressed }) => [styles.codeBlock, pressed && styles.codeBlockPressed]}
      >
        <View style={styles.codeHeader}>
          <Text style={styles.codeLang}>{lang || 'code'}</Text>
          <Text style={[styles.copyHint, isCopied && styles.copyHintActive]}>
            {isCopied ? t('chat.copied', 'Скопировано') : t('chat.copy_code', 'Копировать')}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <Text style={styles.codeText} selectable>
            {content || ' '}
          </Text>
        </ScrollView>
      </Pressable>
    );
  };

  const rules = {
    fence: (node: ASTNode) => renderCodeBlock(node),
    code_block: (node: ASTNode) => renderCodeBlock(node),
  };

  const [stepsExpanded, setStepsExpanded] = useState(true);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.avatarImage}
          resizeMode="contain"
        />
      </View>
      <View style={styles.assistantBubble}>
        {/* Collapsible Reasoning / Thinking Block (Hermes / DeepSeek style) */}
        {Boolean(message.reasoning) && (
          <View style={styles.thinkingWrap}>
            <Pressable
              onPress={() => setThinkingExpanded((prev) => !prev)}
              style={({ pressed }) => [styles.thinkingHeader, pressed && styles.pressed]}
            >
              <Brain size={14} color="#a78bfa" style={{ marginRight: 6 }} />
              <Text style={styles.thinkingHeaderText}>
                Размышления ({message.reasoning!.length} символов)
              </Text>
              <ChevronRightIcon
                size={13}
                color={colors.textMuted}
                style={{ marginLeft: 'auto', transform: [{ rotate: thinkingExpanded ? '90deg' : '0deg' }] }}
              />
            </Pressable>

            {thinkingExpanded && (
              <View style={styles.thinkingBody}>
                <Text style={styles.thinkingText} selectable>
                  {message.reasoning}
                </Text>
              </View>
            )}
          </View>
        )}

        {message.steps && message.steps.length > 0 && (
          <View style={styles.stepsWrap}>
            <Pressable
              onPress={() => setStepsExpanded((prev) => !prev)}
              style={({ pressed }) => [styles.stepsHeader, pressed && styles.pressed]}
            >
              <ChevronRightIcon
                size={13}
                color={colors.textMuted}
                style={{ transform: [{ rotate: stepsExpanded ? '90deg' : '0deg' }] }}
              />
              <Text style={styles.stepsHeaderText}>
                Exploring {message.steps.length} {message.steps.length === 1 ? 'file' : 'files'}
              </Text>
            </Pressable>

            {stepsExpanded && (
              <View style={styles.stepsList}>
                {message.steps.map((step) => (
                  <View key={step.id} style={styles.stepRow}>
                    <Text style={styles.stepActionText}>{step.label}</Text>

                    {step.ext && (
                      <View style={[styles.extBadge, { backgroundColor: getExtColor(step.ext) }]}>
                        <Text style={[styles.extBadgeText, { color: getExtTextColor(step.ext) }]}>{step.ext}</Text>
                      </View>
                    )}

                    <Text style={styles.stepFilename} numberOfLines={1}>
                      {step.filename || step.detail}
                    </Text>

                    {typeof step.addedLines === 'number' && (
                      <Text style={styles.diffAdded}>+{step.addedLines}</Text>
                    )}
                    {typeof step.deletedLines === 'number' && (
                      <Text style={styles.diffDeleted}>-{step.deletedLines}</Text>
                    )}

                    {step.status === 'running' && (
                      <Text style={styles.stepBadgeRunning}>running…</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {isEmpty && (!message.steps || message.steps.length === 0) ? (
          <TypingDots />
        ) : (
          <Markdown style={markdownStyles} rules={rules}>
            {message.content}
          </Markdown>
        )}

        {/* Message Action Bar */}
        {(!isEmpty || (message.steps && message.steps.length > 0) || streamingSpeed) && (
          <View style={styles.actionBar}>
            <Pressable
              onPress={copyFullMessage}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
            >
              {copiedMessage ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Check size={14} color={colors.success} />
                  <Text style={{ color: colors.success, fontSize: 11, fontWeight: '600' }}>{t('chat.copied', 'Скопировано')}</Text>
                </View>
              ) : (
                <Copy size={14} color={colors.textMuted} />
              )}
            </Pressable>

            {onRegenerate ? (
              <Pressable
                onPress={onRegenerate}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              >
                <RotateCw size={14} color={colors.textMuted} />
              </Pressable>
            ) : null}

            {/* Branch navigator ← 1/N → */}
            {branchTotal !== undefined && branchTotal > 1 && (
              <View style={styles.branchNav}>
                <Pressable
                  onPress={onBranchPrev}
                  disabled={branchIndex === 0}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed, branchIndex === 0 && { opacity: 0.3 }]}
                >
                  <ChevronLeft size={13} color={colors.textMuted} />
                </Pressable>
                <Text style={styles.branchLabel}>{(branchIndex ?? 0) + 1}/{branchTotal}</Text>
                <Pressable
                  onPress={onBranchNext}
                  disabled={branchIndex === branchTotal - 1}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed, branchIndex === branchTotal - 1 && { opacity: 0.3 }]}
                >
                  <ChevronRightIcon size={13} color={colors.textMuted} />
                </Pressable>
              </View>
            )}

            {streamingSpeed ? (
              <View style={styles.speedBadge}>
                <Text style={styles.speedText}>{streamingSpeed} т/с</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
});

const markdownStyles = StyleSheet.create({
  body: {
    color: '#e4e4e7',
    fontSize: typography.body,
    lineHeight: 24,
  },
  code_inline: {
    backgroundColor: '#18181c',
    borderWidth: 1,
    borderColor: '#232328',
    borderRadius: 5,
    color: '#e4e4e7',
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: 13,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  code_block: {
    backgroundColor: '#0d0d10',
    borderColor: '#232328',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  fence: {
    backgroundColor: '#0d0d10',
    borderColor: '#232328',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  table: {
    borderColor: '#232328',
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: spacing.md,
    backgroundColor: '#121215',
    overflow: 'hidden',
  },
  thead: {
    backgroundColor: '#18181b',
  },
  tr: {
    borderBottomWidth: 1,
    borderColor: '#27272a',
    flexDirection: 'row',
  },
  th: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  td: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
  },
  link: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  heading1: { color: 'rgba(240, 240, 248, 0.98)', fontWeight: 'bold', fontSize: 24, marginVertical: 10, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  heading2: { color: 'rgba(240, 240, 248, 0.98)', fontWeight: 'bold', fontSize: 20, marginVertical: 8, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  heading3: { color: 'rgba(240, 240, 248, 0.95)', fontWeight: 'bold', fontSize: 18, marginVertical: 6 },
  paragraph: { marginVertical: 4 },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
});

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-start',
    marginBottom: spacing.xl,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: radius.pill,
    height: 30,
    justifyContent: 'center',
    marginTop: 1,
    width: 30,
    flexShrink: 0,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 24,
    height: 24,
  },
  avatarText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  userContainer: {
    maxWidth: '82%',
    alignItems: 'flex-end',
  },
  userBubble: {
    backgroundColor: colors.userBubble,
    borderColor: '#26262e',
    borderWidth: 1,
    borderRadius: radius.xl,
    borderBottomRightRadius: radius.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignSelf: 'flex-end',
  },
  userContent: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
  },
  assistantBubble: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  codeBlock: {
    backgroundColor: '#09090b',
    borderColor: '#27272a',
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  codeBlockPressed: {
    borderColor: colors.accent,
    opacity: 0.92,
  },
  codeHeader: {
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderBottomColor: '#27272a',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  codeLang: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  copyHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  copyHintActive: {
    color: '#7dd3fc',
  },
  codeText: {
    color: '#e5e7eb',
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
    padding: spacing.md,
    minWidth: 40,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingTop: 4,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  actionBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    opacity: 0.8,
  },
  pressed: {
    opacity: 0.8,
  },
  stepsWrap: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  stepsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  stepsHeaderText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  stepsList: {
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    borderTopWidth: 1,
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  stepActionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  extBadge: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  extBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  stepFilename: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  diffAdded: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 2,
  },
  diffDeleted: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 2,
  },
  stepBadgeRunning: {
    color: colors.accent,
    fontSize: 11,
    fontStyle: 'italic',
    marginLeft: 4,
  },
  speedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  branchNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 4,
  },
  branchLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 28,
    textAlign: 'center',
  },
  highlight: {
    backgroundColor: 'rgba(234, 179, 8, 0.35)',
    color: '#fde047',
    borderRadius: 2,
  },

  // ── Thinking / Reasoning Accordion ──
  thinkingWrap: {
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(167, 139, 250, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
    overflow: 'hidden',
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  thinkingHeaderText: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: '600',
  },
  thinkingBody: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(167, 139, 250, 0.15)',
    backgroundColor: '#0b0b0e',
  },
  thinkingText: {
    color: '#d4d4d8',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Consolas, monospace',
  },
});

