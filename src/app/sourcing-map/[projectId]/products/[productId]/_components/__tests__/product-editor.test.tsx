import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vomeroAgentDetail, vomeroProducts, vomeroWorkbenchDetail, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { presetAxis } from '@/lib/sourcing-map/variant-presets';
import { ProductEditor } from '../product-editor';
import { ProductEditorBody } from '../product-editor-body';

const { push, refresh, replace } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, replace }),
  usePathname: () => '/sourcing-map/x',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/image', () => ({ default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} /> }));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  // Every fetch resolves: the BOM grid resolves pinned suppliers' names on mount (Cycle 24.6, d-G9) and the
  // import dialog loads the seat's SKUs when it opens (Task 25), so an unset stub would reject inside an effect (D2).
  fetchMock.mockResolvedValue(reply(404, {}));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}
const SKUS = { skus: [{ sku: 'METCON-CROSS-IRON', product_name: 'Metcon Cross Iron' }] };
const NL = String.fromCharCode(10);

describe('ProductEditor header', () => {
  it('saves the header through PATCH and shows the returned readiness', async () => {
    const notReady = { ready: false, first_failing_rule: 'line_missing_class', detail: 'Line 4 (Metal eyelet 5mm) has no class.' };
    // The PATCH answers the product (SmProduct); the body holds it, so the badge follows (LW-b).
    fetchMock.mockImplementation(async (path: unknown, init?: RequestInit) =>
      init?.method === 'PATCH' ? reply(200, { ...vomeroProducts[0]!, assembly_days: 14, readiness: notReady }) : reply(404, {}));
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Assembly days'), { target: { value: '14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => expect(screen.getByText('Not ready')).toBeInTheDocument());
    const [path, init] = fetchMock.mock.calls.find(([, i]) => i?.method === 'PATCH')!;
    expect(path).toBe(`/api/account/sourcing-map/products/${VOMERO_IDS.pegasus}`);
    expect(JSON.parse(init.body)).toEqual({
      name: 'Pegasus Trail', unit_label: 'pairs', assembly_days: 14, variant_axis: vomeroWorkbenchDetail.variant_axis,
    });
  });

  it('reports a saved header upward and never refreshes the page, which holds nothing it keys on (LW-b); a failed save reports nothing', async () => {
    refresh.mockClear();
    const onSaved = vi.fn();
    fetchMock.mockResolvedValueOnce(reply(400, { error: { code: 'VALIDATION_ERROR', message: 'Unit label is required.' } }));
    render(<ProductEditor projectName="Spring 2027" detail={vomeroWorkbenchDetail} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unit label is required.');
    expect(onSaved).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(reply(200, vomeroProducts[0]));
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(vomeroProducts[0]));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });
  it('keeps Save product focusable while its PATCH is in flight: aria-busy, and a second press sends nothing (LW-a)', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    fetchMock.mockImplementation(async () => {
      await held;
      return reply(200, vomeroProducts[0]);
    });
    render(<ProductEditor projectName="Spring 2027" detail={vomeroWorkbenchDetail} onSaved={vi.fn()} />);
    const save = screen.getByRole('button', { name: 'Save product' });
    save.focus();
    fireEvent.click(save);
    expect(save).toHaveAttribute('aria-busy', 'true');
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).not.toBeDisabled();
    expect(save).toHaveFocus();
    fireEvent.click(save);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(save).not.toHaveAttribute('aria-busy'));
  });
});

