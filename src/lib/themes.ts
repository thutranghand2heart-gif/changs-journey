import type { Journey, ThemeId } from '../db/schema';

export interface ThemeTokens { name: string; bg: string; bg2: string; card: string; cardBorder: string; text: string; muted: string; accent: string; accent2: string; deco: string }

export const THEMES: Record<Exclude<ThemeId, 'custom'>, ThemeTokens> = {
  'christmas-emerald': { name: 'Christmas Emerald', bg: '#0b2a23', bg2: '#103B31', card: 'rgba(16,59,49,0.62)', cardBorder: 'rgba(213,180,119,0.45)', text: '#FFF8EE', muted: 'rgba(255,248,238,0.72)', accent: '#D5B477', accent2: '#8B1E2D', deco: '🎄' },
  'sakura-dreams': { name: 'Sakura Dreams', bg: '#3a1f2b', bg2: '#5b2e40', card: 'rgba(91,46,64,0.55)', cardBorder: 'rgba(255,196,214,0.5)', text: '#fff5f8', muted: 'rgba(255,245,248,0.74)', accent: '#ffc4d6', accent2: '#c2577a', deco: '🌸' },
  'autumn-letters': { name: 'Autumn Letters', bg: '#2e1d10', bg2: '#4a2e17', card: 'rgba(74,46,23,0.58)', cardBorder: 'rgba(234,168,92,0.5)', text: '#fff6ea', muted: 'rgba(255,246,234,0.74)', accent: '#eaa85c', accent2: '#9c3d1c', deco: '🍁' },
  'celestial-night': { name: 'Celestial Night', bg: '#0b1030', bg2: '#18204f', card: 'rgba(24,32,79,0.58)', cardBorder: 'rgba(180,196,255,0.45)', text: '#f3f5ff', muted: 'rgba(243,245,255,0.74)', accent: '#b4c4ff', accent2: '#6c4fd1', deco: '🌙' },
};

export function tokensFor(j: Pick<Journey, 'settings'> | undefined): ThemeTokens {
  if (!j) return THEMES['christmas-emerald'];
  const s = j.settings;
  if (s.theme === 'custom' && s.customColors) {
    const c = s.customColors;
    return { name: 'Tùy chỉnh', bg: c.bg, bg2: c.bg, card: c.card, cardBorder: c.accent + '88', text: c.text, muted: c.text + 'bb', accent: c.accent, accent2: c.accent, deco: '✨' };
  }
  return THEMES[(s.theme === 'custom' ? 'christmas-emerald' : s.theme) as keyof typeof THEMES];
}

export function themeStyle(t: ThemeTokens, font: string): Record<string, string> {
  const fonts: Record<string, string> = {
    storybook: '"Cormorant Garamond", "Iowan Old Style", Georgia, "Times New Roman", "Noto Serif CJK SC", "Songti SC", serif',
    modern: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Apple SD Gothic Neo", sans-serif',
    handwritten: '"Bradley Hand", "Segoe Print", "Snell Roundhand", Georgia, serif',
  };
  return {
    '--bg': t.bg, '--bg2': t.bg2, '--card': t.card, '--card-border': t.cardBorder, '--text': t.text, '--muted': t.muted, '--accent': t.accent, '--accent2': t.accent2,
    '--display': fonts[font] ?? fonts.storybook,
  };
}
