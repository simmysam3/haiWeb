import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { BomLinePin } from '@haiwave/protocol';
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
    expect(screen.getByText('Aglet & Cord · AC-FLAT-137')).toBeInTheDocument();
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

  it('says what its Remove acts on: each pinned supplier has a "Remove supplier" control on its own row, named for its SKU (owner, walk A3, 2026-09-29)', () => {
    render(<Harness initial={[
      { supplier_participant_id: VOMERO_IDS.aglet, supplier_sku: 'AC-FLAT-137', share_pct: 60 },
      { supplier_participant_id: VOMERO_IDS.bowline, supplier_sku: 'BW-LACE-137', share_pct: 40 },
    ]} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const remove = screen.getByRole('button', { name: 'Remove supplier AC-FLAT-137' });
    expect(remove).toHaveTextContent(/^Remove supplier$/);
    expect(rows[0]!.contains(remove)).toBe(true);
    // The supplier's text and its control share the row's first line, the control at the row's end.
    expect(rows[0]!.className).toContain('items-start');
    expect(rows[0]!.className).toContain('justify-between');
  });

  it("lets a pinned supplier's share be edited where it stands, so a total over 100% can be brought back without removing anyone (owner, walk A5, 2026-09-29)", () => {
    render(<Harness initial={[
      { supplier_participant_id: VOMERO_IDS.aglet, supplier_sku: 'AC-FLAT-137', share_pct: 100 },
      { supplier_participant_id: VOMERO_IDS.bowline, supplier_sku: 'BW-LACE-137', share_pct: 50 },
    ]} />);
    expect(screen.getByText('Total 150% · 50% over 100%')).toBeInTheDocument();
    const share = screen.getByRole('spinbutton', { name: 'Share % for AC-FLAT-137' });
    expect(share).toHaveValue(100);
    fireEvent.change(share, { target: { value: '50' } });
    expect(screen.getByRole('spinbutton', { name: 'Share % for AC-FLAT-137' })).toHaveValue(50);
    expect(screen.getByRole('spinbutton', { name: 'Share % for BW-LACE-137' })).toHaveValue(50);
    expect(screen.getByText('Total 100%')).toBeInTheDocument();
    // Both suppliers are still pinned.
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('keeps the stored share while the field holds something that is no share (empty, 0, over 100), and shows it again when the field is left', () => {
    render(<Harness initial={[{ supplier_participant_id: VOMERO_IDS.aglet, supplier_sku: 'AC-FLAT-137', share_pct: 60 }]} />);
    const share = () => screen.getByRole('spinbutton', { name: 'Share % for AC-FLAT-137' });
    // Cleared, to type a new number: the field stays empty, the pin keeps its 60%.
    fireEvent.change(share(), { target: { value: '' } });
    expect(share()).toHaveValue(null);
    expect(screen.getByText('Total 60% · 40% unallocated')).toBeInTheDocument();
    for (const bad of ['0', '150', '-5']) {
      fireEvent.change(share(), { target: { value: bad } });
      expect(screen.getByText('Total 60% · 40% unallocated')).toBeInTheDocument();
    }
    fireEvent.blur(share());
    expect(share()).toHaveValue(60);
    // A share with a fraction is a share.
    fireEvent.change(share(), { target: { value: '33.5' } });
    expect(share()).toHaveValue(33.5);
    expect(screen.getByText('Total 33.5% · 66.5% unallocated')).toBeInTheDocument();
  });

  it('while the stale lock holds, a share is read-only and a change to it goes nowhere (stale-lock)', () => {
    const onChange = vi.fn();
    render(<PinEditor classId="cpt_flat_laces" pins={[{ supplier_participant_id: VOMERO_IDS.aglet, supplier_sku: 'AC-FLAT-137', share_pct: 60 }]} onChange={onChange} locked />);
    const share = screen.getByRole('spinbutton', { name: 'Share % for AC-FLAT-137' });
    expect(share).toHaveAttribute('readonly');
    fireEvent.change(share, { target: { value: '30' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(share).toHaveValue(60);
  });

  it('offers a new supplier the share that is still unallocated, and none when the line is fully allocated (owner, walk A5, 2026-09-29)', async () => {
    fetchMock.mockResolvedValue(lacesSuppliers());
    const open = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add supplier' }));
      await screen.findByRole('option', { name: 'Aglet & Cord' });
      return screen.getByRole('spinbutton', { name: 'Share %' });
    };
    // Nothing pinned: the whole line.
    const none = render(<Harness initial={[]} />);
    expect(await open()).toHaveValue(100);
    none.unmount();
    // 60% pinned: the 40% left.
    const some = render(<Harness initial={[{ supplier_participant_id: VOMERO_IDS.bowline, supplier_sku: 'BW-LACE-137', share_pct: 60 }]} />);
    expect(await open()).toHaveValue(40);
    // Pin it, then open again: nothing is left to offer, and an empty share cannot be pinned.
    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: VOMERO_IDS.aglet } });
    fireEvent.change(screen.getByLabelText('Supplier SKU'), { target: { value: 'AC-FLAT-137' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
    expect(screen.getByText('Total 100%')).toBeInTheDocument();
    const full = await open();
    expect(full).toHaveValue(null);
    fireEvent.change(screen.getByLabelText('Supplier'), { target: { value: VOMERO_IDS.aglet } });
    fireEvent.change(screen.getByLabelText('Supplier SKU'), { target: { value: 'AC-FLAT-120' } });
    expect(screen.getByRole('button', { name: 'Pin' })).toBeDisabled();
    some.unmount();
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
    press(screen.getByRole('button', { name: 'Remove supplier AC-FLAT-137' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove supplier AC-FLAT-120' }));
    press(screen.getByRole('button', { name: 'Remove supplier AC-FLAT-120' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add supplier' }));
  });

  it('once the stale lock lands on an open pin form, Pin adds nothing and Share % is read-only; Pin is never disabled (stale-lock, LW-a)', async () => {
    fetchMock.mockResolvedValue(lacesSuppliers());
    const onChange = vi.fn();
    const { rerender } = render(<PinEditor classId="cpt_flat_laces" pins={[]} onChange={onChange} />);
    await openAndChoose(VOMERO_IDS.aglet);
    fireEvent.change(screen.getByLabelText('Supplier SKU'), { target: { value: 'AC-FLAT-120' } });
    // A slow re-read fails now: the lock lands on a form ready to pin.
    rerender(<PinEditor classId="cpt_flat_laces" pins={[]} onChange={onChange} locked />);
    const share = screen.getByLabelText('Share %');
    await userEvent.type(share, '5');
    expect(share).toHaveValue(100);
    const pin = screen.getByRole('button', { name: 'Pin' });
    fireEvent.click(pin);
    expect(onChange).not.toHaveBeenCalled();
    expect(pin).not.toBeDisabled();
    expect(pin).toHaveAttribute('aria-disabled', 'true');
  });
});
