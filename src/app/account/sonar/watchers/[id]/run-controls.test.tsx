import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { RunControls } from './run-controls';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('RunControls', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the initial running pill and the Cancel button', () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'running',
        hop_count: 0,
        gap_count: 0,
        results_available_count: 0,
      }),
    });
    render(
      <RunControls
        runId="r-1"
        initialStatus="running"
        initialHopCount={null}
        initialGapCount={null}
        initialResultsCount={0}
      />,
    );
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows Cancelling… optimistically and fires the cancel POST', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && url.endsWith('/cancel')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, status: 'running' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          status: 'running',
          hop_count: 1,
          gap_count: 0,
          results_available_count: 0,
        }),
      });
    });
    render(
      <RunControls
        runId="r-2"
        initialStatus="running"
        initialHopCount={null}
        initialGapCount={null}
        initialResultsCount={0}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // Cancelling… indicator appears immediately.
    expect(await screen.findByText(/cancelling/i)).toBeInTheDocument();
    // POST was issued.
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            (url as string).endsWith('/cancel') &&
            (init as RequestInit | undefined)?.method === 'POST',
        ),
      ).toBe(true);
    });
  });

  it('omits hop and gap counters when the hook returns null even though SSR provided a value', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'running',
        hop_count: null,
        gap_count: null,
        results_available_count: 2,
      }),
    });
    render(
      <RunControls
        runId="r-4"
        initialStatus="running"
        initialHopCount={5}
        initialGapCount={3}
        initialResultsCount={2}
      />,
    );
    // Wait for the hook's first fetch.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    // After the hook resolves with null, the counter must omit hops/gaps.
    await waitFor(() => {
      const text = screen.getByText(/2 results/);
      expect(text.textContent).toBe('2 results');
      expect(text.textContent).not.toContain('hops');
      expect(text.textContent).not.toContain('gaps');
    });
  });

  it('hides the Cancel button on a terminal status', () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'complete',
        hop_count: 5,
        gap_count: 0,
        results_available_count: 1,
      }),
    });
    render(
      <RunControls
        runId="r-3"
        initialStatus="complete"
        initialHopCount={5}
        initialGapCount={0}
        initialResultsCount={1}
      />,
    );
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('failed status pill tooltip includes the error reason', () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'failed',
        hop_count: null,
        gap_count: null,
        results_available_count: 0,
      }),
    });
    render(
      <RunControls
        runId="r1"
        initialStatus="failed"
        initialHopCount={null}
        initialGapCount={null}
        initialResultsCount={0}
        errorMessage='duplicate key value violates unique constraint "idx_sku_obligations_unique_active"'
      />,
    );
    const tip = document.getElementById(
      screen.getByTestId('pill').getAttribute('aria-describedby') as string,
    );
    expect(tip).toHaveTextContent(/Reason:/);
    expect(tip).toHaveTextContent('idx_sku_obligations_unique_active');
  });

  it('clears the Cancelling indicator and shows an error message when the cancel POST fails', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && url.endsWith('/cancel')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
          json: async () => ({}),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          status: 'running',
          hop_count: 1,
          gap_count: 0,
          results_available_count: 0,
        }),
      });
    });
    render(
      <RunControls
        runId="r-error"
        initialStatus="running"
        initialHopCount={null}
        initialGapCount={null}
        initialResultsCount={0}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // After the failed POST resolves, the indicator clears and the error renders.
    await waitFor(() => {
      expect(screen.queryByText(/cancelling/i)).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
    });

    // Cancel button is back (still running, no longer cancelling).
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});
