import type { ReactNode } from 'react';

// v.1.43: /sonar/posture/ collapsed to a single child route — the
// Watcher Backlog at /sonar/posture/changes. The old siblings
// (working-list, obligations) and the BacklogTabs strip moved to
// /sonar/audit/ when the audit-side Event Backlog was carved out.
// This layout stays as a passthrough rather than being deleted because
// the Watcher Backlog still resolves through /sonar/posture/changes
// and Next requires the directory tree to be intact.
export default function PostureLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
