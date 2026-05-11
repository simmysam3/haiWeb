import type { ReactNode } from 'react';

/**
 * Pass-through layout for /account/settings/*. The parent
 * src/app/account/layout.tsx already supplies the sidebar/header chrome;
 * this file exists so the settings section has its own segment boundary
 * for future route-group additions (notifications, profile, etc.).
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
