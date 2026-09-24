import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vomeroAgentDetail, vomeroWorkbenchDetail, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
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

describe('ProductEditor header', () => {
  it('saves the header through PATCH and shows the returned readiness', async () => {
    const notReady = { ready: false, first_failing_rule: 'line_missing_class', detail: 'Line 4 (Metal eyelet 5mm) has no class.' };
    fetchMock.mockResolvedValue(reply(200, { ...vomeroWorkbenchDetail, assembly_days: 14, readiness: notReady }));
    render(<ProductEditor projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Assembly days'), { target: { value: '14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => expect(screen.getByText('Not ready')).toBeInTheDocument());
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe(`/api/account/sourcing-map/products/${VOMERO_IDS.pegasus}`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({
      name: 'Pegasus Trail', unit_label: 'pairs', assembly_days: 14, variant_axis: vomeroWorkbenchDetail.variant_axis,
    });
  });

  it('refreshes the page after a successful header save, so the page re-reads the product; a failed save does not', async () => {
    refresh.mockClear();
    fetchMock.mockResolvedValueOnce(reply(400, { error: { code: 'VALIDATION_ERROR', message: 'Unit label is required.' } }));
    render(<ProductEditor projectName="Spring 2027" detail={vomeroWorkbenchDetail} />);
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
});
