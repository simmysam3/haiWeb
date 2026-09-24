'use client';
import { createContext, useCallback, useContext, useState, type CSSProperties, type ReactNode } from 'react';
import { smThemeStyle, type SmTheme } from '@/lib/sourcing-map/theme';
import { writeStoredTheme } from '@/lib/sourcing-map/theme-storage';

interface ThemeCtx {
  theme: SmTheme;
  toggle(): void;
}
const Ctx = createContext<ThemeCtx>({ theme: 'dark', toggle: () => {} });

export function useSmTheme(): ThemeCtx {
  return useContext(Ctx);
}

/** The app's root element: data-theme + the --sm-* tokens (spec §9.1). Dark by default. */
export function SmThemeRoot({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<SmTheme>('dark');
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: SmTheme = t === 'dark' ? 'light' : 'dark';
      writeStoredTheme(next);
      return next;
    });
  }, []);
  return (
    <Ctx.Provider value={{ theme, toggle }}>
      <div data-testid="sm-root" data-theme={theme} style={smThemeStyle(theme) as CSSProperties} className="sm-root">
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** Header control. The label is fixed; aria-pressed carries the state. */
export function ThemeToggle() {
  const { theme, toggle } = useSmTheme();
  return (
    <button type="button" onClick={toggle} aria-pressed={theme === 'light'} className="sm-btn sm-btn-ghost text-xs">
      Light theme
    </button>
  );
}
