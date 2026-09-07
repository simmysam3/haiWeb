'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { jsonFetcher } from '@/lib/swr-fetcher';
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
  is_custom: boolean;
  phantom_demand_inbound_probe_limit: number;
  phantom_demand_inbound_probe_limit_is_custom: boolean;
}

interface Props { initialCurrent: CurrentPayload | null; }

export function UsageClient({ initialCurrent }: Props) {
  const [window, setWindow] = useState<1 | 7 | 30>(7);

  const { data: currentData } = useSWR<CurrentPayload>('/api/account/usage/current', jsonFetcher, {
    fallbackData: initialCurrent ?? undefined,
    refreshInterval: 30000,
  });
  const current = currentData ?? initialCurrent;

  const { data: activeRunsData } = useSWR<{ active_runs: ActiveRunRow[] }>(
    '/api/account/usage/active-runs',
    jsonFetcher,
    { refreshInterval: 10000 },
  );

  const { data: timeseriesData } = useSWR<{ buckets: TimeseriesBucket[] }>(
    `/api/account/usage/timeseries?window_days=${window}`,
    jsonFetcher,
  );

  const { data: counterpartiesData } = useSWR<{ counterparties: CounterpartyRow[] }>(
    `/api/account/usage/counterparties?window_days=${window}`,
    jsonFetcher,
  );

  const { data: throttleData } = useSWR<{ throttle_history: ThrottleHistoryRow[] }>(
    '/api/account/usage/throttle-history?days=30',
    jsonFetcher,
  );

  if (!current) {
    return (
      <div className="border rounded p-4 text-slate">
        Usage data unavailable. Try again in a moment.
      </div>
    );
  }

  // Modality breakdown from the SAME window's counterparty rows: the three
  // modality sums and the total they add up to agree by construction. Until
  // the rows arrive the widget says so rather than drawing zeros
  // (QUA-web-account-2-02).
  const modality = (counterpartiesData?.counterparties ?? []).reduce(
    (acc, r: CounterpartyRow) => ({
      audit: acc.audit + (r.audit_hops ?? 0),
      watcher: acc.watcher + (r.watcher_hops ?? 0),
      phantom_demand: acc.phantom_demand + (r.phantom_demand_hops ?? 0),
    }),
    { audit: 0, watcher: 0, phantom_demand: 0 },
  );
  const modalityTotal = modality.audit + modality.watcher + modality.phantom_demand;

  return (
    <div className="space-y-4">
      <CurrentHeader
        consumed={current.consumed}
        budget={current.budget}
        windowStart={current.window_start}
      />

      {counterpartiesData ? (
        <CompositionBar
          audit={modality.audit}
          watcher={modality.watcher}
          phantom_demand={modality.phantom_demand}
          total={modalityTotal}
        />
      ) : (
        <section className="bg-white border border-slate-200 rounded p-4 text-sm text-slate">
          Loading modality breakdown…
        </section>
      )}

      <TimeseriesChart
        buckets={timeseriesData?.buckets ?? []}
        window={window}
        onWindowChange={setWindow}
      />

      <CounterpartyTable rows={counterpartiesData?.counterparties ?? []} />

      <ActiveRunsList rows={activeRunsData?.active_runs ?? []} />

      <ThrottleHistoryList rows={throttleData?.throttle_history ?? []} />

      <BudgetDisplay
        budget={current.budget}
        isCustom={current.is_custom}
        probeLimit={current.phantom_demand_inbound_probe_limit}
        probeLimitIsCustom={current.phantom_demand_inbound_probe_limit_is_custom}
      />
    </div>
  );
}
