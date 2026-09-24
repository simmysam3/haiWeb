import { matchVariantHeader, parseQty, parseShare } from './cells';

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

/** Mapped rows → uploaded BOM lines (spec §7.3 step 2). */
export function buildBomLines(input: BomBuildInput): BomBuild {
  const { rows, headers, mapping, variantValues, decimalComma } = input;
  const col = (t: string) => mapping.indexOf(t);
  const cell = (cells: string[], t: string) => {
    const i = col(t);
    return i < 0 ? '' : (cells[i] ?? '').trim();
  };
  const errors: RowError[] = [];
  const wide = mapping.flatMap((t, i) => (t === 'variant_qty' ? [{ i, variant: matchVariantHeader(headers[i] ?? '', variantValues) }] : []));
  const ignoredColumns = wide.filter((w) => w.variant === null).map((w) => (headers[w.i] ?? '').trim());
  const sized = wide.filter((w): w is { i: number; variant: string } => w.variant !== null);

  const lines: UploadedBomLine[] = [];
  for (const r of rows) {
    const component = cell(r.cells, 'component');
    const byVariant: Record<string, number> = {};
    for (const w of sized) {
      const t = (r.cells[w.i] ?? '').trim();
      if (t === '') continue;
      const q = parseQty(t, decimalComma);
      if (q !== null && q >= 0) byVariant[w.variant] = q;
    }
    const values = Object.values(byVariant);
    const uniformText = cell(r.cells, 'qty_per_unit');
    const uniform = uniformText === '' ? null : parseQty(uniformText, decimalComma);
    lines.push({
      key: `row-${r.row}`, rows: [r.row], component_label: component,
      part_ref: cell(r.cells, 'part_ref') || null, class_text: cell(r.cells, 'class') || null,
      uom: cell(r.cells, 'uom') || 'ea',
      qty_per_unit: uniform ?? (values.length > 0 ? mean(values) : 0),
      variant_bound: values.length > 0, qty_by_variant: values.length > 0 ? byVariant : null,
      supplier_name: cell(r.cells, 'supplier') || null, supplier_sku: cell(r.cells, 'supplier_sku') || null,
      share_pct: cell(r.cells, 'share') === '' ? null : parseShare(cell(r.cells, 'share')),
    });
  }
  return { ok: true, lines, ignoredColumns, errors };
}
