'use client';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { smThemeStyle, type SmTheme } from '@/lib/sourcing-map/theme';
import { readStoredTheme, writeStoredTheme } from '@/lib/sourcing-map/theme-storage';

interface ThemeCtx {
  theme: SmTheme;
  toggle(): void;
}
const Ctx = createContext<ThemeCtx>({ theme: 'dark', toggle: () => {} });

export function useSmTheme(): ThemeCtx {
  return useContext(Ctx);
}

// The stored choice changes only through this root's own toggle, which re-renders through state.
const noSubscription = () => () => {};
// The server has no storage, so it always renders dark.
const serverStoredTheme = (): SmTheme | null => null;

/** The app's root element: data-theme + the --sm-* tokens (spec §9.1). Dark by default. */
export function SmThemeRoot({ children }: { children: ReactNode }) {
  // Reconcile the remembered choice after hydration: the server snapshot is dark.
  const stored = useSyncExternalStore(noSubscription, readStoredTheme, serverStoredTheme);
  const [chosen, setChosen] = useState<SmTheme | null>(null);
  const theme = chosen ?? stored ?? 'dark';
  const toggle = useCallback(() => {
    const next: SmTheme = theme === 'dark' ? 'light' : 'dark';
    writeStoredTheme(next);
    setChosen(next);
  }, [theme]);
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
