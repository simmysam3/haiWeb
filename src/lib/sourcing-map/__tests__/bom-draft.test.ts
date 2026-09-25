import { describe, it, expect } from 'vitest';
import { vomeroWorkbenchDetail } from '../__fixtures__/vomero';
import { newDraftLine, pinShareTotal, lineProblems } from '../bom-draft';

describe('BOM draft', () => {
  it('names each problem that blocks saving a line', () => {
    const axis = vomeroWorkbenchDetail.variant_axis;
    const line = { ...newDraftLine(), component_label: ' ', qty_per_unit: 0 };
    expect(lineProblems(line, axis)).toEqual(['Component is required.', 'Qty per unit must be more than 0.']);
    const pinned = {
      ...newDraftLine(), component_label: 'Eyelet',
      pins: [
        { supplier_participant_id: '5a1e0000-0000-4000-8000-000000000105', supplier_sku: 'A', share_pct: 60 },
        { supplier_participant_id: '5a1e0000-0000-4000-8000-000000000106', supplier_sku: 'B', share_pct: 45 },
      ],
    };
    expect(lineProblems(pinned, axis)).toEqual(['Supplier shares total 105%; they may total at most 100%.']);
    const sized = { ...newDraftLine(), component_label: 'Outsole', variant_bound: true, qty_by_variant: { '9': 1, '14': 1 } };
    expect(lineProblems(sized, axis)).toEqual(['Sizes not on the product: 14.']);
    expect(lineProblems(sized, null)).toEqual(['Size-bound needs a variant axis on the product.']);
    const thirds = ['A', 'B', 'C'].map((s) => ({ supplier_participant_id: '5a1e0000-0000-4000-8000-000000000105', supplier_sku: s, share_pct: 33.33 }));
    expect(pinShareTotal(thirds)).toBe(99.99);
  });
});
