'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { EmittedChangeKind } from '@haiwave/protocol';

// Turbopack + file: symlink: inline mirror of EMITTED_CHANGE_KINDS from @haiwave/protocol.
// Source of truth: packages/protocol/src/audit/compliance-changes.ts — EMITTED_CHANGE_KINDS (v1.34 §5.3).
// Turbopack cannot value-import the CJS @haiwave/protocol package through the file: symlink on Windows;
// a direct import will fail at runtime. Keep this list verbatim in sync with EMITTED_CHANGE_KINDS in
// the protocol package. Do NOT replace with a direct import.
const EMITTED_CHANGE_KINDS: readonly EmittedChangeKind[] = [
  'gap_added',
  'gap_resolved',
  'origin_shifted_country',
  'origin_shifted_plant',
  'vendor_substituted',
  'lead_time_degraded',
  'lead_time_improved',
  'certification_expired_or_revoked',
  'certification_renewed',
  'depth_reduced',
  'depth_increased',
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
    router.push(`${pathname}?${sp}`);
  }

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (value) {
      sp.set(key, value);
    } else {
      sp.delete(key);
    }
    router.push(`${pathname}?${sp}`);
  }

  function isKindActive(kind: string) {
    return searchParams.getAll('kind').includes(kind);
  }

  const partner = searchParams.get('partner') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="self-center text-xs uppercase tracking-wider text-slate">Kind:</span>
      {EMITTED_CHANGE_KINDS.map((kind) => (
        <button
          key={kind}
          type="button"
          aria-pressed={isKindActive(kind)}
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
        className="w-32 rounded-md border border-slate/30 px-2 py-1 text-xs"
      />

      <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">From:</span>
      <input
        type="date"
        value={from}
        onChange={(e) => setParam('from', e.target.value)}
        className="rounded-md border border-slate/30 px-2 py-1 text-xs"
      />

      <span className="self-center pl-2 text-xs uppercase tracking-wider text-slate">To:</span>
      <input
        type="date"
        value={to}
        onChange={(e) => setParam('to', e.target.value)}
        className="rounded-md border border-slate/30 px-2 py-1 text-xs"
      />
    </div>
  );
}
