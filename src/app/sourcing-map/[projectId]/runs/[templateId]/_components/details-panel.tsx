'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import type { SmBand, SmCandidateResult2 as SmCandidateResult, SmPortfolioDrop, SmSlotResult2 as SmSlotResult, SourcingMapExecutionResult2 } from '@/lib/sourcing-map/types';
import { EM_DASH, bandVar, bandWord, bindingRows, candidateNamesOf, candidateWeekAt, formatDropDate, formatPct, formatQty, hasPath, NOTHING_BENEATH, noCoverageText, pathSummary, slotDemandAt, slotTitle, sharedBindingText, slotWeekFor, sortedVariantEntries, traceSentence, traceable, utilizationText } from '@/lib/sourcing-map/map/selectors';
import { Pill } from '@/components/pill';
import { SmButton } from '@/app/sourcing-map/_components/sm-button';
import { OptionPanel } from './option-panel';
import { PathBeneath } from './path-beneath';

const TRACE_BANDS: SmBand[] = ['slight', 'moderate', 'severe'];

type Tab = 'details' | 'path';
/** The selected tab shows without hue alone (WCAG 1.4.1): a border and a weight, the Configure tray's literal pair. */
const TAB_SELECTED = 'border-b-2 border-[var(--sm-teal)] px-3 py-2 text-sm font-medium';
/** An unavailable tab (w3) dims as `.sm-btn[aria-disabled="true"]` does, by the attribute (sourcing-map.css:19). */
const TAB = 'sm-muted px-3 py-2 text-sm aria-disabled:opacity-55';

/**
 * Card details (spec §9.3). Price terms arrive with SP4.
 * Focus moves to the heading when the panel opens (controller ruling R1); returning it on close is the workspace's job.
 * Escape is the workspace's: its one page-wide listener closes one layer per press (LF spec §6.5).
 * SP2 (spec §12.4): the path summary and the sub-tier aggregates. SP3 (spec §12.3): the option panel.
 * A sticky column in the workspace's page flow, below the header (Task 39 P2): a fixed overlay covered the header's controls.
 */
