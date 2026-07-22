import { Platform } from 'react-native';

export const colors = {
  background: '#000000',
  backgroundSoft: '#0d0d0d',
  surface: '#1c1c1e',
  surfaceElevated: '#2c2c2e',
  surfaceMuted: '#3a3a3c',
  border: '#38383a',
  borderStrong: '#545456',
  text: '#ffffff',
  textMuted: '#aeaeb2',
  textDim: '#636366',
  accent: '#ffffff',
  accentStrong: '#ffffff',
  accentSoft: 'rgba(255,255,255,0.06)',
  danger: '#ff453a',
  dangerSoft: 'rgba(255,69,58,0.14)',
  success: '#30d158',
  successSoft: 'rgba(48,209,88,0.12)',
  warning: '#ffd60a',
  warningSoft: 'rgba(255,214,10,0.12)',
  userBubble: '#2c2c2e',
  assistantBubble: 'transparent',
  input: '#1c1c1e',
  codeSurface: '#141416',
  overlay: 'rgba(255,255,255,0.04)',
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
