import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { vomeroDetail, vomeroExecution, vomeroProducts, vomeroProject, vomeroRunTemplate, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';

const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));
vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => `/sourcing-map/${VOMERO_IDS.project}/runs/${VOMERO_IDS.template}`,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/image', () => ({ default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} /> }));
vi.mock('swr', () => ({ default: () => ({ data: undefined, error: undefined }) }));
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ readiness: { ready: true, first_failing_rule: null, detail: null }, slot_count: 5, probe_count: 7, probe_count_worst_case: 10, responders_short: [] }) }));

// A queued answer a test leaves unread must never reach the next test.
beforeEach(() => fetchBffJson.mockReset());

/** The five reads of a good load, in the page's order: run, project, products, executions, newest detail. */
function queueGoodLoad() {
  fetchBffJson
    .mockResolvedValueOnce({ kind: 'ok', data: { template: vomeroRunTemplate } })
    .mockResolvedValueOnce({ kind: 'ok', data: vomeroProject })
    .mockResolvedValueOnce({ kind: 'ok', data: { products: vomeroProducts } })
    .mockResolvedValueOnce({ kind: 'ok', data: { executions: [vomeroExecution] } })
    .mockResolvedValueOnce({ kind: 'ok', data: vomeroDetail });
}

describe('run workspace page', () => {
  it('loads the run, its project, the library, the executions and the latest result, and renders the map', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { template: vomeroRunTemplate } })
      .mockResolvedValueOnce({ kind: 'ok', data: vomeroProject })
      .mockResolvedValueOnce({ kind: 'ok', data: { products: vomeroProducts } })
      .mockResolvedValueOnce({ kind: 'ok', data: { executions: [vomeroExecution] } })
      .mockResolvedValueOnce({ kind: 'ok', data: vomeroDetail });
    const { default: Page } = await import('../page');
    render(await Page({ params: Promise.resolve({ projectId: VOMERO_IDS.project, templateId: VOMERO_IDS.template }) }));
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Projects›Spring 2027›Line A base');
    expect(screen.getByText('96,000 pairs · 6 drops')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Sourcing map' })).toBeInTheDocument();
    expect(screen.getByText('CSG Footwear Vietnam')).toBeInTheDocument();
    expect(fetchBffJson).toHaveBeenLastCalledWith(`/api/account/sourcing-map/executions/${VOMERO_IDS.execution}`);
  });

  it('is a 404 when the run is not the caller’s', async () => {
    fetchBffJson.mockReset();
    fetchBffJson.mockResolvedValueOnce({ kind: 'error', status: 404, message: '' });
    const { default: Page } = await import('../page');
    await expect(Page({ params: Promise.resolve({ projectId: VOMERO_IDS.project, templateId: VOMERO_IDS.template }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('is a 404, before any fetch, when the run segment is not an id (R6: Next hands the page "..%2F" decoded)', async () => {
    // Without the guard every read answers, so the page would render.
    queueGoodLoad();
    const { default: Page } = await import('../page');
    await expect(Page({ params: Promise.resolve({ projectId: VOMERO_IDS.project, templateId: decodeURIComponent('..%2Fprojects') }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(fetchBffJson).not.toHaveBeenCalled();
  });

  it('shows an alert when the project read fails, never a silent fallback name (R1)', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { template: vomeroRunTemplate } })
      .mockResolvedValueOnce({ kind: 'error', status: 500, message: '' })
      .mockResolvedValueOnce({ kind: 'ok', data: { products: vomeroProducts } })
      .mockResolvedValueOnce({ kind: 'ok', data: { executions: [vomeroExecution] } })
      .mockResolvedValueOnce({ kind: 'ok', data: vomeroDetail });
    const { default: Page } = await import('../page');
    render(await Page({ params: Promise.resolve({ projectId: VOMERO_IDS.project, templateId: VOMERO_IDS.template }) }));
    // By text, then role: the fixture's answers turn stale after 2026-09-30 and add an alert of their own.
    expect(screen.getByText('The project could not be loaded (500). Try again in a moment.')).toHaveAttribute('role', 'alert');
  });

  it('shows an alert and disables Configure when the product library read fails (R1)', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { template: vomeroRunTemplate } })
      .mockResolvedValueOnce({ kind: 'ok', data: vomeroProject })
      .mockResolvedValueOnce({ kind: 'error', status: 502, message: '' })
      .mockResolvedValueOnce({ kind: 'ok', data: { executions: [vomeroExecution] } })
      .mockResolvedValueOnce({ kind: 'ok', data: vomeroDetail });
    const { default: Page } = await import('../page');
    render(await Page({ params: Promise.resolve({ projectId: VOMERO_IDS.project, templateId: VOMERO_IDS.template }) }));
    expect(screen.getByText('Products could not be loaded (502). Try again in a moment.')).toHaveAttribute('role', 'alert');
    // A tray over an empty library could Apply a scope that drops products.
    expect(screen.getByRole('button', { name: 'Configure' })).toBeDisabled();
  });

  it('shows an alert, and never "No execution yet", when the executions read fails (R1)', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { template: vomeroRunTemplate } })
      .mockResolvedValueOnce({ kind: 'ok', data: vomeroProject })
      .mockResolvedValueOnce({ kind: 'ok', data: { products: vomeroProducts } })
      .mockResolvedValueOnce({ kind: 'error', status: 500, message: '' });
    const { default: Page } = await import('../page');
    render(await Page({ params: Promise.resolve({ projectId: VOMERO_IDS.project, templateId: VOMERO_IDS.template }) }));
    expect(screen.getByText('Results could not be loaded (500). Try again in a moment.')).toHaveAttribute('role', 'alert');
    expect(screen.queryByText(/No execution yet/)).toBeNull();
  });

  it('shows an alert, and never "No execution yet", when the newest result read fails (R1)', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { template: vomeroRunTemplate } })
      .mockResolvedValueOnce({ kind: 'ok', data: vomeroProject })
      .mockResolvedValueOnce({ kind: 'ok', data: { products: vomeroProducts } })
      .mockResolvedValueOnce({ kind: 'ok', data: { executions: [vomeroExecution] } })
      .mockResolvedValueOnce({ kind: 'error', status: 500, message: '' });
    const { default: Page } = await import('../page');
    render(await Page({ params: Promise.resolve({ projectId: VOMERO_IDS.project, templateId: VOMERO_IDS.template }) }));
    expect(screen.getByText('The latest result could not be loaded (500). Try again in a moment.')).toHaveAttribute('role', 'alert');
    expect(screen.queryByText(/No execution yet/)).toBeNull();
  });

  it('is a 404, before any fetch, when the project segment is not an id (R6)', async () => {
    queueGoodLoad();
    const { default: Page } = await import('../page');
    await expect(Page({ params: Promise.resolve({ projectId: decodeURIComponent('..%2F..%2Fx'), templateId: VOMERO_IDS.template }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(fetchBffJson).not.toHaveBeenCalled();
  });
});