export function DetailsPanel({ ref, executionId, result, slot, candidate: c, drops, asOfDrop, productNames, onClose, hidden = false, unavailable = null, onOpenRow, pin }: {
  /** LF (spec §7): the workspace finds a Path beneath row in this panel, to return focus to it */
  ref?: Ref<HTMLElement>;
  executionId: string; result: SourcingMapExecutionResult2; slot: SmSlotResult; candidate: SmCandidateResult; drops: SmPortfolioDrop[]; asOfDrop: string | null;
  productNames: Record<string, string>; onClose(): void;
  /** SP2 (spec §12.4, P2): hidden, not unmounted, while a handle panel holds the column, so it never remounts and refocuses */
  hidden?: boolean;
  /** LF (spec §9.5): why Path beneath is unavailable for every card (a running execution), or null */
  unavailable?: string | null;
  /** LF (spec §7): a Path beneath row was pressed; the workspace opens that alias's handle panel on this card */
  onOpenRow?(alias: string): void;
  /** LF (spec §6.2, §9.5): Pin / Unpin; the workspace owns the pin, and says why it is unavailable, or null */
  pin?: { pinned: boolean; onToggle(): void; reason: string | null };
}) {
  const asOfWeek = slotWeekFor(slot, asOfDrop);
  const demandWeek = slot.demand.find((d) => d.week === asOfWeek);
  const answerWeek = candidateWeekAt(c, asOfWeek);
  const summary = pathSummary(c);
  const shared = sharedBindingText(result, c);
  const rows = bindingRows(c);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  // LF (spec §6.2, w3): an unavailable Pin stays focusable and ignores a press (SmButton), and is described by its reason,
  // a line of its own under the header
  const pinReasonId = useId();
  // LF (spec §7): two tabs over two panels, both always mounted and the unselected one hidden, so a switch never remounts
  // the option panel (it would refetch). The tab is this panel's state, and the workspace keys the panel by the pick, so
  // a new pick opens on Details. With two tabs either arrow moves to the other (APG); the press is taken with
  // preventDefault, never stopPropagation, and Escape is left to the page's listener.
  const detailsTabId = useId();
  const pathTabId = useId();
  const [tab, setTab] = useState<Tab>('details');
  const detailsTabRef = useRef<HTMLButtonElement>(null);
  const pathTabRef = useRef<HTMLButtonElement>(null);
  const reason = unavailable ?? (hasPath(c) ? null : NOTHING_BENEATH);
  const reasonId = useId();
  // w3: an unavailable tab takes focus and is described, and is never selected
  function choose(next: Tab) {
    if (next === 'path' && reason !== null) return;
    setTab(next);
  }
  function onArrow(e: KeyboardEvent, next: Tab) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    (next === 'details' ? detailsTabRef : pathTabRef).current?.focus();
    choose(next);
  }
  return (
    <aside ref={ref} hidden={hidden} aria-label={`Details for ${c.supplier_name}`} className="sm-surface sticky top-0 z-30 max-h-screen w-full max-w-xl shrink-0 self-start overflow-y-auto border-l border-[var(--sm-line)] p-6 text-sm">
      <div className="flex items-center justify-between">
        <h2 ref={headingRef} tabIndex={-1} className="sm-heading text-lg font-semibold">{c.supplier_name}{c.supplier_country ? ` · ${c.supplier_country}` : ''}</h2>
        <div className="flex items-center gap-2">
          {pin && (
            <SmButton aria-disabled={pin.reason !== null} aria-describedby={pin.reason !== null ? pinReasonId : undefined} className="sm-btn sm-btn-ghost text-xs" onClick={pin.onToggle}>
              {pin.pinned ? 'Unpin' : 'Pin'}
            </SmButton>
          )}
          <button type="button" aria-label="Close details" className="sm-btn sm-btn-ghost text-xs" onClick={onClose}>Close</button>
        </div>
      </div>
      {pin && pin.reason !== null && <p id={pinReasonId} className="sm-muted mt-1 text-xs">{pin.reason}</p>}
      <div role="tablist" aria-label="Option details" className="mt-4 flex gap-2 border-b border-[var(--sm-line)]">
        <button ref={detailsTabRef} role="tab" type="button" id={detailsTabId} aria-selected={tab === 'details'} onClick={() => setTab('details')} onKeyDown={(e) => onArrow(e, 'path')} className={tab === 'details' ? TAB_SELECTED : TAB}>Details</button>
        <button ref={pathTabRef} role="tab" type="button" id={pathTabId} aria-selected={tab === 'path'} aria-disabled={reason !== null || undefined} aria-describedby={reason !== null ? reasonId : undefined} onClick={() => choose('path')} onKeyDown={(e) => onArrow(e, 'details')} className={tab === 'path' ? TAB_SELECTED : TAB}>Path beneath</button>
      </div>
      {reason !== null && <p id={reasonId} className="sm-muted mt-1 text-xs">{reason}</p>}
      <div role="tabpanel" aria-labelledby={detailsTabId} hidden={tab !== 'details'}>
        <p className="sm-muted">{`${slotTitle(slot)} · ${c.supplier_sku}`}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2">
          <dt className="sm-muted">Lead time</dt><dd>{c.own_lead_time_days !== null ? `${c.own_lead_time_days} d` : '—'}</dd>
          <dt className="sm-muted">Utilization</dt><dd>{c.utilization_band ? <Pill themed category="sm_utilization" value={c.utilization_band} /> : '—'}</dd>
          <dt className="sm-muted">Allocation</dt><dd>{c.allocation_share_pct > 0 ? `Allocated ${c.allocation_share_pct}%` : 'Not allocated'}</dd>
          <dt className="sm-muted">Products using this slot</dt><dd>{slot.product_ids.map((id) => productNames[id] ?? id).join(', ')}</dd>
        </dl>
        {summary !== null && (
          <section aria-label="Below tier 1" className="mt-4">
            <h3 className="sm-muted text-xs">Below tier 1</h3>
            <p className="mt-1">{summary}</p>
            {c.trace && traceable(c) && <p className="mt-1">{`Shortfall trace: ${traceSentence(c.trace, candidateNamesOf(result))}`}</p>}
            {c.trace && c.trace.edges.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="sm-muted">Trace lines:</span>
                <ul aria-label="Trace line bands" className="flex gap-3">
                  {TRACE_BANDS.map((band) => (
                    <li key={band} className="flex items-center gap-1"><span aria-hidden="true" className="inline-block h-0.5 w-4" style={{ background: bandVar(band) }} />{bandWord(band)}</li>
                  ))}
                </ul>
              </div>
            )}
            {rows.length > 0 && (
              <table aria-label="Binding sources" className="sm-table mt-2">
                <thead><tr><th>Binding source</th><th>Tier</th><th>Band</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.alias}>
                      <td>
                        {`${r.alias} · ${r.classLabel ?? EM_DASH} · ${r.country ?? EM_DASH}`}
                        {r.binds_for > 1 && <div className="sm-warn text-xs">{`Binding for ${r.binds_for} options`}</div>}
                      </td>
                      <td>{r.tier}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span role="img" aria-label={bandWord(r.band)} title={bandWord(r.band)} className="inline-block h-2 w-2 rounded-full" style={{ background: bandVar(r.band) }} />
                          <span>{bandWord(r.band)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {shared !== null && <p className="sm-warn mt-2">{shared}</p>}
            {c.aggregates && (
              <dl aria-label="Sub-tier aggregates" className="mt-2 grid grid-cols-2 gap-2">
                <dt className="sm-muted">Responders</dt><dd>{c.aggregates.responders}</dd>
                <dt className="sm-muted">Median lead time</dt><dd>{c.aggregates.median_lead_time_days !== null ? `${c.aggregates.median_lead_time_days} d` : EM_DASH}</dd>
                <dt className="sm-muted">Utilization</dt>
                <dd>{utilizationText(c.aggregates.utilization)}</dd>
                <dt className="sm-muted">Countries</dt><dd>{c.aggregates.countries.length > 0 ? c.aggregates.countries.join(', ') : EM_DASH}</dd>
                <dt className="sm-muted">Classes</dt><dd>{c.aggregates.classes.length > 0 ? c.aggregates.classes.join(', ') : EM_DASH}</dd>
                <dt className="sm-muted">Not observed</dt><dd>{c.aggregates.not_observed}</dd>
              </dl>
            )}
            <p className="sm-muted mt-2 text-xs">Sources below tier 1 were not searched for alternatives.</p>
          </section>
        )}
        <table aria-label="Coverage by drop" className="sm-table mt-6">
          <thead><tr><th>Drop</th><th>Need week</th><th>Required</th><th>Stated</th><th>Coverage</th></tr></thead>
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
                  <td>{w ? formatPct(w.option_coverage) : noCoverageText(c, week)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {slot.slot_key.variant_bound && asOfWeek && demandWeek?.cum_qty_by_variant && (
          <table aria-label={`Coverage by size at ${formatDropDate(asOfWeek)}`} className="sm-table mt-6">
            <thead><tr><th>Size</th><th>Required</th><th>Stated</th><th>Coverage</th></tr></thead>
            <tbody>
              {sortedVariantEntries(demandWeek.cum_qty_by_variant).map(([v, need]) => {
                const got = answerWeek?.cum_achievable_by_variant?.[v];
                return (
                  <tr key={v} aria-label={v}>
                    <td>{v}</td>
                    <td>{formatQty(need)}</td>
                    <td>{got !== undefined ? formatQty(got) : '—'}</td>
                    <td>{got !== undefined ? formatPct(need === 0 ? 1 : got / need) : noCoverageText(c, asOfWeek)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {/* An SP1 candidate has no candidate_key: its participant id is not an option key, so the panel never asks for it. */}
        <OptionPanel executionId={executionId} candidateKey={c.candidate_key ?? null} />
        <p className="sm-muted mt-6 text-xs">Price terms arrive in a later release.</p>
      </div>
      <div role="tabpanel" aria-labelledby={pathTabId} hidden={tab !== 'path'}>
        <PathBeneath result={result} candidate={c} onOpenRow={(alias) => onOpenRow?.(alias)} />
      </div>
    </aside>
  );
}
