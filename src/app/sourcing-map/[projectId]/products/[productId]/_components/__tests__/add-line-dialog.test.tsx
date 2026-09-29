import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { AddLineDialog } from '../add-line-dialog';

const fetchMock = vi.fn();
function reply(body: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
}
/** The class search finds the laces class; its suppliers are Bowline (one SKU) and Aglet & Cord (one SKU). */
async function route(url: string) {
  if (url.startsWith('/api/account/sourcing-map/classes?')) {
    return reply({ classes: [{ class_id: 'cpt_flat_laces', label: 'Flat laces', class_path: ['Components', 'Trims', 'Laces', 'Flat laces'] }] });
  }
  if (url.startsWith('/api/account/sourcing-map/class-suppliers?')) {
    return reply({
      class_id: 'cpt_flat_laces',
      suppliers: [
        { participant_id: VOMERO_IDS.bowline, legal_name: 'Bowline Cordage', country: 'PT', skus: [{ supplier_sku: 'BW-LACE-137', class_id: 'cpt_flat_laces', class_depth: 0 }] },
        { participant_id: VOMERO_IDS.aglet, legal_name: 'Aglet & Cord', country: 'IN', skus: [{ supplier_sku: 'AC-FLAT-137', class_id: 'cpt_flat_laces', class_depth: 0 }] },
      ],
    });
  }
  return { ok: false, status: 404, text: async () => JSON.stringify({ error: { code: 'NOT_FOUND', message: 'not found' } }) };
}
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(route);
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function mount() {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  render(<AddLineDialog open onClose={onClose} onAdd={onAdd} />);
  return { onAdd, onClose, dialog: screen.getByRole('dialog', { name: 'Add a BOM line' }) };
}
const step = (name: RegExp) => screen.getByRole('group', { name });

