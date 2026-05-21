import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * v1.37 R2 — the Sonar Dashboard absorbed the full Coverage surface from
 * the old `/sonar/posture` landing. v1.37 polish item 1 then unified ALL
 * BFF lanes onto `fetchBffJson` (no more local fetchJson null-coalescer);
 * these tests assert the page still composes correctly after the unify.
 *
 * Call order matters: `loadCoverage()` is invoked BEFORE the outer
 * `Promise.all` (assigned to `coveragePromise` first) so its two internal
 * `fetchBffJson` calls fire first, then the four best-effort lanes inside
 * the Promise.all (cross-modality / activity / throttled / templates).
 * The raw `loadAuditChartData` lane keeps its `global.fetch` mock since
 * it operates against a different API prefix.
 */
const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));

vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
  headers: () =>
    Promise.resolve(
      new Map([
        ['host', 'localhost:3001'],
        ['x-forwarded-proto', 'http'],
      ]) as unknown as Headers,
    ),
}));

// RefreshButton (rendered inside ActivityFeed) calls `useRouter()`; the
// jsdom test env has no app-router context, so we stub it here. The sticky
// sub-nav also calls `usePathname`/`useSearchParams` through the App
// Router; the stubs cover both.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => '/account/sonar/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

// `getActiveScopes` lives in the sibling `_lib/scopes` module — mock it so
// the page renders past the gate.
vi.mock('../../_lib/scopes', () => ({
  getActiveScopes: () =>
    Promise.resolve({ kind: 'ok', scopes: ['scope-1'] }),
}));

// Mock recharts at the top to keep test output focused on structure (chart
// containers render into the DOM; we don't need pixel-accurate svgs).
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="recharts-responsive">{children}</div>
    ),
  };
});

function snapshot(complete: number) {
  return {
    snapshot_id: 'snap-1',
    snapshot_completed_at: '2026-05-21T00:00:00.000Z',
    coverage_total_products: 50,
    coverage_complete_products: complete,
    coverage_partial_products: 0,
    coverage_no_traversal_products: 50 - complete,
    complete_pct: (complete / 50) * 100,
    partial_pct: 0,
    no_traversal_pct: ((50 - complete) / 50) * 100,
  };
}

/**
 * Queue the four best-effort lanes (cross-modality / activity / throttled
 * / templates) as ok-empty so the page renders past them. Coverage current
 * + trend are queued FIRST because `loadCoverage` fires before the outer
 * Promise.all (see file-header comment).
 */
function queueDefaultBestEffortLanes() {
  fetchBffJson
    .mockResolvedValueOnce({
      kind: 'ok',
      data: { partners: [], generated_at: '', partial: { audit: false, phantom_demand: false, watcher: false } },
    })
    .mockResolvedValueOnce({ kind: 'ok', data: { events: [] } })
    .mockResolvedValueOnce({ kind: 'ok', data: { audit: 0, watcher: 0, total: 0 } })
    .mockResolvedValueOnce({ kind: 'ok', data: { templates: [] } });
}

beforeEach(() => {
  fetchBffJson.mockReset();
  // `loadAuditChartData` still uses raw `fetch` against a different API
  // prefix; keep the runs lane empty so the chart shells render.
  global.fetch = vi.fn().mockImplementation(async (url: string) => {
    if (url.includes('/api/account/audit-runs?limit=25')) {
      return new Response(JSON.stringify({ runs: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('null', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
});

describe('UnifiedDashboardPage — v1.37 R2 coverage absorption + polish unify', () => {
  it('renders the Coverage section heading and the cross-modality overview heading', async () => {
    fetchBffJson
      .mockResolvedValueOnce({
        kind: 'ok',
        data: { snapshot: snapshot(25) },
      })
      .mockResolvedValueOnce({
        kind: 'ok',
        data: { points: [snapshot(20), snapshot(25)] },
      });
    queueDefaultBestEffortLanes();

    const { default: Page } = await import('../page');
    render(await Page());

    // Section headings prove the composition: Coverage on top, Cross-modality below.
    expect(screen.getByRole('heading', { name: /Compliance coverage/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Cross-modality overview/i })).toBeInTheDocument();
    // The full-coverage stats strip renders its tile labels.
    expect(screen.getByText(/Total products/i)).toBeInTheDocument();
    // The 'What these numbers mean' explainer carried forward from R1.
    expect(screen.getByText(/What these numbers mean/i)).toBeInTheDocument();
    // 'Complete' tile + 'Complete' bullet both exist — assert at least one.
    expect(screen.getAllByText(/^Complete$/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows the onboarding empty-state when no completed snapshot exists', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { snapshot: null } })
      .mockResolvedValueOnce({ kind: 'ok', data: { points: [] } });
    queueDefaultBestEffortLanes();

    const { default: Page } = await import('../page');
    render(await Page());

    expect(
      screen.getByText(/No completed compliance snapshot yet/i),
    ).toBeInTheDocument();
    // The cross-modality section still renders below.
    expect(
      screen.getByRole('heading', { name: /Cross-modality overview/i }),
    ).toBeInTheDocument();
  });

  it('renders a status-aware error banner on a 403 coverage current response', async () => {
    fetchBffJson
      .mockResolvedValueOnce({
        kind: 'error',
        status: 403,
        message: 'forbidden',
      })
      .mockResolvedValueOnce({ kind: 'ok', data: { points: [] } });
    queueDefaultBestEffortLanes();

    const { default: Page } = await import('../page');
    render(await Page());

    expect(
      screen.getByText(/do not have permission to view compliance coverage/i),
    ).toBeInTheDocument();
  });

  it('renders the sticky sub-nav with all three section anchors', async () => {
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { snapshot: snapshot(25) } })
      .mockResolvedValueOnce({ kind: 'ok', data: { points: [] } });
    queueDefaultBestEffortLanes();

    const { default: Page } = await import('../page');
    render(await Page());

    const nav = screen.getByTestId('dashboard-subnav');
    expect(nav).toBeInTheDocument();
    // Anchor links present (not route changes — in-page jumps).
    expect(nav.querySelector('a[href="#section-coverage"]')).toBeTruthy();
    expect(nav.querySelector('a[href="#section-cross-modality"]')).toBeTruthy();
    expect(nav.querySelector('a[href="#section-activity"]')).toBeTruthy();
  });

  it('best-effort lanes that error out degrade gracefully (page still renders)', async () => {
    // Coverage lanes ok, but cross-modality + activity + throttled +
    // templates all error. The page must still render without throwing.
    fetchBffJson
      .mockResolvedValueOnce({ kind: 'ok', data: { snapshot: snapshot(25) } })
      .mockResolvedValueOnce({ kind: 'ok', data: { points: [snapshot(20), snapshot(25)] } })
      .mockResolvedValueOnce({ kind: 'error', status: 500, message: 'boom' })
      .mockResolvedValueOnce({ kind: 'error', status: 500, message: 'boom' })
      .mockResolvedValueOnce({ kind: 'error', status: 500, message: 'boom' })
      .mockResolvedValueOnce({ kind: 'error', status: 500, message: 'boom' });

    // Console errors are EXPECTED here — the unwrapBestEffort adapter logs
    // every transport failure. Silence them so the test output stays
    // readable.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { default: Page } = await import('../page');
    render(await Page());

    expect(screen.getByRole('heading', { name: /Compliance coverage/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Cross-modality overview/i })).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
