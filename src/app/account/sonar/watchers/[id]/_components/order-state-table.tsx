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

const THEAD = 'bg-slate-50 text-xs uppercase tracking-wider text-slate';
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
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="min-w-full text-left">
              <thead className={THEAD}>
                <tr>
                  <th className="px-3 py-2 font-semibold">PO</th>
                  <th className="px-3 py-2 font-semibold">Qty</th>
                  <th className="px-3 py-2 font-semibold">Quoted ship</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {payload.active_orders.map((order) => (
                  <tr key={order.po_number}>
                    <td className="px-3 py-2 font-mono text-charcoal">{order.po_number}</td>
                    <td className="px-3 py-2">{order.quantity}</td>
                    <td className="px-3 py-2">{formatDate(order.quoted_ship_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h4 className={SUBHEAD}>Recent fulfillments</h4>
        {recent.length === 0 ? (
          <p className="italic text-slate">No fulfillment history.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="min-w-full text-left">
              <thead className={THEAD}>
                <tr>
                  <th className="px-3 py-2 font-semibold">PO</th>
                  <th className="px-3 py-2 font-semibold">Qty</th>
                  <th className="px-3 py-2 font-semibold">Quoted ship</th>
                  <th className="px-3 py-2 font-semibold">Actual ship</th>
                  <th className="px-3 py-2 font-semibold">
                    <Pill category="lead_time_col" value="calibrated">
                      Ship delta
                    </Pill>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recent.map((fulfillment) => {
                  const delta = shipDelta(
                    fulfillment.quoted_ship_date,
                    fulfillment.actual_ship_date,
                  );
                  return (
                    <tr key={fulfillment.po_number}>
                      <td className="px-3 py-2 font-mono text-charcoal">{fulfillment.po_number}</td>
                      <td className="px-3 py-2">{fulfillment.quantity}</td>
                      <td className="px-3 py-2">{formatDate(fulfillment.quoted_ship_date)}</td>
                      <td className="px-3 py-2">{formatDate(fulfillment.actual_ship_date)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${
                            delta.late
                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
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
          </div>
        )}
        <p className="mt-1 text-[10px] text-slate">
          Calibrated lead time {payload.calibrated.days}d from {payload.calibrated.sample_count}{' '}
          orders.
        </p>
      </section>
    </div>
  );
}
