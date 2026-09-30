'use client';
import type { SourcingMapExecutionResult2 } from '@/lib/sourcing-map/types';
import { EM_DASH, candidateNamesOf } from '@/lib/sourcing-map/map/selectors';

/**
 * Shared exposure (spec §9.3, §14.1): every sub-tier alias whose participant sits under two or more options, once,
 * by alias and tier, with the tier-1 options it supplies. Read-only. Nothing for an SP1 result (no shared_exposure).
 */
export function SharedExposure({ result }: { result: SourcingMapExecutionResult2 }) {
  const entries = result.shared_exposure ?? [];
  if (entries.length === 0) return null;
  const names = candidateNamesOf(result);
  return (
    <section aria-label="Shared exposure" className="px-6 pt-3">
      <h3 className="sm-muted text-xs">Shared exposure</h3>
      <ul className="mt-1 flex flex-wrap gap-2">
        {entries.map((e) => (
          <li key={e.alias} className="text-xs">
            {`${e.alias} · tier ${e.tier} ${EM_DASH} ${e.under.map((k) => names[k]).filter((n): n is string => Boolean(n)).join(', ')}`}
          </li>
        ))}
      </ul>
    </section>
  );
}
