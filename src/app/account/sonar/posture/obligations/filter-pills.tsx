'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { ResolutionClass } from '@haiwave/protocol';
import type { OnNetworkStatus } from './_lib/types';

const RESOLUTION_OPTIONS: ResolutionClass[] = ['agentic_eligible', 'pending', 'out_of_band'];
const NETWORK_OPTIONS: OnNetworkStatus[] = ['participant', 'invited', 'not_invited'];

// Tooltip copy: definition first, then the filter action. Mirrors PILL_DEFINITIONS
// style in components/pill.tsx but inlined here because these are <button> toggles.
const RESOLUTION_TOOLTIPS: Record<ResolutionClass, string> = {
  agentic_eligible: 'The gap can be resolved agent-to-agent on the HAIWAVE network. Click to filter to agentic-eligible gaps only.',
  pending: 'Resolution path not yet determined. Click to filter to pending gaps only.',
  out_of_band: 'Resolution requires off-network outreach (the counterparty is not a participant). Click to filter to out-of-band gaps only.',
};

const NETWORK_TOOLTIPS: Record<OnNetworkStatus, string> = {
  participant: 'The counterparty is an active HAIWAVE participant. Click to filter to participant counterparties only.',
  invited: 'The counterparty has been invited to join HAIWAVE but has not yet accepted. Click to filter to invited counterparties only.',
  not_invited: 'The counterparty is not a HAIWAVE participant and has not been invited. Click to filter to not-invited counterparties only.',
};

export function FilterPills() {
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

  function setMinRequestCount(value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value && Number.parseInt(value, 10) > 0) {
      sp.set('min_request_count', value);
    } else {
      sp.delete('min_request_count');
    }
    router.push(`${pathname}?${sp}`);
  }

  function isPressed(key: string, value: string) {
    return searchParams.getAll(key).includes(value);
  }

  const minCount = searchParams.get('min_request_count') ?? '';

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="self-center text-xs uppercase tracking-wider text-slate">Resolution:</span>
      {RESOLUTION_OPTIONS.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={isPressed('resolution_class', r)}
          title={RESOLUTION_TOOLTIPS[r]}
          onClick={() => toggleParam('resolution_class', r)}
          className={`rounded-full border px-3 py-1 text-xs ${
            isPressed('resolution_class', r)
              ? 'border-teal bg-teal/10 text-navy'
              : 'border-slate/30 text-slate hover:border-slate'
          }`}
        >
          {r}
        </button>
      ))}

      <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">Network:</span>
      {NETWORK_OPTIONS.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={isPressed('on_network_status', n)}
          title={NETWORK_TOOLTIPS[n]}
          onClick={() => toggleParam('on_network_status', n)}
          className={`rounded-full border px-3 py-1 text-xs ${
            isPressed('on_network_status', n)
              ? 'border-teal bg-teal/10 text-navy'
              : 'border-slate/30 text-slate hover:border-slate'
          }`}
        >
          {n}
        </button>
      ))}

      <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">Min requests:</span>
      <input
        type="number"
        min={1}
        value={minCount}
        onChange={(e) => setMinRequestCount(e.target.value)}
        placeholder="≥1"
        title="Hide gaps with fewer than N pending requests. Helps focus on the busiest gaps."
        className="w-20 rounded-md border border-slate/30 px-2 py-1 text-xs"
      />
    </div>
  );
}
