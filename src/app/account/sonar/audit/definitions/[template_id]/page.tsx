import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { RunTemplate } from '@haiwave/protocol';
import { PageHeader } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';
import { formatCadence } from '../../../templates/_lib/format-cadence';
import { RunsFilterToggle, parseRunsFilter } from '@/components/sonar/observations';
import { DefinitionTabs } from '../../../_components/definition-tabs';
import { parseDefinitionTab } from '../../../_lib/definition-tab';
import { AuditHistoryTable } from '../../_components/audit-history-table';
import type { EnrichedAuditRun } from '../../_components/audit-column-packs';
import { AuditDefinitionDetail } from './_components/audit-definition-detail';
import { AuditRunNowButton } from './_components/audit-run-now-button';

interface DetailPageProps {
  params: Promise<{ template_id: string }>;
  searchParams: Promise<{ tab?: string | string[]; runs?: string | string[] }>;
}

interface RunsPayload {
  runs: EnrichedAuditRun[];
  auditor_country?: string;
}

export default async function AuditDefinitionDetailPage({ params, searchParams }: DetailPageProps) {
  const { template_id } = await params;
  const resolvedSearchParams = await searchParams;
  const initialTab = parseDefinitionTab(resolvedSearchParams.tab);
  // D-206 — ?runs=archived shows runs archived when this audit's definition
  // was deleted with runs=archive; otherwise the active list.
  const runsFilter = parseRunsFilter(resolvedSearchParams.runs);
  const archived = runsFilter === 'archived';
  const result = await fetchBffJson<{ template: RunTemplate }>(
    `/api/account/sonar/audit/definitions/${template_id}`,
  );

  if (result.kind === 'error') {
    notFound();
  }

  const tpl = result.data.template;

  if (tpl.observation_class !== 'audit') {
    notFound();
  }

  // v1.85 — this audit's runs only. The list page shows every run; here the
  // BFF is asked for the template's runs so the history is the audit's own.
  const runsResult = await fetchBffJson<RunsPayload>(
    `/api/account/sonar/audit/runs?template_id=${encodeURIComponent(template_id)}${archived ? '&archived=true' : ''}`,
  );
  const runs = runsResult.kind === 'ok' ? runsResult.data.runs : [];
  const auditorCountry =
    runsResult.kind === 'ok' ? runsResult.data.auditor_country : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audit"
        title={tpl.template_name}
        description={
          <>
            {formatCadence(tpl.cadence)} · Last run{' '}
            {tpl.last_run_at
              ? new Date(tpl.last_run_at).toLocaleString()
              : '—'}
          </>
        }
        actions={
          <div className="flex items-center gap-4">
            <Link
              href="/account/sonar/audit"
              className="text-sm text-teal hover:underline"
            >
              ← Audits
            </Link>
            <AuditRunNowButton templateId={tpl.template_id} />
          </div>
        }
      />

      {runsResult.kind === 'error' && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Could not load run history (
          {runsResult.status !== 0 ? `HTTP ${runsResult.status}` : 'network error'}). Run
          history may be incomplete.
        </div>
      )}

      {/* v1.85 — parity with the watcher page: Run history and Configuration
          are tabs (?tab=runs|configuration). */}
      <DefinitionTabs
        ariaLabel="Audit sections"
        initialTab={initialTab}
        runs={
          <section aria-labelledby="history-heading" className="space-y-3">
            <h2
              id="history-heading"
              className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
            >
              Run history
            </h2>
            <p className="text-xs text-slate">
              Runs of this audit only. Polled every 15 seconds while the page is open —
              in-progress runs update live.
            </p>
            <RunsFilterToggle value={runsFilter} />
            <AuditHistoryTable
              initialRows={runs}
              auditorCountry={auditorCountry}
              templateId={template_id}
              archived={archived}
              emptyMessage="No runs yet for this audit. Use Run now, or wait for the next scheduled fire."
            />
          </section>
        }
        configuration={<AuditDefinitionDetail template={tpl} />}
      />
    </div>
  );
}
