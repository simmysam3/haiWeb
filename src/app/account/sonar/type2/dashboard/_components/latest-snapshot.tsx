'use client';

import useSWR from 'swr';
import type {
  Type2Result,
  Type2Run,
  CapacityUtilizationBand,
  DeliveryEvent,
  LeadTimeDistribution,
} from '@haiwave/protocol';
import { jsonFetcher } from '@/lib/swr-fetcher';

interface LatestSnapshotProps {
  runId: string;
  onSelectCounterparty: (counterpartyId: string) => void;
}

interface RunDetailEnvelope {
  run: Type2Run;
  results: Type2Result[];
}

interface PerCounterpartyRow {
  counterpartyId: string;
  leadTime: { p50: number; p90: number } | null;
  capacityBand: CapacityUtilizationBand['band'] | null;
  deliveryEvent: DeliveryEvent['event_type'] | null;
  hasGap: boolean;
}

function isLeadTimeDistribution(payload: unknown): payload is LeadTimeDistribution {
  return (
    !!payload &&
    typeof payload === 'object' &&
    'percentiles' in payload &&
    'window_days' in payload
  );
}

function isCapacityBand(payload: unknown): payload is CapacityUtilizationBand {
  return (
    !!payload &&
    typeof payload === 'object' &&
    'band' in payload &&
    'observed_at' in payload
  );
}

function isDeliveryEvent(payload: unknown): payload is DeliveryEvent {
  return (
    !!payload &&
    typeof payload === 'object' &&
    'event_type' in payload &&
    'occurred_at' in payload
  );
}

/**
 * Fold the per-result list into one row per counterparty so the grid
 * can render lead time / capacity / delivery side-by-side. A missing
 * signal renders as "—"; a redacted_gap is flagged so the row exposes
 * the gap context on the drill-down.
 */
function foldByCounterparty(results: Type2Result[]): PerCounterpartyRow[] {
  const rows = new Map<string, PerCounterpartyRow>();
  for (const r of results) {
    // v1.29: aggregate rows (tier-2+) have null counterparty_participant_id —
    // skip them here; the latest-snapshot view shows only direct tier-1 results.
    if (r.counterparty_participant_id === null) continue;
    const cur = rows.get(r.counterparty_participant_id) ?? {
      counterpartyId: r.counterparty_participant_id,
      leadTime: null,
      capacityBand: null,
      deliveryEvent: null,
      hasGap: false,
    };
    if (r.synthesis_mode === 'redacted_gap') {
      cur.hasGap = true;
    } else if (r.signal_type === 'lead_time_distribution' && isLeadTimeDistribution(r.payload)) {
      cur.leadTime = {
        p50: r.payload.percentiles.p50,
        p90: r.payload.percentiles.p90,
      };
    } else if (r.signal_type === 'capacity_utilization_band' && isCapacityBand(r.payload)) {
      cur.capacityBand = r.payload.band;
    } else if (r.signal_type === 'delivery_event' && isDeliveryEvent(r.payload)) {
      cur.deliveryEvent = r.payload.event_type;
    }
    rows.set(r.counterparty_participant_id, cur);
  }
  return [...rows.values()];
}

/**
 * Latest snapshot grid — one row per counterparty showing lead time
 * percentiles, capacity band, and most recent delivery event from the
 * given run. Click a row to open the per-counterparty drill-down.
 */
export function LatestSnapshot({ runId, onSelectCounterparty }: LatestSnapshotProps) {
  const { data, isLoading, error } = useSWR<RunDetailEnvelope>(
    `/api/account/sonar/type2/runs/${runId}`,
    jsonFetcher,
  );

  if (isLoading) return <p className="text-sm text-slate">Loading snapshot…</p>;
  if (error || !data) return <p className="text-sm text-rose-600">Failed to load snapshot.</p>;

  const rows = foldByCounterparty(data.results);
  if (rows.length === 0) {
    return <p className="text-sm text-slate italic">Run completed with no counterparty results.</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate">
          <tr>
            <th className="px-4 py-2">Counterparty</th>
            <th className="px-4 py-2">Lead time p50 / p90 (days)</th>
            <th className="px-4 py-2">Capacity band</th>
            <th className="px-4 py-2">Last delivery</th>
            <th className="px-4 py-2">Gaps</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => (
            <tr
              key={row.counterpartyId}
              className="cursor-pointer hover:bg-slate-50"
              onClick={() => onSelectCounterparty(row.counterpartyId)}
            >
              <td className="px-4 py-2 font-mono text-xs text-charcoal">
                {row.counterpartyId.slice(0, 8)}…
              </td>
              <td className="px-4 py-2 text-charcoal">
                {row.leadTime
                  ? `${row.leadTime.p50.toFixed(1)} / ${row.leadTime.p90.toFixed(1)}`
                  : '—'}
              </td>
              <td className="px-4 py-2 text-charcoal capitalize">
                {row.capacityBand ?? '—'}
              </td>
              <td className="px-4 py-2 text-charcoal capitalize">
                {row.deliveryEvent ?? '—'}
              </td>
              <td className="px-4 py-2 text-charcoal">
                {row.hasGap ? (
                  <span className="text-xs text-amber-600">redacted_gap</span>
                ) : (
                  <span className="text-xs text-slate">none</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
