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
});
