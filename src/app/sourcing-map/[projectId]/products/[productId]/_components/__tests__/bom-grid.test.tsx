import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vomeroWorkbenchDetail, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { toDraft } from '@/lib/sourcing-map/bom-draft';
import { BomGrid } from '../bom-grid';

const fetchMock = vi.fn();
function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}
/** The PUT answers the saved detail; a profile lookup answers the name given, else 404. */
function route(profiles: Record<string, string> = {}) {
  return async (url: string) => {
    if (url.endsWith('/bom-lines')) return reply(200, vomeroWorkbenchDetail);
    const id = /\/api\/account\/company\/([^/]+)\/profile$/.exec(url)?.[1];
    if (id && profiles[id]) return reply(200, { legal_name: profiles[id] });
    return reply(404, { error: { code: 'NOT_FOUND', message: 'Participant not found' } });
  };
}
function putBody(): { lines: Array<Record<string, unknown>> } | null {
  const call = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/bom-lines'));
  return call ? JSON.parse(call[1].body) : null;
}
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(route());
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function mount(lines = vomeroWorkbenchDetail.lines, onSaved = vi.fn()) {
  render(<BomGrid productId={VOMERO_IDS.pegasus} axis={vomeroWorkbenchDetail.variant_axis} initialLines={lines} classes={vomeroWorkbenchDetail.classes} onSaved={onSaved} />);
  return onSaved;
}

