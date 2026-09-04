// src/lib/aura/studio/studioThemes.ts

export type ThemeColors = {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
};

export type StudioTheme = {
  id: string;
  label: string;
  description: string;
  colors: ThemeColors;
  radius: string;
  shadow: string;
  headerLayout: 'center' | 'left';
  gradient?: string;
};

export const STUDIO_THEMES: Record<string, StudioTheme> = {
  pure: {
    id: 'pure',
    label: 'Pure',
    description: 'クリーンで明るい、シンプルなデザイン',
    colors: {
      bg: '#ffffff',
      surface: '#f8fafc',
      text: '#111827',
      muted: '#6b7280',
      border: '#e5e7eb',
    },
    radius: '0.75rem',
    shadow: '0 1px 3px rgba(0,0,0,0.08)',
    headerLayout: 'center',
  },
  night: {
    id: 'night',
    label: 'Night',
    description: 'ダークでエレガント、洗練されたデザイン',
    colors: {
      bg: '#0f172a',
      surface: '#1e293b',
      text: '#f1f5f9',
      muted: '#94a3b8',
      border: '#334155',
    },
    radius: '0.75rem',
    shadow: '0 1px 3px rgba(0,0,0,0.4)',
    headerLayout: 'left',
  },
  flow: {
    id: 'flow',
    label: 'Flow',
    description: 'グラデーションとカラーが映える、活力あるデザイン',
    colors: {
      bg: '#fafafa',
      surface: '#ffffff',
      text: '#111827',
      muted: '#6b7280',
      border: '#e5e7eb',
    },
    radius: '1rem',
    shadow: '0 4px 20px rgba(0,0,0,0.08)',
    headerLayout: 'center',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
};

export const STUDIO_THEME_LIST = Object.values(STUDIO_THEMES);

export function getTheme(themeId: string): StudioTheme {
  return STUDIO_THEMES[themeId] ?? STUDIO_THEMES.pure;
}
