import type { SkuObligationStatus } from '@haiwave/protocol';
import type { InboundNominationGroup, InboundNominationRow } from './responder-queue-types';

export function groupNominations(
  rows: InboundNominationRow[],
): InboundNominationGroup[] {
  const byProduct = new Map<string, InboundNominationRow[]>();
  for (const r of rows) {
    const list = byProduct.get(r.product_id);
    if (list) list.push(r);
    else byProduct.set(r.product_id, [r]);
  }

  const groups: InboundNominationGroup[] = [];
  for (const [product_id, observers] of byProduct) {
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
