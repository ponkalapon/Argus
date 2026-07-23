import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { WorkspaceScreen } from './components/WorkspaceScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { AgentSettings, ProjectInfo, StoredChat } from '../shared/types';
import { colors, radius, spacing, typography } from './styles/theme';
import { t, loadTranslations } from './i18n';

export function App() {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [chats, setChats] = useState<StoredChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [screen, setScreen] = useState<'workspace' | 'settings'>('workspace');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      window.argus.loadSettings(),
      window.argus.loadApiKey(),
      window.argus.loadProjects(),
    ]).then(([s, key, projs]) => {
      setSettings(s);
      setApiKey(key);
      setProjects(projs);
      if (projs.length > 0) {
        setActiveProject(projs[0].path);
      }
      setIsLoading(false);
      loadTranslations(s.language);
    });

    window.argus.onNavigate((screen) => {
      if (screen === 'settings') setScreen('settings');
      if (screen === 'workspace') setScreen('workspace');
    });
  }, []);

  useEffect(() => {
    if (!activeProject) return;
    window.argus.loadChats(activeProject).then((loaded) => {
      setChats(loaded);
      setActiveChatId(loaded.length > 0 ? loaded[0].id : null);
    });
  }, [activeProject]);

  const handleAddProject = useCallback(async () => {
    const folder = await window.argus.selectFolder();
    if (!folder) return;
    const name = await window.argus.getProjectName(folder);
    const updated = [...projects, { path: folder, name }];
    setProjects(updated);
    await window.argus.saveProjects(updated);
    setActiveProject(folder);
  }, [projects]);

  const handleRemoveProject = useCallback(async (path: string) => {
    const updated = projects.filter((p) => p.path !== path);
    setProjects(updated);
    await window.argus.saveProjects(updated);
    if (activeProject === path) {
      setActiveProject(updated.length > 0 ? updated[0].path : null);
    }
  }, [projects, activeProject]);

  const handleSaveSettings = useCallback(async (s: AgentSettings, key: string) => {
    await window.argus.saveSettings(s);
    await window.argus.saveApiKey(key);
    setSettings(s);
    setApiKey(key);
  }, []);

  const handleSaveChats = useCallback(async (updated: StoredChat[]) => {
    setChats(updated);
    if (activeProject) {
      await window.argus.saveChats(activeProject, updated);
    }
  }, [activeProject]);

  if (isLoading || !settings) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.background }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: colors.text, marginBottom: spacing.lg }}>Argus Desktop</div>
          <div style={{ color: colors.textMuted }}>{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: colors.background, overflow: 'hidden' }}>
      <Sidebar
        projects={projects}
        activeProject={activeProject}
        onSelectProject={setActiveProject}
        onAddProject={handleAddProject}
        onRemoveProject={handleRemoveProject}
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={() => {
          const newChat: StoredChat = {
            id: `chat-${Date.now()}`,
            title: 'Новый чат',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          const updated = [newChat, ...chats];
          handleSaveChats(updated);
          setActiveChatId(newChat.id);
        }}
        onDeleteChat={(id) => {
          const updated = chats.filter((c) => c.id !== id);
          handleSaveChats(updated);
          if (activeChatId === id) setActiveChatId(updated.length > 0 ? updated[0].id : null);
        }}
        onOpenSettings={() => setScreen('settings')}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {screen === 'settings' ? (
          <SettingsScreen
            initialSettings={settings}
            onBack={() => setScreen('workspace')}
            onSave={handleSaveSettings}
          />
        ) : activeProject ? (
          <WorkspaceScreen
            settings={settings}
            apiKey={apiKey}
            projectPath={activeProject}
            projectName={projects.find((p) => p.path === activeProject)?.name || ''}
            chats={chats}
            activeChatId={activeChatId}
            onSelectChat={setActiveChatId}
            onSaveChats={handleSaveChats}
            onOpenSettings={() => setScreen('settings')}
          />
        ) : (
          <EmptyState onAddProject={handleAddProject} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ onAddProject }: { onAddProject: () => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: spacing.lg,
    }}>
      <div style={{ fontSize: 48, color: colors.textDim }}>📂</div>
      <div style={{ fontSize: typography.subtitle, color: colors.text, fontWeight: 600 }}>
        {t('emptyState.noProjects')}
      </div>
      <div style={{ fontSize: typography.body, color: colors.textMuted, maxWidth: 360, textAlign: 'center' }}>
        {t('emptyState.addProjectHint')}
      </div>
      <button
        onClick={onAddProject}
        style={{
          background: colors.accent, color: '#000', border: 'none',
          padding: `${spacing.md}px ${spacing.xl}px`, borderRadius: radius.pill,
          fontSize: typography.body, fontWeight: 600, cursor: 'pointer',
          marginTop: spacing.sm,
        }}
      >
        {t('emptyState.addProjectButton')}
      </button>
    </div>
  );
}
