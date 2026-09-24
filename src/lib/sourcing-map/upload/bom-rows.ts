import { matchVariantHeader, parseQty, parseShare } from './cells';
import { SM_LIMITS } from '../contract';

export interface RowError {
  /** 1-based source row; 0 = a mapping problem */
  row: number;
  message: string;
}

export interface UploadedBomLine {
  key: string;
  rows: number[];
  component_label: string;
  part_ref: string | null;
  class_text: string | null;
  uom: string;
  qty_per_unit: number;
  variant_bound: boolean;
  qty_by_variant: Record<string, number> | null;
  supplier_name: string | null;
  supplier_sku: string | null;
  share_pct: number | null;
}

export type BomBuild =
  | { ok: true; lines: UploadedBomLine[]; ignoredColumns: string[]; errors: RowError[] }
  | { ok: false; rejection: string; rows: number[] };

export interface BomBuildInput {
  rows: Array<{ row: number; cells: string[] }>;
  headers: string[];
  mapping: string[];
  variantValues: string[];
  decimalComma: boolean;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
function mean(values: number[]): number {
  return round6(values.reduce((a, b) => a + b, 0) / values.length);
}

const MAKE_VALUES = new Set(['make', 'm', 'manufactured', 'in-house', 'in house', 'sub-assembly', 'subassembly', 'phantom']);

/** Mapped rows → uploaded BOM lines (spec §7.3 step 2). */
export function buildBomLines(input: BomBuildInput): BomBuild {
  const { rows, headers, mapping, variantValues, decimalComma } = input;
  const col = (t: string) => mapping.indexOf(t);
  const cell = (cells: string[], t: string) => {
    const i = col(t);
    return i < 0 ? '' : (cells[i] ?? '').trim();
  };
  const errors: RowError[] = [];
  if (col('level_make') >= 0) {
    const rejected = rows
      .filter((r) => {
        const v = cell(r.cells, 'level_make').toLocaleLowerCase();
        const level = /^\.*(\d+)$/.exec(v);
        return (level !== null && Number(level[1]) > 1) || MAKE_VALUES.has(v);
      })
      .map((r) => r.row);
    if (rejected.length > 0) {
      return {
        ok: false,
        rows: rejected,
        rejection: `Rows ${rejected.join(', ')} are make or sub-assembly lines. Only single-level purchased lines can be uploaded; nothing was flattened.`,
      };
    }
  }
  const wide = mapping.flatMap((t, i) => (t === 'variant_qty' ? [{ i, variant: matchVariantHeader(headers[i] ?? '', variantValues) }] : []));
  const ignoredColumns = wide.filter((w) => w.variant === null).map((w) => (headers[w.i] ?? '').trim());
  const sized = wide.filter((w): w is { i: number; variant: string } => w.variant !== null);

  if (col('component') < 0) errors.push({ row: 0, message: 'Map a column to Component.' });
  if (col('variant') < 0 && sized.length === 0 && col('qty_per_unit') < 0) {
    errors.push({ row: 0, message: 'Map a column to Qty per unit, or map per-size quantity columns.' });
  }
  if (errors.length > 0) return { ok: true, lines: [], ignoredColumns, errors };

  const lines: UploadedBomLine[] = [];
  const long = col('variant') >= 0;
  const groups = new Map<string, UploadedBomLine>();
  for (const r of rows) {
    const component = cell(r.cells, 'component');
    if (component === '') {
      errors.push({ row: r.row, message: `Row ${r.row}: Component is empty.` });
      continue;
    }
    const shareText = cell(r.cells, 'share');
    const share = shareText === '' ? null : parseShare(shareText);
    if (shareText !== '' && share === null) {
      errors.push({ row: r.row, message: `Row ${r.row}: '${shareText}' is not a share between 0 and 100.` });
      continue;
    }
    const base = {
      component_label: component,
      part_ref: cell(r.cells, 'part_ref') || null,
      class_text: cell(r.cells, 'class') || null,
      uom: cell(r.cells, 'uom') || 'ea',
      supplier_name: cell(r.cells, 'supplier') || null,
      supplier_sku: cell(r.cells, 'supplier_sku') || null,
      share_pct: share,
    };
    if (long) {
      const variant = matchVariantHeader(cell(r.cells, 'variant'), variantValues);
      const qty = parseQty(cell(r.cells, 'qty_per_unit'), decimalComma);
      if (variant === null) {
        errors.push({ row: r.row, message: `Row ${r.row}: size '${cell(r.cells, 'variant')}' is not on the product.` });
        continue;
      }
      if (qty === null || qty < 0) {
        errors.push({ row: r.row, message: `Row ${r.row}: '${cell(r.cells, 'qty_per_unit')}' is not a quantity.` });
        continue;
      }
      const groupKey = JSON.stringify([base.component_label, base.part_ref, base.uom, base.supplier_name, base.supplier_sku]);
      let g = groups.get(groupKey);
      if (!g) {
        g = { key: `rows-${r.row}`, rows: [], ...base, qty_per_unit: 0, variant_bound: true, qty_by_variant: {} };
        groups.set(groupKey, g);
        lines.push(g);
      }
      g.rows.push(r.row);
      g.qty_by_variant![variant] = qty;
      continue;
    }
    const byVariant: Record<string, number> = {};
    for (const w of sized) {
      const t = (r.cells[w.i] ?? '').trim();
      if (t === '') continue;
      const q = parseQty(t, decimalComma);
      if (q === null || q < 0) {
        errors.push({ row: r.row, message: `Row ${r.row}: '${t}' under size ${w.variant} is not a quantity.` });
        continue;
      }
      byVariant[w.variant] = q;
    }
    const values = Object.values(byVariant);
    const uniformText = cell(r.cells, 'qty_per_unit');
    const uniform = uniformText === '' ? null : parseQty(uniformText, decimalComma);
    const qtyPerUnit = uniform ?? (values.length > 0 ? mean(values) : null);
    if (qtyPerUnit === null || !(qtyPerUnit > 0)) {
      errors.push({ row: r.row, message: `Row ${r.row}: '${uniformText}' is not a quantity per unit.` });
      continue;
    }
    lines.push({
      key: `row-${r.row}`, rows: [r.row], ...base,
      qty_per_unit: qtyPerUnit,
      variant_bound: values.length > 0, qty_by_variant: values.length > 0 ? byVariant : null,
    });
  }
  for (const g of groups.values()) g.qty_per_unit = mean(Object.values(g.qty_by_variant ?? {}));
  for (const g of groups.values()) {
    if (!(g.qty_per_unit > 0)) errors.push({ row: g.rows[0]!, message: `Row ${g.rows[0]}: every size of ${g.component_label} has quantity 0.` });
  }
  if (lines.length > SM_LIMITS.BOM_LINES_PER_PRODUCT) {
    errors.push({ row: 0, message: `The file has ${lines.length} lines; a product holds at most ${SM_LIMITS.BOM_LINES_PER_PRODUCT}.` });
  }
  return { ok: true, lines, ignoredColumns, errors };
}
