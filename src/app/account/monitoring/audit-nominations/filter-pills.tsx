'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { SkuObligationStatus } from '@haiwave/protocol';

const STATUS_OPTIONS: SkuObligationStatus[] = [
  'outstanding',
  'acknowledged',
  'partially_resolved',
  'fully_resolved',
  'declined',
  'blocked_non_participant',
];

interface ObserverOption {
  id: string;
  name: string;
}

export function FilterPills({ observers }: { observers: ObserverOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggleParam(key: string, value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    const existing = sp.getAll(key);
    sp.delete(key);
    if (existing.includes(value)) {
      for (const v of existing) if (v !== value) sp.append(key, v);
    } else {
      for (const v of existing) sp.append(key, v);
      sp.append(key, value);
    }
    router.push(`${pathname}?${sp}`);
  }

  function isPressed(key: string, value: string) {
    return searchParams.getAll(key).includes(value);
  }

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      <span className="self-center text-xs uppercase tracking-wider text-slate">Status:</span>
      {STATUS_OPTIONS.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={isPressed('status', s)}
          onClick={() => toggleParam('status', s)}
          className={`rounded-full border px-3 py-1 text-xs ${
            isPressed('status', s)
              ? 'border-teal bg-teal/10 text-navy'
              : 'border-slate/30 text-slate hover:border-slate'
          }`}
        >
          {s}
        </button>
      ))}

      {observers.length > 0 && (
        <>
          <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">Observer:</span>
          {observers.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={isPressed('observer_id', o.id)}
              onClick={() => toggleParam('observer_id', o.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                isPressed('observer_id', o.id)
                  ? 'border-teal bg-teal/10 text-navy'
                  : 'border-slate/30 text-slate hover:border-slate'
              }`}
            >
              {o.name}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
