import Link from 'next/link';
import { fetchBffJson } from '@/lib/server-fetch';
import { ScheduledQueue } from './_components/scheduled-queue';
import { HistoryQueue } from './_components/history-queue';
import type { RunTemplate, AuditRun } from '@haiwave/protocol';

interface DefinitionsPayload {
  templates: RunTemplate[];
}

interface RunsPayload {
  runs: AuditRun[];
}

export default async function AuditListPage() {
  const [defsResult, runsResult] = await Promise.all([
    fetchBffJson<DefinitionsPayload>('/api/account/sonar/audit/definitions'),
    fetchBffJson<RunsPayload>('/api/account/sonar/audit/runs'),
  ]);

  const allDefinitions = defsResult.kind === 'ok' ? defsResult.data.templates : [];
  const runs = runsResult.kind === 'ok' ? runsResult.data.runs : [];

  // Scheduled queue: recurring definitions only (cadence.kind !== 'manual_only')
  const scheduledDefinitions = allDefinitions.filter(
    (t) => t.cadence.kind !== 'manual_only',
  );

  return (
    <div className="p-6 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-charcoal">Audits</h1>
          <p className="text-sm text-slate mt-1">
            Manage your recurring audit configurations and review the full run history.
            Scheduled configurations fire automatically on their cadence; ad-hoc runs
            are triggered manually or via evidence dispatch.
          </p>
        </div>
        <Link
          href="/account/sonar/audit/new"
          className="shrink-0 whitespace-nowrap rounded bg-teal text-white px-3 py-1.5 text-sm font-medium hover:bg-teal/90"
        >
          + New Audit
        </Link>
      </header>

      {defsResult.kind === 'error' && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Could not load audit configurations (
          {defsResult.status !== 0
            ? `HTTP ${defsResult.status}`
            : 'network error'}
          ). Scheduled queue may be incomplete.
        </div>
      )}

      <section aria-labelledby="scheduled-heading" className="space-y-3">
        <h2
          id="scheduled-heading"
          className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
        >
          Scheduled configurations
        </h2>
        <p className="text-xs text-slate">
          Recurring audit templates (daily, weekly, or event-triggered). Manual-only
          configurations are managed from{' '}
          <Link href="/account/sonar/templates" className="text-teal hover:underline">
            Configurations
          </Link>
          .
        </p>
        <ScheduledQueue rows={scheduledDefinitions} />
      </section>

      {runsResult.kind === 'error' && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Could not load run history (
          {runsResult.status !== 0
            ? `HTTP ${runsResult.status}`
            : 'network error'}
          ). History queue may be incomplete.
        </div>
      )}

      <section aria-labelledby="history-heading" className="space-y-3">
        <h2
          id="history-heading"
          className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
        >
          Audit history
        </h2>
        <p className="text-xs text-slate">
          All audit runs across configurations and ad-hoc triggers. Polled every
          15 seconds while the page is open — in-progress runs update live.
        </p>
        <HistoryQueue initialRows={runs} />
      </section>
    </div>
  );
}
