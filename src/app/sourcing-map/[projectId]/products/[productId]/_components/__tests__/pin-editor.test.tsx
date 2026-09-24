import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { BomLinePin } from '@/lib/sourcing-map/contract';
import { PinEditor } from '../pin-editor';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

/** class-suppliers for cpt_flat_laces: Bowline with one SKU, Aglet & Cord with two. */
function lacesSuppliers() {
  return {
    ok: true, status: 200,
    text: async () => JSON.stringify({
      class_id: 'cpt_flat_laces',
      suppliers: [
        { participant_id: VOMERO_IDS.bowline, legal_name: 'Bowline Cordage', country: 'PT', skus: [{ supplier_sku: 'BW-LACE-137', class_id: 'cpt_flat_laces', class_depth: 0 }] },
        { participant_id: VOMERO_IDS.aglet, legal_name: 'Aglet & Cord', country: 'IN', skus: [{ supplier_sku: 'AC-FLAT-137', class_id: 'cpt_flat_laces', class_depth: 0 }, { supplier_sku: 'AC-FLAT-120', class_id: 'cpt_flat_laces', class_depth: 0 }] },
      ],
    }),
  };
}

/** The editor inside a parent that keeps the pins, as the grid does. */
function Harness({ initial }: { initial: BomLinePin[] }) {
  const [pins, setPins] = useState(initial);
  return <PinEditor classId="cpt_flat_laces" pins={pins} onChange={setPins} />;
}

async function openAndChoose(supplierId: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Add supplier' }));
  await screen.findByRole('option', { name: 'Aglet & Cord' });
  fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: supplierId } });
}

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

  it('Cancel closes a picker whose supplier load failed and clears its error; reopening loads afresh with no stale error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 502,
      text: async () => JSON.stringify({ error: { code: 'upstream_error', message: 'The supplier list could not be loaded.' } }),
    });
    render(<PinEditor classId="cpt_flat_laces" pins={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add supplier' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The supplier list could not be loaded.');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Supplier')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    fetchMock.mockResolvedValueOnce({
      ok: true, status: 200,
      text: async () => JSON.stringify({
        class_id: 'cpt_flat_laces',
        suppliers: [{ participant_id: VOMERO_IDS.bowline, legal_name: 'Bowline Cordage', country: 'PT', skus: [{ supplier_sku: 'BW-LACE-137', class_id: 'cpt_flat_laces', class_depth: 0 }] }],
      }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add supplier' }));
    expect(await screen.findByRole('option', { name: 'Bowline Cordage' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('never offers a supplier SKU the line already pins, stored or just added, so no duplicate pin reaches the PUT', async () => {
    fetchMock.mockResolvedValue(lacesSuppliers());
    render(<Harness initial={[{ supplier_participant_id: VOMERO_IDS.aglet, supplier_sku: 'AC-FLAT-120', share_pct: 40 }]} />);
    await openAndChoose(VOMERO_IDS.aglet);
    expect(screen.queryByRole('option', { name: 'AC-FLAT-120' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Supplier SKU'), { target: { value: 'AC-FLAT-137' } });
    fireEvent.change(screen.getByLabelText('Share %'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
    expect(screen.getByText('Aglet & Cord · AC-FLAT-137 · 30%')).toBeInTheDocument();
    await openAndChoose(VOMERO_IDS.aglet);
    expect(screen.queryByRole('option', { name: 'AC-FLAT-120' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'AC-FLAT-137' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: VOMERO_IDS.bowline } });
    expect(screen.getByRole('option', { name: 'BW-LACE-137' })).toBeInTheDocument();
  });

  it('drops a cancelled load’s late answer, and a reopened picker shows only its own load: no stale alert, no stale suppliers', async () => {
    const failed = {
      ok: false, status: 502,
      text: async () => JSON.stringify({ error: { code: 'upstream_error', message: 'The supplier list could not be loaded.' } }),
    };
    let answerFirst: (r: unknown) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { answerFirst = resolve; }));
    render(<PinEditor classId="cpt_flat_laces" pins={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add supplier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => answerFirst(failed));
    // Reopened: its own load answers 200, and the cancelled session's late 502 leaves no alert.
    fetchMock.mockResolvedValueOnce(lacesSuppliers());
    fireEvent.click(screen.getByRole('button', { name: 'Add supplier' }));
    expect(await screen.findByRole('option', { name: 'Bowline Cordage' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    // Reopened again: this load fails, so it shows its own failure and none of the last session's suppliers.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fetchMock.mockResolvedValueOnce(failed);
    fireEvent.click(screen.getByRole('button', { name: 'Add supplier' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The supplier list could not be loaded.');
    expect(screen.queryByRole('option', { name: 'Bowline Cordage' })).toBeNull();
  });

  it('moves keyboard focus with the form: into Supplier on open, back to Add supplier after Cancel or Pin, and to the next Remove, else Add supplier, as pins go (WCAG 2.4.3)', async () => {
    /** A keyboard user's activation: focus the control, then press it. */
    const press = (el: HTMLElement) => {
      el.focus();
      fireEvent.click(el);
    };
    fetchMock.mockResolvedValue(lacesSuppliers());
    render(<Harness initial={[]} />);
    press(screen.getByRole('button', { name: 'Add supplier' }));
    expect(document.activeElement).toBe(screen.getByLabelText('Supplier'));
    await screen.findByRole('option', { name: 'Aglet & Cord' });
    press(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add supplier' }));
    for (const sku of ['AC-FLAT-137', 'AC-FLAT-120']) {
      press(screen.getByRole('button', { name: 'Add supplier' }));
      await screen.findByRole('option', { name: 'Aglet & Cord' });
      fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: VOMERO_IDS.aglet } });
      fireEvent.change(screen.getByLabelText('Supplier SKU'), { target: { value: sku } });
      fireEvent.change(screen.getByLabelText('Share %'), { target: { value: '30' } });
      press(screen.getByRole('button', { name: 'Pin' }));
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add supplier' }));
    }
    press(screen.getByRole('button', { name: 'Remove AC-FLAT-137' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove AC-FLAT-120' }));
    press(screen.getByRole('button', { name: 'Remove AC-FLAT-120' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add supplier' }));
  });
});
