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

interface PartnerRecord {
  id: string;
  company_name: string;
}

const SIGNAL_LABEL: Record<string, string> = {
  lead_time_distribution: 'lead time',
  capacity_utilization_band: 'capacity',
  delivery_event: 'delivery events',
};

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

  // Parallel enrichment: template (for the title) + partners (for vendor names
  // on the counterparty grid). WatcherResult only carries participant_id; the
  // protocol envelope has no human-readable name, so we join client-side.
  const [defResult, partnersResult] = await Promise.all([
    run.template_id
      ? fetchBffJson<DefinitionResponse>(
          `/api/account/sonar/watcher/definitions/${run.template_id}`,
        )
      : Promise.resolve({ kind: 'error' as const, status: 0, message: 'no template' }),
    fetchBffJson<PartnerRecord[]>('/api/account/partners'),
  ]);

  const templateName =
    defResult.kind === 'ok' ? defResult.data.template.template_name : null;
  const partnerNameById = new Map<string, string>();
  if (partnersResult.kind === 'ok') {
    for (const p of partnersResult.data) {
      partnerNameById.set(p.id, p.company_name);
    }
  }

  const enrichedResults: WatcherResult[] = results.map((r) => ({
    ...r,
    counterparty_name: r.counterparty_participant_id
      ? partnerNameById.get(r.counterparty_participant_id) ?? null
      : null,
  })) as WatcherResult[];

  // Title: template_name when available; otherwise a descriptive scope summary
  // for ad-hoc runs so the user isn't staring at a UUID slice.
  const signalLabels = run.signal_types
    .map((s) => SIGNAL_LABEL[s] ?? s)
    .join(', ');
  const title =
    templateName ??
    (run.run_origin === 'ad_hoc' || !run.template_id
      ? `Ad-hoc · ${signalLabels}`
      : `Run ${run.run_id.slice(0, 8)}`);

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
          Counterparty observations
        </h2>
        <p className="text-sm text-slate">
          One row per vendor in scope. Each row summarises the signals returned
          (or redacted) on this run; expand a row for the per-signal detail.
        </p>
        <CounterpartiesGrid results={enrichedResults} />
      </section>
    </div>
  );
}
