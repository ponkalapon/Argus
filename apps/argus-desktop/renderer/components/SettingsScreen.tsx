import { useState, useEffect } from 'react';
import { AgentSettings } from '../../shared/types';
import { colors, radius, spacing, typography } from '../styles/theme';
import { t, loadTranslations } from '../i18n';

type Props = {
  initialSettings: AgentSettings;
  onBack: () => void;
  onSave: (settings: AgentSettings, apiKey: string) => Promise<void>;
};

const MODEL_SUGGESTIONS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];

type Provider = {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  description: string;
};

const PROVIDERS: Provider[] = [
  { id: 'openai', name: 'settings.providers.openai', baseUrl: 'https://api.openai.com', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1-mini'], description: 'settings.descriptions.openai' },
  { id: 'openrouter', name: 'settings.providers.openrouter', baseUrl: 'https://openrouter.ai/api', models: ['anthropic/claude-sonnet-4', 'google/gemini-2.0-flash'], description: 'settings.descriptions.openrouter' },
  { id: 'anthropic', name: 'settings.providers.anthropic', baseUrl: 'https://api.anthropic.com', models: ['claude-sonnet-4', 'claude-3.5-haiku'], description: 'settings.descriptions.anthropic' },
  { id: 'deepseek', name: 'settings.providers.deepseek', baseUrl: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner'], description: 'settings.descriptions.deepseek' },
  { id: 'groq', name: 'settings.providers.groq', baseUrl: 'https://api.groq.com/openai', models: ['llama-3.3-70b-versatile'], description: 'settings.descriptions.groq' },
  { id: 'ollama', name: 'settings.providers.ollama', baseUrl: 'http://localhost:11434', models: ['llama3.1', 'qwen2.5', 'mistral'], description: 'settings.descriptions.ollama' },
  { id: 'custom', name: 'settings.providers.custom', baseUrl: '', models: [], description: 'settings.descriptions.custom' },
];

export function SettingsScreen({ initialSettings, onBack, onSave }: Props) {
  const [baseUrl, setBaseUrl] = useState(initialSettings.baseUrl);
  const [model, setModel] = useState(initialSettings.model);
  const [apiKey, setApiKey] = useState('');
  const [isKeyLoaded, setIsKeyLoaded] = useState(false);
  const [apiFormat, setApiFormat] = useState(initialSettings.apiFormat || 'openai');
  const [language, setLanguage] = useState(initialSettings.language || 'ru');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showProviders, setShowProviders] = useState(false);

  useEffect(() => {
    window.argus.loadApiKey().then((key) => { setApiKey(key); setIsKeyLoaded(true); });
  }, []);

  useEffect(() => {
    loadTranslations(language);
  }, [language]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const s: AgentSettings = { ...initialSettings, baseUrl, model, apiFormat, language };
      if (baseUrl.trim() && model.trim()) onSave(s, apiKey);
    }, 800);
    return () => clearTimeout(timer);
  }, [baseUrl, model, apiKey, apiFormat, language]);

  const currentProvider = PROVIDERS.find((p) => p.id === selectedProvider)
    || PROVIDERS.find((p) => p.baseUrl && baseUrl.startsWith(p.baseUrl));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>{t('common.back')}</button>
        <div style={styles.headerTitle}>{t('settings.title')}</div>
        <div style={{ width: 100 }} />
      </div>

      <div style={styles.content}>
        {/* Provider */}
        <div style={styles.card}>
          <div style={styles.cardHeader} onClick={() => setShowProviders(!showProviders)}>
            <div>
              <div style={styles.fieldLabel}>{t('settings.provider')}</div>
              <div style={styles.providerName}>{t(currentProvider?.name || 'settings.providers.custom')}</div>
            </div>
            <span style={{ color: colors.textDim, transform: showProviders ? 'rotate(180deg)' : '', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
          </div>
          {showProviders && (
            <div style={styles.providerList}>
              {PROVIDERS.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProvider(p.id);
                    if (p.baseUrl) setBaseUrl(p.baseUrl);
                    if (p.models.length > 0 && !model) setModel(p.models[0]);
                    if (p.id === 'ollama') setApiFormat('ollama');
                    else if (p.id === 'anthropic') setApiFormat('anthropic');
                    else setApiFormat('openai');
                    setShowProviders(false);
                  }}
                  style={{
                    ...styles.providerItem,
                    ...(selectedProvider === p.id ? styles.providerItemActive : {}),
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{t(p.name)}</div>
                    <div style={{ fontSize: typography.caption, color: colors.textDim }}>{t(p.description)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Base URL */}
        <div style={styles.card}>
          <div style={styles.fieldRow}>
            <div style={styles.fieldLabel}>{t('settings.baseUrl')}</div>
            <input
              value={baseUrl}
              onChange={(e) => { setBaseUrl(e.target.value); setSelectedProvider(null); }}
              placeholder="https://api.openai.com"
              style={styles.input}
            />
            <div style={styles.fieldHint}>
              {apiFormat === 'openai' && `${baseUrl}/v1/chat/completions`}
              {apiFormat === 'ollama' && `${baseUrl}/api/chat`}
              {apiFormat === 'anthropic' && `${baseUrl}/v1/messages`}
            </div>
          </div>
        </div>

        {/* Model */}
        <div style={styles.card}>
          <div style={styles.fieldRow}>
            <div style={styles.fieldLabel}>{t('settings.model')}</div>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4o-mini"
              style={styles.input}
            />
            <div style={styles.chipRow}>
              {(currentProvider?.models || MODEL_SUGGESTIONS).map((m) => (
                <button key={m} onClick={() => setModel(m)} style={styles.chip}>{m}</button>
              ))}
            </div>
          </div>
        </div>

        {/* API Format (custom only) */}
        {selectedProvider === 'custom' && (
          <div style={styles.card}>
            <div style={styles.fieldRow}>
              <div style={styles.fieldLabel}>{t('settings.apiFormat')}</div>
              <div style={styles.chipRow}>
                {([
                  { id: 'openai', label: 'settings.formats.openai' },
                  { id: 'ollama', label: 'settings.formats.ollama' },
                  { id: 'anthropic', label: 'settings.formats.anthropic' },
                  { id: 'kobold', label: 'settings.formats.kobold' },
                ] as const).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setApiFormat(f.id)}
                    style={{ ...styles.chip, ...(apiFormat === f.id ? styles.chipActive : {}) }}
                  >
                    {t(f.label)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* API Key */}
        <div style={styles.card}>
          <div style={styles.fieldRow}>
            <div style={styles.fieldLabel}>{t('settings.apiKey')}</div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isKeyLoaded ? 'sk-...' : t('common.loading')}
              style={styles.input}
            />
            <div style={styles.fieldHint}>{t('settings.apiKeyHint')}</div>
          </div>
        </div>

        {/* Language */}
        <div style={styles.card}>
          <div style={styles.fieldRow}>
            <div style={styles.fieldLabel}>{t('settings.language')}</div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={styles.input}
            >
              <option value="ru">Русский</option>
              <option value="en">English (US)</option>
              <option value="uk">Українська</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: `${spacing.lg}px ${spacing.xl}px`,
    borderBottom: `1px solid ${colors.border}`,
    background: colors.backgroundSoft,
  },
  backBtn: {
    background: 'transparent', border: 'none', color: colors.text,
    fontSize: typography.body, cursor: 'pointer', padding: `${spacing.sm}px ${spacing.md}px`,
    borderRadius: radius.md,
  },
  headerTitle: { fontSize: typography.subtitle, fontWeight: 700, color: colors.text },
  content: {
    flex: 1, overflow: 'auto', padding: `${spacing.xl}px`,
    display: 'flex', flexDirection: 'column', gap: spacing.md,
    maxWidth: 600, margin: '0 auto', width: '100%',
  },
  card: {
    background: colors.surface, borderRadius: radius.xl,
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: `${spacing.lg}px ${spacing.xl}px`, cursor: 'pointer',
  },
  providerName: { fontSize: typography.body, fontWeight: 500, color: colors.text, marginTop: spacing.xs },
  providerList: { borderTop: `1px solid ${colors.border}` },
  providerItem: {
    padding: `${spacing.md}px ${spacing.xl}px`, cursor: 'pointer',
    borderBottom: `1px solid ${colors.border}`, transition: 'background 0.15s',
  },
  providerItemActive: { background: colors.accentSoft },
  fieldRow: { padding: `${spacing.lg}px ${spacing.xl}px` },
  fieldLabel: {
    fontSize: typography.caption, fontWeight: 500,
    color: colors.textMuted, marginBottom: spacing.sm,
  },
  input: {
    width: '100%', background: colors.surfaceElevated, border: 'none',
    borderRadius: radius.md, color: colors.text,
    fontSize: typography.body, padding: `${spacing.md}px ${spacing.lg}px`,
    outline: 'none', fontFamily: 'inherit',
  },
  fieldHint: {
    fontSize: typography.caption, color: colors.textDim,
    marginTop: spacing.sm, lineHeight: 1.4,
  },
  chipRow: {
    display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md,
  },
  chip: {
    background: colors.surfaceMuted, border: 'none', borderRadius: radius.pill,
    padding: `${spacing.xs}px ${spacing.md}px`,
    color: colors.textMuted, fontSize: typography.caption, fontWeight: 500,
    cursor: 'pointer',
  },
  chipActive: {
    background: colors.text, color: colors.background,
  },
};
