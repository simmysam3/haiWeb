'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// Sync with @haiwave/protocol WorkingListCategory / WorkingListStatusFilter / WorkingListSort.
// Turbopack cannot value-import the CJS @haiwave/protocol via the file: symlink on Windows.
const CATEGORIES = ['gap', 'change', 'nomination', 'obligation', 'expiry'] as const;
const STATUSES = ['open', 'snoozed', 'dismissed'] as const;
const SORTS = ['recency', 'oldest_unresolved'] as const;

// Tooltip copy: definition first, then the action the click performs. Matches
// the descriptive style of components/pill.tsx PILL_DEFINITIONS — kept inline
// here because these are <button> toggles, not status pills.
const CATEGORY_TOOLTIPS: Record<(typeof CATEGORIES)[number], string> = {
  gap: 'An open compliance gap from the latest snapshot. Click to filter the list to gap items only.',
  change: 'A just-broken change event detected between snapshots. Click to filter the list to change items only.',
  nomination: 'An outgoing vendor nomination awaiting response. Click to filter the list to nomination items only.',
  obligation: 'An incoming customer request awaiting your response. Click to filter the list to obligation items only.',
  expiry: 'A provenance key expiring within the warning window. Click to filter the list to expiry items only.',
};

export function FilterPills() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  function toggleCategory(cat: string) {
    const sp = new URLSearchParams(searchParams.toString());
    const cur = (sp.get('categories') ?? '').split(',').filter(Boolean);
    const next = cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat];
    if (next.length) sp.set('categories', next.join(',')); else sp.delete('categories');
    router.push(`${pathname}?${sp}`);
  }
  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value) sp.set(key, value); else sp.delete(key);
    router.push(`${pathname}?${sp}`);
  }
  const activeCats = (searchParams.get('categories') ?? '').split(',').filter(Boolean);
  const status = searchParams.get('status') ?? '';
  const sort = searchParams.get('sort') ?? 'recency';
  const sku = searchParams.get('sku') ?? '';
  function clearSku() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('sku');
    router.push(sp.toString() ? `${pathname}?${sp}` : pathname);
  }
  // v.1.37 mobile pass: on small screens the bar collapses to a 2-column
  // stacked layout (Category pills span full width and wrap; the trailing
  // Status/Sort/Partner dropdowns each stack label-above-input full-width
  // for ≥44px touch targets). On ≥md it returns to the inline flex-wrap
  // row that matches the v1.37 Sonar FilterPills convention.
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
      <div className="flex w-full flex-wrap items-center gap-2 md:contents">
        <span className="self-center text-xs uppercase tracking-wider text-slate">Category:</span>
        {CATEGORIES.map((cat) => (
          <button key={cat} type="button" aria-pressed={activeCats.includes(cat)} title={CATEGORY_TOOLTIPS[cat]} onClick={() => toggleCategory(cat)} className={`rounded-full border px-3 py-1.5 text-xs md:py-1 ${activeCats.includes(cat) ? 'border-teal bg-teal/10 text-navy' : 'border-slate/30 text-slate hover:border-slate'}`}>{cat}</button>
        ))}
      </div>
      <label className="flex w-full flex-col gap-1 md:contents">
        <span className="text-xs uppercase tracking-wider text-slate md:self-center md:pl-4">Status:</span>
        <select value={status} onChange={(e) => setParam('status', e.target.value)} title="Filter by item lifecycle state — open, snoozed (re-surfaces later), or dismissed (acknowledged & suppressed)." className="w-full rounded-md border border-slate/30 px-2 py-2 text-sm md:w-auto md:py-1 md:text-xs">
          <option value="" title="Show items in any lifecycle state.">all</option>
          <option value="open" title="Open and unresolved items.">open</option>
          <option value="snoozed" title="Items snoozed for later; re-surface when their snooze window elapses.">snoozed</option>
          <option value="dismissed" title="Items acknowledged & suppressed with a reason; hidden from the default working view.">dismissed</option>
        </select>
      </label>
      <label className="flex w-full flex-col gap-1 md:contents">
        <span className="text-xs uppercase tracking-wider text-slate md:self-center md:pl-4">Sort:</span>
        <select value={sort} onChange={(e) => setParam('sort', e.target.value)} title="Order rows by recency (most recently transitioned first) or oldest_unresolved (longest-open gaps first; open items only)." className="w-full rounded-md border border-slate/30 px-2 py-2 text-sm md:w-auto md:py-1 md:text-xs">
          <option value="recency" title="Show the most recently transitioned items first.">recency</option>
          <option value="oldest_unresolved" title="Show the longest-open items first (restricted to open items).">oldest unresolved</option>
        </select>
      </label>
      <label className="flex w-full flex-col gap-1 md:contents">
        <span className="text-xs uppercase tracking-wider text-slate md:self-center md:pl-4">Partner:</span>
        <input type="text" value={searchParams.get('partner_id') ?? ''} onChange={(e) => setParam('partner_id', e.target.value)} placeholder="vendor ID" title="Filter rows to those involving a specific counterparty (paste a vendor UUID)." className="w-full rounded-md border border-slate/30 px-2 py-2 text-sm md:w-32 md:py-1 md:text-xs" />
      </label>
    </div>
  );
}
