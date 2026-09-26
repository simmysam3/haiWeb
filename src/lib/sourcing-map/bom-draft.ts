import type { BomLinePin, SmBomLine, SmBomLineInput, SmProductDetail, VariantAxis } from '@haiwave/protocol';

/** A grid row: the PUT shape plus a stable key and the class label shown in the picker. */
export interface BomDraftLine extends SmBomLineInput {
  key: string;
  class_label: string | null;
}

let seq = 0;
export function newDraftLine(): BomDraftLine {
  seq += 1;
  return {
    key: `new-${seq}`, class_label: null, component_label: '', part_ref: null, class_id: null, uom: 'ea',
    qty_per_unit: 1, variant_bound: false, qty_by_variant: null, pins: [], origin: 'authored', note: null,
  };
}

export function pinShareTotal(pins: BomLinePin[]): number {
  return Math.round(pins.reduce((a, p) => a + p.share_pct, 0) * 100) / 100;
}

export function lineProblems(line: BomDraftLine, axis: VariantAxis | null): string[] {
  const out: string[] = [];
  if (line.component_label.trim() === '') out.push('Component is required.');
  if (!(line.qty_per_unit > 0)) out.push('Qty per unit must be more than 0.');
  if (line.uom.trim() === '') out.push('UoM is required.');
  const total = pinShareTotal(line.pins);
  if (total > 100) out.push(`Supplier shares total ${total}%; they may total at most 100%.`);
  if (line.variant_bound && !axis) out.push('Size-bound needs a variant axis on the product.');
  if (line.variant_bound && axis && line.qty_by_variant) {
    const unknown = Object.keys(line.qty_by_variant).filter((k) => !axis.values.includes(k));
    if (unknown.length > 0) out.push(`Sizes not on the product: ${unknown.join(', ')}.`);
  }
  return out;
}

/** d-G5: the detail's `classes` label each line (a dangling slug is served as its own label). */
export function toDraft(lines: SmBomLine[], classes: SmProductDetail['classes']): BomDraftLine[] {
  return lines.map((l) => ({
    key: l.line_id,
    class_label: l.class_id ? classes[l.class_id]?.label ?? l.class_id : null,
    component_label: l.component_label, part_ref: l.part_ref, class_id: l.class_id, uom: l.uom,
    qty_per_unit: l.qty_per_unit, variant_bound: l.variant_bound, qty_by_variant: l.qty_by_variant,
    pins: l.pins, origin: l.origin, note: l.note,
  }));
}

export function toInput(lines: BomDraftLine[]): SmBomLineInput[] {
  return lines.map((l) => ({
    component_label: l.component_label.trim(), part_ref: l.part_ref, class_id: l.class_id, uom: l.uom.trim(),
    qty_per_unit: l.qty_per_unit, variant_bound: l.variant_bound, qty_by_variant: l.variant_bound ? l.qty_by_variant : null,
    pins: l.pins, origin: l.origin, note: l.note,
  }));
}
