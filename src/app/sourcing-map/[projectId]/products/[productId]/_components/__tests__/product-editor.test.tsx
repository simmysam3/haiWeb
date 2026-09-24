import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vomeroAgentDetail, vomeroProducts, vomeroWorkbenchDetail, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
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

  it('refreshes the page after a successful header save, so the page re-reads the product; a failed save does not', async () => {
    refresh.mockClear();
    fetchMock.mockResolvedValueOnce(reply(400, { error: { code: 'VALIDATION_ERROR', message: 'Unit label is required.' } }));
    render(<ProductEditor projectName="Spring 2027" detail={vomeroWorkbenchDetail} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unit label is required.');
    expect(refresh).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(reply(200, vomeroWorkbenchDetail));
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
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

  it('closes the wizard after a saved upload and refreshes, so the page re-reads the product (Task 24 editor sync)', async () => {
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
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog', { name: 'Upload BOM' })).toBeNull();
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

  it('the Ready pill follows a BOM save, which answers the product with its new readiness (LW-b)', async () => {
    const notReady = { ready: false, first_failing_rule: 'line_missing_class', detail: 'Line 4 (Metal eyelet 5mm) has no class.' };
    fetchMock.mockImplementation(async (path: unknown, init?: RequestInit) =>
      String(path).endsWith('/bom-lines') && init?.method === 'PUT' ? reply(200, { ...vomeroWorkbenchDetail, readiness: notReady }) : reply(404, {}));
    render(<ProductEditorBody projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save BOM' }));
    expect(await screen.findByText('Not ready')).toBeInTheDocument();
  });
});

