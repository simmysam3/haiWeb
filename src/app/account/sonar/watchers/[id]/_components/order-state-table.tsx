import type { OrderFulfillmentHistoryPayload } from '@haiwave/protocol';
import { Pill } from '@/components/pill';

// Order-state view for a (SKU, vendor) on the readiness watcher run-detail
// page. Two sub-tables: the vendor's currently open orders, then the most
// recent fulfillments with the quoted-vs-actual ship-date slip that the
// calibrated lead time is derived from. Purely presentational — the payload
// is the direct OrderFulfillmentHistoryPayload signal.

const DAY_MS = 86_400_000;

// Deterministic UTC formatting so the rendered date does not drift with the
// runner's local timezone.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface ShipDelta {
  label: string;
  late: boolean;
}

function shipDelta(quotedShipDate: string, actualShipDate: string): ShipDelta {
  const days = Math.round((Date.parse(actualShipDate) - Date.parse(quotedShipDate)) / DAY_MS);
  if (days <= 0) return { label: 'on time', late: false };
  return { label: `+${days}d`, late: true };
}

const HEADER_ROW = 'text-[10px] uppercase tracking-wider text-slate-500';
const SUBHEAD = 'mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600';

interface Props {
  payload: OrderFulfillmentHistoryPayload;
}

export function OrderStateTable({ payload }: Props) {
  const recent = payload.recent_fulfillments.slice(0, 5);

  return (
    <div className="space-y-4 text-sm">
      <section>
        <h4 className={SUBHEAD}>Active orders</h4>
        {payload.active_orders.length === 0 ? (
          <p className="italic text-slate">No open orders.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className={HEADER_ROW}>
                <th className="py-1 pr-3 font-semibold">PO</th>
                <th className="py-1 pr-3 font-semibold">Qty</th>
                <th className="py-1 font-semibold">Quoted ship</th>
              </tr>
            </thead>
            <tbody>
              {payload.active_orders.map((order) => (
                <tr key={order.po_number} className="border-t border-slate-100">
                  <td className="py-1 pr-3 font-mono text-charcoal">{order.po_number}</td>
                  <td className="py-1 pr-3">{order.quantity}</td>
                  <td className="py-1">{formatDate(order.quoted_ship_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h4 className={SUBHEAD}>Recent fulfillments</h4>
        {recent.length === 0 ? (
          <p className="italic text-slate">No fulfillment history.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className={HEADER_ROW}>
                <th className="py-1 pr-3 font-semibold">PO</th>
                <th className="py-1 pr-3 font-semibold">Qty</th>
                <th className="py-1 pr-3 font-semibold">Quoted ship</th>
                <th className="py-1 pr-3 font-semibold">Actual ship</th>
                <th className="py-1 font-semibold">
                  <Pill category="lead_time_col" value="calibrated">
                    Ship delta
                  </Pill>
                </th>
              </tr>
            </thead>
            <tbody>
              {recent.map((fulfillment) => {
                const delta = shipDelta(
                  fulfillment.quoted_ship_date,
                  fulfillment.actual_ship_date,
                );
                return (
                  <tr key={fulfillment.po_number} className="border-t border-slate-100">
                    <td className="py-1 pr-3 font-mono text-charcoal">{fulfillment.po_number}</td>
                    <td className="py-1 pr-3">{fulfillment.quantity}</td>
                    <td className="py-1 pr-3">{formatDate(fulfillment.quoted_ship_date)}</td>
                    <td className="py-1 pr-3">{formatDate(fulfillment.actual_ship_date)}</td>
                    <td className="py-1">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                          delta.late
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {delta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="mt-1 text-[10px] text-slate">
          Calibrated lead time {payload.calibrated.days}d from {payload.calibrated.sample_count}{' '}
          orders.
        </p>
      </section>
    </div>
  );
}
