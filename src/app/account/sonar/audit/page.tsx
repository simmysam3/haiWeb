import Link from 'next/link';
import { PageHeader } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';
import {
  ConfigurationsTable,
  RunHistoryTable,
} from '@/components/sonar/observations';
import {
  auditConfigurationsColumnPack,
  buildAuditHistoryColumnPack,
  type EnrichedAuditRun,
} from './_components/audit-column-packs';
import type { RunTemplate, AuditRun } from '@haiwave/protocol';

interface DefinitionsPayload {
  templates: RunTemplate[];
}

interface RunsPayload {
  runs: AuditRun[];
  auditor_country?: string;
}

type AuditTemplate = Extract<RunTemplate, { observation_class: 'audit' }>;

function isAuditTemplate(t: RunTemplate): t is AuditTemplate {
  return t.observation_class === 'audit';
}

export default async function AuditListPage() {
  const [defsResult, runsResult] = await Promise.all([
    fetchBffJson<DefinitionsPayload>('/api/account/sonar/audit/definitions'),
    fetchBffJson<RunsPayload>('/api/account/sonar/audit/runs'),
  ]);

  const allDefinitions = defsResult.kind === 'ok' ? defsResult.data.templates : [];
  const runs = runsResult.kind === 'ok' ? runsResult.data.runs : [];
  const auditorCountry =
    runsResult.kind === 'ok' ? runsResult.data.auditor_country : undefined;

  // Scheduled queue: recurring audit definitions only (cadence.kind !== 'manual_only').
  const scheduledDefinitions = allDefinitions
    .filter(isAuditTemplate)
    .filter((t) => t.cadence.kind !== 'manual_only');

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audits"
        description={
          <>
            <strong className="text-charcoal">Supplier ecosystem oversight.</strong>{' '}
            Verify supplier sourcing claims run by run. Pick a supplier, scope the audit
            to a whole catalog, a product class, or specific SKUs, then schedule recurring
            sweeps or fire ad-hoc checks. One supplier per audit — sweep many for breadth.
          </>
        }
        actions={
          <Link
            href="/account/sonar/audit/new"
            className="shrink-0 whitespace-nowrap rounded bg-teal text-white px-3 py-1.5 text-sm font-medium hover:bg-teal/90"
          >
            + New Audit
          </Link>
        }
      />

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
        <ConfigurationsTable
          rows={scheduledDefinitions}
          columns={auditConfigurationsColumnPack}
          keyFn={(t) => t.template_id}
          emptyMessage="No recurring audit configurations. Create a configuration and set a daily, weekly, or event-triggered cadence to see it here."
        />
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
        <RunHistoryTable<EnrichedAuditRun>
          initialRows={runs}
          columns={buildAuditHistoryColumnPack(auditorCountry)}
          pollEndpoint="/api/account/sonar/audit/runs"
          keyFn={(r) => r.run_id}
          emptyMessage='No audit runs yet. Trigger a run from a configuration or use the "+ New Audit" action above.'
        />
      </section>
    </div>
  );
}
