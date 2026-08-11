import type { WatcherSynthesisMode } from '@haiwave/protocol';

interface SqlPayload {
  kind: 'direct';
  days: number | null;
  availability: 'available' | 'partial' | 'unavailable';
  ask_quantity: number;
  resolved_via: 'phantom_demand_bom';
  observed_at: string;
}
interface Props { synthesisMode: WatcherSynthesisMode; payload: SqlPayload | null }

export function SoftQuotedLeadTimePanel({ synthesisMode, payload }: Props) {
  if (synthesisMode !== 'direct' || payload === null) {
    return <p className="text-sm italic text-slate">Soft-quote signal not shared.</p>;
  }
  if (payload.days === null || payload.availability === 'unavailable') {
    return (
      <p className="text-sm text-charcoal">
        Unavailable for {payload.ask_quantity} units — no viable path resolved.
      </p>
    );
  }
  return (
    <div className="space-y-1 text-sm">
      <div>
        <span className="font-medium text-charcoal">{payload.days}d</span>{' '}
        <span className="text-slate">for {payload.ask_quantity} units</span>
        {payload.availability === 'partial' && (
          <span className="text-xs text-warning"> (partial coverage)</span>
        )}
      </div>
      <p className="text-xs text-slate">
        Best-effort, from a phantom-demand traversal — not a committed quote.
        Observed {new Date(payload.observed_at).toLocaleString()}.
      </p>
    </div>
  );
}
