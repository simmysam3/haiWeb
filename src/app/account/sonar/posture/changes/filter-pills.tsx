'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { EVENT_KIND_PILLS, KIND_TOOLTIPS } from './_lib/event-kind-pills';

/**
 * "Showing" dropdown for the Watcher Backlog feed.
 *
 * v.1.45: severity filtering retired. The watcher surface now only carries
 * lead-time drift events (degraded / improved) — none are inherently
 * "critical" vs "warning" in a way that warrants a filter, so the feed always
 * shows every severity. The dropdown is now a simple view-mode toggle between
 * the active backlog and the already-processed rows (`?processed=true`).
 */
const SHOWING_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'processed', label: 'Processed' },
] as const;

export function FilterPills() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggleKind(kind: string) {
    const sp = new URLSearchParams(searchParams.toString());
    const existing = sp.getAll('kind');
    sp.delete('kind');
    if (existing.includes(kind)) {
      for (const v of existing) if (v !== kind) sp.append('kind', v);
    } else {
      for (const v of existing) sp.append('kind', v);
      sp.append('kind', kind);
    }
    // Filter change shrinks/shifts the result set — page N could now be past
    // the end. Reset to page 1 so the user sees results, not an empty page.
    sp.delete('page');
    router.push(`${pathname}?${sp}`);
  }

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value) {
      sp.set(key, value);
    } else {
      sp.delete(key);
    }
    sp.delete('page');
    router.push(`${pathname}?${sp}`);
  }

  // Active ↔ Processed view toggle. Processed sets `?processed=true`; Active
  // clears it. Any stale `severity` fragment from a pre-v.1.45 URL is dropped
  // either way so it can't silently filter the feed.
  function setShowing(value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('severity');
    if (value === 'processed') {
      sp.set('processed', 'true');
    } else {
      sp.delete('processed');
    }
    sp.delete('page');
    router.push(`${pathname}?${sp}`);
  }

  function isKindActive(kind: string) {
    return searchParams.getAll('kind').includes(kind);
  }

  const partner = searchParams.get('partner') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const isProcessedView = searchParams.get('processed') === 'true';
  const showing = isProcessedView ? 'processed' : 'active';

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="self-center text-xs uppercase tracking-wider text-slate">Showing:</span>
      <select
        value={showing}
        onChange={(e) => setShowing(e.target.value)}
        title="Toggle between the active backlog and rows you've already processed. All drift events are shown regardless of severity."
        className="rounded-md border border-slate/30 px-2 py-1 text-xs"
      >
        {SHOWING_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">Kind:</span>
      {EVENT_KIND_PILLS.map((kind) => (
        <button
          key={kind}
          type="button"
          aria-pressed={isKindActive(kind)}
          title={KIND_TOOLTIPS[kind]}
          onClick={() => toggleKind(kind)}
          className={`rounded-full border px-3 py-1 text-xs ${
            isKindActive(kind)
              ? 'border-teal bg-teal/10 text-navy'
              : 'border-slate/30 text-slate hover:border-slate'
          }`}
        >
          {kind.replace(/_/g, ' ')}
        </button>
      ))}

      <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">Partner:</span>
      <input
        type="text"
        value={partner}
        onChange={(e) => setParam('partner', e.target.value)}
        placeholder="vendor ID"
        title="Filter the feed to changes involving a specific counterparty (paste a vendor UUID)."
        className="w-32 rounded-md border border-slate/30 px-2 py-1 text-xs"
      />

      <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">From:</span>
      <input
        type="date"
        value={from}
        onChange={(e) => setParam('from', e.target.value)}
        title="Hide changes that occurred before this date."
        className="rounded-md border border-slate/30 px-2 py-1 text-xs"
      />

      <span className="self-center pl-2 text-xs uppercase tracking-wider text-slate">To:</span>
      <input
        type="date"
        value={to}
        onChange={(e) => setParam('to', e.target.value)}
        title="Hide changes that occurred after this date."
        className="rounded-md border border-slate/30 px-2 py-1 text-xs"
      />
    </div>
  );
}
