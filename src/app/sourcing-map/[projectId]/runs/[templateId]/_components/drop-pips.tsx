'use client';
import type { SmCandidateResult, SmSlotResult } from '@haiwave/protocol';
import type { SmPortfolioDrop } from '@/lib/sourcing-map/types';
import { candidateWeekAt, formatDropDate, formatPct, heatVar, slotWeekFor } from '@/lib/sourcing-map/map/selectors';

/** One pip per portfolio drop coloured by option coverage; the as-of pip is outlined (spec §9.3, ruling 13). */
export function DropPips({ slot, candidate, drops, asOfDrop }: {
  slot: SmSlotResult; candidate: SmCandidateResult; drops: SmPortfolioDrop[]; asOfDrop: string | null;
}) {
  return (
    <ol aria-label="Coverage by drop" className="mt-2 flex gap-1">
      {drops.map((d) => {
        const w = candidateWeekAt(candidate, slotWeekFor(slot, d.due_date));
        const isAsOf = d.due_date === asOfDrop;
        const label = `${formatDropDate(d.due_date)}: ${w ? `${formatPct(w.option_coverage)} covered` : 'no answer'}${isAsOf ? ' (shown)' : ''}`;
        return (
          <li key={d.due_date}>
            <span
              role="img"
              aria-label={label}
              title={label}
              className="block h-2 w-4 rounded-sm"
              style={{
                background: w ? heatVar(w.option_coverage) : 'var(--sm-line-2)',
                outline: isAsOf ? '2px solid var(--sm-ink)' : undefined,
                outlineOffset: isAsOf ? '1px' : undefined,
              }}
            />
          </li>
        );
      })}
    </ol>
  );
}
