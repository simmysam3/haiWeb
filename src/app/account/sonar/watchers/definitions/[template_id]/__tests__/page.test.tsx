import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * v1.85 — the watcher definition page reads `?tab=` and opens on that tab.
 * Fetch order the page issues: 1. definition detail, 2. runs list.
 */
const { fetchBffJson } = vi.hoisted(() => ({ fetchBffJson: vi.fn() }));
vi.mock('@/lib/server-fetch', () => ({ fetchBffJson }));

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => 'session=abc' }),
  headers: () => Promise.resolve(new Map([['host', 'localhost:3001']]) as unknown as Headers),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/account/sonar/watchers/definitions/t-1',
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}));

// The scope picker fetches partner/catalog data on mount; it is not under test.
vi.mock('../../../new/_components/watcher-scope-picker', () => ({
  WatcherScopePicker: () => <div data-testid="watcher-scope-picker" />,
}));

// A run for the (unconditional, template_id-scoped) runs fetch that feeds
// both the trend chart and the Run history table.
const ACTIVE_RUN = {
  run_id: 'r-active-1',
  initiator_participant_id: 'p-1',
  triggered_at: '2026-08-22T10:00:00.000Z',
  triggered_by_user_id: null,
  status: 'complete',
  completed_at: '2026-08-22T10:05:00.000Z',
  cancelled_at: null,
  depth_limit: 1,
  hop_count: 5,
  gap_count: 0,
  error_message: null,
  run_origin: 'template_scheduled',
  template_id: 't-1',
  signal_types: ['lead_time_distribution'],
  archived_at: null,
  results: [
    {
      counterparty_participant_id: 'cp-1',
      signal_type: 'lead_time_distribution',
      synthesis_mode: 'direct',
      payload: { percentiles: { p50: 5 } },
    },
  ],
};

const template = {
  template_id: 't-1',
  template_name: 'Acme lead-time watch',
  observation_class: 'watcher',
  cadence: { kind: 'manual_only' },
  enabled: true,
  retention_days: 90,
  created_at: '2026-05-08T12:00:00.000Z',
  last_run_at: null,
  scope: {
    kind: 'watcher',
    authorization_basis: 'bilateral',
    counterparties: ['acme-corp'],
    signal_types: ['lead_time_distribution'],
    skus: [],
    depth_limit: 1,
  },
};

beforeEach(() => {
  fetchBffJson.mockReset();
  fetchBffJson
    .mockResolvedValueOnce({ kind: 'ok', data: { template } })
    .mockResolvedValueOnce({ kind: 'ok', data: { runs: [] } });
  // Client-side SWR polling inside the history table.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ runs: [] }) }) as Response),
  );
});

async function renderPage(tab?: string, runs?: string) {
  const Page = (await import('../page')).default;
  const searchParams: Record<string, string> = {};
  if (tab) searchParams.tab = tab;
  if (runs) searchParams.runs = runs;
  const el = await Page({
    params: Promise.resolve({ template_id: 't-1' }),
    searchParams: Promise.resolve(searchParams),
  });
  render(el as React.ReactElement);
}

describe('WatcherDefinitionPage tabs', () => {
  it('opens on Run history when the URL carries no tab', async () => {
    await renderPage();
    expect(screen.getByRole('tab', { name: 'Run history' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Run history' })).toBeVisible();
  });

  it('opens on Configuration for ?tab=configuration, with the editor visible', async () => {
    await renderPage('configuration');
    expect(screen.getByRole('tab', { name: 'Configuration' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Identity' })).toBeVisible();
    // The runs panel is `hidden`, so ask for hidden nodes explicitly.
    expect(screen.getByRole('heading', { name: 'Run history', hidden: true })).not.toBeVisible();
  });

  it('falls back to Run history for an unknown tab value', async () => {
    await renderPage('bogus');
    expect(screen.getByRole('tab', { name: 'Run history' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('WatcherDefinitionPage — no Archived toggle (D-206 scope change)', () => {
  beforeEach(() => {
    fetchBffJson.mockReset();
    fetchBffJson.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/account/sonar/watcher/definitions/t-1')) {
        return { kind: 'ok', data: { template } };
      }
      if (path.startsWith('/api/account/sonar/watcher/runs')) {
        const scoped = path.includes('template_id=t-1');
        if (!scoped) return { kind: 'ok', data: { runs: [] } };
        return { kind: 'ok', data: { runs: [ACTIVE_RUN] } };
      }
      throw new Error(`unexpected BFF path ${path}`);
    });
    // Client-side SWR polling inside the history table.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ runs: [] }) }) as Response),
    );
  });

  it.each([
    ['no runs param', undefined],
    ['?runs=archived (now ignored)', 'archived'],
  ])('%s: fetches the runs list exactly once, scoped by template_id and without archived, and shows no Runs toggle', async (_label, runs) => {
    await renderPage(undefined, runs);

    const runsCalls = fetchBffJson.mock.calls
      .map(([path]) => String(path))
      .filter((path) => path.includes('/watcher/runs'));
    expect(runsCalls).toEqual(['/api/account/sonar/watcher/runs?template_id=t-1']);

    expect(screen.queryByRole('radiogroup', { name: 'Runs' })).not.toBeInTheDocument();
  });
});