describe('AddLineDialog', () => {
  it('asks in order: the class step waits for the component, its quantity and its unit (owner, walk 2026-09-29)', () => {
    const { dialog } = mount();
    expect(within(dialog).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['1. Component', '2. Class', '3. Supplier']);
    const search = () => within(step(/^2\. Class/)).getByLabelText(/^Class search for /);
    // Nothing entered yet: the class step is there to read, and inert.
    expect(search()).toHaveAttribute('readonly');
    expect(within(step(/^2\. Class/)).getByText('Name the component first.')).toBeInTheDocument();
    fireEvent.change(within(step(/^1\. Component/)).getByLabelText('Component'), { target: { value: 'Heel counter TPU' } });
    // Qty per unit opens at 1 and UoM at "ea", so the name completes the step.
    expect(within(step(/^1\. Component/)).getByLabelText('Qty per unit')).toHaveValue(1);
    expect(within(step(/^1\. Component/)).getByLabelText('UoM')).toHaveValue('ea');
    expect(search()).not.toHaveAttribute('readonly');
    expect(within(step(/^2\. Class/)).queryByText('Name the component first.')).toBeNull();
    // A quantity of 0, or no unit, closes it again.
    fireEvent.change(within(step(/^1\. Component/)).getByLabelText('Qty per unit'), { target: { value: '0' } });
    expect(search()).toHaveAttribute('readonly');
    fireEvent.change(within(step(/^1\. Component/)).getByLabelText('Qty per unit'), { target: { value: '2' } });
    fireEvent.change(within(step(/^1\. Component/)).getByLabelText('UoM'), { target: { value: ' ' } });
    expect(search()).toHaveAttribute('readonly');
  });

  async function nameAndPickLaces() {
    fireEvent.change(within(step(/^1\. Component/)).getByLabelText('Component'), { target: { value: 'Flat lace 137 cm' } });
    fireEvent.change(within(step(/^2\. Class/)).getByLabelText('Class search for Flat lace 137 cm'), { target: { value: 'lace' } });
    fireEvent.click(within(step(/^2\. Class/)).getByRole('button', { name: 'Find class for Flat lace 137 cm' }));
    fireEvent.click(await within(step(/^2\. Class/)).findByRole('button', { name: /Flat laces$/ }));
  }

  it('opens the supplier step on the suppliers of the class picked, with nothing more to press', async () => {
    mount();
    expect(within(step(/^3\. Supplier/)).getByText('Pick a class first.')).toBeInTheDocument();
    await nameAndPickLaces();
    const suppliers = step(/^3\. Supplier/);
    expect(await within(suppliers).findByRole('option', { name: 'Bowline Cordage' })).toBeInTheDocument();
    expect(within(suppliers).getByRole('option', { name: 'Aglet & Cord' })).toBeInTheDocument();
    expect(within(suppliers).queryByText('Pick a class first.')).toBeNull();
    expect(within(suppliers).getByText('Optional. With no supplier the line is open to any trading partner.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([u]) => u)).toContain('/api/account/sourcing-map/class-suppliers?class_id=cpt_flat_laces');
  });

  it('lets the class be decided later: the line stays Unclassified and the supplier step says why it waits', async () => {
    mount();
    fireEvent.change(within(step(/^1\. Component/)).getByLabelText('Component'), { target: { value: 'Heel counter TPU' } });
    const later = within(step(/^2\. Class/)).getByRole('checkbox', { name: 'Decide the class later' });
    fireEvent.click(later);
    expect(within(step(/^2\. Class/)).getByLabelText(/^Class search for /)).toHaveAttribute('readonly');
    expect(within(step(/^3\. Supplier/)).getByText('A supplier is chosen from those who publish the class, so this waits for the class.')).toBeInTheDocument();
    expect(within(step(/^3\. Supplier/)).queryByLabelText('Supplier')).toBeNull();
    // Unticking it brings the search back.
    fireEvent.click(later);
    expect(within(step(/^2\. Class/)).getByLabelText(/^Class search for /)).not.toHaveAttribute('readonly');
  });

  it('adds the line once the component is named and the class is decided, and hands the grid a row with what was entered', async () => {
    const { onAdd, onClose, dialog } = mount();
    const add = () => within(dialog).getByRole('button', { name: 'Add line' });
    expect(add()).toBeDisabled();
    await nameAndPickLaces();
    expect(add()).not.toBeDisabled();
    fireEvent.change(within(step(/^1\. Component/)).getByLabelText('Qty per unit'), { target: { value: '2' } });
    fireEvent.change(within(step(/^1\. Component/)).getByLabelText('UoM'), { target: { value: 'pr' } });
    fireEvent.change(within(step(/^1\. Component/)).getByLabelText('Part ref'), { target: { value: 'LACE-137' } });
    const suppliers = step(/^3\. Supplier/);
    await within(suppliers).findByRole('option', { name: 'Bowline Cordage' });
    fireEvent.change(within(suppliers).getByLabelText('Supplier'), { target: { value: VOMERO_IDS.bowline } });
    fireEvent.change(within(suppliers).getByLabelText('Supplier SKU'), { target: { value: 'BW-LACE-137' } });
    fireEvent.click(within(suppliers).getByRole('button', { name: 'Pin' }));
    fireEvent.click(add());
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0]![0]).toMatchObject({
      component_label: 'Flat lace 137 cm', part_ref: 'LACE-137', qty_per_unit: 2, uom: 'pr',
      class_id: 'cpt_flat_laces', class_label: 'Flat laces',
      pins: [{ supplier_participant_id: VOMERO_IDS.bowline, supplier_sku: 'BW-LACE-137', share_pct: 100 }],
      variant_bound: false, qty_by_variant: null, origin: 'authored',
    });
    expect(onAdd.mock.calls[0]![0].key).toMatch(/^new-/);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('never drops a supplier that was chosen and not pinned: Add line waits, and says for what', async () => {
    const { onAdd, dialog } = mount();
    await nameAndPickLaces();
    const suppliers = step(/^3\. Supplier/);
    await within(suppliers).findByRole('option', { name: 'Bowline Cordage' });
    const add = () => within(dialog).getByRole('button', { name: 'Add line' });
    const WAIT = 'Press Pin to keep the supplier you chose, or Skip supplier.';
    expect(within(dialog).queryByText(WAIT)).toBeNull();
    fireEvent.change(within(suppliers).getByLabelText('Supplier'), { target: { value: VOMERO_IDS.bowline } });
    expect(add()).toBeDisabled();
    expect(within(dialog).getByText(WAIT)).toBeInTheDocument();
    expect(add()).toHaveAccessibleDescription(WAIT);
    // Skipping the supplier lets the line go with none.
    fireEvent.click(within(suppliers).getByRole('button', { name: 'Skip supplier' }));
    expect(within(dialog).queryByText(WAIT)).toBeNull();
    fireEvent.click(add());
    expect(onAdd.mock.calls[0]![0]).toMatchObject({ class_id: 'cpt_flat_laces', pins: [] });
  });

  it('lets go of a supplier chosen for a class once the class is put off: Add line is free, and the line has neither', async () => {
    const { onAdd, dialog } = mount();
    await nameAndPickLaces();
    const suppliers = step(/^3\. Supplier/);
    await within(suppliers).findByRole('option', { name: 'Bowline Cordage' });
    fireEvent.change(within(suppliers).getByLabelText('Supplier'), { target: { value: VOMERO_IDS.bowline } });
    fireEvent.click(within(step(/^2\. Class/)).getByRole('checkbox', { name: 'Decide the class later' }));
    const add = within(dialog).getByRole('button', { name: 'Add line' });
    expect(add).not.toBeDisabled();
    fireEvent.click(add);
    expect(onAdd.mock.calls[0]![0]).toMatchObject({ component_label: 'Flat lace 137 cm', class_id: null, class_label: null, pins: [] });
  });

  it('has one Cancel, the dialog\'s own: the way out of the supplier form says what it does, "Skip supplier"', async () => {
    const { onClose, dialog } = mount();
    await nameAndPickLaces();
    const suppliers = step(/^3\. Supplier/);
    await within(suppliers).findByRole('option', { name: 'Bowline Cordage' });
    expect(within(dialog).getAllByRole('button', { name: 'Cancel' })).toHaveLength(1);
    expect(within(suppliers).queryByRole('button', { name: 'Cancel' })).toBeNull();
    fireEvent.click(within(suppliers).getByRole('button', { name: 'Skip supplier' }));
    expect(within(suppliers).queryByLabelText('Supplier')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    // The dialog's Cancel closes the dialog and adds nothing.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
