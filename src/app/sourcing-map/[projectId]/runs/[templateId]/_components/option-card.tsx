'use client';
import type { SmCandidateResult, SmSlotResult } from '@/lib/sourcing-map/contract';
import type { SmPortfolioDrop } from '@/lib/sourcing-map/types';
import { availabilityText, candidateWeekAt, heatOf, limitText, slotDemandAt, slotWeekFor } from '@/lib/sourcing-map/map/selectors';
import { Pill } from '@/components/pill';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';
import { DropPips } from './drop-pips';

const TONE = { good: 'success', mid: 'warn', bad: 'problem' } as const;
const AVAILABILITY_DEFINITION = "The supplier's answer at this drop, never more than you asked (D-148).";

/**
 * Option card (spec §9.3): the selected drop plus a row of drop pips. It is a
 * `div role="button"`, as in the prototype, because a <button> may not contain the pips' list (D20).
 */
export function OptionCard({ slot, candidate: c, asOfDrop, drops, selected, onSelect }: {
  slot: SmSlotResult; candidate: SmCandidateResult; asOfDrop: string | null; drops: SmPortfolioDrop[]; selected: boolean; onSelect(): void;
}) {
  const week = slotWeekFor(slot, asOfDrop);
  const demand = slotDemandAt(slot, week);
  const w = candidateWeekAt(c, week);
  const availability = availabilityText(c, week, demand, slot.slot_key.uom);
  const limit = limitText(c.limit);
  const name = `${c.supplier_name}${c.supplier_country ? `, ${c.supplier_country}` : ''}`;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={selected}
      aria-label={`${name}: ${availability}; ${limit}`}
      className="sm-card group flex h-full w-full cursor-pointer flex-col p-3 text-left text-xs"
      style={selected ? { borderColor: 'var(--sm-teal)' } : undefined}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold" title={c.supplier_name}>{c.supplier_name}</span>
        <span className="sm-muted">{c.supplier_country ?? ''}</span>
      </span>
      <span className="sm-muted mt-1 truncate" title={c.class_path.join(' › ')}>{c.class_path.slice(-2).join(' › ')}</span>
      <span className="mt-2">
        <Pill themed tone={w ? TONE[heatOf(w.option_coverage)] : 'neutral'} definition={AVAILABILITY_DEFINITION}>{availability}</Pill>
      </span>
      <span className="mt-2">{limit}</span>
      <span className="mt-1 flex flex-wrap items-center gap-2">
        {c.own_lead_time_days !== null && <span>{`${c.own_lead_time_days} d lead`}</span>}
        {c.utilization_band && <Pill themed category="sm_utilization" value={c.utilization_band} />}
      </span>
      <span className="mt-1">{`Allocated ${c.allocation_share_pct}%`}</span>
      <DropPips slot={slot} candidate={c} drops={drops} asOfDrop={asOfDrop} />
      <span className="mt-auto flex justify-end pt-2"><DetailChevron /></span>
    </div>
  );
}
