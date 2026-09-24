import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { PinEditor } from '../pin-editor';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('PinEditor', () => {
  it("pins a supplier and SKU from the class's publishers with a share, showing the total", async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      text: async () => JSON.stringify({
        class_id: 'cpt_flat_laces',
        suppliers: [
          { participant_id: VOMERO_IDS.bowline, legal_name: 'Bowline Cordage', country: 'PT', skus: [{ supplier_sku: 'BW-LACE-137', class_id: 'cpt_flat_laces', class_depth: 0 }] },
          { participant_id: VOMERO_IDS.aglet, legal_name: 'Aglet & Cord', country: 'IN', skus: [{ supplier_sku: 'AC-FLAT-137', class_id: 'cpt_flat_laces', class_depth: 0 }, { supplier_sku: 'AC-FLAT-120', class_id: 'cpt_flat_laces', class_depth: 0 }] },
        ],
      }),
    });
    const onChange = vi.fn();
    render(<PinEditor classId="cpt_flat_laces" pins={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add supplier' }));
    fireEvent.change(await screen.findByLabelText('Supplier'), { target: { value: VOMERO_IDS.aglet } });
    fireEvent.change(screen.getByLabelText('Supplier SKU'), { target: { value: 'AC-FLAT-120' } });
    fireEvent.change(screen.getByLabelText('Share %'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/account/sourcing-map/class-suppliers?class_id=cpt_flat_laces');
    expect(onChange).toHaveBeenCalledWith([{ supplier_participant_id: VOMERO_IDS.aglet, supplier_sku: 'AC-FLAT-120', share_pct: 40 }]);
  });
});
