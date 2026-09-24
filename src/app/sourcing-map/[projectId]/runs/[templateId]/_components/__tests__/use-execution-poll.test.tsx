import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { VOMERO_IDS, runningDetail, vomeroDetail, vomeroResult } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SmExecutionDetail } from '@/lib/sourcing-map/contract';
import { SM_POLL_MS } from '@/lib/sourcing-map/map/selectors';
import { FetchError } from '@/lib/swr-fetcher';

const { swrCalls } = vi.hoisted(() => ({ swrCalls: [] as Array<{ key: string | null; opts: { refreshInterval?: number; dedupingInterval?: number; onSuccess?(d: unknown): void; onError?(e: unknown): void } }> }));
vi.mock('swr', () => ({
  default: (key: string | null, _fetcher: unknown, opts: { refreshInterval?: number; dedupingInterval?: number; onSuccess?(d: unknown): void; onError?(e: unknown): void }) => {
    swrCalls.push({ key, opts });
    return { data: undefined, error: undefined };
  },
}));

import { useExecutionPoll } from '../use-execution-poll';

function Probe({ initial }: { initial: SmExecutionDetail | null }) {
  const { detail: d, error } = useExecutionPoll(initial);
  return (
    <>
      <p data-testid="probe">
        {d ? `${d.execution.status}:${d.result?.slots[0]?.candidates[1]?.status ?? '-'}` : 'none'}
      </p>
      {error ? <p data-testid="poll-error">{error}</p> : null}
    </>
  );
}

const fetchMock = vi.fn();
beforeEach(() => {
  swrCalls.length = 0;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('useExecutionPoll', () => {
  it('polls the status with the cursor every 1.5 s while running, and not at all once terminal', () => {
    const { unmount } = render(<Probe initial={runningDetail()} />);
    const last = swrCalls[swrCalls.length - 1]!;
    expect(last.key).toBe('/api/account/sourcing-map/executions/5a1e0000-0000-4000-8000-000000000031/status?cursor=3');
    expect(last.opts.refreshInterval).toBe(SM_POLL_MS);
    // D8: SWR skips a refresh tick inside dedupingInterval (default 2,000 ms), so 1.5 s would fire every 3 s.
    expect(last.opts.dedupingInterval).toBe(0);
    unmount();
    swrCalls.length = 0;
    render(<Probe initial={vomeroDetail} />);
    expect(swrCalls.every((c) => c.key === null)).toBe(true);
  });

  it('follows a new initial execution: shows it and polls its status from its own cursor (R1)', () => {
    const { rerender } = render(<Probe initial={runningDetail()} />);
    const other = runningDetail();
    rerender(<Probe initial={{ ...other, execution: { ...other.execution, execution_id: VOMERO_IDS.executionOld, probes_done: 1 } }} />);
    expect(swrCalls[swrCalls.length - 1]!.key).toBe('/api/account/sourcing-map/executions/5a1e0000-0000-4000-8000-000000000032/status?cursor=1');
    rerender(<Probe initial={vomeroDetail} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('completed:answered');
    expect(swrCalls[swrCalls.length - 1]!.key).toBeNull();
  });

  it('merges changed candidates into the result and advances the cursor', async () => {
    render(<Probe initial={runningDetail()} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('running:probing');
    const last = swrCalls[swrCalls.length - 1]!;
    act(() => {
      last.opts.onSuccess!({
        execution_id: '5a1e0000-0000-4000-8000-000000000031', status: 'running', failure_reason: null,
        probes_planned: 7, probes_done: 4, cursor: 4,
        changed: [{ slot_index: 0, candidate_index: 1, candidate: vomeroResult.slots[0]!.candidates[1]! }],
      });
    });
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('running:answered'));
    expect(swrCalls[swrCalls.length - 1]!.key).toContain('status?cursor=4');
  });

  it('fetches the full detail once when the status turns terminal', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(vomeroDetail) });
    render(<Probe initial={runningDetail()} />);
    const last = swrCalls[swrCalls.length - 1]!;
    act(() => {
      last.opts.onSuccess!({ execution_id: '5a1e0000-0000-4000-8000-000000000031', status: 'completed', failure_reason: null, probes_planned: 7, probes_done: 7, cursor: 7, changed: [] });
    });
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('completed:answered'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/account/sourcing-map/executions/5a1e0000-0000-4000-8000-000000000031');
  });

  it('shows a failed status poll as a retrying notice with its HTTP status, never the fetcher message with its internal URL (R2)', () => {
    render(<Probe initial={runningDetail()} />);
    const last = swrCalls[swrCalls.length - 1]!;
    act(() => {
      last.opts.onError!(new FetchError(503, 'Request to /api/account/sourcing-map/executions/5a1e0000-0000-4000-8000-000000000031/status?cursor=3 failed: 503'));
    });
    expect(screen.getByTestId('poll-error').textContent).toBe('Progress could not be refreshed (503). Retrying.');
  });

  it('clears the retrying notice on the next successful poll (R2)', () => {
    render(<Probe initial={runningDetail()} />);
    act(() => {
      swrCalls[swrCalls.length - 1]!.opts.onError!(new FetchError(502, 'Request to /api/x failed: 502'));
    });
    expect(screen.getByTestId('poll-error')).toBeInTheDocument();
    act(() => {
      swrCalls[swrCalls.length - 1]!.opts.onSuccess!({ execution_id: '5a1e0000-0000-4000-8000-000000000031', status: 'running', failure_reason: null, probes_planned: 7, probes_done: 3, cursor: 3, changed: [] });
    });
    expect(screen.queryByTestId('poll-error')).toBeNull();
    expect(screen.getByTestId('probe')).toHaveTextContent('running:probing');
  });

  it('shows a poll that failed without an HTTP status (the network dropped) as a retrying notice, never "(undefined)" (R2)', () => {
    render(<Probe initial={runningDetail()} />);
    act(() => {
      swrCalls[swrCalls.length - 1]!.opts.onError!(new TypeError('Failed to fetch'));
    });
    expect(screen.getByTestId('poll-error').textContent).toBe('Progress could not be refreshed. Retrying.');
  });

  it('says why the composed result could not be loaded once the execution ends (R2)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => JSON.stringify({ error: { code: 'not_found', message: 'Execution not found.' } }) });
    render(<Probe initial={runningDetail()} />);
    act(() => {
      swrCalls[swrCalls.length - 1]!.opts.onSuccess!({ execution_id: '5a1e0000-0000-4000-8000-000000000031', status: 'completed', failure_reason: null, probes_planned: 7, probes_done: 7, cursor: 7, changed: [] });
    });
    await waitFor(() => expect(screen.getByTestId('poll-error').textContent).toBe('Execution not found.'));
    expect(screen.getByTestId('probe')).toHaveTextContent('completed:probing');
  });

  it('drops the previous execution’s notice when another execution is loaded (stale error)', () => {
    const { rerender } = render(<Probe initial={runningDetail()} />);
    act(() => {
      swrCalls[swrCalls.length - 1]!.opts.onError!(new FetchError(503, 'Request to /api/x failed: 503'));
    });
    expect(screen.getByTestId('poll-error')).toBeInTheDocument();
    rerender(<Probe initial={{ ...vomeroDetail, execution: { ...vomeroDetail.execution, execution_id: VOMERO_IDS.executionOld } }} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('completed:answered');
    expect(screen.queryByTestId('poll-error')).toBeNull();
  });
});
