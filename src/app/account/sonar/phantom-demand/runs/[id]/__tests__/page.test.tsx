import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../page.js';

vi.mock('@/lib/server-haiwave-client', () => ({
  getServerHaiwaveClient: async () => ({
    getPhantomDemandRun: async () => ({
      run_id: 'r1',
      status: 'complete',
      scope_snapshot: {
        kind: 'phantom_demand',
        counterparty: 'cp1',
        skus: ['s1', 's2'],
        hypothetical_quantity: 100,
        hypothetical_timeline: null,
      },
      results: [
        {
          sku_id: 's1',
          payload: {
            kind: 'phantom_demand_response',
            responder_quoted_quantity: 100,
            responder_completeness: 'complete',
            responder_confidence: 'high',
            responder_response_time_ms: 142,
            responder_quoted_timeline: '2026-06-01T00:00:00Z',
            free_text_response: null,
          },
          synthesis_mode: 'direct',
          gap: null,
        },
        {
          sku_id: 's2',
          payload: { kind: 'phantom_demand_response' },
          synthesis_mode: 'redacted_gap',
          gap: { reason: 'responder_probe_limit_exhausted' },
        },
      ],
    }),
  }),
}));

describe('PD run detail page', () => {
  it('renders scope summary, probe rows, gap reasons', async () => {
    render(await Page({ params: { id: 'r1' } } as any));
    // Scope summary
    expect(screen.getByText(/Counterparty/)).toBeInTheDocument();
    // '100' appears in both quantity and quoted quantity
    expect(screen.getAllByText('100').length).toBeGreaterThan(0);
    // Gap reason
    expect(screen.getByText(/responder_probe_limit_exhausted/)).toBeInTheDocument();
  });

  it('renders statuses via the standard Pill primitive (run status + per-probe), not hand-rolled spans', async () => {
    render(await Page({ params: { id: 'r1' } } as any));
    const pills = screen.getAllByTestId('pill');
    // run-status pill + one probe-status pill per result row (2 results)
    expect(pills.length).toBeGreaterThanOrEqual(3);
    // Pill title-cases its value: run status + complete probe -> 'Complete'
    // (textContent also includes the sr-only definition tooltip text)
    expect(pills.some((p) => p.textContent?.includes('Complete'))).toBe(true);
    // gap row (redacted_gap synthesis_mode) renders as a 'No answer' verdict pill
    expect(pills.some((p) => p.textContent?.includes('No answer'))).toBe(true);
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
    await expect(FreshPage({ params: { id: 'r3' } } as any)).rejects.toThrow(
      /500/,
    );
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
    await expect(FreshPage({ params: { id: 'r4' } } as any)).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(notFound).toHaveBeenCalled();
  });

  it('shows the standard empty state when there are no probe results', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-haiwave-client', () => ({
      getServerHaiwaveClient: async () => ({
        getPhantomDemandRun: async () => ({
          run_id: 'r2',
          // non-running so CancelButton (useRouter) is not rendered
          status: 'complete',
          scope_snapshot: { kind: 'phantom_demand', counterparty: 'cp1', skus: [], hypothetical_quantity: 1, hypothetical_timeline: null },
          results: [],
        }),
      }),
    }));
    const { default: FreshPage } = await import('../page.js');
    render(await FreshPage({ params: { id: 'r2' } } as any));
    expect(screen.getByText(/No probe results yet/i)).toBeInTheDocument();
  });
});
