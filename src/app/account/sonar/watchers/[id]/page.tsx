import { notFound } from 'next/navigation';
import { PageHeader } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';
import { ThrottleBanner } from '@/components/sonar/throttle-banner';
import { ResumptionHistoryTable } from '@/components/sonar/resumption-history-table';
import { CounterpartiesGrid } from './_components/counterparties-grid';
import { RunControls } from './run-controls';
import { RunFailureBanner } from './run-failure-banner';
import type { RunTemplate, WatcherRun, WatcherResult } from '@haiwave/protocol';

interface WatcherRunDetailResponse {
  run: WatcherRun;
  results: WatcherResult[];
}

interface DefinitionResponse {
  template: RunTemplate;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Watcher run-detail page.
 *
 * v.1.43 Task 21 — rewritten from the audit-shaped predecessor. Drops the
 * geo `<RollupPanel>` and `<ProductsGrid>` (audit-specific) and renders the
 * canonical watcher surface: header + (throttle / failure) banners +
 * `<CounterpartiesGrid>` of per-counterparty results.
 */
export default async function WatcherRunDetailPage({ params }: RouteContext) {
  const { id: runId } = await params;
  const result = await fetchBffJson<WatcherRunDetailResponse>(
    `/api/account/sonar/watcher/runs/${runId}`,
  );

  if (result.kind === 'error') {
    if (result.status === 404) notFound();
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
        >
          Could not load watcher run ({result.status || 'network error'}).
        </div>
      </div>
    );
  }

  const { run, results } = result.data;

  // Template-name enrichment: protocol envelope only carries template_id; fetch
  // the definition so the header reads "Apex LT watcher" instead of "Run b00bc87b".
  // Ad-hoc runs (no template_id) keep the short-hash fallback.
  let templateName: string | null = null;
  if (run.template_id) {
    const defResult = await fetchBffJson<DefinitionResponse>(
      `/api/account/sonar/watcher/definitions/${run.template_id}`,
    );
    if (defResult.kind === 'ok') {
      templateName = defResult.data.template.template_name;
    }
  }

  const title = templateName ?? `Ad-hoc run ${run.run_id.slice(0, 8)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Watcher"
        title={title}
        description={
          <>
            Triggered {new Date(run.triggered_at).toLocaleString()} · depth{' '}
            {run.depth_limit} · {run.signal_types.length} signals
          </>
        }
        actions={<RunControls run={run} />}
      />

      {run.status === 'throttled' && run.resumption_state && (
        <>
          <ThrottleBanner />
          <ResumptionHistoryTable resumptionState={run.resumption_state} />
        </>
      )}

      {(run.status === 'failed' || run.status === 'cancelled') && (
        <RunFailureBanner
          status={run.status}
          errorMessage={null}
          resultsCount={results.length}
        />
      )}

      <section aria-labelledby="counterparties-heading" className="space-y-3">
        <h2
          id="counterparties-heading"
          className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
        >
          Counterparties
        </h2>
        <CounterpartiesGrid results={results} />
      </section>
    </div>
  );
}
