import type { SmTheme } from './theme';

/** Per-viewer convenience (spec §9.1). */
export const SM_THEME_KEY = 'sm.theme';

export function writeStoredTheme(theme: SmTheme): void {
  try {
    window.localStorage.setItem(SM_THEME_KEY, theme);
  } catch {
    // Not remembered; the toggle still works for this page view.
  }
}

export function readStoredTheme(): SmTheme | null {
  try {
    const v = window.localStorage.getItem(SM_THEME_KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}
