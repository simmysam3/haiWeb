import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => '' }),
  headers: async () => ({ get: () => 'localhost:3001' }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('TemplatesListPage', () => {
  it('renders empty-state when no templates', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ templates: [] }),
    } as Response);
    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);
    expect(screen.getByText(/no configurations yet/i)).toBeInTheDocument();
  });

  it('renders non-audit rows and filters out audit-class configs', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        templates: [
          {
            template_id: 'abc',
            template_name: 'daily-audit',
            observation_class: 'audit',
            cadence: { kind: 'daily', time_of_day: '02:00' },
            enabled: true,
            last_run_at: null,
            last_run_id: null,
            initiator_participant_id: '00000000-0000-0000-0000-000000000001',
            scope: {
              scope_type: 'company',
              scope_ids: [],
              depth_limit: 1,
              hop_budget: 5,
            },
            retention_days: 30,
            created_at: new Date().toISOString(),
            created_by_user_id: '00000000-0000-0000-0000-000000000001',
          },
          {
            template_id: 'def',
            template_name: 'daily-watcher',
            observation_class: 'watcher',
            cadence: { kind: 'daily', time_of_day: '02:00' },
            enabled: true,
            last_run_at: null,
            last_run_id: null,
            initiator_participant_id: '00000000-0000-0000-0000-000000000001',
            scope: {
              scope_type: 'company',
              scope_ids: [],
              depth_limit: 1,
              hop_budget: 5,
            },
            retention_days: 30,
            created_at: new Date().toISOString(),
            created_by_user_id: '00000000-0000-0000-0000-000000000001',
          },
        ],
      }),
    } as Response);
    const Page = (await import('../page')).default;
    const ui = await Page();
    render(ui as React.ReactElement);
    // Audit-class configs are managed under /account/sonar/audit and excluded here.
    expect(screen.queryByText('daily-audit')).not.toBeInTheDocument();
    expect(screen.getByText('daily-watcher')).toBeInTheDocument();
    expect(screen.getByText(/Daily at 02:00 UTC/)).toBeInTheDocument();
  });
});
