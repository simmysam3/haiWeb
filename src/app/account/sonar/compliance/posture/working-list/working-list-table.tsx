'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { WorkingListItem } from '@haiwave/protocol';
import { Pill } from '@/components/pill';

interface Props { items: WorkingListItem[]; }

export function WorkingListTable({ items }: Props) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [dismissKey, setDismissKey] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState('');

  async function transition(key: string, body: { state: 'open' | 'snoozed' | 'dismissed'; snooze_until?: string; dismiss_reason?: string }) {
    setBusyKey(key);
    try {
      await fetch(`/api/account/sonar/compliance/working-list/items/${key}/state`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      router.refresh();
    } finally { setBusyKey(null); setDismissKey(null); setDismissReason(''); }
  }

  if (items.length === 0) return <p className="p-12 text-center text-slate">Nothing on your working list.</p>;

  return (
    <div className="divide-y divide-slate/10">
      {items.map((it) => (
        <div key={it.canonical_key} className="relative flex items-start justify-between gap-4 px-4 py-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Pill category="working_list_category" value={it.category}>{it.category}</Pill>
              {it.state !== 'open' && <span className="text-xs uppercase tracking-wider text-slate">{it.state}</span>}
            </div>
            <p className="text-sm font-medium text-navy">{it.subject}</p>
            <p className="text-sm text-slate">{it.reason}</p>
            <p className="text-xs text-slate/70">{new Date(it.item_event_time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={it.action_href} className="rounded-md border border-slate/30 px-3 py-1.5 text-xs text-slate hover:border-teal hover:text-navy">Open</Link>
            {it.state !== 'open' ? (
              <button type="button" disabled={busyKey === it.canonical_key} onClick={() => transition(it.canonical_key, { state: 'open' })} className="rounded-md border border-slate/30 px-3 py-1.5 text-xs text-slate hover:border-teal">Reopen</button>
            ) : (
              <>
                <button type="button" disabled={busyKey === it.canonical_key} onClick={() => transition(it.canonical_key, { state: 'snoozed', snooze_until: new Date(Date.now() + 7 * 86400000).toISOString() })} className="rounded-md border border-slate/30 px-3 py-1.5 text-xs text-slate hover:border-teal">Snooze 7d</button>
                <button type="button" onClick={() => setDismissKey(it.canonical_key)} className="rounded-md border border-slate/30 px-3 py-1.5 text-xs text-slate hover:border-teal">Dismiss</button>
              </>
            )}
          </div>
          {dismissKey === it.canonical_key && (
            <div className="absolute right-8 top-14 z-10 flex flex-col gap-2 rounded-md border border-slate/30 bg-white p-3 shadow">
              <input type="text" placeholder="Dismiss reason" value={dismissReason} onChange={(e) => setDismissReason(e.target.value)} className="w-56 rounded-md border border-slate/30 px-2 py-1 text-xs" />
              <button type="button" disabled={!dismissReason || busyKey === it.canonical_key} onClick={() => transition(it.canonical_key, { state: 'dismissed', dismiss_reason: dismissReason })} className="rounded-md bg-teal px-3 py-1.5 text-xs text-white disabled:opacity-50">Confirm</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
