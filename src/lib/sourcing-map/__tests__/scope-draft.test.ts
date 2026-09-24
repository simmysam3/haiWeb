import { describe, it, expect } from 'vitest';
import { addProduct, applyUploadedDemand, defaultDemand } from '../scope-draft';
import { SM_LIMITS, type SourcingMapScope } from '../contract';
import { vomeroProducts, vomeroRunTemplate, VOMERO_IDS } from '../__fixtures__/vomero';

const EMPTY: SourcingMapScope = { kind: 'sourcing_map', project_id: VOMERO_IDS.project, products: [], depth_cap: 5, seat_weekly_capacity: null };

describe('scope draft', () => {
  it('turns an uploaded schedule into drops, a product mix from the pairs, and overrides only where a drop differs', () => {
    const s: SourcingMapScope = { ...EMPTY, products: vomeroRunTemplate.scope.products.slice(0, 2) };
    const out = applyUploadedDemand(s, {
      perProduct: [
        {
          product_id: VOMERO_IDS.pegasus,
          drops: [
            { due_date: '2027-01-15', qty: 300, pairs: { '9': 100, '10': 200 } },
            { due_date: '2027-02-15', qty: 600, pairs: { '9': 200, '10': 400 } },
            { due_date: '2027-03-15', qty: 300, pairs: { '9': 300 } },
          ],
        },
      ],
      errors: [],
      ignoredColumns: [],
    }, vomeroProducts);
    const pegasus = out.products[0]!.demand;
    expect(pegasus.generator).toBeNull();
    expect(pegasus.drops.map((d) => [d.due_date, d.qty])).toEqual([['2027-01-15', 300], ['2027-02-15', 600], ['2027-03-15', 300]]);
    expect(pegasus.mix!['9']).toBe(50);
    expect(pegasus.mix!['10']).toBe(50);
    expect(pegasus.drops[0]!.mix_override!['10']).toBe(66.67);
    expect(pegasus.drops[2]!.mix_override!['9']).toBe(100);
    expect(out.products[1]).toEqual(s.products[1]);
  });

  it('caps a run at 25 products and adds a product only once (ruling 7)', () => {
    const full = { ...EMPTY, products: Array.from({ length: SM_LIMITS.PRODUCTS_PER_RUN }, (_, i) => ({ product_id: `5a1e0000-0000-4000-8000-0000000003${String(i).padStart(2, '0')}`, demand: defaultDemand(null, '2027-01-15') })) };
    expect(addProduct(full, vomeroProducts[0]!, '2027-01-15')).toEqual(full);
    const one = addProduct(EMPTY, vomeroProducts[0]!, '2027-01-15');
    expect(addProduct(one, vomeroProducts[0]!, '2027-01-15')).toEqual(one);
  });
});
