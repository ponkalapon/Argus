import { useState } from 'react';
import { ProjectInfo, StoredChat } from '../../shared/types';
import { colors, radius, spacing, typography } from '../styles/theme';
import { t } from '../i18n';

type Props = {
  projects: ProjectInfo[];
  activeProject: string | null;
  onSelectProject: (path: string) => void;
  onAddProject: () => void;
  onRemoveProject: (path: string) => void;
  chats: StoredChat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onOpenSettings: () => void;
};

export function Sidebar({
  projects, activeProject, onSelectProject, onAddProject, onRemoveProject,
  chats, activeChatId, onSelectChat, onNewChat, onDeleteChat, onOpenSettings,
}: Props) {
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);

  return (
    <div style={styles.container}>
      {/* Title bar drag region */}
      <div style={styles.titleBar} />

      {/* Project tabs */}
      <div style={styles.tabsRow}>
        <div style={styles.tabsScroll}>
          {projects.map((p) => (
            <div
              key={p.path}
              onClick={() => onSelectProject(p.path)}
              onMouseEnter={() => setHoveredProject(p.path)}
              onMouseLeave={() => setHoveredProject(null)}
              style={{
                ...styles.tab,
                ...(activeProject === p.path ? styles.tabActive : {}),
              }}
            >
              <span style={styles.tabText}>{p.name}</span>
              {hoveredProject === p.path && projects.length > 1 && (
                <span
                  onClick={(e) => { e.stopPropagation(); onRemoveProject(p.path); }}
                  style={styles.tabClose}
                >
                  ×
                </span>
              )}
            </div>
          ))}
        </div>
        <button onClick={onAddProject} style={styles.addTab} title={t('sidebar.addProjectTitle')}>+</button>
      </div>

      <div style={styles.divider} />

      {/* Chat list */}
      <div style={styles.chatList}>
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            onMouseEnter={() => setHoveredChat(chat.id)}
            onMouseLeave={() => setHoveredChat(null)}
            style={{
              ...styles.chatItem,
              ...(activeChatId === chat.id ? styles.chatItemActive : {}),
            }}
          >
            <span style={styles.chatItemText}>{chat.title || t('sidebar.newChatDefault')}</span>
            {hoveredChat === chat.id && (
              <span
                onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                style={styles.chatDelete}
              >
                🗑
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Bottom actions */}
      <div style={styles.bottom}>
        {activeProject && (
          <button onClick={onNewChat} style={styles.newChatBtn}>
            {t('common.newChat')}
          </button>
        )}
        <button onClick={onOpenSettings} style={styles.settingsBtn}>
          {t('common.settings')}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 260,
    minWidth: 260,
    background: colors.sidebar,
    display: 'flex',
    flexDirection: 'column',
    borderRight: `1px solid ${colors.border}`,
    userSelect: 'none',
  },
  titleBar: {
    height: 38,
    WebkitAppRegion: 'drag',
  },
  tabsRow: {
    display: 'flex',
    alignItems: 'center',
    padding: `0 ${spacing.sm}px`,
    gap: spacing.xs,
  },
  tabsScroll: {
    display: 'flex',
    gap: spacing.xs,
    flex: 1,
    overflow: 'auto',
    padding: `${spacing.xs}px 0`,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.sm}px ${spacing.md}px`,
    borderRadius: radius.md,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    fontSize: typography.caption,
    color: colors.textMuted,
    background: 'transparent',
    transition: 'background 0.15s',
    flexShrink: 0,
  },
  tabActive: {
    background: colors.surfaceMuted,
    color: colors.text,
  },
  tabText: { overflow: 'hidden', textOverflow: 'ellipsis' },
  tabClose: {
    fontSize: 14,
    color: colors.textDim,
    cursor: 'pointer',
    padding: '0 2px',
  },
  addTab: {
    background: 'transparent',
    border: 'none',
    color: colors.textMuted,
    fontSize: 18,
    cursor: 'pointer',
    padding: `${spacing.xs}px ${spacing.sm}px`,
    borderRadius: radius.sm,
    flexShrink: 0,
  },
  divider: {
    height: 1,
    background: colors.border,
    margin: `${spacing.xs}px ${spacing.lg}px`,
  },
  chatList: {
    flex: 1,
    overflow: 'auto',
    padding: `${spacing.sm}px ${spacing.sm}px`,
  },
  chatItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${spacing.sm + 2}px ${spacing.md}px`,
    borderRadius: radius.md,
    cursor: 'pointer',
    fontSize: typography.body,
    color: colors.textMuted,
    transition: 'background 0.15s',
  },
  chatItemActive: {
    background: colors.surfaceMuted,
    color: colors.text,
  },
  chatItemText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    flex: 1,
  },
  chatDelete: {
    fontSize: 12,
    cursor: 'pointer',
    padding: '0 4px',
    opacity: 0.6,
  },
  bottom: {
    padding: `${spacing.sm}px ${spacing.md}px`,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  newChatBtn: {
    background: colors.surfaceMuted,
    border: 'none',
    color: colors.text,
    padding: `${spacing.sm}px ${spacing.md}px`,
    borderRadius: radius.md,
    fontSize: typography.body,
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  settingsBtn: {
    background: 'transparent',
    border: 'none',
    color: colors.textDim,
    padding: `${spacing.sm}px ${spacing.md}px`,
    borderRadius: radius.md,
    fontSize: typography.caption,
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
};
