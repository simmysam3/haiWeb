import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RunTemplate } from '@haiwave/protocol';

vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => '' }),
  headers: async () => ({ get: () => 'localhost:3001' }),
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
      return { ok: true, status: 200, json: async () => ({ runs: [] }) } as Response;
    }
    // NeedsTriageStrip (SWR) and anything else.
    return { ok: true, status: 200, json: async () => ({ alerts: [] }) } as Response;
  });
}

async function renderPage() {
  const Page = (await import('../page')).default;
  render((await Page()) as React.ReactElement);
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
