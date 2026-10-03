'use client';
import type { SmCandidateResult2 as SmCandidateResult, SmPortfolioDrop, SmSlotResult2 as SmSlotResult } from '@/lib/sourcing-map/types';
import { availabilityReason, availabilityText, candidateKeyOf, candidateWeekAt, cardSummaryText, gapText, heatOf, limitReason, slotDemandAt, slotWeekFor, traceable, unobservedTier, utilizationText } from '@/lib/sourcing-map/map/selectors';
import { Pill } from '@/components/pill';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';
import { DropPips } from './drop-pips';
import { TierRows } from './tier-rows';

const TONE = { good: 'success', mid: 'warn', bad: 'problem' } as const;
/** The utilization bar's segments, in band order, with the tones `pill.tsx`'s `sm_utilization` map gives the same bands (AR-6). */
const UTIL_BANDS = [['low', 'success'], ['moderate', 'info'], ['high', 'warn'], ['at_capacity', 'problem']] as const;
// The D-148 disclosure ceiling, in the user's words; the internal register id stays out of the copy (L296).
/** Contract §9: the card's and the handle panel's copy for a seat that answers for itself only. */
export const NOT_TRACED_NOTE = 'not traced below (answers for itself only)';
const AVAILABILITY_DEFINITION = "The supplier's answer at this drop, never more than you asked.";
/** A click that lands on one of these inside the card belongs to it: the button, or a Pill's definition tip. */
const OWN_CONTROL = 'a, button, input, select, textarea, [tabindex]';

/**
 * Option card (spec §9.3): the selected drop plus a row of drop pips. A <button> may not contain the pips'
 * list (D20), and a role="button" would make everything in it presentational, so the card is an <article>
 * whose header is the selecting <button>; the rest is ordinary readable content (controller ruling F-a).
 * A gap (no answer) is dashed and says so, never zero or full coverage (AC 15).
 * The dash is also inline: `.sm-card`'s unlayered `border` shorthand outranks the layered `border-dashed` utility.
 * A selected card has a 2px border as well as its colour; focus is a separate outline on the button.
 */
export function OptionCard({
  slot, candidate: c, asOfDrop, drops, selected, onSelect,
  traced = false, selectedAlias = null, onSelectAlias = () => undefined, hoveredAlias = null, onHoverAlias = () => undefined,
}: {
  slot: SmSlotResult; candidate: SmCandidateResult; asOfDrop: string | null; drops: SmPortfolioDrop[]; selected: boolean; onSelect(): void;
  /** SP2 (spec §12.1, §12.3): the tier rows' state, owned by the map; every SP1 call site can omit them */
  traced?: boolean; selectedAlias?: string | null; onSelectAlias?(alias: string | null, origin: string): void; hoveredAlias?: string | null; onHoverAlias?(alias: string | null): void;
}) {
  const week = slotWeekFor(slot, asOfDrop);
  const demand = slotDemandAt(slot, week);
  const gap = gapText(c.status);
  const w = candidateWeekAt(c, week);
  const availability = availabilityText(c, week, demand, slot.slot_key.uom);
  const limit = limitReason(c);
  const unobserved = unobservedTier(c);
  // Not traversing (SP3, G-5) outranks the unobserved note: the two never show together.
  const note = c.not_traced_below === true ? NOT_TRACED_NOTE : unobserved !== null ? `not fully observed below tier ${unobserved}` : null;
  const summary = cardSummaryText(c);
  const util = summary !== null && c.aggregates != null ? c.aggregates.utilization : null;
  const segments = util === null ? [] : UTIL_BANDS.filter(([k]) => util[k] > 0);
  const name = `${c.supplier_name}${c.supplier_country ? `, ${c.supplier_country}` : ''}`;
  return (
    <article
      // A mouse click anywhere else on the card also selects; the button handles its own clicks and keys.
      onClick={(e) => {
        const hit = e.target instanceof Element ? e.target.closest(OWN_CONTROL) : null;
        if (hit && e.currentTarget.contains(hit)) return;
        onSelect();
      }}
      className={`sm-card group flex h-full w-full cursor-pointer flex-col p-3 text-left text-xs ${gap ? 'border-dashed' : ''}`}
      style={{
        ...(gap ? { borderColor: 'var(--sm-gap-border)', borderStyle: 'dashed' } : selected ? { borderColor: 'var(--sm-teal)' } : {}),
        // Selection is never shown by hue alone (ruling F-b); a gap card that is selected gets the same width.
        ...(selected ? { borderWidth: '2px' } : {}),
      }}
    >
      <button
        type="button"
        data-anchor={candidateKeyOf(c)}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={gap ? `${name}: ${gap}` : `${name}: ${availability}; ${limit}${note !== null ? `; ${note}` : ''}`}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="truncate text-sm font-semibold" title={c.supplier_name}>{c.supplier_name}</span>
        <span className="sm-muted">{c.supplier_country ?? ''}</span>
      </button>
      <span className="sm-muted mt-1 truncate" title={c.class_path.join(' › ')}>{c.class_path.slice(-2).join(' › ')}</span>
      <span className="mt-2">
        {gap ? (
          <Pill themed category="sm_candidate_status" value={c.status}>{gap}</Pill>
        ) : (
          <Pill themed tone={w ? TONE[heatOf(w.option_coverage)] : 'neutral'} definition={[AVAILABILITY_DEFINITION, availabilityReason(c, week, demand)].filter(Boolean).join(' ')}>{availability}</Pill>
        )}
      </span>
      {!gap && <span className="mt-2">{limit}</span>}
      {!gap && note !== null && <span className="sm-warn mt-1">{note}</span>}
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
      <TierRows candidate={c} traced={traced} selectedAlias={selectedAlias} onSelectAlias={onSelectAlias} hoveredAlias={hoveredAlias} onHoverAlias={onHoverAlias} />
      <span className="mt-auto flex flex-col pt-2">
        {summary !== null && <span className="truncate" title={summary}>{summary}</span>}
        <span className={`flex items-center gap-2 ${summary !== null ? 'mt-1' : ''}`}>
          {util !== null && segments.length > 0 && (
            <span role="img" aria-label={`Utilization below tier 1: ${utilizationText(util)}`} className="flex h-1.5 w-16 overflow-hidden rounded-full">
              {segments.map(([k, tone]) => (
                <span key={k} data-util={k} style={{ flexGrow: util[k], background: `var(--sm-pill-${tone}-fg)` }} />
              ))}
            </span>
          )}
          {traceable(c) && !selected && <span className="sm-muted">Select to trace</span>}
          <span className="ml-auto flex"><DetailChevron /></span>
        </span>
      </span>
    </article>
  );
}