describe('ProductEditorBody', () => {
  it('renders the BOM grid for a workbench product', () => {
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    expect(screen.getByRole('heading', { name: 'Bill of materials' })).toBeInTheDocument();
    expect(screen.getAllByRole('row', { name: /^Line / })).toHaveLength(5);
  });

  it('renders the read-only agent view for an agent product and offers Import from agent on a workbench product', () => {
    const { unmount } = render(<ProductEditorBody projectName="Spring 2027" detail={vomeroAgentDetail} />);
    expect(screen.getByText('Read fresh at each run')).toBeInTheDocument();
    unmount();
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    fireEvent.click(screen.getByRole('button', { name: 'Import from agent' }));
    expect(screen.getByRole('dialog', { name: 'Import from agent' })).toBeInTheDocument();
  });

  it("the import dialog's typed SKU, mode and error do not survive a cancel and reopen", async () => {
    fetchMock.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes('/agent-parent-skus')) return Promise.resolve(reply(200, SKUS));
      if (p.includes('/import-agent-bom')) return Promise.resolve(reply(502, { error: { code: 'agent_unreachable', message: 'upstream' } }));
      return Promise.resolve(reply(404, {}));
    });
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    fireEvent.click(screen.getByRole('button', { name: 'Import from agent' }));
    await waitFor(() => expect(document.querySelector('datalist option[value="METCON-CROSS-IRON"]')).not.toBeNull());
    fireEvent.change(screen.getByLabelText('Parent SKU'), { target: { value: 'UNLISTED-SKU-9' } });
    fireEvent.click(screen.getByRole('radio', { name: /Link/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Import from agent' }));
    await waitFor(() => expect(document.querySelector('datalist option[value="METCON-CROSS-IRON"]')).not.toBeNull());
    expect(screen.getByLabelText('Parent SKU')).toHaveValue('');
    expect(screen.getByRole('radio', { name: /Copy/ })).toBeChecked();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('moves focus into the import dialog on open and returns it to the toolbar button on Cancel (WCAG 2.4.3)', () => {
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    const openButton = screen.getByRole('button', { name: 'Import from agent' });
    openButton.focus();
    fireEvent.click(openButton);
    expect(screen.getByLabelText('Parent SKU')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(openButton).toHaveFocus();
  });

  it('opens the upload wizard from "Upload BOM"', () => {
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    fireEvent.click(screen.getByRole('button', { name: 'Upload BOM' }));
    expect(screen.getByRole('dialog', { name: 'Upload BOM' })).toBeInTheDocument();
    expect(screen.getByLabelText('Spreadsheet file')).toBeInTheDocument();
  });

  it('mounts the upload wizard only while open, so a reopen starts at the File step with nothing chosen', async () => {
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    fireEvent.click(screen.getByRole('button', { name: 'Upload BOM' }));
    await userEvent.upload(screen.getByLabelText('Spreadsheet file'), new File([['Description,Usage', 'Upper leather tumbled,0.25'].join(NL)], 'bom.csv', { type: 'text/csv' }));
    expect(await screen.findByLabelText('Map column Description')).toHaveValue('component');
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Upload BOM' })).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Upload BOM' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Upload BOM' }));
    const dialog = screen.getByRole('dialog', { name: 'Upload BOM' });
    expect(within(dialog).getByText('1 File')).toHaveAttribute('aria-current', 'step');
    expect((within(dialog).getByLabelText('Spreadsheet file') as HTMLInputElement).files).toHaveLength(0);
    expect(within(dialog).queryByLabelText('Map column Description')).toBeNull();
  });

  it('closes the wizard after a saved upload and never refreshes the page: the body holds the saved product (LW-b)', async () => {
    refresh.mockClear();
    fetchMock.mockImplementation((path: unknown, init?: RequestInit) => {
      const p = String(path);
      if (p.endsWith('/class-suggestions')) return Promise.resolve(reply(200, { retrieval: 'hybrid', lines: [{ suggestions: [] }] }));
      if (p.endsWith('/bom-lines') && init?.method === 'PUT') return Promise.resolve(reply(200, vomeroWorkbenchDetail));
      return Promise.resolve(reply(404, {}));
    });
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    fireEvent.click(screen.getByRole('button', { name: 'Upload BOM' }));
    const dialog = screen.getByRole('dialog', { name: 'Upload BOM' });
    await userEvent.upload(within(dialog).getByLabelText('Spreadsheet file'), new File([['Description,Usage', 'Upper leather tumbled,0.25'].join(NL)], 'bom.csv', { type: 'text/csv' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Continue' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Continue to review' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Save 1 line' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Upload BOM' })).toBeNull());
    expect(refresh).not.toHaveBeenCalled();
  });

  it('keeps the upload wizard open while its save is in flight: Escape, the backdrop and Close do nothing until it settles', async () => {
    refresh.mockClear();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    fetchMock.mockImplementation(async (path: unknown, init?: RequestInit) => {
      const p = String(path);
      if (p.endsWith('/class-suggestions')) return reply(200, { retrieval: 'hybrid', lines: [{ suggestions: [] }] });
      if (p.endsWith('/bom-lines') && init?.method === 'PUT') {
        await held;
        return reply(409, { error: { code: 'product_not_workbench', message: 'This product reads its BOM from your agent.' } });
      }
      return reply(404, {});
    });
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    fireEvent.click(screen.getByRole('button', { name: 'Upload BOM' }));
    const dialog = screen.getByRole('dialog', { name: 'Upload BOM' });
    await userEvent.upload(within(dialog).getByLabelText('Spreadsheet file'), new File([['Description,Usage', 'Upper leather tumbled,0.25'].join(NL)], 'bom.csv', { type: 'text/csv' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Continue' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Continue to review' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Save 1 line' }));
    // the PUT is in flight: a close now would replace the BOM unseen on success, or lose the message on failure
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Upload BOM' })).toBeInTheDocument();
    const backdrop = dialog.previousElementSibling as HTMLElement;
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(backdrop);
    expect(screen.getByRole('dialog', { name: 'Upload BOM' })).toBeInTheDocument();
    const close = within(dialog).getByRole('button', { name: 'Close' });
    expect(close).toBeDisabled();
    fireEvent.click(close);
    expect(screen.getByRole('dialog', { name: 'Upload BOM' })).toBeInTheDocument();
    release();
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This product reads its BOM from your agent.');
    expect(refresh).not.toHaveBeenCalled();
    // settled: closing works again
    expect(close).toBeEnabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Upload BOM' })).toBeNull();
  });

  it('the Ready pill follows a BOM save, which answers the product with its new readiness, with no page refresh (LW-b)', async () => {
    refresh.mockClear();
    const notReady = { ready: false, first_failing_rule: 'line_missing_class', detail: 'Line 4 (Metal eyelet 5mm) has no class.' };
    fetchMock.mockImplementation(async (path: unknown, init?: RequestInit) =>
      String(path).endsWith('/bom-lines') && init?.method === 'PUT' ? reply(200, { ...vomeroWorkbenchDetail, readiness: notReady }) : reply(404, {}));
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save BOM' }));
    expect(await screen.findByText('Not ready')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('hands the grid and the upload wizard the saved variant axis as soon as the header PATCH answers (LW-b)', async () => {
    // A new product: no axis yet, no lines. The PATCH answers the axis the header saved.
    const fresh = { ...vomeroWorkbenchDetail, name: 'Walk trainer', variant_axis: null, lines: [], line_count: 0 };
    const axis = presetAxis('mens_us_6_15', false);
    fetchMock.mockImplementation(async (_path: unknown, init?: RequestInit) =>
      init?.method === 'PATCH' ? reply(200, { ...vomeroProducts[0]!, name: 'Walk trainer (saved)', variant_axis: axis }) : reply(404, {}));
    render(<ProductEditorBody projectName="Spring 2027" detail={fresh} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
    expect(screen.getByRole('checkbox', { name: 'Size-bound' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Walk trainer (saved)' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Half sizes' }));
    fireEvent.change(screen.getByLabelText('Variant preset'), { target: { value: 'mens_us_6_15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    // The crumb reads the saved product, so it says when the PATCH has answered.
    expect(await within(screen.getByRole('navigation', { name: 'Breadcrumb' })).findByText('Walk trainer (saved)')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Size-bound' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Upload BOM' }));
    await userEvent.upload(screen.getByLabelText('Spreadsheet file'), new File([['Description,Usage,9,10', 'Outsole,1,1,1.1'].join(NL)], 'bom.csv', { type: 'text/csv' }));
    // A size header is a per-size column only against the product's axis: against the pre-save null axis it is ignored.
    expect(await screen.findByLabelText('Map column 9')).toHaveValue('variant_qty');
    expect(screen.getByLabelText('Map column 10')).toHaveValue('variant_qty');
  });

  it('after Save BOM a supplier pinned this session keeps its name, and each supplier is looked up once (d-G9, LW-b)', async () => {
    const aglet = { participant_id: VOMERO_IDS.aglet, legal_name: 'Aglet & Cord', country: 'IN', skus: [{ supplier_sku: 'AC-FLAT-120', class_id: 'cpt_flat_laces', class_depth: 0 }] };
    // The PUT replaces the lines in one transaction, so the saved lines come back under new ids (every row remounts).
    const saved = {
      ...vomeroWorkbenchDetail,
      lines: vomeroWorkbenchDetail.lines.map((l, i) => ({
        ...l, line_id: `5a1e0000-0000-4000-8000-00000000050${i}`,
        pins: i === 4 ? [{ supplier_participant_id: VOMERO_IDS.aglet, supplier_sku: 'AC-FLAT-120', share_pct: 100 }] : l.pins,
      })),
    };
    const profiles: Record<string, string> = { [VOMERO_IDS.leon]: 'León Cuero SA', [VOMERO_IDS.zephyr]: 'Zephyr Compounds', [VOMERO_IDS.aglet]: 'Aglet & Cord' };
    fetchMock.mockImplementation(async (path: unknown, init?: RequestInit) => {
      const p = String(path);
      if (p.startsWith('/api/account/sourcing-map/class-suppliers?')) return reply(200, { class_id: 'cpt_flat_laces', suppliers: [aglet] });
      if (p.endsWith('/bom-lines') && init?.method === 'PUT') return reply(200, saved);
      const id = /\/api\/account\/company\/([^/]+)\/profile$/.exec(p)?.[1];
      return id && profiles[id] ? reply(200, { legal_name: profiles[id] }) : reply(404, {});
    });
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    const laces = () => screen.getByRole('row', { name: 'Line 5: Flat lace 137 cm' });
    fireEvent.click(within(laces()).getByRole('button', { name: 'Add supplier' }));
    await within(laces()).findByRole('option', { name: 'Aglet & Cord' });
    fireEvent.change(within(laces()).getByLabelText('Supplier'), { target: { value: VOMERO_IDS.aglet } });
    fireEvent.change(within(laces()).getByLabelText('Supplier SKU'), { target: { value: 'AC-FLAT-120' } });
    fireEvent.click(within(laces()).getByRole('button', { name: 'Pin' }));
    expect(within(laces()).getByText('Aglet & Cord · AC-FLAT-120 · 100%')).toBeInTheDocument();
    await within(screen.getByRole('row', { name: /^Line 1:/ })).findByText('León Cuero SA · LC-BOV-UP-01 · 60%');
    fireEvent.click(screen.getByRole('button', { name: 'Save BOM' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith('/bom-lines') && i?.method === 'PUT')).toBe(true));
    expect(await within(laces()).findByText('Aglet & Cord · AC-FLAT-120 · 100%')).toBeInTheDocument();
    expect(within(laces()).queryByText(/Unknown supplier/)).toBeNull();
    const lookups = fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/account/company/'));
    expect(lookups.sort()).toEqual([VOMERO_IDS.aglet, VOMERO_IDS.leon, VOMERO_IDS.mekong, VOMERO_IDS.zephyr].map((id) => `/api/account/company/${id}/profile`).sort());
  });

  it('a committed upload replaces the grid with the saved lines, and focus returns to the same Upload BOM button (LW-b)', async () => {
    const uploaded = {
      ...vomeroWorkbenchDetail,
      line_count: 1,
      lines: [{ ...vomeroWorkbenchDetail.lines[1]!, line_id: '5a1e0000-0000-4000-8000-000000000600', position: 0, component_label: 'Upper leather tumbled', origin: 'uploaded' as const }],
    };
    fetchMock.mockImplementation(async (path: unknown, init?: RequestInit) => {
      const p = String(path);
      if (p.endsWith('/class-suggestions')) return reply(200, { retrieval: 'hybrid', lines: [{ suggestions: [] }] });
      if (p.endsWith('/bom-lines') && init?.method === 'PUT') return reply(200, uploaded);
      return reply(404, {});
    });
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    expect(screen.getAllByRole('row', { name: /^Line / })).toHaveLength(5);
    const openButton = screen.getByRole('button', { name: 'Upload BOM' });
    openButton.focus();
    fireEvent.click(openButton);
    const dialog = screen.getByRole('dialog', { name: 'Upload BOM' });
    await userEvent.upload(within(dialog).getByLabelText('Spreadsheet file'), new File([['Description,Usage', 'Upper leather tumbled,0.25'].join(NL)], 'bom.csv', { type: 'text/csv' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Continue' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Continue to review' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Save 1 line' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Upload BOM' })).toBeNull());
    expect(screen.getAllByRole('row', { name: /^Line / })).toHaveLength(1);
    expect(screen.getByLabelText('Component for line 1')).toHaveValue('Upper leather tumbled');
    // The very element that opened the wizard: a toolbar remounted with the grid would leave focus on <body>.
    expect(document.activeElement).toBe(openButton);
  });

  it('a copy import, which answers only counts, re-reads the product and replaces the grid with its lines, and a successful re-read locks nothing (LW-b, stale-lock)', async () => {
    const imported = {
      ...vomeroWorkbenchDetail,
      line_count: 2,
      lines: vomeroAgentDetail.lines.map((l, i) => ({ ...l, line_id: `5a1e0000-0000-4000-8000-00000000070${i}`, product_id: VOMERO_IDS.pegasus, position: i })),
    };
    fetchMock.mockImplementation(async (path: unknown, init?: RequestInit) => {
      const p = String(path);
      if (p.endsWith('/agent-parent-skus')) return reply(200, SKUS);
      if (p.endsWith('/import-agent-bom') && init?.method === 'POST') return reply(200, { mode: 'copy', lines_created: 2, lines_unclassified: 1 });
      if (p === `/api/account/sourcing-map/products/${VOMERO_IDS.pegasus}` && (init?.method ?? 'GET') === 'GET') return reply(200, imported);
      if (p.endsWith('/bom-lines') && init?.method === 'PUT') return reply(200, imported);
      return reply(404, {});
    });
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    fireEvent.click(screen.getByRole('button', { name: 'Import from agent' }));
    fireEvent.change(screen.getByLabelText('Parent SKU'), { target: { value: 'METCON-CROSS-IRON' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(screen.getAllByRole('row', { name: /^Line / })).toHaveLength(2));
    expect(screen.getByLabelText('Component for line 2')).toHaveValue('Flat lace 137 cm');
    expect(screen.queryByRole('dialog')).toBeNull();
    // stale-lock: no alert, the toolbar stays live, and Save BOM sends its PUT.
    expect(screen.queryByRole('alert')).toBeNull();
    for (const name of ['Upload BOM', 'Import from agent']) expect(screen.getByRole('button', { name })).not.toHaveAttribute('aria-disabled');
    const saveBom = screen.getByRole('button', { name: 'Save BOM' });
    fireEvent.click(saveBom);
    expect(bomPuts()).toHaveLength(1);
    await waitFor(() => expect(saveBom).not.toHaveAttribute('aria-busy'));
  });

  const bomPuts = () => fetchMock.mock.calls.filter(([u, i]) => String(u).endsWith('/bom-lines') && i?.method === 'PUT');
  // stale-lock: an import the server accepted, whose re-read then fails, opened from a focused "Import from agent". It
  // resolves once the alert shows.
  async function importThenFailReread(mode: 'copy' | 'link' = 'copy') {
    fetchMock.mockImplementation(async (path: unknown, init?: RequestInit) => {
      const p = String(path);
      if (p.endsWith('/agent-parent-skus')) return reply(200, SKUS);
      if (p.endsWith('/import-agent-bom') && init?.method === 'POST') {
        return reply(200, mode === 'copy' ? { mode, lines_created: 2, lines_unclassified: 1 } : { mode, lines_created: 0, lines_unclassified: 0 });
      }
      if (p === `/api/account/sourcing-map/products/${VOMERO_IDS.pegasus}` && init?.method === 'PATCH') return reply(200, { ...vomeroProducts[0]!, name: 'Pegasus Trail (saved)' });
      if (p === `/api/account/sourcing-map/products/${VOMERO_IDS.pegasus}`) return reply(500, { error: { code: 'INTERNAL_ERROR', message: 'The product could not be read.' } });
      if (p.endsWith('/bom-lines') && init?.method === 'PUT') return reply(200, vomeroWorkbenchDetail);
      return reply(404, {});
    });
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    const opener = screen.getByRole('button', { name: 'Import from agent' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.change(screen.getByLabelText('Parent SKU'), { target: { value: 'METCON-CROSS-IRON' } });
    if (mode === 'link') fireEvent.click(screen.getByRole('radio', { name: /Link/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    return { alert: await screen.findByRole('alert'), opener };
  }

  it('a failed re-read after an import says the import succeeded and asks for a reload, with the read’s message (stale-lock, a-G4)', async () => {
    const { alert } = await importThenFailReread();
    expect(alert.textContent).toBe('The import succeeded, but the product could not be re-read: The product could not be read. Reload the page to continue.');
  });

  it('while the stale lock holds, an edit plus Save BOM sends no PUT: the pre-import lines never overwrite the imported ones (stale-lock)', async () => {
    await importThenFailReread();
    // A valid edit: a line problem would stop the save before any request, lock or no lock.
    fireEvent.change(screen.getByLabelText('Component for line 1'), { target: { value: 'Upper leather (edited)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save BOM' }));
    expect(bomPuts()).toHaveLength(0);
  });

  it('while the stale lock holds, typing into the grid’s line and size inputs changes nothing: they are read-only (stale-lock)', async () => {
    await importThenFailReread();
    // user-event types as a user does, so it respects readOnly (fireEvent.change would not).
    const fields = [
      screen.getByLabelText('Component for line 1'), screen.getByLabelText('Part ref for line 1'),
      screen.getByLabelText('Qty per unit for line 1'), screen.getByLabelText('UoM for line 1'),
      screen.getAllByLabelText(/^Qty for size /)[0]!,
    ];
    for (const field of fields) {
      const before = (field as HTMLInputElement).value;
      await userEvent.type(field, '7');
      expect(field).toHaveValue(field.getAttribute('type') === 'number' ? Number(before) : before);
    }
  });

  it('while the stale lock holds, Add line, Remove, Size-bound and the uniform-qty reset do nothing, and none is disabled (stale-lock, LW-a)', async () => {
    await importThenFailReread();
    const rows = () => screen.getAllByRole('row', { name: /^Line / });
    const line1 = () => screen.getByRole('row', { name: /^Line 1:/ });
    fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
    expect(rows()).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Remove line 1' }));
    expect(rows()).toHaveLength(5);
    expect(screen.getByLabelText('Component for line 1')).toHaveValue('Upper leather, tumbled');
    const sizeBound = within(line1()).getByRole('checkbox', { name: 'Size-bound' });
    fireEvent.click(sizeBound);
    expect(sizeBound).toBeChecked();
    expect(within(line1()).getAllByLabelText(/^Qty for size /).length).toBeGreaterThan(0);
    // Inert, never disabled: a control that holds focus keeps it (LW-a).
    for (const control of [
      screen.getByRole('button', { name: 'Add line' }), screen.getByRole('button', { name: 'Remove line 1' }), sizeBound,
      within(line1()).getByRole('button', { name: 'Use the uniform qty for every size' }),
    ]) {
      expect(control).not.toBeDisabled();
      expect(control).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('while the stale lock holds, Upload BOM and Import from agent do nothing: the body’s product is stale (stale-lock)', async () => {
    await importThenFailReread();
    fireEvent.click(screen.getByRole('button', { name: 'Upload BOM' }));
    expect(screen.queryByRole('dialog', { name: 'Upload BOM' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Import from agent' }));
    expect(screen.queryByRole('dialog', { name: 'Import from agent' })).toBeNull();
  });

  it('while the stale lock holds, focus stays on Import from agent, which the lock makes aria-disabled, never disabled (stale-lock, LW-a)', async () => {
    const { opener } = await importThenFailReread();
    // The closing dialog handed focus back to its opener. `disabled` would move it on to <body> in a browser (HTML's
    // focus-fixup rule; jsdom does not apply it), so the pin is that neither toolbar button is disabled.
    expect(document.activeElement).toBe(opener);
    for (const name of ['Import from agent', 'Upload BOM']) {
      const button = screen.getByRole('button', { name });
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('the stale lock survives a later header save: only a reload clears it (stale-lock)', async () => {
    await importThenFailReread();
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Pegasus Trail (saved)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    // The crumb reads the saved product, so it says when the PATCH has answered.
    expect(await within(screen.getByRole('navigation', { name: 'Breadcrumb' })).findByText('Pegasus Trail (saved)')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('The import succeeded, but the product could not be re-read');
    expect(screen.getByRole('button', { name: 'Import from agent' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Save BOM' }));
    expect(bomPuts()).toHaveLength(0);
  });

  it('a Link import whose re-read fails is locked the same way: the body still shows the workbench grid the import made stale (stale-lock)', async () => {
    const { alert } = await importThenFailReread('link');
    expect(alert.textContent).toBe('The import succeeded, but the product could not be re-read: The product could not be read. Reload the page to continue.');
    // The product is an agent product now, but without the re-read the body never switched to the agent view.
    expect(screen.queryByText('Read fresh at each run')).toBeNull();
    expect(screen.getByRole('button', { name: 'Import from agent' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.change(screen.getByLabelText('Component for line 1'), { target: { value: 'Upper leather (edited)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save BOM' }));
    expect(bomPuts()).toHaveLength(0);
  });

  it('a link import switches the body to the read-only agent view (LW-b)', async () => {
    const linked = { ...vomeroAgentDetail, product_id: VOMERO_IDS.pegasus, name: 'Pegasus Trail' };
    fetchMock.mockImplementation(async (path: unknown, init?: RequestInit) => {
      const p = String(path);
      if (p.endsWith('/agent-parent-skus')) return reply(200, SKUS);
      if (p.endsWith('/import-agent-bom') && init?.method === 'POST') return reply(200, { mode: 'link', lines_created: 0, lines_unclassified: 0 });
      if (p === `/api/account/sourcing-map/products/${VOMERO_IDS.pegasus}`) return reply(200, linked);
      return reply(404, {});
    });
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    fireEvent.click(screen.getByRole('button', { name: 'Import from agent' }));
    fireEvent.change(screen.getByLabelText('Parent SKU'), { target: { value: 'METCON-CROSS-IRON' } });
    fireEvent.click(screen.getByRole('radio', { name: /Link/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Read fresh at each run')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save BOM' })).toBeNull();
  });

  it('after a link import, focus goes to the agent view’s heading, never to <body> with the toolbar the switch removed (F-a)', async () => {
    const linked = { ...vomeroAgentDetail, product_id: VOMERO_IDS.pegasus, name: 'Pegasus Trail' };
    fetchMock.mockImplementation(async (path: unknown, init?: RequestInit) => {
      const p = String(path);
      if (p.endsWith('/agent-parent-skus')) return reply(200, SKUS);
      if (p.endsWith('/import-agent-bom') && init?.method === 'POST') return reply(200, { mode: 'link', lines_created: 0, lines_unclassified: 0 });
      if (p === `/api/account/sourcing-map/products/${VOMERO_IDS.pegasus}`) return reply(200, linked);
      return reply(404, {});
    });
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    const opener = screen.getByRole('button', { name: 'Import from agent' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.change(screen.getByLabelText('Parent SKU'), { target: { value: 'METCON-CROSS-IRON' } });
    fireEvent.click(screen.getByRole('radio', { name: /Link/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Read fresh at each run')).toBeInTheDocument();
    expect(opener).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Bill of materials' })));
  });

  it('an agent product that loads as one takes no focus: only the switch after a link import moves it (F-a)', () => {
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroAgentDetail} />);
    expect(screen.getByText('Read fresh at each run')).toBeInTheDocument();
    expect(document.activeElement).toBe(document.body);
  });
});

