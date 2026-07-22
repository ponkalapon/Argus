import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentSettings, ChatMessage, StoredChat, ChatCompletionMessage } from '../../shared/types';
import { colors, radius, spacing, typography } from '../styles/theme';
import { t } from '../i18n';
import { estimateMessagesTokens, estimateTokens, TOOL_DEFINITIONS } from '../services/openaiClient';

type Props = {
  settings: AgentSettings;
  apiKey: string;
  projectPath: string;
  projectName: string;
  chats: StoredChat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onSaveChats: (chats: StoredChat[]) => void;
  onOpenSettings: () => void;
};

const getWelcomeMsg = (): ChatMessage => ({
  id: 'welcome',
  role: 'assistant',
  content: t('workspace.welcome'),
  createdAt: Date.now(),
});

export function WorkspaceScreen({
  settings, apiKey, projectPath, projectName,
  chats, activeChatId, onSelectChat, onSaveChats, onOpenSettings,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'thinking' | 'error'>('idle');
  const [inputTokens, setInputTokens] = useState(0);
  const [outputTokens, setOutputTokens] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const streamTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamQueue = useRef('');
  const streamMessageId = useRef<string | null>(null);

  const activeChat = chats.find((c) => c.id === activeChatId);

  useEffect(() => {
    if (activeChat) {
      setMessages(activeChat.messages.length > 0 ? activeChat.messages : [getWelcomeMsg()]);
    } else {
      setMessages([getWelcomeMsg()]);
    }
  }, [activeChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateMessageContent = useCallback((id: string, delta: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
    );
  }, []);

  const startStreamTicker = useCallback((messageId: string) => {
    if (streamTimer.current) clearInterval(streamTimer.current);
    streamMessageId.current = messageId;
    streamQueue.current = '';
    streamTimer.current = setInterval(() => {
      if (!streamQueue.current) return;
      const len = streamQueue.current.length;
      const chunkSize = len < 8 ? 1 : len < 50 ? Math.min(Math.ceil(len / 4), 6) : Math.min(Math.max(Math.ceil(len / 8), 4), 32);
      const chunk = streamQueue.current.slice(0, chunkSize);
      streamQueue.current = streamQueue.current.slice(chunkSize);
      updateMessageContent(messageId, chunk);
    }, 16);
  }, [updateMessageContent]);

  const flushStream = useCallback(() => {
    if (streamTimer.current) { clearInterval(streamTimer.current); streamTimer.current = null; }
    if (streamMessageId.current && streamQueue.current) {
      updateMessageContent(streamMessageId.current, streamQueue.current);
      streamQueue.current = '';
    }
    streamMessageId.current = null;
  }, [updateMessageContent]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || status === 'thinking') return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text.trim(), createdAt: Date.now() };
    const assistantMsg: ChatMessage = { id: `a-${Date.now()}`, role: 'assistant', content: '', createdAt: Date.now() };

    const allMessages = [...messages, userMsg];
    setMessages([...allMessages, assistantMsg]);
    setDraft('');
    setStatus('thinking');
    startStreamTicker(assistantMsg.id);

    const apiMessages: ChatCompletionMessage[] = allMessages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }));

    setInputTokens(estimateMessagesTokens(apiMessages));
    setOutputTokens(0);

    const streamedText = { current: '' };

    try {
      const result = await window.argus.readFile(projectPath, '.argus');
      let workspaceContext = '';
      if (!result.error) {
        try {
          const files = await window.argus.listFiles(projectPath);
          workspaceContext = `Проект: ${projectName}\nФайлы:\n${files.slice(0, 50).map((f) => `  ${f.isDir ? '📁' : '📄'} ${f.path}`).join('\n')}`;
        } catch { /* ignore */ }
      }

      const response = await fetch(`${settings.baseUrl}${getEndpointPath(settings.apiFormat)}`, {
        method: 'POST',
        headers: createHeaders(apiKey, settings.apiFormat),
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: 'system', content: buildSystemPrompt(projectName, workspaceContext) },
            ...apiMessages,
          ],
          temperature: 0.7,
          max_tokens: 4096,
          stream: true,
          tools: TOOL_DEFINITIONS,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(t('workspace.apiError', { status: String(response.status), message: errText.slice(0, 200) }));
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                streamedText.current += delta;
                streamQueue.current += delta;
                setOutputTokens(estimateTokens(streamedText.current));
              }
            } catch { /* skip */ }
          }
        }
      }

      flushStream();

      const finalMessages = [...allMessages, { ...assistantMsg, content: streamedText.current }];
      setMessages(finalMessages);

      // Update chat
      if (activeChatId) {
        const title = activeChat?.title === 'Новый чат' && streamedText.current
          ? streamedText.current.slice(0, 40).trim()
          : activeChat?.title || 'Новый чат';
        const updated = chats.map((c) =>
          c.id === activeChatId ? { ...c, title, messages: finalMessages, updatedAt: Date.now() } : c,
        );
        onSaveChats(updated);
      }

      setStatus('idle');
    } catch (e) {
      flushStream();
      const errMsg = e instanceof Error ? e.message : t('workspace.unknownError');
      setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, content: `❌ ${errMsg}` } : m));
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [messages, status, settings, apiKey, projectPath, projectName, activeChatId, activeChat, chats, onSaveChats, startStreamTicker, flushStream]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(draft);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          <div style={styles.headerTitle}>📂 {projectName}</div>
          <div style={styles.headerSub}>{t('workspace.messageCount', { count: messages.length - 1 })}</div>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.tokenInfo}>{t('workspace.tokenInput')} {formatTokens(inputTokens)} / {t('workspace.tokenOutput')} {formatTokens(outputTokens)}</span>
          <span style={styles.modelBadge}>{settings.model}</span>
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messagesContainer}>
        <div style={styles.messagesInner}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {status === 'thinking' && (
            <div style={styles.typingRow}>
              <div style={styles.typingDot} />
              <div style={{ ...styles.typingDot, animationDelay: '0.2s' }} />
              <div style={{ ...styles.typingDot, animationDelay: '0.4s' }} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div style={styles.inputBar}>
        <div style={styles.inputContainer}>
          <textarea
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('workspace.inputPlaceholder')}
            style={styles.textarea}
            rows={1}
          />
          <button
            onClick={() => sendMessage(draft)}
            disabled={!draft.trim() || status === 'thinking'}
            style={{
              ...styles.sendBtn,
              opacity: draft.trim() && status !== 'thinking' ? 1 : 0.4,
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div style={{ ...styles.msgRow, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && <div style={styles.avatar}>🤖</div>}
      <div style={{
        ...styles.bubble,
        ...(isUser ? styles.userBubble : styles.assistantBubble),
        maxWidth: '75%',
      }}>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: typography.body }}>
          {message.content || (message.role === 'assistant' ? '…' : '')}
        </div>
      </div>
    </div>
  );
}

