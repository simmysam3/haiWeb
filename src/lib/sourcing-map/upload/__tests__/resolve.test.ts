// src/lib/sourcing-map/upload/__tests__/resolve.test.ts
import { describe, it, expect } from 'vitest';
import { resolveLine, toUploadInput, uploadRowErrors } from '../resolve';
import { ReplaceBomLinesRequestSchema, SmBomLineInputSchema } from '../../contract';
import type { UploadedBomLine } from '../bom-rows';
import { VOMERO_IDS } from '../../__fixtures__/vomero';

const LINE: UploadedBomLine = {
  key: 'row-2', rows: [2], component_label: 'Upper leather tumbled', part_ref: 'LTH-4471', class_text: null, uom: 'sq ft',
  qty_per_unit: 0.25, variant_bound: false, qty_by_variant: null, supplier_name: 'Leon Cuero SA', supplier_sku: null, share_pct: 60,
};
const PICK = { class_id: 'cpt_full_grain_leather_hides', label: 'Full grain leather hides' };
const EXACT = { name: 'Leon Cuero SA', match: { participant_id: VOMERO_IDS.leon, legal_name: 'León Cuero', confidence: 'exact' as const }, note: null };

describe('resolveLine (spec §7.3 step 3)', () => {
  it('pins an exact or high match with its SKU, and leaves every other outcome unpinned with a note', () => {
    expect(resolveLine(LINE, PICK, EXACT, 'LC-BOV-UP-01').pin).toEqual({ supplier_participant_id: VOMERO_IDS.leon, supplier_sku: 'LC-BOV-UP-01', share_pct: 60 });
    expect(resolveLine({ ...LINE, share_pct: null }, PICK, EXACT, 'LC-BOV-UP-01').pin?.share_pct).toBe(100);
    expect(resolveLine(LINE, PICK, EXACT, null)).toMatchObject({ pin: null, note: "Supplier 'Leon Cuero SA' has no SKU picked in this class; not pinned" });
    const kwang = { ...LINE, supplier_name: 'Kwang Il' };
    expect(resolveLine(kwang, null, { name: 'Kwang Il', match: null, note: 'not_a_trading_partner' }, null)).toMatchObject({ pin: null, note: "Supplier 'Kwang Il' is not a trading partner" });
    expect(resolveLine(kwang, null, { name: 'Kwang Il', match: null, note: 'not_on_network' }, null).note).toBe("Supplier 'Kwang Il' is not on the network");
    expect(resolveLine(kwang, null, { name: 'Kwang Il', match: null, note: 'ambiguous' }, null).note).toBe("Supplier 'Kwang Il' matches more than one trading partner");
    const weak = { name: 'Leon Cuero SA', match: { ...EXACT.match, confidence: 'low' as const }, note: null };
    expect(resolveLine(LINE, PICK, weak, 'LC-BOV-UP-01')).toMatchObject({ pin: null, note: "Supplier 'Leon Cuero SA' matched León Cuero only weakly; not pinned" });
    expect(resolveLine({ ...LINE, supplier_name: null }, PICK, null, null)).toMatchObject({ class_id: PICK.class_id, pin: null, note: null });
    expect(toUploadInput(resolveLine(LINE, PICK, EXACT, 'LC-BOV-UP-01'))).toEqual({
      component_label: 'Upper leather tumbled', part_ref: 'LTH-4471', class_id: 'cpt_full_grain_leather_hides', uom: 'sq ft',
      qty_per_unit: 0.25, variant_bound: false, qty_by_variant: null,
      pins: [{ supplier_participant_id: VOMERO_IDS.leon, supplier_sku: 'LC-BOV-UP-01', share_pct: 60 }], origin: 'uploaded', note: null,
    });
  });
});

/** Limits read from the PUT's own schema, never retyped. */
const FIELDS = SmBomLineInputSchema.innerType().shape;

describe('uploadRowErrors (A5-I1: Review passes only lines the PUT takes, spec §7.3 step 4)', () => {
  it('names the source row of a line whose UoM is longer than the schema allows', () => {
    const max = FIELDS.uom.maxLength!;
    const long = resolveLine({ ...LINE, rows: [7], uom: 'u'.repeat(max + 1) }, PICK, null, null);
    expect(uploadRowErrors([resolveLine(LINE, PICK, null, null), long])).toEqual([
      { row: 7, message: `Row 7: Unit of measure is longer than ${max} characters.` },
    ]);
  });

  it('names the source row of a line whose Component is longer than the schema allows (a long-layout line: its first row)', () => {
    const max = FIELDS.component_label.maxLength!;
    const long = resolveLine({ ...LINE, rows: [4, 5, 6], component_label: 'c'.repeat(max + 1) }, PICK, null, null);
    expect(uploadRowErrors([long])).toEqual([{ row: 4, message: `Row 4: Component is longer than ${max} characters.` }]);
  });

  it('refuses more lines than the PUT takes, as a file-level error (row 0) with the schema\'s limit', () => {
    const max = ReplaceBomLinesRequestSchema.shape.lines._def.maxLength!.value;
    const lines = Array.from({ length: max + 1 }, (_, i) => resolveLine({ ...LINE, key: `row-${i + 2}`, rows: [i + 2] }, PICK, null, null));
    expect(uploadRowErrors(lines)).toEqual([{ row: 0, message: `The file has ${max + 1} lines; a product holds at most ${max}.` }]);
    expect(uploadRowErrors(lines.slice(0, max))).toEqual([]);
  });
});

