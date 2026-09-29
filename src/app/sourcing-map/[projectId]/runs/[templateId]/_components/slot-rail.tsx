'use client';
import type { CSSProperties } from 'react';
import type { SmSlotResult } from '@haiwave/protocol';
import { formatDropDate, formatPct, formatQty, heatVar, isUnclassifiedSlot, slotCoverageAt, slotDemandAt, slotTitle, slotWeekFor, sortedVariantEntries } from '@/lib/sourcing-map/map/selectors';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';
import { RAIL_L } from '@/lib/sourcing-map/map/layout';

/** One rail line at the height the layout reserves for it (RAIL_L): the text never wraps, so the height holds. */
function lineBox(height: number, marginTop = 0): CSSProperties {
  return { height, lineHeight: `${height}px`, marginTop };
}

/**
 * Slot rail header (spec §9.3): class, requirement by the as-of drop, products, coverage, size-bound mark.
 * It is `textH` tall, the height the layout reserved (railTextHeight), and the map's links run below it.
 */
export function SlotRail({ slot, asOfDrop, collapsed, onToggle, productNames, productFilter, textH }: {
  slot: SmSlotResult; asOfDrop: string | null; collapsed: boolean; onToggle(): void; productNames: Record<string, string>; productFilter: string | null; textH: number;
}) {
  const week = slotWeekFor(slot, asOfDrop);
  const demand = slotDemandAt(slot, week);
  const cov = slotCoverageAt(slot, week);
  const used = slot.product_ids.map((id) => productNames[id] ?? id);
  const title = slotTitle(slot);
  const requirement = week ? `${formatQty(demand)} ${slot.slot_key.uom} by ${formatDropDate(week)}` : 'No demand by this drop';
  const products = productFilter && slot.product_ids.includes(productFilter)
    ? (() => {
        const i = slot.demand.findIndex((d) => d.week === week);
        const mine = i < 0 ? 0 : slot.product_demand.find((pd) => pd.product_id === productFilter)?.cum_qty[i] ?? 0;
        return `${productNames[productFilter] ?? productFilter}: ${formatQty(mine)} of ${formatQty(demand)} ${slot.slot_key.uom} (${formatPct(demand === 0 ? 0 : mine / demand)})`;
      })()
    : `Used by ${used.length} product${used.length === 1 ? '' : 's'}: ${used.join(', ')}`;
  const coverage = cov ? `Covered ${formatPct(cov.coverage)} by this drop${slot.observed ? '' : ' · not fully observed'}` : null;
  const sizeBound = slot.slot_key.variant_system ? `Size-bound · ${slot.slot_key.variant_system}` : 'Size-bound';
  return (
    <div className="text-sm" style={{ height: textH, overflow: 'hidden' }}>
      <button type="button" aria-expanded={!collapsed} onClick={onToggle} className="group flex max-w-full items-center gap-2 font-semibold" style={lineBox(RAIL_L.line)}>
        <DetailChevron expanded={!collapsed} />
        <span className="truncate" title={title}>{title}</span>
      </button>
      <p className="truncate" title={requirement} style={lineBox(RAIL_L.line, RAIL_L.lineGap)}>{requirement}</p>
      <p className="sm-muted truncate" title={products} style={lineBox(RAIL_L.line)}>{products}</p>
      {slot.no_publisher && !isUnclassifiedSlot(slot) ? (
        <p className="sm-warn truncate" title="No trading partner publishes this class" style={lineBox(RAIL_L.line)}>No trading partner publishes this class</p>
      ) : coverage ? (
        <p className="truncate" title={coverage} style={lineBox(RAIL_L.line)}>{coverage}</p>
      ) : null}
      {slot.slot_key.variant_bound && (
        <p className="sm-muted truncate text-xs" title={sizeBound} style={lineBox(RAIL_L.small)}>{sizeBound}</p>
      )}
      {slot.slot_key.variant_bound && cov?.coverage_by_variant && (
        <ol aria-label="Coverage by size" className="flex flex-wrap" style={{ marginTop: RAIL_L.lineGap, gap: RAIL_L.cellGap }}>
          {sortedVariantEntries(cov.coverage_by_variant).map(([v, r]) => (
            <li key={v}>
              <span
                role="img"
                aria-label={`Size ${v}: ${formatPct(r)} covered`}
                className="box-border block truncate px-1 text-[10px]"
                style={{ width: RAIL_L.cellW, height: RAIL_L.cellH, lineHeight: `${RAIL_L.cellH - 2}px`, borderBottom: `2px solid ${heatVar(r)}` }}
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