function buildSystemPrompt(projectName: string, workspaceContext: string): string {
  return `Ты — Argus, AI-ассистент для разработки. Работаешь с проектом "${projectName}".

${workspaceContext ? workspaceContext + '\n\n' : ''}Правила:
- Будь конкретным, давай готовый код
- Объясняй кратко, только суть
- Используй файлы проекта как контекст`;
}

function createHeaders(apiKey: string, format: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey.trim()) {
    if (format === 'anthropic') { h['x-api-key'] = apiKey.trim(); h['anthropic-version'] = '2023-06-01'; }
    else h.Authorization = `Bearer ${apiKey.trim()}`;
  }
  return h;
}

function getEndpointPath(format: string): string {
  switch (format) {
    case 'ollama': return '/api/chat';
    case 'anthropic': return '/v1/messages';
    case 'kobold': return '/api/v1/chat/completions';
    default: return '/v1/chat/completions';
  }
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const styles: Record<string, React.CSSProperties> = {
  container: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: `${spacing.md}px ${spacing.xl}px`,
    borderBottom: `1px solid ${colors.border}`,
    background: colors.backgroundSoft,
    WebkitAppRegion: 'drag' as any,
  },
  headerInfo: { display: 'flex', flexDirection: 'column', gap: 2 },
  headerTitle: { fontSize: typography.subtitle, fontWeight: 700, color: colors.text },
  headerSub: { fontSize: typography.caption, color: colors.textDim },
  headerRight: { display: 'flex', alignItems: 'center', gap: spacing.md },
  tokenInfo: { fontSize: typography.caption, color: colors.textDim },
  modelBadge: {
    fontSize: typography.caption, color: colors.textMuted,
    background: colors.surfaceMuted, padding: `${spacing.xs}px ${spacing.sm}px`,
    borderRadius: radius.pill,
  },
  messagesContainer: { flex: 1, overflow: 'auto', background: colors.background },
  messagesInner: {
    maxWidth: 800, margin: '0 auto', padding: `${spacing.xl}px ${spacing.xl}px`,
    display: 'flex', flexDirection: 'column', gap: spacing.lg,
  },
  msgRow: { display: 'flex', alignItems: 'flex-start', gap: spacing.sm },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    background: colors.surfaceMuted, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 16, flexShrink: 0,
  },
  bubble: { padding: `${spacing.md}px ${spacing.lg}px`, borderRadius: radius.xl, lineHeight: 1.6 },
  userBubble: { background: colors.userBubble, borderBottomRightRadius: radius.sm },
  assistantBubble: { background: colors.assistantBubble },
  typingRow: { display: 'flex', gap: spacing.sm, padding: `${spacing.md}px ${spacing.lg}px` },
  typingDot: {
    width: 8, height: 8, borderRadius: 4, background: colors.textDim,
    animation: 'pulse 1.2s infinite',
  },
  inputBar: {
    borderTop: `1px solid ${colors.border}`,
    padding: `${spacing.md}px ${spacing.xl}px`,
    background: colors.backgroundSoft,
  },
  inputContainer: {
    maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'flex-end',
    gap: spacing.sm, background: colors.surface, borderRadius: radius.xl,
    padding: `${spacing.sm}px ${spacing.sm}px ${spacing.sm}px ${spacing.lg}px`,
    border: `1px solid ${colors.border}`,
  },
  textarea: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: colors.text, fontSize: typography.body,
    fontFamily: 'inherit', resize: 'none', lineHeight: 1.5,
    maxHeight: 150, minHeight: 24,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    background: colors.text, color: colors.background,
    border: 'none', fontSize: 18, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
};
