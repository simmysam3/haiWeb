import type { SmTheme } from './theme';

/** Per-viewer convenience (spec §9.1). */
export const SM_THEME_KEY = 'sm.theme';

export function writeStoredTheme(theme: SmTheme): void {
  window.localStorage.setItem(SM_THEME_KEY, theme);
}
