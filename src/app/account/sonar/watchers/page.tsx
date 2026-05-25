import { cookies, headers } from 'next/headers';
import type { AuditRun } from '@haiwave/protocol';
import { getActiveScopes } from '../_lib/scopes';
import { NoScopesCTA } from '../_shared/no-scopes-cta';
import { ScopesErrorBanner } from '../_shared/scopes-error-banner';
import { RunControls } from './run-controls';
import { RunsTable } from './runs-table';
import { PageIntro } from '@/components/page-intro';

async function loadRuns(): Promise<AuditRun[]> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  try {
    const res = await fetch(`${baseUrl}/api/account/audit-runs?limit=100`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { runs?: AuditRun[] };
    return data.runs ?? [];
  } catch (err) {
    console.error('[runs.loadRuns] network failure', { err });
    return [];
  }
}

/**
 * v.1.41 Backlog IA — relocated from /account/sonar/posture/runs.
 * Watchers are configuration + observation surface for the runs that
 * generate Backlog items, not a Backlog item themselves; carving them
 * out of the Backlog section into their own Sonar Observe entry makes
 * the intent clear.
 *
 * URL change: /account/sonar/posture/runs[/...] → /account/sonar/watchers[/...]
 * Old URLs 301-redirect via proxy.ts so external bookmarks survive.
 */
export default async function WatcherManagementPage() {
  const scopesResult = await getActiveScopes();
  if (scopesResult.kind === 'error') {
    return (
      <div className="p-6">
        <ScopesErrorBanner status={scopesResult.status} />
      </div>
    );
  }
  if (scopesResult.scopes.length === 0) {
    return (
      <div className="p-6">
        <NoScopesCTA context="runs" />
      </div>
    );
  }
  const runs = await loadRuns();
  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-charcoal">Watcher Management</h1>
        <RunControls />
      </header>
      <PageIntro>
        Configure and observe the watchers that monitor your active scopes — product availability, lead-time drift, capacity shifts, and other supply-chain signals. Start, cancel, or re-run from here; the <em>Sonar Dashboard</em> aggregates the latest results across all modalities, and detected events surface in the <em>Backlog</em>.
      </PageIntro>
      <RunsTable runs={runs} />
    </div>
  );
}
