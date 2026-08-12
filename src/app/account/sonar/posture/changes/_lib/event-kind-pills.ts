import type { EmittedChangeKind } from '@haiwave/protocol';

// Watcher Backlog pill set. Lives outside any `'use client'` module so the
// Server Component page can iterate it server-side (default-allowlist
// enforcement) without hitting the RSC client-reference boundary — Next 16 /
// Turbopack wraps every export of a `'use client'` module as a client
// reference, so a const array imported from one becomes an opaque function
// on the server and `new Set(arr)` throws "function is not iterable". Same
// reason `_lib/severity.ts` exists; see its comment for context.

// v.1.43: Watcher Backlog is the watcher/monitoring-signal surface. The 7
// audit-data kinds (origin/plant shifts, cert status, vendor substitution,
// depth) live on the Event Backlog under Sonar Audit (audit/events/) — keep
// the two surfaces strictly disjoint by kind so the nav tooltip ("Drift
// events from your scheduled watcher configurations") matches what users
// see. v1.69 slice D adds the MRP promise-drift kinds here too — they are
// watcher-emitted (watcher-drift-service.ts), same as the lead-time pair.
// v1.73 WP4: upstream_risk_reported is deliberately WITHHELD from this array
// until protocol 3.66.0 (WP3) mints it. This array doubles as the wire filter
// allowlist (posture/changes/page.tsx forwards it verbatim as `?kind=`), and
// haiCore's unknown-kind handling turns an all-unknown `kind` filter into an
// unfiltered query (drops every requested kind, falls through to its
// no-filter default, returns the ENTIRE compliance_changes feed — including
// all seven audit-side kinds — on this watcher-only surface). Carrying the
// literal ahead of the protocol, as this file once did, is exactly what
// caused that: clicking ONLY the dormant pill sent `kind=upstream_risk_reported`
// and haiCore returned everything. Re-add the literal the day 3.66.0 lands.
type WatcherBacklogKind = Extract<
  EmittedChangeKind,
  'lead_time_degraded' | 'lead_time_improved' | 'promise_date_slipped' | 'promise_date_improved'
>;

export const EVENT_KIND_PILLS: ReadonlyArray<WatcherBacklogKind> = [
  'lead_time_degraded',
  'lead_time_improved',
  'promise_date_slipped',
  'promise_date_improved',
] as const;

export const KIND_TOOLTIPS: Record<(typeof EVENT_KIND_PILLS)[number], string> = {
  lead_time_degraded: 'Lead time increased beyond the degradation threshold. Click to filter the feed to lead-time-degraded events only.',
  lead_time_improved: 'Lead time decreased beyond the degradation threshold. Click to filter the feed to lead-time-improved events only.',
  promise_date_slipped: 'The ERP’s post-MRP schedule for a booked order line completes later than the promised date. Click to filter the feed to promise-slipped events only.',
  promise_date_improved: 'The ERP’s post-MRP schedule for a booked order line completes earlier than promised, or re-splits without moving completion. Click to filter the feed to promise-improved events only.',
};
