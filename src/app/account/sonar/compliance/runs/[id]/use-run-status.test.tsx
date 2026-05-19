import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRunStatus } from './use-run-status';

describe('useRunStatus', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the status payload from the BFF endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'running',
        hop_count: 5,
        gap_count: 0,
        results_available_count: 0,
      }),
    });
    const { result } = renderHook(() => useRunStatus('run-1'));
    await waitFor(() => {
      expect(result.current.status).toBe('running');
    });
    expect(result.current.hopCount).toBe(5);
    expect(result.current.resultsAvailableCount).toBe(0);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/audit-runs/run-1/status',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('does not poll once status is terminal', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'complete',
        hop_count: 10,
        gap_count: 0,
        results_available_count: 2,
      }),
    });
    const { result } = renderHook(() => useRunStatus('run-2'));
    await waitFor(() => {
      expect(result.current.status).toBe('complete');
    });
    const callsAfterTerminal = fetchMock.mock.calls.length;
    // Wait beyond the 10s baseline; SWR should NOT issue another fetch.
    await new Promise((r) => setTimeout(r, 200));
    expect(fetchMock.mock.calls.length).toBe(callsAfterTerminal);
  });
});
