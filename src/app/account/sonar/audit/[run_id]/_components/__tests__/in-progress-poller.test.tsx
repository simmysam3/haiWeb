import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const refreshSpy = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshSpy, push: vi.fn(), replace: vi.fn() }),
}));

import { InProgressPoller } from '../in-progress-poller';

const RUN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  refreshSpy.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('InProgressPoller', () => {
  it('renders the in-progress placeholder text', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ run: { status: 'running' } }),
    } as Response);

    render(<InProgressPoller runId={RUN_ID} />);

    expect(screen.getByText(/run in progress/i)).toBeInTheDocument();
    expect(
      screen.getByText(/this page will update automatically/i),
    ).toBeInTheDocument();
  });

  it('calls router.refresh() when the run transitions out of running', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ run: { status: 'complete' } }),
    } as Response);

    render(<InProgressPoller runId={RUN_ID} />);

    // Wait for the immediate-on-mount tick to land + dispatch refresh.
    await waitFor(() => expect(refreshSpy).toHaveBeenCalledTimes(1));
  });

  it('does NOT refresh when the status is still running', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ run: { status: 'running' } }),
    } as Response);

    render(<InProgressPoller runId={RUN_ID} />);

    // Wait long enough for at least the first tick to complete.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('refreshes for any terminal status (failed, cancelled, throttled)', async () => {
    for (const terminal of ['failed', 'cancelled', 'throttled', 'partial']) {
      refreshSpy.mockReset();
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ run: { status: terminal } }),
      } as Response);

      const { unmount } = render(<InProgressPoller runId={RUN_ID} />);
      await waitFor(() => expect(refreshSpy).toHaveBeenCalledTimes(1));
      unmount();
    }
  });

  it('surfaces a network error inline without crashing', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);

    render(<InProgressPoller runId={RUN_ID} />);

    await waitFor(() =>
      expect(screen.getByText(/couldn['’]t reach the monitoring service/i)).toBeInTheDocument(),
    );
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('hits the BFF audit-run endpoint with the run_id', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ run: { status: 'running' } }),
    } as Response);

    render(<InProgressPoller runId={RUN_ID} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0];
    expect(url).toBe(`/api/account/sonar/audit/runs/${RUN_ID}`);
  });
});
