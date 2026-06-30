import { fetchBffJson } from '@/lib/server-fetch';
import { PageHeader } from '@/components';
import { ColorwayReadiness } from './_components/colorway-readiness';
import type { SkuReadiness, RolledUpReadinessState } from '@haiwave/protocol';

type RollupPayload = {
  colorways: Array<{ sku_ref: string; colorway_name: string; rolled_up_state: RolledUpReadinessState }>;
};

type ReadinessPageProps = {
  searchParams: Promise<{ sku?: string }>;
};

export default async function ReadinessPage({ searchParams }: ReadinessPageProps) {
  const { sku: skuParam } = await searchParams;

  // Fetch colorway list from the rollup endpoint — this enumerates all colorways
  // visible to the session (scoped server-side by the session token).
  const rollupResult = await fetchBffJson<RollupPayload>('/api/account/readiness/rollup');
  const colorways = rollupResult.kind === 'ok' ? rollupResult.data.colorways : [];

  // Determine which SKU to show — use the query param if present and valid;
  // fall back to the first colorway returned by the rollup.
  const selectedSkuRef = skuParam ?? colorways[0]?.sku_ref ?? null;

  // Fetch the full SkuReadiness for the selected colorway.
  let readiness: SkuReadiness | null = null;
  if (selectedSkuRef) {
    const readinessResult = await fetchBffJson<SkuReadiness>(
      `/api/account/readiness/${encodeURIComponent(selectedSkuRef)}`,
    );
    readiness = readinessResult.kind === 'ok' ? readinessResult.data : null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Readiness"
        description={
          <>
            <strong className="text-charcoal">SKU-resolution backlog.</strong>{' '}
            Review component-line readiness for each colorway — quantity, shade, length,
            and lead-time outcomes — and manage the backlog of flagged items through
            to resolution.
          </>
        }
      />

      {rollupResult.kind === 'error' && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Could not load colorway list (
          {rollupResult.status !== 0
            ? `HTTP ${rollupResult.status}`
            : 'network error'}
          ). Colorway selector may be incomplete.
        </div>
      )}

      <ColorwayReadiness
        colorways={colorways}
        initialReadiness={readiness}
        initialSkuRef={selectedSkuRef}
      />
    </div>
  );
}