describe('BomGrid', () => {
  it('labels stored lines from the detail’s classes, adds a hand-entered line, and saves the whole BOM through PUT bom-lines (AC 4, d-G5)', async () => {
    const onSaved = mount();
    expect(screen.getAllByRole('row', { name: /^Line / })).toHaveLength(5);
    expect(screen.getByRole('row', { name: /^Line 1:/ })).toHaveTextContent('Full grain leather hides');
    expect(screen.getByRole('row', { name: /^Line 2:/ })).toHaveTextContent('cpt_eva_foam_midsole');
    fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
    fireEvent.change(screen.getByLabelText('Component for line 6'), { target: { value: 'Heel counter TPU' } });
    fireEvent.change(screen.getByLabelText('UoM for line 6'), { target: { value: 'pr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save BOM' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(vomeroWorkbenchDetail));
    const put = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/bom-lines'))!;
    expect(put[0]).toBe(`/api/account/sourcing-map/products/${VOMERO_IDS.pegasus}/bom-lines`);
    expect(put[1].method).toBe('PUT');
    const body = putBody()!;
    expect(body.lines).toHaveLength(6);
    // The PUT carries exactly the input fields, never the grid's own key or class label (S3 folded 24.1 in here).
    expect(Object.keys(body.lines[0]!).sort()).toEqual(
      ['class_id', 'component_label', 'note', 'origin', 'part_ref', 'pins', 'qty_by_variant', 'qty_per_unit', 'uom', 'variant_bound'].sort(),
    );
    expect(body.lines[5]).toMatchObject({ component_label: 'Heel counter TPU', uom: 'pr', qty_per_unit: 1, origin: 'authored' });
    // A slug missing from `classes`, which the contract rules out, shows as itself.
    expect(toDraft(vomeroWorkbenchDetail.lines, {})[1]!.class_label).toBe('cpt_eva_foam_midsole');
  });

  it('shows each stored pin under its supplier’s name, looked up once per supplier when the editor opens; an unresolved one reads "Unknown supplier", never an id (d-G9)', async () => {
    fetchMock.mockImplementation(route({ [VOMERO_IDS.leon]: 'León Cuero SA', [VOMERO_IDS.zephyr]: 'Zephyr Compounds' }));
    mount();
    const leather = screen.getByRole('row', { name: /^Line 1:/ });
    expect(await within(leather).findByText('León Cuero SA · LC-BOV-UP-01 · 60%')).toBeInTheDocument();
    expect(within(leather).getByText('Unknown supplier · MK-FG-HIDE-2 · 40%')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /^Line 3:/ })).getByText('Zephyr Compounds · ZC-OUT-R2 · 100%')).toBeInTheDocument();
    const lookups = fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/account/company/'));
    expect(lookups.sort()).toEqual([VOMERO_IDS.leon, VOMERO_IDS.mekong, VOMERO_IDS.zephyr].map((id) => `/api/account/company/${id}/profile`).sort());
    expect(screen.queryByText(/5a1e0000/)).toBeNull();
  });

  it('a size-bound line records per-size quantities and saves them as qty_by_variant (spec §7.2)', async () => {
    mount([]);
    fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
    fireEvent.change(screen.getByLabelText('Component for line 1'), { target: { value: 'Outsole' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Size-bound' }));
    expect(screen.getAllByRole('spinbutton', { name: /^Qty for size / })).toHaveLength(13);
    fireEvent.change(screen.getByLabelText('Qty for size 10'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use the uniform qty for every size' }));
    expect(screen.getByLabelText('Qty for size 10')).toHaveValue(1);
    fireEvent.change(screen.getByLabelText('Qty for size 9'), { target: { value: '1.2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save BOM' }));
    await waitFor(() => expect(putBody()).not.toBeNull());
    expect(putBody()!.lines[0]).toMatchObject({ component_label: 'Outsole', variant_bound: true, qty_by_variant: { '9': 1.2 } });
  });

  it('refuses to save and names the line while shares total more than 100', async () => {
    const over = { ...vomeroWorkbenchDetail.lines[0]!, pins: vomeroWorkbenchDetail.lines[0]!.pins.map((p) => ({ ...p, share_pct: 60 })) };
    mount([over]);
    fireEvent.click(screen.getByRole('button', { name: 'Save BOM' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Line 1: Supplier shares total 120%; they may total at most 100%.');
    expect(putBody()).toBeNull();
  });

  it('a refused save clears an earlier failed save’s message, so only the current problems show (a-G4)', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/bom-lines') ? reply(400, { error: { code: 'VALIDATION_ERROR', message: 'The BOM could not be saved.' } }) : reply(404, {}),
    );
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Save BOM' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The BOM could not be saved.');
    fireEvent.change(screen.getByLabelText('Component for line 2'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save BOM' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('Line 2: Component is required.');
    expect(screen.queryByText('The BOM could not be saved.')).toBeNull();
  });

  it('a line whose class changes drops the supplier picker it opened for the old class, so no stale publisher can be pinned', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/account/sourcing-map/class-suppliers?')) {
        return reply(200, {
          class_id: 'cpt_flat_laces',
          suppliers: [{ participant_id: VOMERO_IDS.aglet, legal_name: 'Aglet & Cord', country: 'IN', skus: [{ supplier_sku: 'AC-FLAT-120', class_id: 'cpt_flat_laces', class_depth: 0 }] }],
        });
      }
      if (url.startsWith('/api/account/sourcing-map/classes?')) {
        return reply(200, { classes: [{ class_id: 'cpt_waxed_laces', label: 'Waxed laces', class_path: ['Components', 'Trims', 'Laces', 'Waxed laces'] }] });
      }
      return reply(404, {});
    });
    mount();
    const laces = screen.getByRole('row', { name: /^Line 5:/ });
    fireEvent.click(within(laces).getByRole('button', { name: 'Add supplier' }));
    expect(await within(laces).findByRole('option', { name: 'Aglet & Cord' })).toBeInTheDocument();
    fireEvent.change(within(laces).getByLabelText('Class search for Flat lace 137 cm'), { target: { value: 'waxed' } });
    fireEvent.click(within(laces).getByRole('button', { name: 'Find class for Flat lace 137 cm' }));
    fireEvent.click(await within(laces).findByRole('button', { name: /Waxed laces/ }));
    expect(within(laces).getByText('Waxed laces')).toBeInTheDocument();
    expect(within(laces).queryByLabelText('Supplier')).toBeNull();
    expect(within(laces).queryByRole('option', { name: 'Aglet & Cord' })).toBeNull();
    expect(within(laces).getByRole('button', { name: 'Add supplier' })).toBeEnabled();
  });
});
