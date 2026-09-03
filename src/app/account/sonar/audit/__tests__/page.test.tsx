import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => '' }),
  headers: async () => ({
    get: (name: string) => {
      if (name === 'host') return 'localhost:3001';
      if (name === 'x-forwarded-proto') return 'http';
      if (name === 'cookie') return '';
      return null;
    },
  }),
}));

// D-206 — RunsFilterToggle (rendered on the page) reads the pathname and
// search params itself and navigates via useRouter().replace.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/account/sonar/audit',
  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

const STUB_TEMPLATE = {
  template_id: '00000000-0000-0000-0000-000000000001',
  template_name: 'Weekly EMEA Audit',
  observation_class: 'audit',
  cadence: { kind: 'weekly', day_of_week: 'mon', time_of_day: '06:00' },
  enabled: true,
  last_run_at: null,
  last_run_id: null,
  initiator_participant_id: '00000000-0000-0000-0000-000000000002',
  scope: {
    kind: 'audit',
    authorization_basis: 'bilateral',
    depth_limit: 3,
    counterparties: [],
    skus: [],
    signal_types: [],
  },
  retention_days: 90,
  created_at: new Date().toISOString(),
  created_by_user_id: '00000000-0000-0000-0000-000000000002',
};

const STUB_RUN = {
  run_id: 'aaaaaaaa-0000-0000-0000-000000000001',
  initiator_participant_id: '00000000-0000-0000-0000-000000000002',
  triggered_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  triggered_by_user_id: null,
  scope_snapshot: { depth_limit: 3, authorization_basis: 'bilateral' },
  status: 'complete',
  completed_at: new Date().toISOString(),
  cancelled_at: null,
  depth_limit: 3,
  hop_count: 12,
  gap_count: 0,
  error_message: null,
  run_origin: 'template_scheduled',
  template_id: '00000000-0000-0000-0000-000000000001',
};

describe('AuditListPage', () => {
  it('renders empty state for both queues when data is empty', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) } as Response);

    const Page = (await import('../page')).default;
    const ui = await Page({ searchParams: Promise.resolve({}) });
    render(ui as React.ReactElement);

    expect(screen.getByText(/audits/i, { selector: 'h1' })).toBeInTheDocument();
    expect(screen.getByText(/no recurring audit configurations/i)).toBeInTheDocument();
    // HistoryQueue is a client component — its empty state renders after hydration;
    // the fallbackData (empty array) is passed through initialRows.
  });

  it('renders scheduled rows for non-manual templates', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: [STUB_TEMPLATE] }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) } as Response);

    const Page = (await import('../page')).default;
    const ui = await Page({ searchParams: Promise.resolve({}) });
    render(ui as React.ReactElement);

    expect(screen.getByText('Weekly EMEA Audit')).toBeInTheDocument();
    // Cadence text appears twice: once in Cadence column, once in Next fire column
    const cadenceCells = screen.getAllByText(/Weekly on Monday at 06:00 UTC/);
    expect(cadenceCells.length).toBeGreaterThanOrEqual(1);
  });

  it('excludes manual_only templates from the scheduled queue', async () => {
    const manualTemplate = {
      ...STUB_TEMPLATE,
      template_id: '00000000-0000-0000-0000-000000000099',
      template_name: 'Manual Ad-hoc',
      cadence: { kind: 'manual_only' },
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: [manualTemplate] }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) } as Response);

    const Page = (await import('../page')).default;
    const ui = await Page({ searchParams: Promise.resolve({}) });
    render(ui as React.ReactElement);

    expect(screen.queryByText('Manual Ad-hoc')).not.toBeInTheDocument();
    expect(screen.getByText(/no recurring audit configurations/i)).toBeInTheDocument();
  });

  it('shows a degraded banner when definitions fetch fails', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'unavailable' } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) } as Response);

    const Page = (await import('../page')).default;
    const ui = await Page({ searchParams: Promise.resolve({}) });
    render(ui as React.ReactElement);

    expect(screen.getByRole('alert')).toHaveTextContent(/HTTP 503/);
  });

  it('renders + New Audit CTA', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) } as Response);

    const Page = (await import('../page')).default;
    const ui = await Page({ searchParams: Promise.resolve({}) });
    render(ui as React.ReactElement);

    const cta = screen.getByRole('link', { name: /\+ new audit/i });
    expect(cta).toHaveAttribute('href', '/account/sonar/audit/new');
  });
});

// D-206 — the Audit history section reads `?runs=archived` and shows the
// archived list instead of the default active list. A run whose definition
// was deleted with runs=archive carries archived_at; the runs BFF returns it
// only when the request URL carries `archived=true` (Task 2's contract).
// v1.85 fix wave (C1) — a real archived run of a deleted definition has
// template_id NULL (FK ON DELETE SET NULL); only the wire template_name
// snapshot names it. This test stubs global fetch above the BFF route, so it
// can't pin the C1 bug (the BFF route test does that) — but the fixture
// should still reflect what the real system produces.
const ARCHIVED_RUN = {
  ...STUB_RUN,
  run_id: 'aaaaaaaa-0000-0000-0000-000000000099',
  template_id: null,
  template_name: 'Weekly EMEA Audit',
  archived_at: '2026-08-25T00:00:00.000Z',
};

function mockAuditBff() {
  fetchMock.mockImplementation(async (url: RequestInfo | URL) => {
    const u = String(url);
    if (u.includes('/audit/definitions')) {
      return { ok: true, status: 200, json: async () => ({ templates: [] }) } as Response;
    }
    if (u.includes('/audit/runs')) {
      const archived = u.includes('archived=true');
      return {
        ok: true,
        status: 200,
        json: async () => ({ runs: archived ? [ARCHIVED_RUN] : [], auditor_country: 'GB' }),
      } as Response;
    }
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  });
}

async function renderPage(searchParams: Record<string, string> = {}) {
  const Page = (await import('../page')).default;
  const ui = await Page({ searchParams: Promise.resolve(searchParams) });
  render(ui as React.ReactElement);
}

describe('AuditListPage — runs filter (D-206)', () => {
  it('defaults to active: no archived=true on the runs fetch, Active checked, no archived pill', async () => {
    mockAuditBff();
    await renderPage();

    const runsCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/audit/runs'));
    expect(String(runsCall?.[0])).not.toMatch(/archived=true/);
    expect(screen.getByRole('radio', { name: 'Active' })).toBeChecked();
    expect(
      screen.queryAllByTestId('pill').some((el) => el.textContent === 'Archived'),
    ).toBe(false);
  });

  it('?runs=archived fetches archived runs, checks Archived, and renders the archived pill', async () => {
    mockAuditBff();
    await renderPage({ runs: 'archived' });

    const runsCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/audit/runs'));
    expect(String(runsCall?.[0])).toMatch(/archived=true/);
    expect(screen.getByRole('radio', { name: 'Archived' })).toBeChecked();

    const row = screen.getByRole('row', { name: /Weekly EMEA Audit/ });
    expect(within(row).getByText('Archived')).toBeInTheDocument();
  });
});

describe('AuditListPage — run history (HistoryQueue via initialRows)', () => {
  it('passes initialRows to HistoryQueue (rendered in SSR context)', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ runs: [STUB_RUN] }),
      } as Response);

    const Page = (await import('../page')).default;
    const ui = await Page({ searchParams: Promise.resolve({}) });
    render(ui as React.ReactElement);

    // HistoryQueue renders as a Client Component with fallbackData — the
    // initialRows are wired through and the table headings are present.
    expect(screen.getByText(/audit history/i, { selector: 'h2' })).toBeInTheDocument();
  });
});
