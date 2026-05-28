import type { WatcherSynthesisMode } from '@haiwave/protocol';

interface DirectPayload {
  window_days: number;
  percentiles: { p50: number; p75: number; p90: number; p95: number; p99: number };
  sample_count: number;
  fulfillment_class?: string;
}

interface AggregatedPayload {
  median_p50: number;
  median_p90: number;
  source_responder_count: number;
}

type Payload = DirectPayload | AggregatedPayload | null;

interface Props {
  synthesisMode: WatcherSynthesisMode;
  payload: Payload;
}

const PCT_KEYS = ['p50', 'p75', 'p90', 'p95', 'p99'] as const;

export function LeadTimePanel({ synthesisMode, payload }: Props) {
  if (synthesisMode === 'redacted_gap' || payload === null) {
    return (
      <p className="text-sm italic text-slate">
        Vendor has not opted into lead-time sharing.
      </p>
    );
  }

  if (synthesisMode === 'aggregated_derivative') {
    const agg = payload as AggregatedPayload;
    return (
      <div className="space-y-1 text-sm">
        <div className="flex items-baseline gap-3">
          <span className="text-slate">median p50</span>
          <span className="font-mono text-charcoal">{agg.median_p50}d</span>
          <span className="text-slate">median p90</span>
          <span className="font-mono text-charcoal">{agg.median_p90}d</span>
        </div>
        <p className="text-xs text-slate">{agg.source_responder_count} responders</p>
      </div>
    );
  }

  const direct = payload as DirectPayload;
  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-5 gap-2 text-center">
        {PCT_KEYS.map((k) => (
          <div key={k} className="rounded border border-slate-200 px-2 py-1">
            <div className="text-[10px] uppercase tracking-wider text-slate">{k}</div>
            <div className="font-mono text-charcoal">{direct.percentiles[k]}d</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate">
        {direct.sample_count} samples · window {direct.window_days}d
        {direct.fulfillment_class ? ` · ${direct.fulfillment_class}` : ''}
      </p>
    </div>
  );
}
