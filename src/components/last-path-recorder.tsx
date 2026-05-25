'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Session stickiness — remembers the most recently visited account page so the
 * login flow can return the user there. Mounted once inside the account layout
 * (server-rendered shell) and runs purely client-side: every navigation under
 * `/account/*` writes `pathname + ?search` to localStorage. Login reads the
 * same key (`login/page.tsx`) and validates it before redirecting, so a
 * tampered value can't redirect off-portal.
 *
 * Reads `window.location.search` rather than `useSearchParams()` so the
 * component doesn't force its enclosing layout into a Suspense boundary at
 * build time — the effect only runs on the client where `window` exists.
 */
export const LAST_ACCOUNT_PATH_KEY = 'haiwave:last-account-path';

export function LastPathRecorder() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || !pathname.startsWith('/account')) return;
    const search = window.location.search;
    const value = search ? `${pathname}${search}` : pathname;
    try {
      window.localStorage.setItem(LAST_ACCOUNT_PATH_KEY, value);
    } catch {
      // localStorage can throw in private-mode Safari and when quota is full.
      // Silent fallback is fine — stickiness is a convenience, not correctness.
    }
  }, [pathname]);

  return null;
}
