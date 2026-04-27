import { cookies, headers } from 'next/headers';
import type { AuditRun } from '@haiwave/protocol';
import { getActiveScopes } from '../_lib/scopes';
import { NoScopesCTA } from '../_shared/no-scopes-cta';
import { RunControls } from '../dashboard/run-controls';
import { RunsTable } from './runs-table';

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
  } catch {
    return [];
  }
}

export default async function RunsPage() {
  const scopes = await getActiveScopes();
  if (scopes.length === 0) {
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
        <h1 className="text-xl font-semibold text-charcoal">Runs</h1>
        <RunControls />
      </header>
      <RunsTable runs={runs} />
    </div>
  );
}
