export const ACCENT_PALETTES = {
  purple: {
    name: 'Фиолетовый Argus',
    primary: '#a855f7',
    strong: '#c084fc',
    soft: 'rgba(168,85,247,0.14)',
    border: 'rgba(168,85,247,0.4)',
  },
  cyan: {
    name: 'Кибер Бирюзовый',
    primary: '#06b6d4',
    strong: '#22d3ee',
    soft: 'rgba(6,182,212,0.14)',
    border: 'rgba(6,182,212,0.4)',
  },
  emerald: {
    name: 'Неоновый Изумруд',
    primary: '#10b981',
    strong: '#34d399',
    soft: 'rgba(16,185,129,0.14)',
    border: 'rgba(16,185,129,0.4)',
  },
  amber: {
    name: 'Янтарное Пламя',
    primary: '#f59e0b',
    strong: '#fbbf24',
    soft: 'rgba(245,158,11,0.14)',
    border: 'rgba(245,158,11,0.4)',
  },
  blue: {
    name: 'Электрический Синий',
    primary: '#3b82f6',
    strong: '#60a5fa',
    soft: 'rgba(59,130,246,0.14)',
    border: 'rgba(59,130,246,0.4)',
  },
  rose: {
    name: 'Магический Рубин',
    primary: '#f43f5e',
    strong: '#fb7185',
    soft: 'rgba(244,63,94,0.14)',
    border: 'rgba(244,63,94,0.4)',
  },
} as const;

export const colors = {
  background: '#09090b',
  backgroundSoft: '#121215',
  surface: '#18181b',
  surfaceElevated: '#27272a',
  surfaceMuted: '#27272a',
  border: '#27272a',
  borderStrong: '#3f3f46',
  text: '#f4f4f5',
  textMuted: '#a1a1aa',
  textDim: '#71717a',
  accent: '#a855f7',
  accentStrong: '#c084fc',
  accentSoft: 'rgba(168,85,247,0.12)',
  danger: '#ef4444',
  dangerSoft: 'rgba(239,68,68,0.14)',
  success: '#22c55e',
  successSoft: 'rgba(34,197,94,0.12)',
  warning: '#eab308',
  warningSoft: 'rgba(234,179,8,0.12)',
  userBubble: '#27272a',
  assistantBubble: 'transparent',
  input: '#18181b',
  codeSurface: '#121215',
  overlay: 'rgba(255,255,255,0.04)',
};

export function applyAccentColor(accentKey?: keyof typeof ACCENT_PALETTES) {
  const key = accentKey && ACCENT_PALETTES[accentKey] ? accentKey : 'purple';
  const pal = ACCENT_PALETTES[key];
  colors.accent = pal.primary;
  colors.accentStrong = pal.strong;
  colors.accentSoft = pal.soft;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  pill: 999,
};

export const typography = {
  hero: 28,
  title: 20,
  subtitle: 17,
  body: 15,
  mono: 13,
  caption: 12,
};

export const motion = {
  quick: 90,
  base: 170,
  slow: 260,
};

export const shadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 14,
  elevation: 6,
};

