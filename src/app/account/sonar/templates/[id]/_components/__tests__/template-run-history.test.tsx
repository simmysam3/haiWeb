import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { TemplateRunHistory } from '../template-run-history';

const fetchMock = vi.fn();
function wrap(ui: React.ReactNode) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>;
}

describe('TemplateRunHistory', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('empty state when template has no runs yet', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ runs: [] }), { status: 200 }));
    render(wrap(<TemplateRunHistory templateId="tA" />));
    await waitFor(() => screen.getByText(/hasn't been triggered yet/i));
  });

  it('renders run rows', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runs: [
            {
              run_id: 'r1',
              status: 'complete',
              triggered_at: '2026-05-09T01:00:00Z',
              completed_at: '2026-05-09T01:01:00Z',
              run_origin: 'template_scheduled',
            },
          ],
        }),
        { status: 200 },
      ),
    );
    render(wrap(<TemplateRunHistory templateId="tA" />));
    await waitFor(() => screen.getByText('r1'));
    expect(screen.getByText('complete')).toBeInTheDocument();
    expect(screen.getByText('template_scheduled')).toBeInTheDocument();
  });

  it('renders error message on fetch failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));
    render(wrap(<TemplateRunHistory templateId="tA" />));
    await waitFor(() => screen.getByText(/failed to load run history/i));
  });
});
