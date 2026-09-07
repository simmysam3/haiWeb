import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { RunTemplate, RunTemplateEvent, WatcherResult, WatcherRun } from '@haiwave/protocol';
import { PageHeader } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';
import { formatCadence } from '@/components/sonar/observations';
import { WatcherHistoryTable } from '../../_components/watcher-history-table';
import { CalibratedLTTrendChart, type TrendRun } from './_components/calibrated-lt-trend-chart';
import { WatcherDefinitionDetail } from './_components/watcher-definition-detail';
import { WatcherRunNowButton } from './_components/watcher-run-now-button';
import { DefinitionTabs } from '../../../_components/definition-tabs';
import { parseDefinitionTab } from '../../../_lib/definition-tab';
import type { EnrichedWatcherRun } from '../../_components/watcher-column-packs';

interface RouteContext {
  params: Promise<{ template_id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}

interface DetailResponse {
  template: RunTemplate;
}

interface RunsResponse {
  runs: WatcherRun[];
}

export default async function WatcherDefinitionPage({ params, searchParams }: RouteContext) {
  const { template_id } = await params;
  const resolvedSearchParams = await searchParams;
  const initialTab = parseDefinitionTab(resolvedSearchParams.tab);
  const detail = await fetchBffJson<DetailResponse>(
    `/api/account/sonar/watcher/definitions/${template_id}`,
  );
  if (detail.kind === 'error') {
    if (detail.status === 404) notFound();
  }
  const tpl = detail.kind === 'ok' ? detail.data.template : null;
  if (!tpl || tpl.observation_class !== 'watcher') notFound();

  // A definition's runs are never archived while the definition is live —
  // archiving only happens when the definition is deleted, after which this
  // page 404s. So the runs fetch is unconditional and scoped by template_id
  // to match the SWR poll WatcherHistoryTable issues (an unscoped fetch here
  // would answer a different question than the poll that replaces it 15s
  // later); it feeds both the trend chart and the Run history table.
  const activeRunsResp = await fetchBffJson<RunsResponse>(
    `/api/account/sonar/watcher/runs?template_id=${encodeURIComponent(template_id)}`,
  );
  const activeRuns = activeRunsResp.kind === 'ok' ? activeRunsResp.data.runs : [];
  const templateRuns: EnrichedWatcherRun[] = activeRuns
    .filter((r) => r.template_id === template_id)
    .map((r) => ({ ...r, template_name: tpl.template_name }));
  const last12 = templateRuns.slice(0, 12);

  // The trend chart's series: a WatcherRun carries no results, so the latest
  // run's trailing-history lane supplies every result across the trailing
  // runs, grouped by run_id here. No runs → an empty series; a lane that did
  // not answer → null, which the chart says rather than "no results".
  let trendRuns: TrendRun[] | null = [];
  if (last12[0]) {
    const trailing = await fetchBffJson<{
      runs: { run_id: string; triggered_at: string }[];
      results: WatcherResult[];
    }>(`/api/account/sonar/watcher/runs/${encodeURIComponent(last12[0].run_id)}/trailing-history`);
    if (trailing.kind === 'ok') {
      const byRun = new Map<string, WatcherResult[]>();
      for (const r of trailing.data.results) {
        const bucket = byRun.get(r.run_id) ?? [];
        bucket.push(r);
        byRun.set(r.run_id, bucket);
      }
      trendRuns = trailing.data.runs.map((r) => ({ ...r, results: byRun.get(r.run_id) ?? [] }));
    } else {
      trendRuns = null;
    }
  }

  // Lifecycle history for the History step (the events route serves every run
  // template, watcher or audit). A lane that did not answer is passed as null
  // so the step says so, instead of "no events recorded yet".
  const eventsResult = await fetchBffJson<{ events: RunTemplateEvent[] }>(
    `/api/account/sonar/audit/definitions/${encodeURIComponent(template_id)}/events`,
  );
  const events = eventsResult.kind === 'ok' ? eventsResult.data.events : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Watcher"
        title={tpl.template_name}
        description={
          <>
            {formatCadence(tpl.cadence)} · retention {tpl.retention_days}d
          </>
        }
        actions={
          <div className="flex items-center gap-4">
            <Link
              href="/account/sonar/watchers"
              className="text-sm text-teal hover:underline"
            >
              ← Watchers
            </Link>
            <WatcherRunNowButton template={tpl} />
          </div>
        }
      />

      {/* v1.85 — Run history and Configuration are tabs (?tab=runs|configuration)
          so the editor is no longer buried below the run history. */}
      <DefinitionTabs
        ariaLabel="Watcher sections"
        initialTab={initialTab}
        runs={
          <div className="space-y-6">
            <section aria-labelledby="trend-heading" className="space-y-3">
              <h2
                id="trend-heading"
                className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
              >
                Calibrated lead-time trend
              </h2>
              <CalibratedLTTrendChart runs={trendRuns} />
            </section>

            <section aria-labelledby="history-heading" className="space-y-3">
              <h2
                id="history-heading"
                className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
              >
                Run history
              </h2>
              <WatcherHistoryTable
                initialRows={templateRuns}
                templateId={template_id}
                emptyMessage="No runs yet for this watcher. Trigger one manually or wait for the next scheduled fire."
              />
            </section>
          </div>
        }
        configuration={<WatcherDefinitionDetail template={tpl} events={events} />}
      />
    </div>
  );
}
