import Link from 'next/link';

interface Props {
  capacityBandCounts: Record<'low' | 'moderate' | 'high' | 'at_capacity', number>;
  medianLeadTimeP90: number | null;
}

export function WatcherSignalsCard({ capacityBandCounts, medianLeadTimeP90 }: Props) {
  const total =
    capacityBandCounts.low + capacityBandCounts.moderate + capacityBandCounts.high + capacityBandCounts.at_capacity;
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-charcoal">Watcher signals</h2>
        <Link href="/account/sonar/watcher/dashboard" className="text-xs text-teal hover:underline">
          View details →
        </Link>
      </div>
      {total === 0 ? (
        <p className="text-sm text-slate italic">No runs yet — visit /watcher to start.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-slate">Capacity bands</dt>
            <dd className="text-xs text-charcoal">
              {capacityBandCounts.low} low · {capacityBandCounts.moderate} mod ·{' '}
              {capacityBandCounts.high} high · {capacityBandCounts.at_capacity} at-cap
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate">Median lead time p90</dt>
            <dd className="text-lg font-semibold text-charcoal">
              {medianLeadTimeP90 !== null ? `${medianLeadTimeP90.toFixed(1)}d` : '—'}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
