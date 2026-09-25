'use client';
import type { SmSlotResult } from '@/lib/sourcing-map/contract';
import { formatDropDate, formatPct, formatQty, heatVar, isUnclassifiedSlot, slotCoverageAt, slotDemandAt, slotTitle, slotWeekFor, sortedVariantEntries } from '@/lib/sourcing-map/map/selectors';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';

/** Slot rail header (spec §9.3): class, requirement by the as-of drop, products, coverage, size-bound mark. */
export function SlotRail({ slot, asOfDrop, collapsed, onToggle, productNames, productFilter }: {
  slot: SmSlotResult; asOfDrop: string | null; collapsed: boolean; onToggle(): void; productNames: Record<string, string>; productFilter: string | null;
}) {
  const week = slotWeekFor(slot, asOfDrop);
  const demand = slotDemandAt(slot, week);
  const cov = slotCoverageAt(slot, week);
  const used = slot.product_ids.map((id) => productNames[id] ?? id);
  return (
    <div className="text-sm">
      <button type="button" aria-expanded={!collapsed} onClick={onToggle} className="group flex items-center gap-2 font-semibold">
        <DetailChevron expanded={!collapsed} />
        {slotTitle(slot)}
      </button>
      <p className="mt-1">{week ? `${formatQty(demand)} ${slot.slot_key.uom} by ${formatDropDate(week)}` : 'No demand by this drop'}</p>
      <p className="sm-muted">
        {productFilter && slot.product_ids.includes(productFilter)
          ? (() => {
              const i = slot.demand.findIndex((d) => d.week === week);
              const mine = i < 0 ? 0 : slot.product_demand.find((pd) => pd.product_id === productFilter)?.cum_qty[i] ?? 0;
              return `${productNames[productFilter] ?? productFilter}: ${formatQty(mine)} of ${formatQty(demand)} ${slot.slot_key.uom} (${formatPct(demand === 0 ? 0 : mine / demand)})`;
            })()
          : `Used by ${used.length} product${used.length === 1 ? '' : 's'}: ${used.join(', ')}`}
      </p>
      {slot.no_publisher && !isUnclassifiedSlot(slot) ? (
        <p className="sm-warn">No trading partner publishes this class</p>
      ) : cov ? (
        <p>{`Covered ${formatPct(cov.coverage)} by this drop${slot.observed ? '' : ' · not fully observed'}`}</p>
      ) : null}
      {slot.slot_key.variant_bound && (
        <p className="sm-muted text-xs">{slot.slot_key.variant_system ? `Size-bound · ${slot.slot_key.variant_system}` : 'Size-bound'}</p>
      )}
      {slot.slot_key.variant_bound && cov?.coverage_by_variant && (
        <ol aria-label="Coverage by size" className="mt-1 flex flex-wrap gap-1">
          {sortedVariantEntries(cov.coverage_by_variant).map(([v, r]) => (
            <li key={v}>
              <span
                role="img"
                aria-label={`Size ${v}: ${formatPct(r)} covered`}
                className="block px-1 text-[10px]"
                style={{ borderBottom: `2px solid ${heatVar(r)}` }}
              >
                {`${v} ${formatPct(r)}`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
