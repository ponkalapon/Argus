import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Markdown, { ASTNode } from 'react-native-markdown-display';
import { Zap } from 'lucide-react-native';
import { ChatMessage } from '../types';
import { colors, fontFamily, radius, spacing, typography } from '../styles/theme';
import { t } from '../i18n';
import MermaidChart from './MermaidChart';

type Props = {
  message: ChatMessage;
  streamingSpeed?: string | null;
};

export const MessageBubble = memo(({ message, streamingSpeed }: Props) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const isUser = message.role === 'user';
  const isEmpty = !isUser && message.content.length === 0;
  const raw = isEmpty ? '' : message.content;

  const fadeAnim = useRef(new Animated.Value(message.content.length > 0 ? 1 : 0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const prevContentLen = useRef(message.content.length);

  useEffect(() => {
    if (!isUser && message.content.length > prevContentLen.current) {
      fadeAnim.setValue(0.7);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }).start();
    }
    prevContentLen.current = message.content.length;
  }, [message.content.length]);

  const dot1Anim = useRef(new Animated.Value(0.4)).current;
  const dot2Anim = useRef(new Animated.Value(0.6)).current;
  const dot3Anim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (isEmpty) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(dot1Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(dot2Anim, { toValue: 0.4, duration: 400, useNativeDriver: true }),
            Animated.timing(dot3Anim, { toValue: 0.6, duration: 400, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(dot1Anim, { toValue: 0.6, duration: 400, useNativeDriver: true }),
            Animated.timing(dot2Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(dot3Anim, { toValue: 0.4, duration: 400, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(dot1Anim, { toValue: 0.4, duration: 400, useNativeDriver: true }),
            Animated.timing(dot2Anim, { toValue: 0.6, duration: 400, useNativeDriver: true }),
            Animated.timing(dot3Anim, { toValue: 1, duration: 400, useNativeDriver: true }),
          ]),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    dot1Anim.setValue(1);
    dot2Anim.setValue(1);
    dot3Anim.setValue(1);
    return undefined;
  }, [isEmpty]);

  if (isUser) {
    return (
      <View style={[styles.row, styles.rowUser]}>
        <View style={styles.userBubble}>
          <Text style={styles.userContent}>{raw}</Text>
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
            {isCopied ? t('messageBubble.copied') : t('messageBubble.copy')}
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

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.avatarImage}
          resizeMode="contain"
        />
      </View>
      <Animated.View style={[styles.assistantBubble, { opacity: isEmpty ? pulseAnim : fadeAnim }]}>
        {isEmpty ? (
          <View style={styles.typingIndicator}>
            <Animated.View style={[styles.typingDot, { opacity: dot1Anim }]} />
            <Animated.View style={[styles.typingDot, { opacity: dot2Anim }]} />
            <Animated.View style={[styles.typingDot, { opacity: dot3Anim }]} />
          </View>
        ) : (
          <Markdown style={markdownStyles} rules={rules}>
            {raw}
          </Markdown>
        )}

        {streamingSpeed ? (
          <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, alignSelf: 'flex-start', marginTop: 6 }}>
            <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '500' }}>{streamingSpeed} т/с</Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
});

const markdownStyles = StyleSheet.create({
  body: {
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: typography.body,
    lineHeight: 24,
  },
  code_inline: {
    backgroundColor: '#18181c',
    borderColor: '#232328',
    borderWidth: 1,
    borderRadius: 4,
    color: '#e4e4e7',
    fontFamily: fontFamily.mono,
    fontSize: 13,
    paddingHorizontal: 5,
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
    borderColor: '#2d2d4e',
    borderWidth: 1,
    borderRadius: 8,
    marginVertical: spacing.md,
  },
  thead: {
    backgroundColor: '#2d2d4e',
  },
  tr: {
    borderBottomWidth: 1,
    borderColor: '#2d2d4e',
    flexDirection: 'row',
  },
  th: {
    padding: spacing.sm,
    color: '#a78bfa',
    fontWeight: 'bold',
  },
  td: {
    padding: spacing.sm,
    color: colors.text,
  },
  link: {
    color: '#a78bfa',
    textDecorationLine: 'underline',
  },
  heading1: { color: colors.text, fontFamily: fontFamily.regular, fontWeight: 'bold', fontSize: 24, marginVertical: 10 },
  heading2: { color: colors.text, fontFamily: fontFamily.regular, fontWeight: 'bold', fontSize: 20, marginVertical: 8 },
  heading3: { color: colors.text, fontFamily: fontFamily.regular, fontWeight: 'bold', fontSize: 18, marginVertical: 6 },
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
  userBubble: {
    backgroundColor: colors.userBubble,
    borderColor: '#26262e',
    borderWidth: 1,
    borderRadius: radius.xxl,
    borderBottomRightRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxWidth: '82%',
  },
  userContent: {
    color: colors.text,
    fontFamily: fontFamily.regular,
    fontSize: typography.body,
    lineHeight: 24,
  },
  assistantBubble: {
    flex: 1,
  },
  codeBlock: {
    backgroundColor: '#0d0d10',
    borderColor: '#232328',
    borderRadius: radius.lg,
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
    backgroundColor: '#1f2937',
    borderBottomColor: '#243044',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  codeLang: {
    color: '#a78bfa',
    fontFamily: fontFamily.regular,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  copyHint: {
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 11,
    fontWeight: '500',
  },
  copyHintActive: {
    color: '#7dd3fc',
  },
  codeText: {
    color: '#e5e7eb',
    fontFamily: fontFamily.mono,
    fontSize: 13,
    lineHeight: 20,
    padding: spacing.md,
    minWidth: 40,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#a78bfa',
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
});
