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
});
