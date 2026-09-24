import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vomeroProducts, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { LibraryTab } from '../library-tab';

const { push, refresh, replace } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, replace }),
  usePathname: () => '/sourcing-map/x',
  useSearchParams: () => new URLSearchParams(),
}));
// next/link renders an <a> in tests (the house idiom, src/components/__tests__/account-nav.test.tsx:16-20)
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}

describe('LibraryTab', () => {
  it('lists each product with its source, variants, line count, readiness and a drill-down', () => {
    render(<LibraryTab projectId={VOMERO_IDS.project} initialProducts={vomeroProducts} />);
    const metcon = screen.getByRole('row', { name: /Metcon Iron/ });
    expect(within(metcon).getByText('Agent')).toBeInTheDocument();
    expect(within(metcon).getByText("13 · Men's US")).toBeInTheDocument();
    expect(within(metcon).getByText('2')).toBeInTheDocument();
    expect(within(metcon).getByText('Ready')).toBeInTheDocument();
    expect(within(metcon).getByRole('link', { name: 'Open Metcon Iron' })).toHaveAttribute(
      'href',
      `/sourcing-map/${VOMERO_IDS.project}/products/${VOMERO_IDS.metcon}`,
    );
  });

  it('creates a workbench product and opens its editor', async () => {
    fetchMock.mockResolvedValue(reply(201, { ...vomeroProducts[0], product_id: VOMERO_IDS.court }));
    render(<LibraryTab projectId={VOMERO_IDS.project} initialProducts={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New product' }));
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Court Classic' } });
    fireEvent.change(screen.getByLabelText('Assembly days'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create product' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/sourcing-map/${VOMERO_IDS.project}/products/${VOMERO_IDS.court}`));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      name: 'Court Classic', unit_label: 'pairs', bom_source: 'workbench', agent_root_sku: null, variant_axis: null, assembly_days: 21,
    });
  });

  it('refuses to delete a product a run uses and names the runs (spec §10)', async () => {
    fetchMock.mockResolvedValue(reply(409, {
      error: {
        code: 'product_in_use', message: 'Pegasus Trail is used by 1 run.', timestamp: '2026-09-23T10:00:00.000Z', request_id: 'req-1',
        details: { code: 'product_in_use', runs: [{ template_id: VOMERO_IDS.template, template_name: 'Line A base' }] },
      },
    }));
    render(<LibraryTab projectId={VOMERO_IDS.project} initialProducts={vomeroProducts} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Pegasus Trail' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Pegasus Trail is used by Line A base. Remove it from those runs first.');
    expect(screen.getByRole('row', { name: /Pegasus Trail/ })).toBeInTheDocument();
  });

  it('opens "+ New product" without a stale delete error (controller ruling, Task 21 finding 2a)', async () => {
    fetchMock.mockResolvedValue(reply(409, {
      error: {
        code: 'product_in_use', message: 'Pegasus Trail is used by 1 run.',
        details: { code: 'product_in_use', runs: [{ template_id: VOMERO_IDS.template, template_name: 'Line A base' }] },
      },
    }));
    render(<LibraryTab projectId={VOMERO_IDS.project} initialProducts={vomeroProducts} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Pegasus Trail' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '+ New product' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
