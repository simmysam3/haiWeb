import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { vomeroProject, vomeroWorkbenchDetail, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SmProductDetail } from '@/lib/sourcing-map/contract';
import ProductPage from '../page';

const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));
vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/sourcing-map/x',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/image', () => ({ default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} /> }));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  // The grid resolves pinned suppliers' names on mount (Cycle 24.6, d-G9); every lookup answers 404 here.
  fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => '{}' });
  vi.stubGlobal('fetch', fetchMock);
  fetchBffJson.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

/** Product B: another workbench product of the project, with its own name and two lines. */
const courtDetail: SmProductDetail = {
  ...vomeroWorkbenchDetail,
  product_id: VOMERO_IDS.court,
  name: 'Court Classic',
  lines: vomeroWorkbenchDetail.lines.slice(3).map((l, i) => ({
    ...l, line_id: `5a1e0000-0000-4000-8000-00000000030${i}`, product_id: VOMERO_IDS.court, position: i,
  })),
};

/** Answers the page's two reads by URL: the project, and the one product given. */
function serve(detail: SmProductDetail) {
  fetchBffJson.mockImplementation(async (url: string) => {
    if (url === `/api/account/sourcing-map/projects/${VOMERO_IDS.project}`) return { kind: 'ok', data: vomeroProject };
    if (url === `/api/account/sourcing-map/products/${detail.product_id}`) return { kind: 'ok', data: detail };
    return { kind: 'error', status: 404, message: '' };
  });
}

function page(productId: string) {
  return ProductPage({ params: Promise.resolve({ projectId: VOMERO_IDS.project, productId }) });
}

describe('/sourcing-map/[projectId]/products/[productId] page', () => {
  it('mounts the editor per product: moving to another product shows that product, never the last one’s unsaved edits', async () => {
    serve(vomeroWorkbenchDetail);
    const { rerender } = render(await page(VOMERO_IDS.pegasus));
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Pegasus Trail (edited)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
    expect(screen.getAllByRole('row', { name: /^Line / })).toHaveLength(6);

    serve(courtDetail);
    rerender(await page(VOMERO_IDS.court));
    expect(screen.getByLabelText('Product name')).toHaveValue('Court Classic');
    expect(screen.getAllByRole('row', { name: /^Line / })).toHaveLength(2);
    expect(screen.getByRole('row', { name: /^Line 1:/ })).toHaveTextContent('Metal eyelets');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Court Classic');
  });
});
