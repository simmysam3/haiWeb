'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { CurrentHeader } from './current-header';
import { CompositionBar } from './composition-bar';
import { TimeseriesChart } from './timeseries-chart';
import { CounterpartyTable } from './counterparty-table';
import { ActiveRunsList } from './active-runs-list';
import { ThrottleHistoryList } from './throttle-history-list';
import { BudgetDisplay } from './budget-display';
import type {
  ActiveRunRow,
  CounterpartyRow,
  ThrottleHistoryRow,
  TimeseriesBucket,
} from './types';

interface CurrentPayload {
  participant_id: string;
  window_start: string;
  consumed: number;
  remaining: number;
  budget: number;
}

interface Props { initialCurrent: CurrentPayload | null; }

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function UsageClient({ initialCurrent }: Props) {
  const [window, setWindow] = useState<1 | 7 | 30>(7);

  const { data: currentData } = useSWR<CurrentPayload>('/api/account/usage/current', fetcher, {
    fallbackData: initialCurrent ?? undefined,
    refreshInterval: 30000,
  });
  const current = currentData ?? initialCurrent;

  const { data: activeRunsData } = useSWR<{ active_runs: ActiveRunRow[] }>(
    '/api/account/usage/active-runs',
    fetcher,
    { refreshInterval: 10000 },
  );

  const { data: timeseriesData } = useSWR<{ buckets: TimeseriesBucket[] }>(
    `/api/account/usage/timeseries?window_days=${window}`,
    fetcher,
  );

  const { data: counterpartiesData } = useSWR<{ counterparties: CounterpartyRow[] }>(
    `/api/account/usage/counterparties?window_days=${window}`,
    fetcher,
  );

  const { data: throttleData } = useSWR<{ throttle_history: ThrottleHistoryRow[] }>(
    '/api/account/usage/throttle-history?days=30',
    fetcher,
  );

  if (!current) {
    return (
      <div className="border rounded p-4 text-slate">
        Usage data unavailable. Try again in a moment.
      </div>
    );
  }

  const totalHops = (timeseriesData?.buckets ?? []).reduce(
    (sum: number, b: TimeseriesBucket) => sum + (b.hops_consumed ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      <CurrentHeader
        consumed={current.consumed}
        budget={current.budget}
        windowStart={current.window_start}
      />

      <CompositionBar audit={0} watcher={0} phantom_demand={0} total={totalHops} />

      <TimeseriesChart
        buckets={timeseriesData?.buckets ?? []}
        window={window}
        onWindowChange={setWindow}
      />

      <CounterpartyTable rows={counterpartiesData?.counterparties ?? []} />

      <ActiveRunsList rows={activeRunsData?.active_runs ?? []} />

      <ThrottleHistoryList rows={throttleData?.throttle_history ?? []} />

      <BudgetDisplay budget={current.budget} />
    </div>
  );
}
