import { describe, it, expect } from 'vitest';
import { buildBomLines } from '../bom-rows';
import { MENS_US_7_13 } from '../../__fixtures__/vomero';

describe('buildBomLines', () => {
  it('wide layout: maps "9.0", "9,5" and "10" to their sizes and lists a size column that matches none', () => {
    const out = buildBomLines({
      headers: ['Description', 'UOM', '9.0', '9,5', '10', '14'],
      mapping: ['component', 'uom', 'variant_qty', 'variant_qty', 'variant_qty', 'variant_qty'],
      rows: [{ row: 2, cells: ['Upper leather', 'sq ft', '0.27', '0.28', '0.29', '0.3'] }],
      variantValues: MENS_US_7_13,
      decimalComma: false,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.ignoredColumns).toEqual(['14']);
    expect(out.errors).toEqual([]);
    expect(out.lines).toEqual([
      {
        key: 'row-2', rows: [2], component_label: 'Upper leather', part_ref: null, class_text: null, uom: 'sq ft',
        qty_per_unit: 0.28, variant_bound: true, qty_by_variant: { '9': 0.27, '9.5': 0.28, '10': 0.29 },
        supplier_name: null, supplier_sku: null, share_pct: null,
      },
    ]);
  });

  it('long layout: groups one row per size into one size-bound line', () => {
    const out = buildBomLines({
      headers: ['Component', 'Size', 'Qty', 'UOM'],
      mapping: ['component', 'variant', 'qty_per_unit', 'uom'],
      rows: [
        { row: 2, cells: ['Rubber outsole', '9', '1', 'pr'] },
        { row: 3, cells: ['Rubber outsole', '9.5', '1', 'pr'] },
        { row: 4, cells: ['Rubber outsole', '10.0', '1.1', 'pr'] },
      ],
      variantValues: MENS_US_7_13,
      decimalComma: false,
    });
    expect(out.ok && out.lines).toEqual([
      {
        key: 'rows-2', rows: [2, 3, 4], component_label: 'Rubber outsole', part_ref: null, class_text: null, uom: 'pr',
        qty_per_unit: 1.033333, variant_bound: true, qty_by_variant: { '9': 1, '9.5': 1, '10': 1.1 },
        supplier_name: null, supplier_sku: null, share_pct: null,
      },
    ]);
  });

  it('rejects make and sub-assembly rows by number and flattens nothing (spec §6.2, AC 5)', () => {
    const out = buildBomLines({
      headers: ['Level', 'Component', 'Qty', 'Make/Buy'],
      mapping: ['level_make', 'component', 'qty_per_unit', 'ignore'],
      rows: [
        { row: 2, cells: ['1', 'Upper', '1', 'Buy'] },
        { row: 3, cells: ['2', 'Upper lining', '1', 'Buy'] },
        { row: 4, cells: ['..3', 'Foam', '1', 'Buy'] },
        { row: 5, cells: ['Make', 'Sockliner', '1', 'Make'] },
      ],
      variantValues: [],
      decimalComma: false,
    });
    expect(out).toEqual({
      ok: false,
      rows: [3, 4, 5],
      rejection: 'Rows 3, 4, 5 are make or sub-assembly lines. Only single-level purchased lines can be uploaded; nothing was flattened.',
    });
  });

  it('names mapping problems (row 0) and each bad row by its source row number', () => {
    const noComponent = buildBomLines({ headers: ['Qty'], mapping: ['qty_per_unit'], rows: [{ row: 2, cells: ['1'] }], variantValues: [], decimalComma: false });
    expect(noComponent.ok && noComponent.errors).toEqual([{ row: 0, message: 'Map a column to Component.' }]);
    const bad = buildBomLines({
      headers: ['Component', 'Qty', 'Share'],
      mapping: ['component', 'qty_per_unit', 'share'],
      rows: [
        { row: 2, cells: ['Eyelet', '12', '60'] },
        { row: 3, cells: ['Lace', 'two', ''] },
        { row: 4, cells: ['', '1', ''] },
        { row: 5, cells: ['Foam', '1', '150'] },
      ],
      variantValues: [],
      decimalComma: false,
    });
    expect(bad.ok && bad.errors).toEqual([
      { row: 3, message: "Row 3: 'two' is not a quantity per unit." },
      { row: 4, message: 'Row 4: Component is empty.' },
      { row: 5, message: "Row 5: '150' is not a share between 0 and 100." },
    ]);
    expect(bad.ok && bad.lines.map((l) => l.component_label)).toEqual(['Eyelet']);
  });

  it('a bad per-size cell in a wide BOM is a row error, never silently dropped (Review Focus 2)', () => {
    const out = buildBomLines({
      headers: ['Component', '9', '9.5'],
      mapping: ['component', 'variant_qty', 'variant_qty'],
      rows: [
        { row: 2, cells: ['Foam', 'x', '0.3'] },
        { row: 3, cells: ['Trim', '0.2', '-1'] },
      ],
      variantValues: MENS_US_7_13,
      decimalComma: false,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.errors).toEqual([
      { row: 2, message: "Row 2: 'x' under size 9 is not a quantity." },
      { row: 3, message: "Row 3: '-1' under size 9.5 is not a quantity." },
    ]);
    expect(out.lines.map((l) => l.qty_by_variant)).toEqual([{ '9.5': 0.3 }, { '9': 0.2 }]);
  });
});
