import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

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

// D-206 — a run whose definition was deleted with runs=archive carries
// archived_at. The runs BFF returns it only when the request URL carries
// `archived=true` (Task 2's contract), so a page that forgets the param
// never sees it.
const ARCHIVED_RUN = {
  run_id: 'r-arch-1',
  initiator_participant_id: 'p-1',
  triggered_at: '2026-08-20T10:00:00.000Z',
  triggered_by_user_id: null,
  status: 'complete',
  completed_at: '2026-08-20T10:05:00.000Z',
  cancelled_at: null,
  depth_limit: 1,
  hop_count: 5,
  gap_count: 0,
  error_message: null,
  run_origin: 'template_scheduled',
  template_id: 't-1',
  signal_types: ['lead_time_distribution'],
  archived_at: '2026-08-25T00:00:00.000Z',
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

describe('WatcherDefinitionPage — runs filter (D-206)', () => {
  beforeEach(() => {
    fetchBffJson.mockReset();
    fetchBffJson.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/account/sonar/watcher/definitions/t-1')) {
        return { kind: 'ok', data: { template } };
      }
      if (path.startsWith('/api/account/sonar/watcher/runs')) {
        const archived = path.includes('archived=true');
        const scoped = path.includes('template_id=t-1');
        return { kind: 'ok', data: { runs: archived && scoped ? [ARCHIVED_RUN] : [] } };
      }
      throw new Error(`unexpected BFF path ${path}`);
    });
    // Client-side SWR polling inside the history table.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ runs: [] }) }) as Response),
    );
  });

  it('defaults to active: no archived=true on the runs fetch, Active checked, no archived pill', async () => {
    await renderPage();

    const runsCall = fetchBffJson.mock.calls.find(([path]) =>
      String(path).includes('/watcher/runs'),
    );
    expect(String(runsCall?.[0])).not.toMatch(/archived=true/);
    expect(screen.getByRole('radio', { name: 'Active' })).toBeChecked();
    expect(
      screen.queryAllByTestId('pill').some((el) => el.textContent === 'Archived'),
    ).toBe(false);
  });

  it('?runs=archived fetches archived runs, checks Archived, and renders the archived pill', async () => {
    await renderPage(undefined, 'archived');

    const runsCall = fetchBffJson.mock.calls.find(([path]) =>
      String(path).includes('/watcher/runs'),
    );
    expect(String(runsCall?.[0])).toMatch(/archived=true/);
    expect(String(runsCall?.[0])).toMatch(/template_id=t-1/);
    expect(screen.getByRole('radio', { name: 'Archived' })).toBeChecked();

    const row = screen.getByRole('row', { name: /Run r-arch-1/ });
    expect(within(row).getByText('Archived')).toBeInTheDocument();
  });
});
