import { Platform } from 'react-native';

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

export const fontFamily = {
  regular: 'Roboto-Regular',
  bold: 'Roboto-Bold',
  medium: 'Roboto-Medium',
  mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
