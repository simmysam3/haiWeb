import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { runningDetail } from '@/lib/sourcing-map/__fixtures__/vomero';
import { SM_POLL_MS } from '@/lib/sourcing-map/map/selectors';
import { useExecutionPoll } from '../use-execution-poll';

// Real SWR (not mocked): these tests pin what SWR actually does with the hook's key and options.
const STATUS = '/api/account/sourcing-map/executions/5a1e0000-0000-4000-8000-000000000031/status';
/** One stable `initial` (the hook restarts on a new object). */
const RUNNING = runningDetail();

function Probe() {
  useExecutionPoll(RUNNING);
  return null;
}

const fetchMock = vi.fn();
const statusUrls = () => fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith(STATUS));
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useExecutionPoll with real SWR', () => {
  it('polls at most once per SM_POLL_MS while answers move the cursor, reading the cursor into the fetched URL (I-2)', async () => {
    let cursor = 3;
    fetchMock.mockImplementation(async () => {
      cursor = Math.min(cursor + 1, 7);
      return { ok: true, status: 200, json: async () => ({ execution_id: RUNNING.execution.execution_id, status: 'running', failure_reason: null, probes_planned: 7, probes_done: cursor, cursor, changed: [] }) };
    });
    render(<SWRConfig value={{ provider: () => new Map() }}><Probe /></SWRConfig>);
    await tick(0);
    expect(statusUrls()).toEqual([`${STATUS}?cursor=3`]);
    await tick(SM_POLL_MS - 1);
    expect(statusUrls()).toHaveLength(1);
    await tick(1);
    expect(statusUrls()).toEqual([`${STATUS}?cursor=3`, `${STATUS}?cursor=4`]);
    await tick(SM_POLL_MS);
    expect(statusUrls()).toEqual([`${STATUS}?cursor=3`, `${STATUS}?cursor=4`, `${STATUS}?cursor=5`]);
  });
});
