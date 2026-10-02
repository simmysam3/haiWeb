import type {
  SmDemandCause, SmDemandException, SmOptionPanel, SmRequestStatus, SmScorecardDimensionKey, SmSupplyRisk, SmSupplyRiskStatus,
} from './types';
import { EM_DASH, bandWord, formatDay, formatQty } from './map/selectors';
import { smRunHref } from './routes';

export const RISK_STATUS_PILLS: ReadonlyArray<{ value: SmSupplyRiskStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'resolving', label: 'Resolving' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'accepted', label: 'Accepted' },
];

/** The statuses the Supply Risks page shows by default (G-15). */
export const ACTIVE_RISK_STATUSES: readonly SmSupplyRiskStatus[] = ['open', 'contacted', 'resolving'];

export const CAUSE_PILLS: ReadonlyArray<{ value: SmDemandCause; label: string }> = [
  { value: 'own_capacity', label: 'Own capacity' },
  { value: 'chain', label: 'Chain' },
  { value: 'posture', label: 'Posture' },
];

export const DIMENSION_LABEL: Record<SmScorecardDimensionKey, string> = {
  fulfillment_reliability: 'Fulfillment reliability',
  response_time: 'Response time',
  price_adherence: 'Price adherence',
  agent_uptime: 'Agent uptime',
};

export function openMapHref(m: NonNullable<SmSupplyRisk['open_map']>): string {
  const q = new URLSearchParams({ execution: m.execution_id, option: m.option_key });
  return `${smRunHref(m.project_id, m.template_id)}?${q.toString()}`;
}

export function originText(o: SmSupplyRisk['origin']): string {
  return [`tier ${o.tier}`, o.class?.label ?? EM_DASH, o.country ?? EM_DASH, bandWord(o.band)].join(' · ');
}

export function figureText(n: number | null): string {
  return n === null ? EM_DASH : formatQty(n);
}

export function windowText(w: SmDemandException['window']): string {
  return `${formatDay(w.first)} to ${formatDay(w.last)}`;
}

export function requestStatusText(s: SmRequestStatus): string {
  return s === 'request_closed' ? 'Request closed' : 'Open';
}

export function leadTimeText(lt: NonNullable<SmOptionPanel['delivery_history']>['lead_time']): string | null {
  if (lt === null) return null;
  return lt.kind === 'calibrated_p50'
    ? `Calibrated p50: ${lt.days} d`
    : `Calibrated median: ${lt.days} d (${lt.sample_count} orders)`;
}

/** The wire query: one `param=value` per value, in order, then the cursor when given. */
export function backlogQuery(param: 'status' | 'cause', values: readonly string[], cursor?: string): string {
  const q = new URLSearchParams();
  for (const v of values) q.append(param, v);
  if (cursor !== undefined) q.append('cursor', cursor);
  return q.toString();
}

export function nextHref(pathname: string, param: 'status' | 'cause', values: readonly string[], nextCursor: string | null): string | null {
  return nextCursor === null ? null : `${pathname}?${backlogQuery(param, values, nextCursor)}`;
}

/** The error ladder of the Watcher Backlog page (G-33). */
export function loadErrorText(status: number, noun: 'supply risks' | 'demand exceptions'): string {
  if (status === 403) return `You do not have permission to view ${noun}.`;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  return `Couldn't load ${noun}. Try again in a moment.`;
}
