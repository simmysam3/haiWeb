'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { DEFAULT_SEVERITY, SEVERITY_VALUES } from './_lib/severity';
import { EVENT_KIND_PILLS, KIND_TOOLTIPS } from './_lib/event-kind-pills';

/**
 * "Showing" dropdown for the Watcher Backlog feed.
 *
 * Conceptually a view-mode selector. `critical | warning | all` choose a
 * severity filter on the wire; `processed` (v.1.42) is mutually exclusive
 * with severity — selecting it sets `?processed=true` and clears severity,
 * fetching only already-actioned rows. The page reads either `severity` or
 * `processed` from the URL and forwards as-is to the BFF.
 */
const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical Only' },
  { value: 'warning', label: 'Warning Only' },
  { value: 'all', label: 'All' },
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

  // Showing dropdown changes are mutually exclusive between the severity and
  // processed query params: selecting Processed clears severity, and selecting
  // any severity clears processed. Without this, an old `severity=critical`
  // URL fragment would silently AND with `processed=true` and confuse the
  // result set.
  function setShowing(value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value === 'processed') {
      sp.set('processed', 'true');
      sp.delete('severity');
    } else {
      sp.set('severity', value);
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
  const rawSeverity = searchParams.get('severity');
  const isProcessedView = searchParams.get('processed') === 'true';
  const showing = isProcessedView
    ? 'processed'
    : rawSeverity && SEVERITY_VALUES.has(rawSeverity)
      ? rawSeverity
      : DEFAULT_SEVERITY;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="self-center text-xs uppercase tracking-wider text-slate">Showing:</span>
      <select
        value={showing}
        onChange={(e) => setShowing(e.target.value)}
        title="Filter the feed by event severity. Defaults to Critical Only. Pick 'Processed' to see rows you've already actioned."
        className="rounded-md border border-slate/30 px-2 py-1 text-xs"
      >
        {SEVERITY_OPTIONS.map((o) => (
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
