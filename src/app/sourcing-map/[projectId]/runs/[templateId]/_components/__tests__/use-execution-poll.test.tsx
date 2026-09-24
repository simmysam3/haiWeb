import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { VOMERO_IDS, runningDetail, vomeroDetail, vomeroResult } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SmExecutionDetail } from '@/lib/sourcing-map/contract';
import { SM_POLL_MS } from '@/lib/sourcing-map/map/selectors';
import { FetchError } from '@/lib/swr-fetcher';

const { swrCalls } = vi.hoisted(() => ({ swrCalls: [] as Array<{ key: string | null; fetcher: (k: string) => Promise<unknown>; opts: { refreshInterval?: number; dedupingInterval?: number; onSuccess?(d: unknown, key: string): void; onError?(e: unknown, key: string): void } }> }));
vi.mock('swr', () => ({
  default: (key: string | null, fetcher: (k: string) => Promise<unknown>, opts: { refreshInterval?: number; dedupingInterval?: number; onSuccess?(d: unknown, key: string): void; onError?(e: unknown, key: string): void }) => {
    swrCalls.push({ key, fetcher, opts });
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

/** Another execution, loaded while the first one's answers are still in flight (R3). */
const otherFailed: SmExecutionDetail = {
  ...vomeroDetail,
  execution: { ...vomeroDetail.execution, execution_id: VOMERO_IDS.executionOld, status: 'failed', failure_reason: 'interrupted' },
};

/** SWR calls the LATEST render's callbacks, and hands each one the key it fetched (swr 2.4.1 index.mjs:466, :475). */
const latest = () => swrCalls[swrCalls.length - 1]!;

const fetchMock = vi.fn();
/** The URL the latest status fetcher requests: the cursor rides in it, not in the SWR key (I-2). */
async function fetchedStatusUrl(): Promise<string> {
  const last = swrCalls[swrCalls.length - 1]!;
  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
  await last.fetcher(last.key!);
  return String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1]![0]);
}
beforeEach(() => {
  swrCalls.length = 0;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('useExecutionPoll', () => {
  it('polls the status with the cursor every 1.5 s while running, and not at all once terminal', async () => {
    const { unmount } = render(<Probe initial={runningDetail()} />);
    const last = swrCalls[swrCalls.length - 1]!;
    expect(last.key).toBe('/api/account/sourcing-map/executions/5a1e0000-0000-4000-8000-000000000031/status');
    expect(await fetchedStatusUrl()).toBe('/api/account/sourcing-map/executions/5a1e0000-0000-4000-8000-000000000031/status?cursor=3');
    expect(last.opts.refreshInterval).toBe(SM_POLL_MS);
    // D8: SWR skips a refresh tick inside dedupingInterval (default 2,000 ms), so 1.5 s would fire every 3 s.
    expect(last.opts.dedupingInterval).toBe(0);
    unmount();
    swrCalls.length = 0;
    render(<Probe initial={vomeroDetail} />);
    expect(swrCalls.every((c) => c.key === null)).toBe(true);
  });

  it('follows a new initial execution: shows it and polls its status from its own cursor (R1)', async () => {
    const { rerender } = render(<Probe initial={runningDetail()} />);
    const other = runningDetail();
    rerender(<Probe initial={{ ...other, execution: { ...other.execution, execution_id: VOMERO_IDS.executionOld, probes_done: 1 } }} />);
    expect(swrCalls[swrCalls.length - 1]!.key).toBe('/api/account/sourcing-map/executions/5a1e0000-0000-4000-8000-000000000032/status');
    expect(await fetchedStatusUrl()).toBe('/api/account/sourcing-map/executions/5a1e0000-0000-4000-8000-000000000032/status?cursor=1');
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
      }, last.key!);
    });
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('running:answered'));
    // I-2: the key stays put as the cursor moves (no back-to-back refetch); the next poll carries the new cursor.
    expect(swrCalls[swrCalls.length - 1]!.key).toBe(last.key);
    expect(await fetchedStatusUrl()).toBe('/api/account/sourcing-map/executions/5a1e0000-0000-4000-8000-000000000031/status?cursor=4');
  });

  it('fetches the full detail once when the status turns terminal', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(vomeroDetail) });
    render(<Probe initial={runningDetail()} />);
    const last = swrCalls[swrCalls.length - 1]!;
    act(() => {
      last.opts.onSuccess!({ execution_id: '5a1e0000-0000-4000-8000-000000000031', status: 'completed', failure_reason: null, probes_planned: 7, probes_done: 7, cursor: 7, changed: [] }, last.key!);
    });
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('completed:answered'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/account/sourcing-map/executions/5a1e0000-0000-4000-8000-000000000031');
  });

  it('shows a failed status poll as a retrying notice with its HTTP status, never the fetcher message with its internal URL (R2)', () => {
    render(<Probe initial={runningDetail()} />);
    const last = swrCalls[swrCalls.length - 1]!;
    act(() => {
      last.opts.onError!(new FetchError(503, 'Request to /api/account/sourcing-map/executions/5a1e0000-0000-4000-8000-000000000031/status?cursor=3 failed: 503'), last.key!);
    });
    expect(screen.getByTestId('poll-error').textContent).toBe('Progress could not be refreshed (503). Retrying.');
  });

  it('clears the retrying notice on the next successful poll (R2)', () => {
    render(<Probe initial={runningDetail()} />);
    act(() => {
      latest().opts.onError!(new FetchError(502, 'Request to /api/x failed: 502'), latest().key!);
    });
    expect(screen.getByTestId('poll-error')).toBeInTheDocument();
    act(() => {
      latest().opts.onSuccess!({ execution_id: '5a1e0000-0000-4000-8000-000000000031', status: 'running', failure_reason: null, probes_planned: 7, probes_done: 3, cursor: 3, changed: [] }, latest().key!);
    });
    expect(screen.queryByTestId('poll-error')).toBeNull();
    expect(screen.getByTestId('probe')).toHaveTextContent('running:probing');
  });

  it('shows a poll that failed without an HTTP status (the network dropped) as a retrying notice, never "(undefined)" (R2)', () => {
    render(<Probe initial={runningDetail()} />);
    act(() => {
      latest().opts.onError!(new TypeError('Failed to fetch'), latest().key!);
    });
    expect(screen.getByTestId('poll-error').textContent).toBe('Progress could not be refreshed. Retrying.');
  });

  it('says why the composed result could not be loaded once the execution ends (R2)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => JSON.stringify({ error: { code: 'not_found', message: 'Execution not found.' } }) });
    render(<Probe initial={runningDetail()} />);
    act(() => {
      latest().opts.onSuccess!({ execution_id: '5a1e0000-0000-4000-8000-000000000031', status: 'completed', failure_reason: null, probes_planned: 7, probes_done: 7, cursor: 7, changed: [] }, latest().key!);
    });
    await waitFor(() => expect(screen.getByTestId('poll-error').textContent).toBe('Execution not found.'));
    expect(screen.getByTestId('probe')).toHaveTextContent('completed:probing');
  });

  it('drops the previous execution’s notice when another execution is loaded (stale error)', () => {
    const { rerender } = render(<Probe initial={runningDetail()} />);
    act(() => {
      latest().opts.onError!(new FetchError(503, 'Request to /api/x failed: 503'), latest().key!);
    });
    expect(screen.getByTestId('poll-error')).toBeInTheDocument();
    rerender(<Probe initial={{ ...vomeroDetail, execution: { ...vomeroDetail.execution, execution_id: VOMERO_IDS.executionOld } }} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('completed:answered');
    expect(screen.queryByTestId('poll-error')).toBeNull();
  });

  it('keeps a newly loaded execution when the old one’s full detail arrives late (R3)', async () => {
    let answer!: (r: unknown) => void;
    fetchMock.mockReturnValue(new Promise((r) => { answer = r; }));
    const { rerender } = render(<Probe initial={runningDetail()} />);
    act(() => {
      latest().opts.onSuccess!({ execution_id: '5a1e0000-0000-4000-8000-000000000031', status: 'completed', failure_reason: null, probes_planned: 7, probes_done: 7, cursor: 7, changed: [] }, latest().key!);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    rerender(<Probe initial={otherFailed} />);
    expect(screen.getByTestId('probe')).toHaveTextContent('failed:answered');
    await act(async () => {
      answer({ ok: true, status: 200, text: async () => JSON.stringify(vomeroDetail) });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByTestId('probe')).toHaveTextContent('failed:answered');
  });

  it('never shows the old execution’s late full-detail failure on the one now loaded (R3)', async () => {
    let answer!: (r: unknown) => void;
    fetchMock.mockReturnValue(new Promise((r) => { answer = r; }));
    const { rerender } = render(<Probe initial={runningDetail()} />);
    act(() => {
      latest().opts.onSuccess!({ execution_id: '5a1e0000-0000-4000-8000-000000000031', status: 'completed', failure_reason: null, probes_planned: 7, probes_done: 7, cursor: 7, changed: [] }, latest().key!);
    });
    rerender(<Probe initial={otherFailed} />);
    await act(async () => {
      answer({ ok: false, status: 404, text: async () => JSON.stringify({ error: { code: 'not_found', message: 'Execution not found.' } }) });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.queryByTestId('poll-error')).toBeNull();
    expect(screen.getByTestId('probe')).toHaveTextContent('failed:answered');
  });

  it('ignores a late status answer for an execution that is no longer loaded: its candidates and cursor stay out (R3)', async () => {
    const { rerender } = render(<Probe initial={runningDetail()} />);
    const oldKey = latest().key!;
    const other = runningDetail();
    rerender(<Probe initial={{ ...other, execution: { ...other.execution, execution_id: VOMERO_IDS.executionOld, probes_done: 1 } }} />);
    act(() => {
      latest().opts.onSuccess!({
        execution_id: '5a1e0000-0000-4000-8000-000000000031', status: 'running', failure_reason: null,
        probes_planned: 7, probes_done: 4, cursor: 4,
        changed: [{ slot_index: 0, candidate_index: 1, candidate: vomeroResult.slots[0]!.candidates[1]! }],
      }, oldKey);
    });
    expect(screen.getByTestId('probe')).toHaveTextContent('running:probing');
    expect(await fetchedStatusUrl()).toBe('/api/account/sourcing-map/executions/5a1e0000-0000-4000-8000-000000000032/status?cursor=1');
  });

  it('never shows the old execution’s late poll failure on the one now loaded, though SWR hands it to the LATEST onError (R3, I-1)', () => {
    const { rerender } = render(<Probe initial={runningDetail()} />);
    const oldKey = latest().key!;
    rerender(<Probe initial={otherFailed} />);
    act(() => {
      // otherFailed is terminal (key null), so SWR's keyRef stays on the old key: the old request's failure passes
      // SWR's safeguard and reaches the latest closure (index.mjs:466; :534 returns before :564 sets keyRef).
      latest().opts.onError!(new FetchError(503, 'Request to /api/x failed: 503'), oldKey);
    });
    expect(screen.queryByTestId('poll-error')).toBeNull();
  });

  it('sends no full-detail request when a key no longer polled reports its execution ended (I-1, review Minor 6)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(vomeroDetail) });
    const { rerender } = render(<Probe initial={runningDetail()} />);
    const oldKey = latest().key!;
    rerender(<Probe initial={otherFailed} />);
    await act(async () => {
      latest().opts.onSuccess!({ execution_id: '5a1e0000-0000-4000-8000-000000000031', status: 'completed', failure_reason: null, probes_planned: 7, probes_done: 7, cursor: 7, changed: [] }, oldKey);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('probe')).toHaveTextContent('failed:answered');
  });
});
