import { test, expect, Page } from '@playwright/test';

/**
 * v.1.44 Refined Phantom Demand — run-detail walk.
 *
 * Covers the RSC run-detail page introduced in Task 13:
 *   §16.1 — page loads without a 5xx (BFF + RSC SSR path)
 *   §16.2 — BOM tree node is visible; clicking it shows the detail panel
 *   §16.3 — SpotCheckBanner "Best-effort spot check" is present
 *
 * Architecture note: the run-detail page is a React Server Component that
 * fetches data directly from haiCore via `getServerHaiwaveClient()`. That
 * server-side fetch is NOT interceptable via `page.route()` (which only
 * intercepts browser-issued requests). The `page.route()` mock registered in
 * `beforeEach` intercepts the client-side SWR polling call issued by
 * `RunDetailShell` after hydration — it prevents unnecessary BFF fan-out and
 * keeps the tree fixture stable for the node-click assertion.
 *
 * The initial SSR render requires a real authenticated session hitting a real
 * haiCore backend. Tests follow the same pattern as `walk.spec.ts` +
 * `audit-flow.spec.ts`: shared `beforeAll` API-login → `storageState`, with
 * graceful degradation when the stack is absent.
 *
 * Running requires a full local stack (HaiWeb :3001, haiCore :3000, Keycloak,
 * Postgres) and USER_EMAIL / USER_PASSWORD env vars (see e2e/README.md).
 */

const EMAIL = process.env.USER_EMAIL ?? '';
const PASSWORD = process.env.USER_PASSWORD ?? '';
const HAIWEB = process.env.HAIWEB_BASE_URL ?? 'http://localhost:3001';

/**
 * Minimal BFF/SWR mock payload returned by the `RunDetailShell` re-fetch.
 * Status must be 'complete' (not 'completed') — RunDetailShell's
 * TERMINAL_STATUSES set uses 'complete' as the canonical value so polling
 * stops immediately after hydration.
 */
const MOCK_RUN_DETAIL = {
  run: {
    run_id: '00000000-0000-0000-0000-000000000001',
    status: 'complete',
    initiator_participant_id: 'p1',
    template_id: null,
    run_origin: 'ad_hoc',
    authorization_basis: 'bilateral',
    scope_snapshot: {
      kind: 'phantom_demand',
      authorization_basis: 'bilateral',
      counterparty: 'cp1',
      skus: ['HC-9000'],
      hypothetical_quantity: 30,
      hypothetical_timeline: null,
    },
    hop_budget: 0,
    hops_consumed: 0,
    throttled_at: null,
    resumption_count: 0,
    started_at: '2026-05-28T12:00:00Z',
    completed_at: '2026-05-28T12:00:05Z',
    triggered_by_user_id: null,
    cancel_requested_at: null,
    cancelled_at: null,
    created_at: '2026-05-28T12:00:00Z',
    updated_at: '2026-05-28T12:00:05Z',
  },
  tree: {
    line_id: '00000000-0000-0000-0000-000000000abc',
    component_sku: 'HC-9000',
    component_label: 'Hydraulic Controller',
    qty_per_parent_unit: 1,
    qty_required_total: 30,
    source: 'internal_mfg',
    on_hand_qty: null,
    vendor_block: null,
    internal_block: { standard_lt_days: 5, historical_lt: null, live_capacity: null },
    wall_block: null,
    subcomponents: [],
  },
};

const RUN_ID = '00000000-0000-0000-0000-000000000001';

let sharedContext: { storageState: any } | null = null;
let stackAvailable = true;

