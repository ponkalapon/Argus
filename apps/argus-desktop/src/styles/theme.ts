export const ACCENT_PALETTES = {
  purple: {
    name: 'Элегантный Фиолетовый',
    primary: '#8b5cf6',
    strong: '#a78bfa',
    soft: 'rgba(139, 92, 246, 0.1)',
    border: 'rgba(139, 92, 246, 0.25)',
  },
  monochrome: {
    name: 'Строгий Обсидиан',
    primary: '#e4e4e7',
    strong: '#ffffff',
    soft: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.2)',
  },
  cyan: {
    name: 'Нордический Бирюзовый',
    primary: '#38bdf8',
    strong: '#7dd3fc',
    soft: 'rgba(56, 189, 248, 0.1)',
    border: 'rgba(56, 189, 248, 0.25)',
  },
  emerald: {
    name: 'Шалфейный Изумруд',
    primary: '#10b981',
    strong: '#34d399',
    soft: 'rgba(16, 185, 129, 0.1)',
    border: 'rgba(16, 185, 129, 0.25)',
  },
  amber: {
    name: 'Матовый Янтарь',
    primary: '#f59e0b',
    strong: '#fbbf24',
    soft: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.25)',
  },
  blue: {
    name: 'Глубокий Синий',
    primary: '#3b82f6',
    strong: '#60a5fa',
    soft: 'rgba(59, 130, 246, 0.1)',
    border: 'rgba(59, 130, 246, 0.25)',
  },
} as const;

export const colors = {
  background: '#0b0b0e',
  backgroundSoft: '#121215',
  surface: '#16161a',
  surfaceElevated: '#212126',
  surfaceMuted: '#1a1a1f',
  border: '#232328',
  borderStrong: '#33333d',
  text: '#f4f4f5',
  textMuted: '#94949e',
  textDim: '#60606c',
  accent: '#8b5cf6',
  accentStrong: '#a78bfa',
  accentSoft: 'rgba(139, 92, 246, 0.08)',
  danger: '#ef4444',
  dangerSoft: 'rgba(239, 68, 68, 0.1)',
  success: '#22c55e',
  successSoft: 'rgba(34, 197, 94, 0.1)',
  warning: '#f59e0b',
  warningSoft: 'rgba(245, 158, 11, 0.1)',
  userBubble: '#1a1a20',
  assistantBubble: 'transparent',
  input: '#141418',
  codeSurface: '#0d0d10',
  overlay: 'rgba(0, 0, 0, 0.5)',
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

