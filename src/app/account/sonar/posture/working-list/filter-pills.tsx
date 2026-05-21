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
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="self-center text-xs uppercase tracking-wider text-slate">Category:</span>
      {CATEGORIES.map((cat) => (
        <button key={cat} type="button" aria-pressed={activeCats.includes(cat)} title={CATEGORY_TOOLTIPS[cat]} onClick={() => toggleCategory(cat)} className={`rounded-full border px-3 py-1 text-xs ${activeCats.includes(cat) ? 'border-teal bg-teal/10 text-navy' : 'border-slate/30 text-slate hover:border-slate'}`}>{cat}</button>
      ))}
      <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">Status:</span>
      <select value={status} onChange={(e) => setParam('status', e.target.value)} title="Filter by item lifecycle state — open, snoozed (re-surfaces later), or dismissed (acknowledged & suppressed)." className="rounded-md border border-slate/30 px-2 py-1 text-xs">
        <option value="" title="Show items in any lifecycle state.">all</option>
        <option value="open" title="Open and unresolved items.">open</option>
        <option value="snoozed" title="Items snoozed for later; re-surface when their snooze window elapses.">snoozed</option>
        <option value="dismissed" title="Items acknowledged & suppressed with a reason; hidden from the default working view.">dismissed</option>
      </select>
      <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">Sort:</span>
      <select value={sort} onChange={(e) => setParam('sort', e.target.value)} title="Order rows by recency (most recently transitioned first) or oldest_unresolved (longest-open gaps first; open items only)." className="rounded-md border border-slate/30 px-2 py-1 text-xs">
        <option value="recency" title="Show the most recently transitioned items first.">recency</option>
        <option value="oldest_unresolved" title="Show the longest-open items first (restricted to open items).">oldest unresolved</option>
      </select>
      <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">Partner:</span>
      <input type="text" value={searchParams.get('partner_id') ?? ''} onChange={(e) => setParam('partner_id', e.target.value)} placeholder="vendor ID" title="Filter rows to those involving a specific counterparty (paste a vendor UUID)." className="w-32 rounded-md border border-slate/30 px-2 py-1 text-xs" />
    </div>
  );
}
