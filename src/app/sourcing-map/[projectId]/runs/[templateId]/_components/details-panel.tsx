'use client';
import { useEffect, useRef } from 'react';
import type { SmCandidateResult, SmSlotResult } from '@/lib/sourcing-map/contract';
import type { SmPortfolioDrop } from '@/lib/sourcing-map/types';
import { candidateWeekAt, formatDropDate, formatPct, formatQty, slotDemandAt, slotTitle, slotWeekFor, sortedVariantEntries } from '@/lib/sourcing-map/map/selectors';
import { Pill } from '@/components/pill';

/**
 * Card details (spec §9.3). Scorecard, delivery history and price terms arrive with SP2 and SP4.
 * Focus moves to the heading when the panel opens (controller ruling R1); returning it on close is the workspace's job.
 */
export function DetailsPanel({ slot, candidate: c, drops, asOfDrop, productNames, onClose }: {
  slot: SmSlotResult; candidate: SmCandidateResult; drops: SmPortfolioDrop[]; asOfDrop: string | null;
  productNames: Record<string, string>; onClose(): void;
}) {
  const asOfWeek = slotWeekFor(slot, asOfDrop);
  const demandWeek = slot.demand.find((d) => d.week === asOfWeek);
  const answerWeek = candidateWeekAt(c, asOfWeek);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <aside aria-label={`Details for ${c.supplier_name}`} className="sm-surface fixed right-0 top-0 z-30 h-full w-full max-w-xl overflow-y-auto border-l border-[var(--sm-line)] p-6 text-sm">
      <div className="flex items-center justify-between">
        <h2 ref={headingRef} tabIndex={-1} className="sm-heading text-lg font-semibold">{c.supplier_name}{c.supplier_country ? ` · ${c.supplier_country}` : ''}</h2>
        <button type="button" aria-label="Close details" className="sm-btn sm-btn-ghost text-xs" onClick={onClose}>Close</button>
      </div>
      <p className="sm-muted">{`${slotTitle(slot)} · ${c.supplier_sku}`}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <dt className="sm-muted">Lead time</dt><dd>{c.own_lead_time_days !== null ? `${c.own_lead_time_days} d` : '—'}</dd>
        <dt className="sm-muted">Utilization</dt><dd>{c.utilization_band ? <Pill themed category="sm_utilization" value={c.utilization_band} /> : '—'}</dd>
        <dt className="sm-muted">Allocation</dt><dd>{c.allocation_share_pct > 0 ? `Allocated ${c.allocation_share_pct}%` : 'Not allocated'}</dd>
        <dt className="sm-muted">Products using this slot</dt><dd>{slot.product_ids.map((id) => productNames[id] ?? id).join(', ')}</dd>
      </dl>
      <table aria-label="Coverage by drop" className="sm-table mt-6">
        <thead><tr><th>Drop</th><th>Need week</th><th>Required</th><th>Can cover</th><th>Coverage</th></tr></thead>
        <tbody>
          {drops.map((d) => {
            const week = slotWeekFor(slot, d.due_date);
            const w = candidateWeekAt(c, week);
            return (
              <tr key={d.due_date} aria-label={formatDropDate(d.due_date)}>
                <td>{formatDropDate(d.due_date)}</td>
                <td>{week ? formatDropDate(week) : '—'}</td>
                <td>{formatQty(slotDemandAt(slot, week))}</td>
                <td>{w ? formatQty(w.cum_achievable) : '—'}</td>
                <td>{w ? formatPct(w.option_coverage) : 'no answer'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {slot.slot_key.variant_bound && asOfWeek && demandWeek?.cum_qty_by_variant && (
        <table aria-label={`Coverage by size at ${formatDropDate(asOfWeek)}`} className="sm-table mt-6">
          <thead><tr><th>Size</th><th>Required</th><th>Can cover</th><th>Coverage</th></tr></thead>
          <tbody>
            {sortedVariantEntries(demandWeek.cum_qty_by_variant).map(([v, need]) => {
              const got = answerWeek?.cum_achievable_by_variant?.[v];
              return (
                <tr key={v} aria-label={v}>
                  <td>{v}</td>
                  <td>{formatQty(need)}</td>
                  <td>{got !== undefined ? formatQty(got) : '—'}</td>
                  <td>{got !== undefined ? formatPct(need === 0 ? 1 : got / need) : 'no answer'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="sm-muted mt-6 text-xs">Scorecard, delivery history and price terms arrive in later releases.</p>
    </aside>
  );
}
