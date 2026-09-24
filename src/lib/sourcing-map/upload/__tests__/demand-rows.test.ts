import { describe, it, expect } from 'vitest';
import { buildDemand } from '../demand-rows';
import { MENS_US_7_13, VOMERO_IDS } from '../../__fixtures__/vomero';

const PRODUCTS = [
  { product_id: VOMERO_IDS.pegasus, name: 'Pegasus Trail', variant_values: MENS_US_7_13 },
  { product_id: VOMERO_IDS.court, name: 'Court Classic', variant_values: MENS_US_7_13 },
];

describe('buildDemand', () => {
  it('long layout: reads Excel serial and US dates, matches products by name, and sums pairs per drop', () => {
    const out = buildDemand({
      headers: ['Style', 'Due', 'Size', 'Pairs'],
      mapping: ['product', 'due_date', 'variant', 'quantity'],
      rows: [
        { row: 2, cells: ['Pegasus Trail', '46402', '9', '300'] },
        { row: 3, cells: ['Pegasus Trail', '1/15/2027', '9.5', '320'] },
        { row: 4, cells: ['court classic', '3/15/27', '10.0', '200'] },
      ],
      products: PRODUCTS,
      decimalComma: false,
    });
    expect(out.errors).toEqual([]);
    expect(out.perProduct).toEqual([
      { product_id: VOMERO_IDS.pegasus, drops: [{ due_date: '2027-01-15', qty: 620, pairs: { '9': 300, '9.5': 320 } }] },
      { product_id: VOMERO_IDS.court, drops: [{ due_date: '2027-03-15', qty: 200, pairs: { '10': 200 } }] },
    ]);
  });

  it('wide layout for a single product needs no product column, and lists a size column that matches none', () => {
    const out = buildDemand({
      headers: ['Due date', '9', '9.5', '14'],
      mapping: ['due_date', 'variant_qty', 'variant_qty', 'variant_qty'],
      rows: [{ row: 2, cells: ['2027-01-15', '300', '320', '5'] }],
      products: [PRODUCTS[0]!],
      decimalComma: false,
    });
    expect(out.ignoredColumns).toEqual(['14']);
    expect(out.perProduct).toEqual([
      { product_id: VOMERO_IDS.pegasus, drops: [{ due_date: '2027-01-15', qty: 620, pairs: { '9': 300, '9.5': 320 } }] },
    ]);
  });

  it('asks for a Product column in a multi-product run, and refuses more than 52 drops per product', () => {
    const noProduct = buildDemand({ headers: ['Due', 'Qty'], mapping: ['due_date', 'quantity'], rows: [{ row: 2, cells: ['2027-01-15', '5'] }], products: PRODUCTS, decimalComma: false });
    expect(noProduct.errors).toEqual([{ row: 0, message: 'Map a Product column; this run has 2 products.' }]);
    const rows = Array.from({ length: 53 }, (_, i) => ({
      row: i + 2,
      cells: [new Date(Date.UTC(2027, 0, 4 + 7 * i)).toISOString().slice(0, 10), '100'],
    }));
    const tooMany = buildDemand({ headers: ['Due', 'Qty'], mapping: ['due_date', 'quantity'], rows, products: [PRODUCTS[0]!], decimalComma: false });
    expect(tooMany.errors).toEqual([{ row: 0, message: 'Pegasus Trail has 53 drops; a product takes at most 52.' }]);
    // totals-only: no sizes, so no pairs; the mix comes from the curve (Task 34)
    expect(tooMany.perProduct[0]!.drops[0]).toEqual({ due_date: '2027-01-04', qty: 100, pairs: null });
  });
});
