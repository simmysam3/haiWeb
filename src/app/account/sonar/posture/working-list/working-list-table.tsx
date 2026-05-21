'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { WorkingListItem } from '@haiwave/protocol';
import { Pill } from '@/components/pill';

export interface PartnerGroup {
  partnerId: string | null;
  partnerName: string;
  items: WorkingListItem[];
}

export function groupByPartner(items: WorkingListItem[]): PartnerGroup[] {
  const map = new Map<string, PartnerGroup>();
  for (const it of items) {
    const key = it.partner_id ?? '__unassigned__';
    const name = it.partner_legal_name ?? 'Unassigned';
    const existing = map.get(key);
    if (existing) {
      existing.items.push(it);
    } else {
      map.set(key, { partnerId: it.partner_id, partnerName: name, items: [it] });
    }
  }
  const groups = Array.from(map.values());
  groups.sort((a, b) => {
    if (a.partnerName === 'Unassigned' && b.partnerName !== 'Unassigned') return 1;
    if (b.partnerName === 'Unassigned' && a.partnerName !== 'Unassigned') return -1;
    return b.items.length - a.items.length;
  });
  return groups;
}

function stateLabel(state: WorkingListItem['state']): string {
  return state === 'dismissed' ? 'suppressed' : state;
}

interface Props { items: WorkingListItem[]; total?: number; }

export function WorkingListTable({ items, total }: Props) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [dismissKey, setDismissKey] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [showSuppressed, setShowSuppressed] = useState(false);

  async function transition(key: string, body: { state: 'open' | 'snoozed' | 'dismissed'; snooze_until?: string; dismiss_reason?: string }) {
    setBusyKey(key);
    setTransitionError(null);
    try {
      const res = await fetch(`/api/account/sonar/compliance/working-list/items/${encodeURIComponent(key)}/state`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setTransitionError(text || `Transition failed: ${res.status}`);
        return;
      }
      setDismissKey(null);
      setDismissReason('');
      router.refresh();
    } catch (e) {
      setTransitionError(e instanceof Error ? e.message : 'Transition failed');
    } finally {
      setBusyKey(null);
    }
  }

  function renderItem(it: WorkingListItem) {
    return (
      <div key={it.canonical_key} className="relative flex items-start justify-between gap-4 px-4 py-3">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill category="working_list_category" value={it.category}>{it.category}</Pill>
            {it.state !== 'open' && <span className="text-xs uppercase tracking-wider text-slate">{stateLabel(it.state)}</span>}
          </div>
          <p className="text-sm font-medium text-navy">{it.subject}</p>
          <p className="text-xs text-slate/80">{it.reason}</p>
          <p className="text-xs text-slate/70">{new Date(it.item_event_time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
          {it.state === 'dismissed' && (
            <p className="text-xs text-slate/70">
              Suppressed by {it.dismissed_by_user ?? 'unknown'}
              {it.dismiss_reason ? <> &mdash; {it.dismiss_reason}</> : null}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={it.action_href} className="rounded-md border border-slate/30 px-3 py-1.5 text-xs text-slate hover:border-teal hover:text-navy">Open</Link>
          {it.state !== 'open' ? (
            <button type="button" disabled={busyKey === it.canonical_key} onClick={() => transition(it.canonical_key, { state: 'open' })} className="rounded-md border border-slate/30 px-3 py-1.5 text-xs text-slate hover:border-teal">Reopen</button>
          ) : (
            <>
              <button type="button" disabled={busyKey === it.canonical_key} onClick={() => transition(it.canonical_key, { state: 'snoozed', snooze_until: new Date(Date.now() + 7 * 86400000).toISOString() })} className="rounded-md border border-slate/30 px-3 py-1.5 text-xs text-slate hover:border-teal">Snooze 7d</button>
              <button
                type="button"
                aria-expanded={dismissKey === it.canonical_key}
                onClick={() => setDismissKey(dismissKey === it.canonical_key ? null : it.canonical_key)}
                className="rounded-md border border-slate/30 px-3 py-1.5 text-xs text-slate hover:border-teal"
              >Acknowledge &amp; suppress</button>
            </>
          )}
        </div>
        {dismissKey === it.canonical_key && (
          <div
            role="group"
            aria-label="Acknowledge and suppress"
            className="absolute right-8 top-14 z-10 flex flex-col gap-2 rounded-md border border-slate/30 bg-white p-3 shadow"
            onKeyDown={(e) => { if (e.key === 'Escape') setDismissKey(null); }}
          >
            <input type="text" placeholder="Dismiss reason" value={dismissReason} onChange={(e) => setDismissReason(e.target.value)} className="w-56 rounded-md border border-slate/30 px-2 py-1 text-xs" />
            <button type="button" disabled={!dismissReason || busyKey === it.canonical_key} onClick={() => transition(it.canonical_key, { state: 'dismissed', dismiss_reason: dismissReason })} className="rounded-md bg-teal px-3 py-1.5 text-xs text-white disabled:opacity-50">Suppress</button>
          </div>
        )}
      </div>
    );
  }

  const visibleItems = showSuppressed ? items : items.filter((it) => it.state !== 'dismissed');
  const suppressedCount = items.filter((it) => it.state === 'dismissed').length;

  if (visibleItems.length === 0 && suppressedCount === 0) return (
    <div className="p-12 text-center space-y-2">
      <p className="text-base font-medium text-navy">Nothing on your working list.</p>
      <p className="text-sm text-slate">As gaps, changes, nominations, obligations, or expiries appear, they will surface here.</p>
    </div>
  );

  return (
    <div>
      {transitionError && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-t-lg border-b border-problem/30 bg-problem/5 px-4 py-2 text-sm text-problem">
          <span>{transitionError}</span>
          <button type="button" onClick={() => setTransitionError(null)} aria-label="Dismiss error" className="ml-2 text-problem/70 hover:text-problem">✕</button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        {total !== undefined && (
          <p className="text-xs text-slate">
            {total > items.length ? `${items.length} of ${total} items` : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
          </p>
        )}
        {suppressedCount > 0 && (
          <button
            type="button"
            aria-pressed={showSuppressed}
            onClick={() => setShowSuppressed((v) => !v)}
            className={`rounded-full border px-3 py-1 text-xs ${showSuppressed ? 'border-teal bg-teal/10 text-navy' : 'border-slate/30 text-slate hover:border-slate'}`}
          >
            {showSuppressed ? `Hide suppressed (${suppressedCount})` : `Show suppressed (${suppressedCount})`}
          </button>
        )}
      </div>
      {visibleItems.length === 0 ? (
        <div className="p-12 text-center space-y-2">
          <p className="text-base font-medium text-navy">Nothing on your working list.</p>
          <p className="text-sm text-slate">As gaps, changes, nominations, obligations, or expiries appear, they will surface here.</p>
        </div>
      ) : (
        groupByPartner(visibleItems).map((g) => (
          <details key={g.partnerId ?? '__unassigned__'} open className="group">
            <summary className="cursor-pointer flex items-center justify-between px-4 py-2 bg-slate/5 hover:bg-slate/10">
              <span className="font-medium text-charcoal">{g.partnerName}</span>
              <span className="rounded-full bg-slate/15 px-2 py-0.5 text-xs font-medium text-slate">{g.items.length}</span>
            </summary>
            <div className="divide-y divide-slate/10">
              {g.items.map((it) => renderItem(it))}
            </div>
          </details>
        ))
      )}
    </div>
  );
}
