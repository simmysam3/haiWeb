import { notFound } from 'next/navigation';
import { PageHeader } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';
import { ThrottleBanner } from '@/components/sonar/throttle-banner';
import { ResumptionHistoryTable } from '@/components/sonar/resumption-history-table';
import { CounterpartiesGrid, type EnrichedWatcherResult } from './_components/counterparties-grid';
import { ReadinessReport } from './_components/readiness-report';
import { pivotReadiness, type RunRef } from './_lib/pivot-readiness';
import { RunControls } from './run-controls';
import { RunFailureBanner } from './run-failure-banner';
import type { RunTemplate, SkuAsk, WatcherRun, WatcherResult } from '@haiwave/protocol';

interface WatcherRunDetailResponse {
  run: WatcherRun;
  results: WatcherResult[];
}

interface TrailingHistoryResponse {
  runs: RunRef[];
  results: WatcherResult[];
}

interface DefinitionResponse {
  template: RunTemplate;
}

interface PartnerRecord {
  id: string;
  company_name: string;
}

interface ManifestCatalogResponse {
  products: Array<{ external_product_id: string; product_name: string }>;
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

  // Parallel enrichment: template (for the title) + partners (for vendor names
  // on the counterparty grid) + manifest catalog (for per-product names on the
  // two-level grid — Plan 3 E3). WatcherResult only carries participant_id +
  // external_product_id; the protocol envelopes have no human-readable name,
  // so we join client-side.
  const [defResult, partnersResult, manifestResult, historyResult] = await Promise.all([
    run.template_id
      ? fetchBffJson<DefinitionResponse>(
          `/api/account/sonar/watcher/definitions/${run.template_id}`,
        )
      : Promise.resolve({ kind: 'error' as const, status: 0, message: 'no template' }),
    fetchBffJson<PartnerRecord[]>('/api/account/partners'),
    fetchBffJson<ManifestCatalogResponse>('/api/account/sonar/manifest-catalog'),
    fetchBffJson<TrailingHistoryResponse>(
      `/api/account/sonar/watcher/runs/${runId}/trailing-history`,
    ),
  ]);

  const templateName =
    defResult.kind === 'ok' ? defResult.data.template.template_name : null;
  const partnerNameById = new Map<string, string>();
  if (partnersResult.kind === 'ok') {
    for (const p of partnersResult.data) {
      partnerNameById.set(p.id, p.company_name);
    }
  }
  const productNameByExtId: Record<string, string> = {};
  if (manifestResult.kind === 'ok') {
    for (const p of manifestResult.data.products) {
      productNameByExtId[p.external_product_id] = p.product_name;
    }
  }

  const enrichedResults: EnrichedWatcherResult[] = results.map((r) => ({
    ...r,
    counterparty_name: r.counterparty_participant_id
      ? partnerNameById.get(r.counterparty_participant_id) ?? null
      : null,
  }));

  // Readiness watchers carry per-SKU forward-demand asks on their scope. When
  // present, the run-detail page pivots to the SKU->vendor readiness surface
  // (order-state + lead-time-history over the trailing runs) instead of the
  // legacy per-counterparty grid. Non-readiness watchers (no sku_asks) fall
  // through to <CounterpartiesGrid> unchanged.
  const skuAsks: SkuAsk[] | null =
    defResult.kind === 'ok' && defResult.data.template.observation_class === 'watcher'
      ? defResult.data.template.scope.sku_asks ?? null
      : null;

  const readinessSkus =
    skuAsks && skuAsks.length > 0 && historyResult.kind === 'ok'
      ? pivotReadiness(
          historyResult.data.results,
          historyResult.data.runs,
          skuAsks,
          productNameByExtId,
          partnerNameById,
        )
      : null;

  // Title is the watcher's configured name (every run originates from a named
  // template). Orphan runs without a resolvable template fall back to a
  // generic "Watcher run" so the page still reads cleanly; the run hash always
  // lives in the subhead so users can identify which run they're inspecting
  // without the title becoming a string assembly.
  const title = templateName ?? 'Watcher run';
  const runHash = run.run_id.slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Watcher"
        title={title}
        description={
          <>
            Run <span className="font-mono">{runHash}</span> · Triggered{' '}
            {new Date(run.triggered_at).toLocaleString()} · depth{' '}
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

      {readinessSkus ? (
        <section aria-labelledby="readiness-heading" className="space-y-3">
          <h2
            id="readiness-heading"
            className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
          >
            SKU readiness
          </h2>
          <p className="text-sm text-slate">
            One section per watched SKU with its forward-demand ask, then each
            supplier&rsquo;s current order state and lead-time history across the
            most recent runs.
          </p>
          <ReadinessReport skus={readinessSkus} />
        </section>
      ) : (
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
          <CounterpartiesGrid
            results={enrichedResults}
            productNameByExtId={productNameByExtId}
          />
        </section>
      )}
    </div>
  );
}
