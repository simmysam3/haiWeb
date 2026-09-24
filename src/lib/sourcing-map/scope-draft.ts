import type { SmProduct, SourcingMapScope } from './contract';
import { mixFromPairs } from './demand-math';
import type { DemandBuild } from './upload/demand-rows';

/**
 * Spec §7.4 "Upload schedule": replace each uploaded product's drops. A
 * variant-level file sets the product mix from its summed pairs and gives a
 * drop an override only where its own mix differs; a totals-only file keeps
 * the product's mix (the curve). The generator is cleared (uploaded, not generated).
 */
export function applyUploadedDemand(scope: SourcingMapScope, build: DemandBuild, library: SmProduct[]): SourcingMapScope {
  return {
    ...scope,
    products: scope.products.map((rp) => {
      const up = build.perProduct.find((p) => p.product_id === rp.product_id);
      if (!up || up.drops.length === 0) return rp;
      const order = library.find((p) => p.product_id === rp.product_id)?.variant_axis?.values ?? [];
      const sized = up.drops.filter((d) => d.pairs !== null);
      let mix = rp.demand.mix;
      if (order.length > 0 && sized.length > 0) {
        const sum: Record<string, number> = {};
        for (const d of sized) for (const [v, q] of Object.entries(d.pairs!)) sum[v] = (sum[v] ?? 0) + q;
        mix = mixFromPairs(sum, order);
      }
      const drops = up.drops.map((d) => {
        if (order.length === 0 || !d.pairs || !mix) return { due_date: d.due_date, qty: d.qty, mix_override: null };
        const own = mixFromPairs(d.pairs, order);
        // compared in hundredths, like mixTotalsHundred (d-G7)
        const differs = order.some((v) => Math.round((own[v] ?? 0) * 100) !== Math.round((mix![v] ?? 0) * 100));
        return { due_date: d.due_date, qty: d.qty, mix_override: differs ? own : null };
      });
      return { ...rp, demand: { drops, mix, generator: null } };
    }),
  };
}
