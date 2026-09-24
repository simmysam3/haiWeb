import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VOMERO_IDS, runningDetail, vomeroDetail } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SmExecutionDetail } from '@/lib/sourcing-map/contract';
import { SM_POLL_MS } from '@/lib/sourcing-map/map/selectors';

const { swrCalls } = vi.hoisted(() => ({ swrCalls: [] as Array<{ key: string | null; opts: { refreshInterval?: number; dedupingInterval?: number; onSuccess?(d: unknown): void } }> }));
vi.mock('swr', () => ({
  default: (key: string | null, _fetcher: unknown, opts: { refreshInterval?: number; dedupingInterval?: number; onSuccess?(d: unknown): void }) => {
    swrCalls.push({ key, opts });
    return { data: undefined, error: undefined };
  },
}));

import { useExecutionPoll } from '../use-execution-poll';

function Probe({ initial }: { initial: SmExecutionDetail | null }) {
  const { detail: d } = useExecutionPoll(initial);
  return (
    <p data-testid="probe">
      {d ? `${d.execution.status}:${d.result?.slots[0]?.candidates[1]?.status ?? '-'}` : 'none'}
    </p>
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
});
