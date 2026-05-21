import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * v1.37 R2 — the Sonar Dashboard absorbed the full Coverage surface from
 * the old `/sonar/posture` landing. These tests assert the dashboard
 * renders the Coverage section heading + the stats strip + the trend
 * empty-state alongside the pre-R2 cross-modality content.
 *
 * The page is a server component that pulls from `cookies()`, `headers()`,
 * `fetchBffJson`, and a local `fetchJson` (best-effort raw fetch). We mock
 * the BFF wrapper + raw fetch directly so the test exercises the
 * composition logic without booting Next.js plumbing.
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
// jsdom test env has no app-router context, so we stub it here.
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

beforeEach(() => {
  fetchBffJson.mockReset();
  // Raw fetch returns null payloads (dashboard tolerates that) plus the
  // audit-runs lane that feeds the Geo/Class/Partners charts. We let
  // those return empty so the page still renders the structural shells.
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

describe('UnifiedDashboardPage — v1.37 R2 coverage absorption', () => {
  it('renders the Coverage section heading and the cross-modality overview heading', async () => {
    fetchBffJson
      // First call: coverage current → snapshot 50% complete.
      .mockResolvedValueOnce({
        kind: 'ok',
        data: { snapshot: snapshot(25) },
      })
      // Second call: coverage trend → 2 snapshots so the trend chart renders.
      .mockResolvedValueOnce({
        kind: 'ok',
        data: { points: [snapshot(20), snapshot(25)] },
      });

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

    const { default: Page } = await import('../page');
    render(await Page());

    expect(
      screen.getByText(/do not have permission to view compliance coverage/i),
    ).toBeInTheDocument();
  });
});
