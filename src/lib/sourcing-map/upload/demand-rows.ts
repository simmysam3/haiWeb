import { matchVariantHeader, parseQty, parseSheetDate } from './cells';
import type { RowError } from './bom-rows';
import { SM_LIMITS } from '../contract';

export interface DemandBuildProduct {
  product_id: string;
  name: string;
  variant_values: string[];
}
export interface DemandBuildDrop {
  due_date: string;
  qty: number;
  /** variant → pairs; null for a totals-only file (the mix comes from the curve) */
  pairs: Record<string, number> | null;
}
export interface DemandBuild {
  perProduct: Array<{ product_id: string; drops: DemandBuildDrop[] }>;
  errors: RowError[];
  ignoredColumns: string[];
}
export interface DemandBuildInput {
  rows: Array<{ row: number; cells: string[] }>;
  headers: string[];
  mapping: string[];
  products: DemandBuildProduct[];
  decimalComma: boolean;
}

/** Mapped demand rows → drops per run product (spec §7.3 demand targets): the long and wide layouts. */
export function buildDemand(input: DemandBuildInput): DemandBuild {
  const { rows, headers, mapping, products, decimalComma } = input;
  const col = (t: string) => mapping.indexOf(t);
  const cell = (cells: string[], t: string) => {
    const i = col(t);
    return i < 0 ? '' : (cells[i] ?? '').trim();
  };
  const errors: RowError[] = [];
  const wideCols = mapping.flatMap((t, i) => (t === 'variant_qty' ? [i] : []));
  const allValues = [...new Set(products.flatMap((p) => p.variant_values))];
  const ignoredColumns = wideCols.filter((i) => matchVariantHeader(headers[i] ?? '', allValues) === null).map((i) => (headers[i] ?? '').trim());
  const byName = new Map(products.map((p) => [p.name.trim().toLocaleLowerCase(), p]));
  const acc = new Map<string, Map<string, DemandBuildDrop>>();

  if (col('due_date') < 0) errors.push({ row: 0, message: 'Map a column to Due date.' });
  if (col('quantity') < 0 && col('variant') < 0 && wideCols.length === 0) {
    errors.push({ row: 0, message: 'Map a column to Quantity, or map per-size quantity columns.' });
  }
  if (col('product') < 0 && products.length !== 1) {
    errors.push({ row: 0, message: `Map a Product column; this run has ${products.length} products.` });
  }
  if (errors.length > 0) return { perProduct: [], errors, ignoredColumns };

  for (const r of rows) {
    // A single-product run needs no product column (spec §7.3).
    const product = col('product') < 0 ? products[0] : byName.get(cell(r.cells, 'product').toLocaleLowerCase());
    if (!product) continue;
    const due = parseSheetDate(cell(r.cells, 'due_date'));
    if (!due) continue;
    const pairs: Record<string, number> = {};
    let qty = 0;
    if (col('variant') >= 0) {
      const v = matchVariantHeader(cell(r.cells, 'variant'), product.variant_values);
      const q = parseQty(cell(r.cells, 'quantity'), decimalComma);
      if (v === null || q === null) continue;
      pairs[v] = q;
      qty = q;
    } else if (wideCols.length > 0) {
      for (const i of wideCols) {
        const v = matchVariantHeader(headers[i] ?? '', product.variant_values);
        const t = (r.cells[i] ?? '').trim();
        if (v === null || t === '') continue;
        const q = parseQty(t, decimalComma);
        if (q === null) continue;
        pairs[v] = (pairs[v] ?? 0) + q;
        qty += q;
      }
    } else {
      const q = parseQty(cell(r.cells, 'quantity'), decimalComma);
      if (q === null) continue;
      qty = q;
    }
    const perDate = acc.get(product.product_id) ?? new Map<string, DemandBuildDrop>();
    acc.set(product.product_id, perDate);
    const drop = perDate.get(due) ?? { due_date: due, qty: 0, pairs: Object.keys(pairs).length > 0 ? {} : null };
    drop.qty += qty;
    if (drop.pairs) for (const [v, q] of Object.entries(pairs)) drop.pairs[v] = (drop.pairs[v] ?? 0) + q;
    perDate.set(due, drop);
  }

  const perProduct = [...acc.entries()].map(([product_id, perDate]) => ({
    product_id,
    drops: [...perDate.values()].filter((d) => d.qty > 0).sort((a, b) => a.due_date.localeCompare(b.due_date)),
  }));
  for (const p of perProduct) {
    if (p.drops.length > SM_LIMITS.DROPS_PER_PRODUCT) {
      const name = products.find((x) => x.product_id === p.product_id)?.name ?? p.product_id;
      errors.push({ row: 0, message: `${name} has ${p.drops.length} drops; a product takes at most ${SM_LIMITS.DROPS_PER_PRODUCT}.` });
    }
  }
  return { perProduct, errors, ignoredColumns };
}
