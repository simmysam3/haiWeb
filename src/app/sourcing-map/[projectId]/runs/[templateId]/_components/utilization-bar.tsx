import type { SmOptionAggregates } from '@/lib/sourcing-map/types';
import { utilizationText } from '@/lib/sourcing-map/map/selectors';

/** The utilization bar's segments, in band order, with the tones `pill.tsx`'s `sm_utilization` map gives the same bands (AR-6). */
const UTIL_BANDS = [['low', 'success'], ['moderate', 'info'], ['high', 'warn'], ['at_capacity', 'problem']] as const;

/** What is below tier 1, as one bar of the non-zero utilization bands; nothing when every count is 0. */
export function UtilizationBar({ utilization: util }: { utilization: SmOptionAggregates['utilization'] }) {
  const segments = UTIL_BANDS.filter(([k]) => util[k] > 0);
  if (segments.length === 0) return null;
  return (
    <span role="img" aria-label={`Utilization below tier 1: ${utilizationText(util)}`} className="flex h-1.5 w-16 overflow-hidden rounded-full">
      {segments.map(([k, tone]) => (
        <span key={k} data-util={k} style={{ flexGrow: util[k], background: `var(--sm-pill-${tone}-fg)` }} />
      ))}
    </span>
  );
}
