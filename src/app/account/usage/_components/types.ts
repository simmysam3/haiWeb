/**
 * Shared row types for the Usage page sub-components.
 *
 * Hoisted out of the individual `*-list` / `*-table` components so the
 * `usage-client` orchestrator and its tests can type SWR responses without
 * resorting to `any`. Shapes match the BFF response payloads under
 * `/api/account/usage/*` (which mirror haiCore's `/sonar/usage/*`).
 *
 * v1.30 PR-5 — Usage Page.
 */

export type ObservationClass = 'audit' | 'watcher' | 'phantom_demand';

export interface TimeseriesBucket {
  window_start: string;
  hops_consumed: number;
}

export interface CounterpartyRow {
  counterparty_id: string;
  counterparty_name: string | null;
  total_hops: number;
  audit_hops: number;
  watcher_hops: number;
  phantom_demand_hops: number;
  last_activity: string;
}

export interface ActiveRunRow {
  run_id: string;
  observation_class: ObservationClass;
  status: 'running' | 'throttled';
  hops_consumed: number;
  started_at: string | null;
  throttled_at: string | null;
}

export interface ThrottleHistoryRow {
  run_id: string;
  observation_class: ObservationClass;
  throttled_at: string;
  resumption_count: number;
  current_status: string;
}
