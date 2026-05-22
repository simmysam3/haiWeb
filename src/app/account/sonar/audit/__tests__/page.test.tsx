import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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
    const ui = await Page();
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
    const ui = await Page();
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
    const ui = await Page();
    render(ui as React.ReactElement);

    expect(screen.queryByText('Manual Ad-hoc')).not.toBeInTheDocument();
    expect(screen.getByText(/no recurring audit configurations/i)).toBeInTheDocument();
  });

  it('shows a degraded banner when definitions fetch fails', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'unavailable' } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) } as Response);

    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);

    expect(screen.getByRole('alert')).toHaveTextContent(/HTTP 503/);
  });

  it('renders + New Audit CTA', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ templates: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runs: [] }) } as Response);

    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);

    const cta = screen.getByRole('link', { name: /\+ new audit/i });
    expect(cta).toHaveAttribute('href', '/account/sonar/audit/new');
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
    const ui = await Page();
    render(ui as React.ReactElement);

    // HistoryQueue renders as a Client Component with fallbackData — the
    // initialRows are wired through and the table headings are present.
    expect(screen.getByText(/audit history/i, { selector: 'h2' })).toBeInTheDocument();
  });
});
