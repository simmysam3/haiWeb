import type { WatcherSynthesisMode } from '@haiwave/protocol';

interface Portion { date: string; quantity: number }
interface Line { line_number: number; promised: Portion[]; current: Portion[] }
interface OpsPayload {
  kind: 'direct';
  order_id: string;
  vendor_order_reference?: string;
  observed_at: string;
  lines: Line[];
}
interface Props { synthesisMode: WatcherSynthesisMode; payload: OpsPayload | null }

// A line's completion date is the max portion date (describe-change.ts uses
// the same rule for the drift feed — keep them agreeing).
function completionDate(portions: Portion[]): string | null {
  let max: string | null = null;
  for (const p of portions) if (!max || p.date > max) max = p.date;
  return max;
}

function slipDays(promised: string | null, current: string | null): number | null {
  if (!promised || !current) return null;
  return Math.round(
    (new Date(`${current}T00:00:00Z`).getTime() - new Date(`${promised}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

export function OrderPromiseSchedulePanel({ synthesisMode, payload }: Props) {
  if (synthesisMode !== 'direct' || payload === null) {
    return <p className="text-sm italic text-slate">Order-promise signal not shared.</p>;
  }
  return (
    <div className="space-y-1 text-sm">
      {payload.vendor_order_reference && (
        <div className="text-xs text-slate">Order {payload.vendor_order_reference}</div>
      )}
      <ul className="space-y-0.5">
        {payload.lines.map((line) => {
          const promised = completionDate(line.promised);
          const current = completionDate(line.current);
          const delta = slipDays(promised, current);
          return (
            <li key={line.line_number} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-xs text-slate">Line {line.line_number}</span>
              <span className="text-charcoal">{promised ?? '—'} → {current ?? '—'}</span>
              {delta !== null && delta > 0 && (
                <span className="text-xs font-medium text-problem">{delta}d later</span>
              )}
              {delta !== null && delta < 0 && (
                <span className="text-xs font-medium text-success">{-delta}d earlier</span>
              )}
              {delta === 0 && <span className="text-xs text-slate">on promise</span>}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate">
        Promised vs the vendor ERP&apos;s current post-MRP schedule. Observed{' '}
        {new Date(payload.observed_at).toLocaleString()}.
      </p>
    </div>
  );
}
