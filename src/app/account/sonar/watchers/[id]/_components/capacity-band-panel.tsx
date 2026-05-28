import type { WatcherSynthesisMode } from '@haiwave/protocol';

type Band = 'low' | 'moderate' | 'high' | 'at_capacity';

interface DirectPayload {
  band: Band;
  observed_at: string;
}

interface AggregatedPayload {
  modal_band: Band;
  distribution: Record<Band, number>;
}

interface Props {
  synthesisMode: WatcherSynthesisMode;
  payload: DirectPayload | AggregatedPayload | null;
}

const BANDS: Band[] = ['low', 'moderate', 'high', 'at_capacity'];
const BAND_LABEL: Record<Band, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  at_capacity: 'At capacity',
};
const BAND_STYLE: Record<Band, string> = {
  low: 'bg-emerald-100 text-emerald-800',
  moderate: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  at_capacity: 'bg-rose-200 text-rose-900',
};

export function CapacityBandPanel({ synthesisMode, payload }: Props) {
  if (synthesisMode === 'redacted_gap' || payload === null) {
    return <p className="text-sm italic text-slate">Capacity signal not shared.</p>;
  }

  if (synthesisMode === 'aggregated_derivative') {
    const agg = payload as AggregatedPayload;
    const total = BANDS.reduce((s, b) => s + (agg.distribution[b] ?? 0), 0);
    return (
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-slate">modal band</span>{' '}
          <span className="font-medium text-charcoal">{agg.modal_band}</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded border border-slate-200">
          {BANDS.map((b) => {
            const pct = total > 0 ? (agg.distribution[b] ?? 0) / total : 0;
            if (pct === 0) return null;
            return (
              <div
                key={b}
                className={BAND_STYLE[b]}
                style={{ width: `${pct * 100}%` }}
                title={`${BAND_LABEL[b]}: ${agg.distribution[b]} responders`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const direct = payload as DirectPayload;
  return (
    <div className="space-y-2 text-sm">
      <div
        className="flex h-7 overflow-hidden rounded border border-slate-200"
        aria-label={`Current band: ${direct.band}`}
      >
        {BANDS.map((b) => (
          <div
            key={b}
            className={`flex-1 px-2 py-0.5 text-center text-xs ${
              b === direct.band
                ? BAND_STYLE[b] + ' font-semibold'
                : 'bg-slate-50 text-slate-400'
            }`}
          >
            {BAND_LABEL[b]}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate">
        observed {new Date(direct.observed_at).toLocaleString()}
      </p>
    </div>
  );
}
