import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Task 17 — the run-detail page pivots to the SKU->vendor <ReadinessReport>
 * when the run's watcher scope carries `sku_asks` (a readiness watcher), and
 * otherwise keeps the legacy <CounterpartiesGrid>. These tests mock the BFF
 * `fetchBffJson` lane per the fetch order the page issues:
 *   1. run detail            (before the Promise.all)
 *   2. definition (template) ─┐
 *   3. partners              ─┤ Promise.all, array order
 *   4. manifest catalog      ─┤
 *   5. trailing-history      ─┘
 */
const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));

vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
  headers: () =>
    Promise.resolve(new Map([['host', 'localhost:3001']]) as unknown as Headers),
}));

// RunControls (rendered in the header) calls useRouter(); notFound() is only
// reached on a 404 run-detail response, which these tests don't exercise.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: vi.fn(),
}));

const RUN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TEMPLATE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const VENDOR_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function baseRun() {
  return {
    run_id: RUN_ID,
    template_id: TEMPLATE_ID,
    status: 'complete',
    triggered_at: '2026-07-21T00:00:00.000Z',
    depth_limit: 1,
    signal_types: ['order_fulfillment_history', 'soft_quoted_lead_time'],
  };
}

function orderHistoryResult() {
  return {
    result_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    run_id: RUN_ID,
    counterparty_participant_id: VENDOR_ID,
    signal_type: 'order_fulfillment_history',
    synthesis_mode: 'direct',
    payload: {
      kind: 'direct',
      active_orders: [{ po_number: 'PO-4471', quantity: 40, quoted_ship_date: '2026-09-12' }],
      recent_fulfillments: [
        { po_number: 'PO-4390', quantity: 30, quoted_ship_date: '2026-06-01', actual_ship_date: '2026-06-03' },
      ],
      calibrated: { days: 32, sample_count: 1 },
    },
    gap_reason: null,
    observed_at: '2026-07-21T00:00:00.000Z',
    tier: 1,
    aggregated_under_tier_1: null,
    external_product_id: 'PN-88A',
  };
}

beforeEach(() => {
  fetchBffJson.mockReset();
  // useRunStatus (SWR) polls the status endpoint via global.fetch; stub it so
  // the fetcher resolves instead of throwing an unhandled rejection.
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ status: 'complete' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});

describe('WatcherRunDetailPage — readiness vs legacy grid', () => {
  it('renders <ReadinessReport> when the watcher scope carries sku_asks', async () => {
    fetchBffJson
      // 1. run detail
      .mockResolvedValueOnce({ kind: 'ok', data: { run: baseRun(), results: [] } })
      // 2. definition — a readiness watcher (scope has sku_asks)
      .mockResolvedValueOnce({
        kind: 'ok',
        data: {
          template: {
            template_id: TEMPLATE_ID,
            template_name: 'Readiness — PN-88A',
            observation_class: 'watcher',
            scope: {
              kind: 'watcher',
              sku_asks: [{ sku: 'PN-88A', ask_quantity: 40, target_days: 30 }],
            },
          },
        },
      })
      // 3. partners
      .mockResolvedValueOnce({ kind: 'ok', data: [] })
      // 4. manifest catalog
      .mockResolvedValueOnce({ kind: 'ok', data: { products: [] } })
      // 5. trailing-history — one run, one (sku, vendor) with order history
      .mockResolvedValueOnce({
        kind: 'ok',
        data: {
          runs: [{ run_id: RUN_ID, triggered_at: '2026-07-21T00:00:00.000Z' }],
          results: [orderHistoryResult()],
        },
      });

    const { default: Page } = await import('../page');
    render(await Page({ params: Promise.resolve({ id: RUN_ID }) }));

    // ReadinessReport: the SKU heading + its forward-demand ask quantity.
    expect(screen.getByRole('heading', { name: 'PN-88A' })).toBeInTheDocument();
    expect(screen.getByText(/Ask: 40 units within 30 calendar days/)).toBeInTheDocument();
    // The order-state table (inside ReadinessReport) shows the active PO.
    expect(screen.getByText('PO-4471')).toBeInTheDocument();
    // NOT the legacy counterparties grid.
    expect(screen.queryByText('Counterparty observations')).not.toBeInTheDocument();
  });

  it('keeps the legacy <CounterpartiesGrid> for a non-readiness watcher (no sku_asks)', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { run: baseRun(), results: [] } })
      .mockResolvedValueOnce({
        kind: 'ok',
        data: {
          template: {
            template_id: TEMPLATE_ID,
            template_name: 'Lead-time watcher',
            observation_class: 'watcher',
            scope: { kind: 'watcher' },
          },
        },
      })
      .mockResolvedValueOnce({ kind: 'ok', data: [] })
      .mockResolvedValueOnce({ kind: 'ok', data: { products: [] } })
      .mockResolvedValueOnce({ kind: 'ok', data: { runs: [], results: [] } });

    const { default: Page } = await import('../page');
    render(await Page({ params: Promise.resolve({ id: RUN_ID }) }));

    expect(
      screen.getByRole('heading', { name: 'Counterparty observations' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Ask: .* units within/)).not.toBeInTheDocument();
  });
});
