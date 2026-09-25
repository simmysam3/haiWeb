import { SM_LIMITS, type DemandSchedule, type SmProduct, type SourcingMapScope, type VariantAxis } from './contract';
import { curveMix, generateDrops, mixFromPairs } from './demand-math';
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

/** A starting schedule the user then edits (ruling 7 keeps it): 6 monthly drops of 1,000 and the default curve. */
export function defaultDemand(axis: VariantAxis | null, firstDue: string): DemandSchedule {
  const g = { total: 6000, first_due_date: firstDue, spacing: 'monthly' as const, count: 6, shape: 'flat' as const };
  const drops = generateDrops(g);
  const curve = axis
    ? { center: axis.values[Math.floor(axis.values.length / 2)]!, spread: 1.5, half_sizes: axis.values.some((v) => v.includes('.')) }
    : null;
  return {
    drops: drops.ok ? drops.drops : [],
    mix: axis && curve ? curveMix(axis.values, curve) : null,
    generator: { ...g, curve },
  };
}

export function addProduct(scope: SourcingMapScope, product: SmProduct, firstDue: string): SourcingMapScope {
  if (scope.products.length >= SM_LIMITS.PRODUCTS_PER_RUN || scope.products.some((p) => p.product_id === product.product_id)) return scope;
  return { ...scope, products: [...scope.products, { product_id: product.product_id, demand: defaultDemand(product.variant_axis, firstDue) }] };
}

export function removeProduct(scope: SourcingMapScope, productId: string): SourcingMapScope {
  return { ...scope, products: scope.products.filter((p) => p.product_id !== productId) };
}

export function moveProduct(scope: SourcingMapScope, productId: string, dir: -1 | 1): SourcingMapScope {
  const i = scope.products.findIndex((p) => p.product_id === productId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= scope.products.length) return scope;
  const products = [...scope.products];
  [products[i], products[j]] = [products[j]!, products[i]!];
  return { ...scope, products };
}

export function replaceDemand(scope: SourcingMapScope, productId: string, demand: DemandSchedule): SourcingMapScope {
  return { ...scope, products: scope.products.map((p) => (p.product_id === productId ? { ...p, demand } : p)) };
}
