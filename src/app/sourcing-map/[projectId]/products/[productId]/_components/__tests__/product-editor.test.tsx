import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vomeroWorkbenchDetail, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { ProductEditor } from '../product-editor';

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
});
