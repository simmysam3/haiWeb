'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// v.1.41 Backlog IA: Gaps mode is hard-scoped to `category=gap` in
// page.tsx, so the cross-category toggle that lived here is gone.
// Remaining filters are within-gap-scope: lifecycle status, sort
// direction, and partner narrowing.
const STATUSES = ['open', 'snoozed', 'dismissed'] as const;
const SORTS = ['recency', 'oldest_unresolved'] as const;

// v.1.41 Backlog IA: "New" toggle. Fixed 7-day window — surfaces fresh
// gaps from new product/vendor onboards so users can prioritise net-new
// work. Items without first_seen_at (gaps predating the change-events
// writer) are filtered OUT when the toggle is on (server-side decision
// in haiCore working-list service).
const NEW_WINDOW_DAYS = 7;

export function FilterPills() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value) sp.set(key, value); else sp.delete(key);
    router.push(`${pathname}?${sp}`);
  }
  const status = searchParams.get('status') ?? '';
  const sort = searchParams.get('sort') ?? 'recency';
  const sku = searchParams.get('sku') ?? '';
  const newActive = searchParams.get('max_age_days') === String(NEW_WINDOW_DAYS);
  function toggleNew() {
    const sp = new URLSearchParams(searchParams.toString());
    if (newActive) sp.delete('max_age_days');
    else sp.set('max_age_days', String(NEW_WINDOW_DAYS));
    router.push(sp.toString() ? `${pathname}?${sp}` : pathname);
  }
  function clearSku() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('sku');
    router.push(sp.toString() ? `${pathname}?${sp}` : pathname);
  }
  // v.1.37 mobile pass kept: on small screens the bar stacks; ≥md it
  // returns to the inline flex-wrap row. Status/Sort/Partner each
  // stack label-above-input full-width for ≥44px touch targets.
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {sku && (
        <div className="mb-1 flex w-full flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate">Filtered to SKU:</span>
          <button
            type="button"
            onClick={clearSku}
            title="Click to clear the SKU filter applied by a global-search deep-link."
            className="inline-flex items-center gap-1 rounded-full border border-teal bg-teal/10 px-3 py-1.5 text-xs text-navy hover:border-teal-dark md:py-1"
          >
            <span className="font-mono">{sku}</span>
            <span aria-hidden className="text-slate">×</span>
            <span className="sr-only">Clear SKU filter</span>
          </button>
        </div>
      )}
      <label className="flex w-full flex-col gap-1 md:contents">
        <span className="text-xs uppercase tracking-wider text-slate md:self-center">Status:</span>
        <select value={status} onChange={(e) => setParam('status', e.target.value)} title="Filter by item lifecycle state — open, snoozed (re-surfaces later), or dismissed (acknowledged & suppressed)." className="w-full rounded-md border border-slate/30 px-2 py-2 text-sm md:w-auto md:py-1 md:text-xs">
          <option value="" title="Show items in any lifecycle state.">all</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="flex w-full flex-col gap-1 md:contents">
        <span className="text-xs uppercase tracking-wider text-slate md:self-center md:pl-4">Sort:</span>
        <select value={sort} onChange={(e) => setParam('sort', e.target.value)} title="Order rows by recency (most recently transitioned first) or oldest_unresolved (longest-open gaps first; open items only)." className="w-full rounded-md border border-slate/30 px-2 py-2 text-sm md:w-auto md:py-1 md:text-xs">
          {SORTS.map((s) => (
            <option key={s} value={s}>{s === 'oldest_unresolved' ? 'oldest unresolved' : s}</option>
          ))}
        </select>
      </label>
      <label className="flex w-full flex-col gap-1 md:contents">
        <span className="text-xs uppercase tracking-wider text-slate md:self-center md:pl-4">Partner:</span>
        <input type="text" value={searchParams.get('partner_id') ?? ''} onChange={(e) => setParam('partner_id', e.target.value)} placeholder="vendor ID" title="Filter rows to those involving a specific counterparty (paste a vendor UUID)." className="w-full rounded-md border border-slate/30 px-2 py-2 text-sm md:w-32 md:py-1 md:text-xs" />
      </label>
      <button
        type="button"
        aria-pressed={newActive}
        onClick={toggleNew}
        title={`Show only gaps first seen in the last ${NEW_WINDOW_DAYS} days. Useful for working through net-new gaps from a recent product or vendor onboard.`}
        className={`md:ml-4 rounded-full border px-3 py-1.5 text-xs md:py-1 ${
          newActive
            ? 'border-teal bg-teal/10 text-navy'
            : 'border-slate/30 text-slate hover:border-slate'
        }`}
      >
        New ({NEW_WINDOW_DAYS}d)
      </button>
    </div>
  );
}
