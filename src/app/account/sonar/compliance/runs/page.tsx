import { cookies, headers } from 'next/headers';
import type { AuditRun } from '@haiwave/protocol';
import { getActiveScopes } from '../_lib/scopes';
import { NoScopesCTA } from '../_shared/no-scopes-cta';
import { ScopesErrorBanner } from '../_shared/scopes-error-banner';
import { RunControls } from '../dashboard/run-controls';
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

export default async function RunsPage() {
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
        <h1 className="text-xl font-semibold text-charcoal">Audit Runs</h1>
        <RunControls />
      </header>
      <PageIntro>
        The complete history of supply-chain audit runs you&apos;ve initiated, with their status, trigger source, and result links. Start, cancel, or re-run audits here; the <em>Audit Dashboard</em> is where the latest run&apos;s results are aggregated for review.
      </PageIntro>
      <RunsTable runs={runs} />
    </div>
  );
}
