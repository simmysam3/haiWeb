'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pill } from '@/components/pill';
import type { BacklogItem, BacklogItemState } from '@haiwave/protocol';
import { BACKLOG_ITEM_TRANSITIONS } from '@haiwave/protocol';

type BacklogListProps = {
  items: BacklogItem[];
};

function formatAmount(amount: number, unit: string): string {
  return `${amount.toLocaleString()} ${unit}`;
}

export function BacklogList({ items }: BacklogListProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function handleTransition(id: string, toState: BacklogItemState) {
    setLoading((prev) => ({ ...prev, [id]: true }));
    setErrors((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(
        `/api/account/readiness/backlog/${id}/transition`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to_state: toState }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { code?: string } };
        setErrors((prev) => ({
          ...prev,
          [id]: body.error?.code ?? `HTTP ${res.status}`,
        }));
        return;
      }
      router.refresh();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : 'Unknown error',
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-slate/20 bg-slate/5 px-4 py-8 text-center text-sm text-slate">
        No backlog items.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate/20 bg-white overflow-hidden divide-y divide-slate/10">
      {items.map((item) => {
        const { event } = item;
        const nextStates = BACKLOG_ITEM_TRANSITIONS[item.state] ?? [];
        const err = errors[item.backlog_item_id];
        const busy = loading[item.backlog_item_id] ?? false;

        return (
          <div key={item.backlog_item_id} className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-charcoal truncate">
                  {event.component} — {event.color_code}
                </span>
                <Pill category="readiness" value={event.event_type} />
                <Pill category="severity" value={event.severity} />
              </div>
              <span className="text-xs text-slate shrink-0 capitalize">
                {item.state.replace('_', ' ')}
              </span>
            </div>

            {(event.observed !== null || event.needed !== null) && (
              <div className="flex items-center gap-6 text-xs text-slate">
                {event.observed !== null && (
                  <span>
                    <span className="font-medium text-charcoal">Observed:</span>{' '}
                    {formatAmount(event.observed.amount, event.observed.unit)}
                  </span>
                )}
                {event.needed !== null && (
                  <span>
                    <span className="font-medium text-charcoal">Needed:</span>{' '}
                    {formatAmount(event.needed.amount, event.needed.unit)}
                  </span>
                )}
              </div>
            )}

            {nextStates.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                {nextStates.map((toState) => (
                  <button
                    key={toState}
                    disabled={busy}
                    onClick={() => handleTransition(item.backlog_item_id, toState)}
                    className="rounded px-3 py-1 text-xs font-medium bg-navy/10 text-navy hover:bg-navy/20 disabled:opacity-50 capitalize transition-colors"
                  >
                    {toState.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}

            {err && (
              <p className="text-xs text-problem">{err}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
