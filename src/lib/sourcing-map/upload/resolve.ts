// src/lib/sourcing-map/upload/resolve.ts
import { SmBomLineInputSchema, type SmBomLineInput, type SupplierMatch } from '../contract';
import type { RowError, UploadedBomLine } from './bom-rows';
import { TARGET_LABELS } from './header-map';

export interface ResolvedLine extends UploadedBomLine {
  class_id: string | null;
  class_label: string | null;
  pin: { supplier_participant_id: string; supplier_sku: string; share_pct: number } | null;
  note: string | null;
}

/**
 * Spec §7.3 step 3: an exact or high supplier match becomes a pin when its SKU
 * is known; a name that is not on the network, not a trading partner,
 * ambiguous or weak leaves the line unpinned with a note (AC 7).
 */
export function resolveLine(
  line: UploadedBomLine,
  picked: { class_id: string; label: string } | null,
  match: SupplierMatch | null,
  sku: string | null,
): ResolvedLine {
  const base = { ...line, class_id: picked?.class_id ?? null, class_label: picked?.label ?? null };
  if (!line.supplier_name) return { ...base, pin: null, note: null };
  const name = line.supplier_name;
  if (!match || match.match === null) {
    const why =
      match?.note === 'not_a_trading_partner' ? 'is not a trading partner'
      : match?.note === 'ambiguous' ? 'matches more than one trading partner'
      : 'is not on the network';
    return { ...base, pin: null, note: `Supplier '${name}' ${why}` };
  }
  if (match.match.confidence === 'low') {
    return { ...base, pin: null, note: `Supplier '${name}' matched ${match.match.legal_name} only weakly; not pinned` };
  }
  if (!sku) return { ...base, pin: null, note: `Supplier '${name}' has no SKU picked in this class; not pinned` };
  return {
    ...base,
    pin: { supplier_participant_id: match.match.participant_id, supplier_sku: sku, share_pct: line.share_pct ?? 100 },
    note: null,
  };
}

/** The PUT bom-lines row for a resolved upload line (origin 'uploaded'). */
export function toUploadInput(l: ResolvedLine): SmBomLineInput {
  return {
    component_label: l.component_label, part_ref: l.part_ref, class_id: l.class_id, uom: l.uom,
    qty_per_unit: l.qty_per_unit, variant_bound: l.variant_bound, qty_by_variant: l.qty_by_variant,
    pins: l.pin ? [l.pin] : [], origin: 'uploaded', note: l.note,
  };
}

/** The Map step's name for the column a PUT field came from (header-map.ts TARGET_LABELS), so an error names it as mapped. */
const FIELD_TARGET: Record<string, string> = {
  component_label: 'component', part_ref: 'part_ref', class_id: 'class', uom: 'uom', qty_per_unit: 'qty_per_unit',
};

/**
 * A5-I1 (spec §7.3 step 4: "nothing is saved until Review passes", with source row numbers): each line as the PUT
 * would send it, checked against the PUT's own schema, so a line haiCore would refuse is a row error on Review, named
 * by its first source row. The limits are the schema's (each issue's `maximum`), never retyped.
 */
export function uploadRowErrors(lines: ResolvedLine[]): RowError[] {
  return lines.flatMap((l) => {
    const out = SmBomLineInputSchema.safeParse(toUploadInput(l));
    if (out.success) return [];
    const row = l.rows[0] ?? 0;
    return out.error.issues.map((issue) => {
      const label = TARGET_LABELS[FIELD_TARGET[String(issue.path[0])] ?? ''] ?? String(issue.path[0]);
      const what = issue.code === 'too_big' && issue.type === 'string' ? `is longer than ${issue.maximum} characters.` : issue.message;
      return { row, message: `Row ${row}: ${label} ${what}` };
    });
  });
}

