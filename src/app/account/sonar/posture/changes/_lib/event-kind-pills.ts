import type { EmittedChangeKind } from '@haiwave/protocol';

// Watcher Backlog pill set. Lives outside any `'use client'` module so the
// Server Component page can iterate it server-side (default-allowlist
// enforcement) without hitting the RSC client-reference boundary — Next 16 /
// Turbopack wraps every export of a `'use client'` module as a client
// reference, so a const array imported from one becomes an opaque function
// on the server and `new Set(arr)` throws "function is not iterable". Same
// reason `_lib/severity.ts` exists; see its comment for context.

// v.1.43: Watcher Backlog is the LT-drift surface and shows only the two
// lead-time event kinds. The 7 audit-data kinds (origin/plant shifts,
// cert status, vendor substitution, depth) live on the Event Backlog under
// Sonar Audit (audit/events/) — keep the two surfaces strictly disjoint by
// kind so the nav tooltip ("Drift events from your scheduled watcher
// configurations") matches what users see.
export const EVENT_KIND_PILLS: ReadonlyArray<
  Extract<EmittedChangeKind, 'lead_time_degraded' | 'lead_time_improved'>
> = ['lead_time_degraded', 'lead_time_improved'] as const;

export const KIND_TOOLTIPS: Record<(typeof EVENT_KIND_PILLS)[number], string> = {
  lead_time_degraded: 'Lead time increased beyond the degradation threshold. Click to filter the feed to lead-time-degraded events only.',
  lead_time_improved: 'Lead time decreased beyond the degradation threshold. Click to filter the feed to lead-time-improved events only.',
};
