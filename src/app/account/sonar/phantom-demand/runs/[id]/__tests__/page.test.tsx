import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../page.js';

// RunDetailShell is a client component that uses SWR — stub it out so the
// page test stays in Server Component territory.
vi.mock('../_components/run-detail-shell', () => ({
  RunDetailShell: ({ initialDetail }: { initialDetail: { tree: unknown } }) => (
    <div data-testid="run-detail-shell">
      {initialDetail.tree ? 'has-tree' : 'no-tree'}
    </div>
  ),
}));

const makeTree = () => ({
  line_id: '00000000-0000-0000-0000-000000000001',
  component_sku: 'HC-9000',
  component_label: 'Hydraulic Controller',
  qty_per_parent_unit: 1,
  qty_required_total: 30,
  source: 'internal_mfg' as const,
  on_hand_qty: null,
  vendor_block: null,
  internal_block: { standard_lt_days: 5, historical_lt: null, live_capacity: null },
  wall_block: null,
  subcomponents: [],
});

vi.mock('@/lib/server-haiwave-client', () => ({
  getServerHaiwaveClient: async () => ({
    getPhantomDemandRun: async () => ({
      run: {
        run_id: 'r1',
        status: 'complete',
        completed_at: '2026-05-28T10:00:00Z',
        created_at: '2026-05-28T09:55:00Z',
        initiator_participant_id: 'p1',
        template_id: null,
        run_origin: 'ad_hoc',
        authorization_basis: 'bilateral',
        scope_snapshot: { kind: 'phantom_demand', authorization_basis: 'bilateral', counterparty: 'cp1', skus: ['s1'], hypothetical_quantity: 100, hypothetical_timeline: null },
        hop_budget: 10,
        hops_consumed: 5,
        throttled_at: null,
        resumption_count: 0,
        cancel_requested_at: null,
        cancelled_at: null,
        started_at: '2026-05-28T09:55:30Z',
        triggered_by_user_id: null,
        updated_at: '2026-05-28T10:00:00Z',
      },
      tree: makeTree(),
    }),
  }),
}));

describe('PD run detail page', () => {
  it('renders the SpotCheckBanner', async () => {
    render(await Page({ params: { id: 'r1r1r1r1-rest' } } as any));
    expect(screen.getByText(/Best-effort spot check/i)).toBeInTheDocument();
  });

  it('renders RunDetailShell with the BOM tree from getPhantomDemandRun', async () => {
    render(await Page({ params: { id: 'r1r1r1r1-rest' } } as any));
    const shell = screen.getByTestId('run-detail-shell');
    expect(shell).toBeInTheDocument();
    expect(shell.textContent).toBe('has-tree');
  });

  it('propagates a non-404 fetch failure instead of masking it as not-found', async () => {
    vi.resetModules();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notFound = vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
    vi.doMock('next/navigation', () => ({ notFound, redirect: vi.fn() }));
    vi.doMock('@/lib/server-haiwave-client', () => ({
      getServerHaiwaveClient: async () => ({
        getPhantomDemandRun: async () => {
          throw Object.assign(new Error('haiCore GET …: 500'), { status: 500 });
        },
      }),
    }));
    const { default: FreshPage } = await import('../page.js');
    await expect(FreshPage({ params: { id: 'r3' } } as any)).rejects.toThrow(/500/);
    expect(notFound).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      '[pd-run-detail] fetch failed',
      expect.objectContaining({ id: 'r3' }),
    );
    consoleError.mockRestore();
  });

  it('renders the not-found page on a genuine 404', async () => {
    vi.resetModules();
    const notFound = vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
    });
    vi.doMock('next/navigation', () => ({ notFound, redirect: vi.fn() }));
    vi.doMock('@/lib/server-haiwave-client', () => ({
      getServerHaiwaveClient: async () => ({
        getPhantomDemandRun: async () => {
          throw Object.assign(new Error('haiCore GET …: 404'), { status: 404 });
        },
      }),
    }));
    const { default: FreshPage } = await import('../page.js');
    await expect(FreshPage({ params: { id: 'r4' } } as any)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
