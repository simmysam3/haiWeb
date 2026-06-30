import { fetchBffJson } from '@/lib/server-fetch';
import { PageHeader } from '@/components';
import { RollupGrid } from '../_components/rollup-grid';
import type { RolledUpReadinessState } from '@haiwave/protocol';

type RollupColorway = {
  sku_ref: string;
  colorway_name: string;
  rolled_up_state: RolledUpReadinessState;
};

type RollupPayload = {
  colorways: RollupColorway[];
};

export default async function ReadinessRollupPage() {
  const result = await fetchBffJson<RollupPayload>('/api/account/readiness/rollup');
  const colorways = result.kind === 'ok' ? result.data.colorways : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Readiness — Roll-up"
        description={
          <>
            <strong className="text-charcoal">State-only view.</strong>{' '}
            Colorway readiness as seen from your position in the supply chain.
            Supplier detail is not disclosed at this level.
          </>
        }
      />
      {result.kind === 'error' && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Could not load readiness roll-up (
          {result.status !== 0 ? `HTTP ${result.status}` : 'network error'}).
        </div>
      )}
      {colorways.length > 0 ? (
        <RollupGrid colorways={colorways} />
      ) : (
        <div className="rounded-md border border-slate/20 bg-slate/5 px-4 py-8 text-center text-sm text-slate">
          No colorway readiness data available.
        </div>
      )}
    </div>
  );
}
