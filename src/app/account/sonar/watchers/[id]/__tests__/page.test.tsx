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

function softQuoteResult() {
  return {
    result_id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    run_id: RUN_ID,
    counterparty_participant_id: VENDOR_ID,
    signal_type: 'soft_quoted_lead_time',
    synthesis_mode: 'direct',
    payload: {
      kind: 'direct',
      days: 34,
      availability: 'available',
      ask_quantity: 40,
      resolved_via: 'phantom_demand_bom',
      observed_at: '2026-07-21T00:00:00.000Z',
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
    // With no manifest product name the h3 falls back to the SKU, and the
    // header also renders the SKU in its trailing mono span — so the accessible
    // name is "PN-88A PN-88A". Match on containment at level 3 (the page h1 is
    // the template name, which contains the SKU too).
    expect(
      screen.getByRole('heading', { level: 3, name: /PN-88A/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Current ask: 40 units within 30 calendar days/)).toBeInTheDocument();
    // The order-state table (inside ReadinessReport) shows the active PO.
    expect(screen.getByText('PO-4471')).toBeInTheDocument();
    // NOT the legacy counterparties grid.
    expect(screen.queryByText('Counterparty observations')).not.toBeInTheDocument();
  });

  // Both of these pin the <UnqualifiedWatchBanner> WIRING, which type-checks
  // either way and is therefore invisible to the component's own tests. The
  // banner must speak for the run, not for the template (whose scope is mutable)
  // and not for the trailing history (which spans other runs).
  it('reads the run’s recorded asks, not the template’s current scope', async () => {
    fetchBffJson
      // 1. run detail — THIS run recorded no asks
      .mockResolvedValueOnce({
        kind: 'ok',
        data: { run: { ...baseRun(), sku_asks: [] }, results: [] },
      })
      // 2. definition — the template HAS an ask today (added after the run)
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
      .mockResolvedValueOnce({ kind: 'ok', data: [] })
      .mockResolvedValueOnce({ kind: 'ok', data: { products: [] } })
      .mockResolvedValueOnce({
        kind: 'ok',
        data: {
          runs: [{ run_id: RUN_ID, triggered_at: '2026-07-21T00:00:00.000Z' }],
          results: [orderHistoryResult()],
        },
      });

    const { default: Page } = await import('../page');
    render(await Page({ params: Promise.resolve({ id: RUN_ID }) }));

    // Confident wording proves run state was read. Sourcing it from the template
    // would instead yield the asks-existed copy.
    expect(screen.getByRole('alert')).toHaveTextContent(
      /no per-SKU forward-demand ask was defined/i,
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent(/could not be resolved/i);

    // The readiness section still renders the template's ask below the banner —
    // that is intended — but it must be QUALIFIED as the current ask. Bare
    // "Ask: 40 units..." next to "no ask was defined for this run" reads as a
    // flat contradiction on the same screen.
    expect(screen.getByText(/Current ask: 40 units within 30 calendar days/)).toBeInTheDocument();
  });

  it('counts soft quotes from this run only, not the trailing history', async () => {
    fetchBffJson
      // 1. run detail — THIS run produced no soft quote
      .mockResolvedValueOnce({
        kind: 'ok',
        data: { run: { ...baseRun(), sku_asks: [] }, results: [] },
      })
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
      .mockResolvedValueOnce({ kind: 'ok', data: [] })
      .mockResolvedValueOnce({ kind: 'ok', data: { products: [] } })
      // 5. trailing history — an EARLIER run did resolve a soft quote
      .mockResolvedValueOnce({
        kind: 'ok',
        data: {
          runs: [{ run_id: RUN_ID, triggered_at: '2026-07-21T00:00:00.000Z' }],
          results: [orderHistoryResult(), softQuoteResult()],
        },
      });

    const { default: Page } = await import('../page');
    render(await Page({ params: Promise.resolve({ id: RUN_ID }) }));

    // The banner must still appear: counting over history would suppress it on
    // the strength of a different run's outcome.
    expect(screen.getByRole('alert')).toHaveTextContent(
      /no per-SKU forward-demand ask was defined/i,
    );
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
    expect(screen.queryByText(/current ask: .* units within/i)).not.toBeInTheDocument();
  });
});
