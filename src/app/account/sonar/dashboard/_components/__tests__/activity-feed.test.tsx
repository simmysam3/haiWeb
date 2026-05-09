import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { ActivityFeed } from '../activity-feed';

const fetchMock = vi.fn();

function wrap(ui: React.ReactNode) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>;
}

describe('ActivityFeed', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('renders empty state when feed has no events', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ events: [] }), { status: 200 }));
    render(wrap(<ActivityFeed initial={null} />));
    await waitFor(() => screen.getByText(/No recent runs/i));
  });

  it('renders rows from initial prop without re-fetching', () => {
    const initial = {
      events: [
        {
          run_id: 'a1',
          modality: 'audit' as const,
          status: 'complete',
          triggered_at: '2026-05-09T03:00:00Z',
          completed_at: '2026-05-09T03:01:00Z',
          run_origin: 'ad_hoc',
          detail_href: '/account/sonar/audit/runs/a1',
        },
      ],
    };
    render(wrap(<ActivityFeed initial={initial} />));
    expect(screen.getByText(/audit/i)).toBeInTheDocument();
    expect(screen.getByText('complete')).toBeInTheDocument();
  });

  it('renders error state when fetch fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    render(wrap(<ActivityFeed initial={null} />));
    await waitFor(() => screen.getByText(/Failed to load activity/i));
  });
});
