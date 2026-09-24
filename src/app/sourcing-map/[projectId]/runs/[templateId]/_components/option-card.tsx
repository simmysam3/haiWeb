'use client';
import type { SmCandidateResult, SmSlotResult } from '@/lib/sourcing-map/contract';
import type { SmPortfolioDrop } from '@/lib/sourcing-map/types';
import { availabilityText, candidateWeekAt, gapText, heatOf, limitText, slotDemandAt, slotWeekFor } from '@/lib/sourcing-map/map/selectors';
import { Pill } from '@/components/pill';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';
import { DropPips } from './drop-pips';

const TONE = { good: 'success', mid: 'warn', bad: 'problem' } as const;
const AVAILABILITY_DEFINITION = "The supplier's answer at this drop, never more than you asked (D-148).";

/**
 * Option card (spec §9.3): the selected drop plus a row of drop pips. It is a
 * `div role="button"`, as in the prototype, because a <button> may not contain the pips' list (D20).
 * A gap (no answer) is dashed and says so, never zero or full coverage (AC 15).
 * The dash is also inline: `.sm-card`'s unlayered `border` shorthand outranks the layered `border-dashed` utility.
 */
export function OptionCard({ slot, candidate: c, asOfDrop, drops, selected, onSelect }: {
  slot: SmSlotResult; candidate: SmCandidateResult; asOfDrop: string | null; drops: SmPortfolioDrop[]; selected: boolean; onSelect(): void;
}) {
  const week = slotWeekFor(slot, asOfDrop);
  const demand = slotDemandAt(slot, week);
  const gap = gapText(c.status);
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
      aria-label={gap ? `${name}: ${gap}` : `${name}: ${availability}; ${limit}`}
      className={`sm-card group flex h-full w-full cursor-pointer flex-col p-3 text-left text-xs ${gap ? 'border-dashed' : ''}`}
      style={gap ? { borderColor: 'var(--sm-gap-border)', borderStyle: 'dashed' } : selected ? { borderColor: 'var(--sm-teal)' } : undefined}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold" title={c.supplier_name}>{c.supplier_name}</span>
        <span className="sm-muted">{c.supplier_country ?? ''}</span>
      </span>
      <span className="sm-muted mt-1 truncate" title={c.class_path.join(' › ')}>{c.class_path.slice(-2).join(' › ')}</span>
      <span className="mt-2">
        {gap ? (
          <Pill themed category="sm_candidate_status" value={c.status}>{gap}</Pill>
        ) : (
          <Pill themed tone={w ? TONE[heatOf(w.option_coverage)] : 'neutral'} definition={AVAILABILITY_DEFINITION}>{availability}</Pill>
        )}
      </span>
      {!gap && <span className="mt-2">{limit}</span>}
      {!gap && (
        <span className="mt-1 flex flex-wrap items-center gap-2">
          {c.own_lead_time_days !== null && <span>{`${c.own_lead_time_days} d lead`}</span>}
          {c.utilization_band && <Pill themed category="sm_utilization" value={c.utilization_band} />}
        </span>
      )}
      <span className="mt-1">{c.allocation_share_pct > 0 ? `Allocated ${c.allocation_share_pct}%` : 'Not allocated'}</span>
      {c.answered_at_allocation && (
        <span className="sm-warn mt-1">Answered at its allocation · spare capacity unknown</span>
      )}
      <DropPips slot={slot} candidate={c} drops={drops} asOfDrop={asOfDrop} />
      <span className="mt-auto flex justify-end pt-2"><DetailChevron /></span>
    </div>
  );
}
