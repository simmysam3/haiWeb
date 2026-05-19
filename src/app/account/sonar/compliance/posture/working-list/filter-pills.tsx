'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// Sync with @haiwave/protocol WorkingListCategory / WorkingListStatusFilter / WorkingListSort.
// Turbopack cannot value-import the CJS @haiwave/protocol via the file: symlink on Windows.
const CATEGORIES = ['gap', 'change', 'nomination', 'obligation', 'expiry'] as const;
const STATUSES = ['open', 'snoozed', 'dismissed'] as const;
const SORTS = ['recency', 'oldest_unresolved'] as const;

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
        <button key={cat} type="button" aria-pressed={activeCats.includes(cat)} onClick={() => toggleCategory(cat)} className={`rounded-full border px-3 py-1 text-xs ${activeCats.includes(cat) ? 'border-teal bg-teal/10 text-navy' : 'border-slate/30 text-slate hover:border-slate'}`}>{cat}</button>
      ))}
      <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">Status:</span>
      <select value={status} onChange={(e) => setParam('status', e.target.value)} className="rounded-md border border-slate/30 px-2 py-1 text-xs">
        <option value="">all</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">Sort:</span>
      <select value={sort} onChange={(e) => setParam('sort', e.target.value)} className="rounded-md border border-slate/30 px-2 py-1 text-xs">
        {SORTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
      </select>
      <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">Partner:</span>
      <input type="text" value={searchParams.get('partner_id') ?? ''} onChange={(e) => setParam('partner_id', e.target.value)} placeholder="vendor ID" className="w-32 rounded-md border border-slate/30 px-2 py-1 text-xs" />
    </div>
  );
}
