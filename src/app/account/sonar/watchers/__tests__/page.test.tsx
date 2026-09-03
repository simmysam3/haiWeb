import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { RunTemplate } from '@haiwave/protocol';

vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => '' }),
  headers: async () => ({ get: () => 'localhost:3001' }),
}));

// D-206 — RunsFilterToggle (rendered on the page) reads the pathname and
// search params itself and navigates via useRouter().replace.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/account/sonar/watchers',
  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

const watcherTemplate = (id: string, cadence: object): RunTemplate =>
  ({
    template_id: id,
    template_name: `Watcher ${id}`,
    observation_class: 'watcher',
    cadence,
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
  }) as unknown as RunTemplate;

// D-206 — a run whose definition was deleted with runs=archive carries
// archived_at. The runs BFF returns it only when the request URL carries
// `archived=true`, matching Task 2's BFF contract.
// v1.85 fix wave (C1) — a real archived/kept run of a DELETED definition has
// template_id NULL (FK ON DELETE SET NULL) and carries the delete-time name
// snapshot as template_name on the wire (haiCore COALESCEs it there). Giving
// this fixture a live template_id (as before) cannot occur in the real system
// and hid the C1 bug — the page derived every run's name from a live
// template-id join alone, discarding the wire template_name.
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
  template_id: null,
  template_name: 'Deleted EMEA Watch',
  signal_types: ['lead_time_distribution'],
  archived_at: '2026-08-25T00:00:00.000Z',
};

function mockBff() {
  fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes('/watcher/definitions')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          templates: [
            watcherTemplate('t-1', {
              kind: 'daily',
              hour_local: 9,
              minute_local: 0,
              timezone: 'UTC',
            }),
            watcherTemplate('t-2', { kind: 'manual_only' }),
          ],
        }),
      } as Response;
    }
    if (u.includes('/watcher/runs')) {
      const archived = u.includes('archived=true');
      return {
        ok: true,
        status: 200,
        json: async () => ({ runs: archived ? [ARCHIVED_RUN] : [] }),
      } as Response;
    }
    // NeedsTriageStrip (SWR) and anything else.
    return { ok: true, status: 200, json: async () => ({ alerts: [] }) } as Response;
  });
}

async function renderPage(searchParams: Record<string, string> = {}) {
  const Page = (await import('../page')).default;
  render(
    (await Page({ searchParams: Promise.resolve(searchParams) })) as React.ReactElement,
  );
}

describe('WatchersListPage', () => {
  it('titles the runs section "Runs", not "Watcher history"', async () => {
    mockBff();
    await renderPage();
    expect(screen.getByRole('heading', { name: 'Runs' })).toBeInTheDocument();
    expect(screen.queryByText(/watcher history/i)).not.toBeInTheDocument();
  });

  it('folds configurations into a collapsed accordion with a count summary', async () => {
    mockBff();
    await renderPage();
    const trigger = screen.getByRole('button', { name: /configurations/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('2 configurations · 1 scheduled')).toBeInTheDocument();
    // The configurations table itself stays unmounted until expanded.
    expect(screen.queryByText('Watcher t-1')).not.toBeInTheDocument();
  });
});

// D-206 — the Runs section reads `?runs=archived` and shows the archived
// list instead of the default active list.
describe('WatchersListPage — runs filter (D-206)', () => {
  it('defaults to active: no archived=true on the runs fetch, Active checked, no archived pill', async () => {
    mockBff();
    await renderPage();

    const runsCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/watcher/runs'),
    );
    expect(String(runsCall?.[0])).not.toMatch(/archived=true/);
    expect(screen.getByRole('radio', { name: 'Active' })).toBeChecked();
    expect(
      screen.queryAllByTestId('pill').some((el) => el.textContent === 'Archived'),
    ).toBe(false);
  });

  it('?runs=archived fetches archived runs, checks Archived, and renders the archived pill', async () => {
    mockBff();
    await renderPage({ runs: 'archived' });

    const runsCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/watcher/runs'),
    );
    expect(String(runsCall?.[0])).toMatch(/archived=true/);
    expect(screen.getByRole('radio', { name: 'Archived' })).toBeChecked();

    // C1 — the run's template was deleted (template_id: null), so its name
    // can only come from the wire template_name snapshot, never from a join
    // against the (now-gone) live template.
    const row = screen.getByRole('row', { name: /Deleted EMEA Watch/ });
    expect(within(row).getByText('Archived')).toBeInTheDocument();
  });
});
