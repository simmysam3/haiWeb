import type { FetchResult } from '@/lib/server-fetch';

type ServiceError = Extract<FetchResult<unknown>, { kind: 'error' }>;

// Maps a failed fetchBffJson call to the user-facing sentence for the Event
// Backlog surfaces. `noun` names what failed to load (e.g. "events", "this
// event") so the Events feed and the Event detail page share one status
// ladder instead of keeping two copies in sync by hand.
export function describeAuditServiceError(result: ServiceError, noun: string): string {
  if (result.status === 403) return `You do not have permission to view ${noun}.`;
  if (result.status === 401) return 'Your session has expired. Please sign in again.';
  if (result.status >= 500) return `Couldn't load ${noun}. The audit service is temporarily unavailable.`;
  if (result.status === 0) return `Couldn't reach the audit service${result.message ? `: ${result.message}` : '.'}`;
  return `Couldn't load ${noun} (status ${result.status}).`;
}
