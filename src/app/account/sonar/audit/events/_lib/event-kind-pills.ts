import type { EmittedChangeKind } from '@haiwave/protocol';

// Shared Event Backlog pill set. Lives outside any `'use client'` module so
// the Server Component page can iterate it server-side (default-allowlist
// enforcement) without hitting the RSC client-reference boundary — Next 16 /
// Turbopack wraps every export of a `'use client'` module as a client
// reference, so a const array imported from one becomes an opaque function
// on the server and `new Set(arr)` throws "function is not iterable". Same
// reason `_lib/severity.ts` exists; see its comment for context.

// Source of truth: packages/protocol/src/audit/compliance-changes.ts —
// EMITTED_CHANGE_KINDS (v1.34 §5.3) MINUS:
//   - gap_added / gap_resolved — surface on the Gaps tab (own lifecycle).
//   - lead_time_degraded / lead_time_improved (v.1.43) — these are
//     watcher/monitoring signals, not audit-data changes; they belong on
//     the Watcher Backlog surface, not the Event Backlog.
//   - promise_date_slipped / promise_date_improved (v1.69 slice D) — same
//     reasoning: watcher-emitted MRP promise drift, Watcher Backlog only.
//   - upstream_risk_reported (v1.73 WP4 forward-carry; minted in protocol
//     3.66.0 by WP3) — a no-op exclusion today (not yet a member of
//     EmittedChangeKind), load-bearing once 3.66.0 deploys: watcher-emitted,
//     Watcher Backlog only, same as the lead-time/promise-drift kinds above.
// Turbopack cannot value-import the CJS @haiwave/protocol package through
// the file: symlink on Windows; a direct value-import will fail at runtime.
// Keep this list verbatim in sync with the subset above. Do NOT replace
// with a value import.
export const EVENT_KIND_PILLS: ReadonlyArray<
  Exclude<EmittedChangeKind, 'gap_added' | 'gap_resolved' | 'lead_time_degraded' | 'lead_time_improved' | 'promise_date_slipped' | 'promise_date_improved' | 'upstream_risk_reported'>
> = [
  'origin_shifted_country',
  'origin_shifted_plant',
  'vendor_substituted',
  'certification_expired_or_revoked',
  'certification_renewed',
  'depth_reduced',
  'depth_increased',
] as const;

// Tooltip copy: definition first, then the filter action. Mirrors
// CHANGE_KIND_DEFINITION in PILL_DEFINITIONS (components/pill.tsx) verbatim,
// with an appended action sentence. Inlined here because these are <button>
// toggles, not status pills.
export const KIND_TOOLTIPS: Record<(typeof EVENT_KIND_PILLS)[number], string> = {
  origin_shifted_country: 'Country of origin changed for this vendor/product. Click to filter the feed to country-shift events only.',
  origin_shifted_plant: 'Plant identifier changed within the same country. Click to filter the feed to plant-shift events only.',
  vendor_substituted: 'A subcomponent vendor changed. Click to filter the feed to vendor-substitution events only.',
  certification_expired_or_revoked: 'A referenced certification became expired or revoked. Click to filter the feed to certification-expiry events only.',
  certification_renewed: 'Certification status returned to valid. Click to filter the feed to certification-renewal events only.',
  depth_reduced: 'Maximum traversal depth decreased for this product. Click to filter the feed to depth-reduced events only.',
  depth_increased: 'Maximum traversal depth increased for this product. Click to filter the feed to depth-increased events only.',
};
