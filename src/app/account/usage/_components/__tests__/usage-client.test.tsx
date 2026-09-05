import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import useSWR from 'swr';
import { UsageClient } from '../usage-client';

vi.mock('swr');
const mockedUseSWR = vi.mocked(useSWR);

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="recharts-responsive">{children}</div>,
  };
});

const current = {
  participant_id: 'p-1',
  window_start: '2026-09-01T00:00:00Z',
  consumed: 12,
  remaining: 88,
  budget: 100,
  is_custom: false,
  phantom_demand_inbound_probe_limit: 10,
  phantom_demand_inbound_probe_limit_is_custom: false,
};

const counterparties = [
  { counterparty_id: 'cp-1', counterparty_name: 'Acme', total_hops: 8, audit_hops: 5, watcher_hops: 2, phantom_demand_hops: 1, last_activity: '2026-09-03T00:00:00Z' },
  { counterparty_id: 'cp-2', counterparty_name: 'Bolt', total_hops: 4, audit_hops: 2, watcher_hops: 1, phantom_demand_hops: 1, last_activity: '2026-09-02T00:00:00Z' },
];

/** SWR double keyed by URL: the window's counterparties carry the per-modality hops. */
function swrByUrl(key: unknown) {
  const url = String(key);
  const answer = (data: unknown) => ({ data, error: undefined, isLoading: false, isValidating: false, mutate: vi.fn() }) as never;
  if (url.startsWith('/api/account/usage/current')) return answer(current);
  if (url.startsWith('/api/account/usage/active-runs')) return answer({ active_runs: [] });
  if (url.startsWith('/api/account/usage/timeseries')) return answer({ buckets: [{ bucket_start: '2026-09-03', hops_consumed: 12 }] });
  if (url.startsWith('/api/account/usage/counterparties')) return answer({ counterparties });
  if (url.startsWith('/api/account/usage/throttle-history')) return answer({ throttle_history: [] });
  return answer(undefined);
}

describe('UsageClient — modality breakdown (QUA-web-account-2-02)', () => {
  beforeEach(() => {
    mockedUseSWR.mockReset();
    mockedUseSWR.mockImplementation(swrByUrl as never);
  });

  it("sums the window's counterparty hops per modality instead of showing zeros", () => {
    render(<UsageClient initialCurrent={current} />);
    expect(screen.getByText('Audit (7)')).toBeInTheDocument();
    expect(screen.getByText('Watcher (3)')).toBeInTheDocument();
    expect(screen.getByText('Phantom Demand (2)')).toBeInTheDocument();
  });
});