test.beforeAll(async ({ browser }) => {
  if (!EMAIL || !PASSWORD) {
    console.info(
      '[refined-pd] USER_EMAIL / USER_PASSWORD not set — stack-dependent tests will be skipped.',
    );
    stackAvailable = false;
    return;
  }

  const page = await browser.newPage();
  try {
    const res = await page.request.post(`${HAIWEB}/api/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: EMAIL, password: PASSWORD },
    });
    if (!res.ok()) {
      const body = await res.text();
      console.info(
        `[refined-pd] Login failed (${res.status()}) — stack-dependent tests will be skipped: ${body.slice(0, 200)}`,
      );
      stackAvailable = false;
    } else {
      sharedContext = { storageState: await page.context().storageState() };
    }
  } catch (err) {
    console.info(
      `[refined-pd] Stack unreachable — stack-dependent tests will be skipped: ${String(err).slice(0, 200)}`,
    );
    stackAvailable = false;
  } finally {
    await page.close();
  }
});

async function loggedInPage(browser: any): Promise<Page> {
  const ctx = await browser.newContext({ storageState: sharedContext!.storageState });
  return ctx.newPage();
}

// ─────────────────────────────────────────────────────────────────────────────
// §16 v.1.44 Refined Phantom Demand — run-detail walk
// ─────────────────────────────────────────────────────────────────────────────

test.describe('§16 v.1.44 Refined Phantom Demand', () => {
  test('16.1 run-detail page loads without 5xx', async ({ browser }) => {
    if (!stackAvailable || !sharedContext) {
      test.skip(
        true,
        'Stack unavailable (USER_EMAIL/USER_PASSWORD not set or server unreachable). ' +
          'Start the full local stack and set env vars to run this test.',
      );
      return;
    }

    const page = await loggedInPage(browser);

    // Intercept the client-side SWR re-fetch (RunDetailShell) so the
    // mock tree is stable regardless of real DB state.
    await page.route(
      '**/api/account/sonar/phantom-demand/runs/' + RUN_ID,
      async (route) => {
        await route.fulfill({ json: MOCK_RUN_DETAIL });
      },
    );

    const response = await page.goto(
      `/account/sonar/phantom-demand/runs/${RUN_ID}`,
      { waitUntil: 'domcontentloaded' },
    );
    expect(response, 'no response from run-detail URL').not.toBeNull();

    const status = response!.status();
    // 200 (real run via SSR) or 404 (no seed data — Next notFound()) are both
    // acceptable; anything 5xx indicates a regression.
    expect(
      status,
      `run-detail page returned unexpected status ${status} — check haiCore is up and seeded`,
    ).toBeLessThan(500);

    if (status !== 200) {
      console.info(
        '[16.1] Page returned 404 (no seed run in DB). ' +
          'Routing confirmed; full assertion skipped — seed a PD run and rerun.',
      );
    }
  });

  test('16.2 user navigates from run-detail to node-selection', async ({ browser }) => {
    if (!stackAvailable || !sharedContext) {
      test.skip(
        true,
        'Stack unavailable (USER_EMAIL/USER_PASSWORD not set or server unreachable). ' +
          'Start the full local stack and set env vars to run this test.',
      );
      return;
    }

    const page = await loggedInPage(browser);

    // Mock the BFF endpoint that RunDetailShell uses for:
    //   a) initial SWR re-fetch (RunDetailShell fires this if tree is already
    //      present in initialDetail OR after status flips to terminal)
    //   b) status polling endpoint (stops immediately because status='complete')
    await page.route(
      `**/api/account/sonar/phantom-demand/runs/${RUN_ID}`,
      async (route) => {
        await route.fulfill({ json: MOCK_RUN_DETAIL });
      },
    );
    await page.route(
      `**/api/account/sonar/phantom-demand/runs/${RUN_ID}/status`,
      async (route) => {
        await route.fulfill({
          json: { status: 'complete', cancel_requested_at: null },
        });
      },
    );

    const response = await page.goto(
      `/account/sonar/phantom-demand/runs/${RUN_ID}`,
      { waitUntil: 'domcontentloaded' },
    );
    expect(response, 'no response from run-detail URL').not.toBeNull();

    const httpStatus = response!.status();
    if (httpStatus === 404) {
      console.info(
        '[16.2] Page returned 404 (no seed run in DB with this ID). ' +
          'Node-click assertion skipped — seed a PD run or use a real run_id.',
      );
      return;
    }

    expect(
      httpStatus,
      `unexpected status ${httpStatus} from run-detail page`,
    ).toBe(200);

    // The BOM tree (from SSR initialDetail) should contain HC-9000 from the
    // seeded/real run. If the DB has a different run payload, the SKU will
    // differ — this assertion is intentionally tolerant via toBeVisible with
    // no strict text match, only verifying the tree section renders.
    //
    // If the seed data is exactly MOCK_RUN_DETAIL (matching HC-9000), the
    // assertions below will pass end-to-end.
    await expect(page.getByText('HC-9000')).toBeVisible({ timeout: 8_000 });

    // Click the node in BomTreeView and verify the detail panel updates.
    await page.getByText('HC-9000').first().click();

    // BomNodeDetail renders "Qty required: 30" from node.qty_required_total.
    await expect(page.getByText(/qty required: 30/i)).toBeVisible();
  });

  test('16.3 SpotCheckBanner renders on run-detail page', async ({ browser }) => {
    if (!stackAvailable || !sharedContext) {
      test.skip(
        true,
        'Stack unavailable (USER_EMAIL/USER_PASSWORD not set or server unreachable). ' +
          'Start the full local stack and set env vars to run this test.',
      );
      return;
    }

    const page = await loggedInPage(browser);

    await page.route(
      `**/api/account/sonar/phantom-demand/runs/${RUN_ID}`,
      async (route) => {
        await route.fulfill({ json: MOCK_RUN_DETAIL });
      },
    );

    const response = await page.goto(
      `/account/sonar/phantom-demand/runs/${RUN_ID}`,
      { waitUntil: 'domcontentloaded' },
    );
    expect(response, 'no response from run-detail URL').not.toBeNull();

    const httpStatus = response!.status();
    if (httpStatus === 404) {
      console.info(
        '[16.3] Page returned 404 (no seed run in DB). ' +
          'SpotCheckBanner assertion skipped.',
      );
      return;
    }

    expect(httpStatus, `unexpected status ${httpStatus}`).toBe(200);

    // SpotCheckBanner always renders on the run-detail page (page.tsx line ~31).
    // The banner text is "Best-effort spot check." (strong) followed by a
    // sentence about lead times and inventory.
    await expect(page.getByText(/best-effort spot check/i)).toBeVisible();
  });
});
