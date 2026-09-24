import { normalizeHeader } from '@/lib/scope-import/parse-workbook';
import { matchVariantHeader } from './cells';

export type UploadKind = 'bom' | 'demand';

export const BOM_TARGETS = [
  'component', 'qty_per_unit', 'uom', 'part_ref', 'class', 'supplier', 'supplier_sku', 'share', 'level_make',
  'variant', 'variant_qty', 'ignore',
] as const;
export type BomTarget = (typeof BOM_TARGETS)[number];

export const DEMAND_TARGETS = ['due_date', 'quantity', 'variant', 'product', 'variant_qty', 'ignore'] as const;
export type DemandTarget = (typeof DEMAND_TARGETS)[number];

export const TARGET_LABELS: Record<string, string> = {
  component: 'Component', qty_per_unit: 'Qty per unit', uom: 'Unit of measure', part_ref: 'Part reference',
  class: 'Class', supplier: 'Supplier', supplier_sku: 'Supplier SKU', share: 'Share',
  level_make: 'Level / make (make lines are rejected)', variant: 'Size (long layout)',
  variant_qty: 'Per-size quantity (wide layout)', due_date: 'Due date', quantity: 'Quantity', product: 'Product', ignore: 'Ignore',
};

/** Spec §7.3 BOM targets. Exact normalized-header match, the parse-workbook pattern (:39-61). */
export const BOM_SYNONYMS: Record<string, string[]> = {
  component: ['component', 'component name', 'component description', 'description', 'material description', 'item description', 'part description', 'part name', 'material', 'item'],
  qty_per_unit: ['qty per unit', 'quantity per unit', 'qty/unit', 'qty per', 'qty per pair', 'usage', 'usage qty', 'consumption', 'qty', 'quantity'],
  uom: ['uom', 'unit of measure', 'unit', 'units', 'u/m', 'um'],
  part_ref: ['part ref', 'part reference', 'part number', 'part no', 'part no.', 'part #', "mat'l #", 'material number', 'material #', 'item number', 'sku', 'mpn'],
  class: ['class', 'category', 'commodity', 'commodity class', 'material class'],
  supplier: ['supplier', 'supplier name', 'vendor', 'vendor name', 'manufacturer'],
  supplier_sku: ['supplier sku', 'vendor sku', 'supplier part', 'supplier part number', 'vendor part', 'vendor part number'],
  share: ['share', 'share %', 'allocation', 'allocation %', 'split', 'split %'],
  level_make: ['level', 'bom level', 'make/buy', 'make or buy', 'procurement type', 'm/b', 'source'],
  variant: ['size', 'variant', 'us size', 'size us'],
};

/** Spec §7.3 demand targets. */
export const DEMAND_SYNONYMS: Record<string, string[]> = {
  due_date: ['due date', 'due', 'delivery date', 'ship date', 'drop date', 'need date', 'date'],
  quantity: ['quantity', 'qty', 'pairs', 'units', 'volume', 'total'],
  variant: ['size', 'variant', 'us size', 'size us'],
  product: ['product', 'product name', 'style', 'model'],
};

/** One target per column, left to right; size headers become per-size quantity. */
export function autoMap(kind: UploadKind, headers: string[], variantValues: string[]): string[] {
  const synonyms = kind === 'bom' ? BOM_SYNONYMS : DEMAND_SYNONYMS;
  return headers.map((h) => {
    const n = normalizeHeader(h);
    for (const [target, list] of Object.entries(synonyms)) {
      if (list.includes(n)) return target;
    }
    if (matchVariantHeader(h, variantValues) !== null) return 'variant_qty';
    return 'ignore';
  });
}
