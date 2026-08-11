import type { WatcherSynthesisMode } from '@haiwave/protocol';

interface ActiveOrder { po_number: string; quantity: number; quoted_ship_date: string }
interface Fulfillment extends ActiveOrder { actual_ship_date: string }
interface OrdPayload {
  kind: 'direct';
  active_orders: ActiveOrder[];
  recent_fulfillments: Fulfillment[];
  calibrated: { days: number; sample_count: number };
}
interface Props { synthesisMode: WatcherSynthesisMode; payload: OrdPayload | null }

export function OrderFulfillmentHistoryPanel({ synthesisMode, payload }: Props) {
  if (synthesisMode !== 'direct' || payload === null) {
    return <p className="text-sm italic text-slate">Order-history signal not shared.</p>;
  }
  // sample_count is the field to key off: {days: 0, sample_count: 0} means
  // "no observations", never "ships same day" — absence surfaces as absence.
  const hasCalibration = payload.calibrated.sample_count > 0;
  const shown = payload.recent_fulfillments.slice(0, 3);
  return (
    <div className="space-y-1 text-sm">
      <div>
        <span className="text-slate">calibrated</span>{' '}
        {hasCalibration ? (
          <span className="font-medium text-charcoal">
            {payload.calibrated.days}d{' '}
            <span className="text-xs text-slate">({payload.calibrated.sample_count} obs)</span>
          </span>
        ) : (
          <span className="italic text-slate">no observations yet</span>
        )}
      </div>
      <div className="text-xs text-slate">
        {payload.active_orders.length} active order{payload.active_orders.length === 1 ? '' : 's'}
      </div>
      {shown.length > 0 && (
        <ul className="space-y-0.5 text-xs text-charcoal">
          {shown.map((f) => (
            <li key={f.po_number}>
              {f.po_number}: quoted {f.quoted_ship_date} → shipped {f.actual_ship_date}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
