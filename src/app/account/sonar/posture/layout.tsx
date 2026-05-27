import type { ReactNode } from 'react';

// Backlog section layout is intentionally a passthrough. Each child page
// (changes / working-list / obligations) renders its own PageHeader first,
// then the shared CoverageHeaderStrip + BacklogTabs, then content — so the
// H1 sits at the top of the viewport and the tab chooser sits between the
// title and the data table. Previously this layout wrapped children with the
// strip + tabs above them, which pushed the per-page H1 below them.
export default function BacklogLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
