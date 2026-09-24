import { SM_LIMITS, type DemandDrop, type SmMix } from './contract';

/**
 * Integer shares of `total` proportional to `weights`, summing exactly to
 * `total` (spec §8.2 largest remainder). Ties in the remainder go to the
 * earlier index. All-zero weights split evenly.
 */
export function largestRemainder(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const w = sum > 0 ? weights : weights.map(() => 1);
  const s = sum > 0 ? sum : weights.length;
  const raw = w.map((x) => (total * x) / s);
  const out = raw.map((r) => Math.floor(r));
  let rem = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; rem > 0 && k < order.length; k++, rem--) out[order[k]![1]] += 1;
  return out;
}

export interface DropsGeneratorInput {
  total: number;
  first_due_date: string;
  spacing: 'weekly' | 'monthly';
  count: number;
  shape: 'flat' | 'ramp' | 'front_loaded';
}

function dropDates(first: string, spacing: 'weekly' | 'monthly', count: number): string[] {
  const [y, m, d] = first.split('-').map(Number) as [number, number, number];
  return Array.from({ length: count }, (_, i) => {
    if (spacing === 'weekly') return new Date(Date.UTC(y, m - 1, d + 7 * i)).toISOString().slice(0, 10);
    const month = new Date(Date.UTC(y, m - 1 + i, 1));
    const last = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
  });
}

/** Spec §7.4 drops generator: every drop gets 1, the rest splits by the shape's weights (exact total). */
export function generateDrops(g: DropsGeneratorInput): { ok: true; drops: DemandDrop[] } | { ok: false; message: string } {
  if (!Number.isInteger(g.count) || g.count < 1 || g.count > SM_LIMITS.DROPS_PER_PRODUCT) {
    return { ok: false, message: `Drops must be between 1 and ${SM_LIMITS.DROPS_PER_PRODUCT}.` };
  }
  if (!Number.isInteger(g.total) || g.total < g.count) {
    return { ok: false, message: `The total must be a whole number of at least ${g.count} (one per drop).` };
  }
  const weights = Array.from({ length: g.count }, (_, i) => (g.shape === 'flat' ? 1 : g.shape === 'ramp' ? i + 1 : g.count - i));
  const extra = largestRemainder(g.total - g.count, weights);
  return {
    ok: true,
    drops: dropDates(g.first_due_date, g.spacing, g.count).map((due_date, i) => ({ due_date, qty: 1 + extra[i]!, mix_override: null })),
  };
}

/**
 * The size-mix curve (spec §7.4), ported from the prototype's generateSizes
 * (docs/haiwave-sourcing-map.html:1094-1104): a Gaussian over numeric variant
 * values, spread floored at 0.3, allocated by largest remainder over 10,000
 * hundredths so the mix totals exactly 100.00. Half sizes off → 0% on them.
 */
export function curveMix(values: readonly string[], curve: { center: string; spread: number; half_sizes: boolean }): SmMix {
  const c = Number(curve.center);
  const sd = Math.max(0.3, curve.spread);
  const numeric = Number.isFinite(c) && values.every((v) => v.trim() !== '' && Number.isFinite(Number(v)));
  const weights = values.map((v) => {
    if (!numeric) return 1;
    const n = Number(v);
    if (!curve.half_sizes && !Number.isInteger(n)) return 0;
    return Math.exp(-0.5 * ((n - c) / sd) ** 2);
  });
  const hundredths = largestRemainder(10000, weights);
  return Object.fromEntries(values.map((v, i) => [v, hundredths[i]! / 100]));
}
