import type { SkuObligationStatus } from '@haiwave/protocol';
import type { InboundNominationGroup, InboundNominationRow } from './responder-queue-types';

export function groupNominations(
  rows: InboundNominationRow[],
): InboundNominationGroup[] {
  // Disclosed rows group by the real product_id; identity-redacted rows (null
  // product_id, D-119) have no sku to key on, so they group by concept label —
  // otherwise every redacted nomination would collapse into one null group. The
  // key is prefixed so a real product_id can never collide with a concept label.
  const byProduct = new Map<string, InboundNominationRow[]>();
  for (const r of rows) {
    const key = r.product_id !== null ? `p:${r.product_id}` : `c:${r.sku_label}`;
    const list = byProduct.get(key);
    if (list) list.push(r);
    else byProduct.set(key, [r]);
  }

  const groups: InboundNominationGroup[] = [];
  for (const [, observers] of byProduct) {
    const product_id = observers[0].product_id;
    observers.sort((a, b) => b.arrival_time.localeCompare(a.arrival_time));
    const status_mix: Partial<Record<SkuObligationStatus, number>> = {};
    let earliest_arrival = observers[0].arrival_time;
    for (const o of observers) {
      status_mix[o.status] = (status_mix[o.status] ?? 0) + 1;
      if (o.arrival_time < earliest_arrival) earliest_arrival = o.arrival_time;
    }
    groups.push({
      product_id,
      sku_label: observers[0].sku_label,
      request_count: observers.length,
      earliest_arrival,
      status_mix,
      observers,
    });
  }

  groups.sort((a, b) => b.earliest_arrival.localeCompare(a.earliest_arrival));
  return groups;
}
