import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { RunTemplate, WatcherRun } from '@haiwave/protocol';
import { PageHeader } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';
import { formatCadence, RunsFilterToggle, parseRunsFilter } from '@/components/sonar/observations';
import { WatcherHistoryTable } from '../../_components/watcher-history-table';
import { CalibratedLTTrendChart } from './_components/calibrated-lt-trend-chart';
import { PerCounterpartyPostureTable } from './_components/per-counterparty-posture-table';
import { WatcherDefinitionDetail } from './_components/watcher-definition-detail';
import { WatcherRunNowButton } from './_components/watcher-run-now-button';
import { DefinitionTabs } from '../../../_components/definition-tabs';
import { parseDefinitionTab } from '../../../_lib/definition-tab';
import type { EnrichedWatcherRun } from '../../_components/watcher-column-packs';

interface RouteContext {
  params: Promise<{ template_id: string }>;
  searchParams: Promise<{ tab?: string | string[]; runs?: string | string[] }>;
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
  // D-206 — ?runs=archived shows runs archived when this watcher's
  // definition was deleted with runs=archive; otherwise the active list.
  const runsFilter = parseRunsFilter(resolvedSearchParams.runs);
  const archived = runsFilter === 'archived';
  const detail = await fetchBffJson<DetailResponse>(
    `/api/account/sonar/watcher/definitions/${template_id}`,
  );
  if (detail.kind === 'error') {
    if (detail.status === 404) notFound();
  }
  const tpl = detail.kind === 'ok' ? detail.data.template : null;
  if (!tpl || tpl.observation_class !== 'watcher') notFound();

  const runsResp = await fetchBffJson<RunsResponse>(
    `/api/account/sonar/watcher/runs${archived ? '?archived=true' : ''}`,
  );
  const allRuns = runsResp.kind === 'ok' ? runsResp.data.runs : [];
  const templateRuns: EnrichedWatcherRun[] = allRuns
    .filter((r) => r.template_id === template_id)
    .map((r) => ({ ...r, template_name: tpl.template_name }));
  const last12 = templateRuns.slice(0, 12);

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
              <CalibratedLTTrendChart runs={last12 as never} />
            </section>

            <section aria-labelledby="posture-heading" className="space-y-3">
              <h2
                id="posture-heading"
                className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
              >
                Per-counterparty posture
              </h2>
              <PerCounterpartyPostureTable rows={[]} />
            </section>

            <section aria-labelledby="history-heading" className="space-y-3">
              <h2
                id="history-heading"
                className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
              >
                Run history
              </h2>
              <RunsFilterToggle value={runsFilter} />
              <WatcherHistoryTable
                initialRows={templateRuns}
                templateId={template_id}
                archived={archived}
                emptyMessage="No runs yet for this watcher. Trigger one manually or wait for the next scheduled fire."
              />
            </section>
          </div>
        }
        configuration={<WatcherDefinitionDetail template={tpl} />}
      />
    </div>
  );
}
