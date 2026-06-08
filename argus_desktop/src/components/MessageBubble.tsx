import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Markdown, { ASTNode } from 'react-native-markdown-display';
import { ChatMessage } from '../types';
import { colors, radius, spacing, typography } from '../styles/theme';
import { Bot } from 'lucide-react-native';
import MermaidChart from './MermaidChart';

type Props = {
  message: ChatMessage;
};

export const MessageBubble = memo(({ message }: Props) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const isUser = message.role === 'user';
  const isEmpty = !isUser && message.content.length === 0;
  const raw = isEmpty ? '...' : message.content;

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
            {isCopied ? 'Скопировано' : 'Копировать'}
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
        <Bot size={16} color="#a78bfa" />
      </View>
      <View style={styles.assistantBubble}>
        <Markdown style={markdownStyles} rules={rules}>
          {raw}
        </Markdown>
      </View>
    </View>
  );
});

const markdownStyles = StyleSheet.create({
  body: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
  },
  code_inline: {
    backgroundColor: '#1e1e3a',
    borderRadius: 4,
    color: '#a78bfa',
    fontFamily: 'monospace',
    fontSize: 13,
    paddingHorizontal: 5,
  },
  code_block: {
    backgroundColor: '#1a1a2e',
    borderColor: '#2d2d4e',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  fence: {
    backgroundColor: '#1a1a2e',
    borderColor: '#2d2d4e',
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
  heading1: { color: colors.text, fontWeight: 'bold', fontSize: 24, marginVertical: 10 },
  heading2: { color: colors.text, fontWeight: 'bold', fontSize: 20, marginVertical: 8 },
  heading3: { color: colors.text, fontWeight: 'bold', fontSize: 18, marginVertical: 6 },
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
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 30,
    justifyContent: 'center',
    marginTop: 1,
    width: 30,
    flexShrink: 0,
  },
  avatarText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  userBubble: {
    backgroundColor: colors.userBubble,
    borderRadius: radius.xxl,
    borderBottomRightRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxWidth: '82%',
  },
  userContent: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
  },
  assistantBubble: {
    flex: 1,
  },
  codeBlock: {
    backgroundColor: '#111827',
    borderColor: '#243044',
    borderRadius: radius.lg,
    borderWidth: 1,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  codeBlockPressed: {
    borderColor: '#a78bfa',
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
});
