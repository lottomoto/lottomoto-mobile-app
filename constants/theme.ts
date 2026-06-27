import { Platform } from 'react-native';

export const Colors = {
  navy: '#0D1B3E',
  navyLight: '#132044',
  navyMedium: '#1E3A5F',
  navyDark: '#091530',
  gold: '#D4AF37',
  goldLight: '#E8CC6E',
  goldDark: '#B8941F',
  red: '#DC2626',
  redLight: '#EF4444',
  green: '#16A34A',
  greenLight: '#22C55E',
  white: '#FFFFFF',
  offWhite: '#F1F5F9',
  gray: '#94A3B8',
  grayLight: '#CBD5E1',
  grayDark: '#64748B',
  orange: '#F59E0B',
  transparent: 'transparent',

  light: {
    text: '#F1F5F9',
    background: '#0D1B3E',
    tint: '#D4AF37',
    icon: '#94A3B8',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#D4AF37',
    card: '#132044',
    border: '#1E3A5F',
  },
  dark: {
    text: '#F1F5F9',
    background: '#070E1F',
    tint: '#D4AF37',
    icon: '#94A3B8',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#D4AF37',
    card: '#0D1B3E',
    border: '#1E3A5F',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

import { DarkTheme } from '@react-navigation/native';

export const LDMLTheme = {
  ...DarkTheme,
  dark: true as const,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.gold,
    background: Colors.navy,
    card: Colors.navyDark,
    text: Colors.offWhite,
    border: Colors.navyMedium,
    notification: Colors.red,
  },
};
