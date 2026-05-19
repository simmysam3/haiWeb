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
          title: 'Apex Q1 Compliance Audit',
          summary: '5 products · 2 vendors · depth 2',
          outcome: '3 gaps',
          triggered_at: '2026-05-09T03:00:00Z',
          completed_at: '2026-05-09T03:01:00Z',
          duration_seconds: 60,
          run_origin: 'template_scheduled',
          detail_href: '/account/sonar/compliance/runs/a1',
        },
      ],
    };
    render(wrap(<ActivityFeed initial={initial} />));
    expect(screen.getByText('Apex Q1 Compliance Audit')).toBeInTheDocument();
    expect(screen.getByText('5 products · 2 vendors · depth 2')).toBeInTheDocument();
    expect(screen.getByText('complete')).toBeInTheDocument();
    expect(screen.getByText('3 gaps')).toBeInTheDocument();
  });

  it('renders error state when fetch fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    render(wrap(<ActivityFeed initial={null} />));
    await waitFor(() => screen.getByText(/Failed to load activity/i));
  });

  it('renders "unknown time" for malformed triggered_at', async () => {
    const initial = {
      events: [
        {
          run_id: 'a1',
          modality: 'audit' as const,
          status: 'complete',
          title: 'Ad hoc Audit',
          summary: '',
          outcome: null,
          triggered_at: 'not-a-date',
          completed_at: null,
          duration_seconds: null,
          run_origin: 'ad_hoc',
          detail_href: '/account/sonar/compliance/runs/a1',
        },
      ],
    };
    render(wrap(<ActivityFeed initial={initial} />));
    expect(screen.getByText(/unknown time/i)).toBeInTheDocument();
  });
});
