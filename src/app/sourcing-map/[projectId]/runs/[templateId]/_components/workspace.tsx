'use client';
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { SmEstimateResponse, SmProduct } from '@haiwave/protocol';
import type { SmExecutionDetail2 as SmExecutionDetail, SmExecutionSummary2 as SmExecutionSummary } from '@/lib/sourcing-map/types';
import type { SmRunTemplate } from '@/lib/sourcing-map/local-shapes';
import { smFetch } from '@/lib/sourcing-map/client';
import { SM_HOME, smProjectHref } from '@/lib/sourcing-map/routes';
import { readStoredHeat, writeStoredHeat } from '@/lib/sourcing-map/heat-storage';
import { NOTHING_BENEATH, RUN_NOT_COMPLETE, candidateKeyOf, candidateNamesOf, nodeOf, otherTiers, pinnable, resolveAsOfDrop, underOf } from '@/lib/sourcing-map/map/selectors';
import { SmHeader } from '@/app/sourcing-map/_components/sm-header';
import { useExecutionPoll } from './use-execution-poll';
import { ExecutionPicker } from './execution-picker';
import { RunButton } from './run-button';
import { AnswersAsOf, ExecutionBanner } from './execution-state';
import { SeatBar } from './seat-bar';
import { MapCanvas } from './map-canvas';
import { DetailsPanel } from './details-panel';
import { HandlePanel } from './handle-panel';
import { ConfigureTray } from './configure-tray';

export interface WorkspaceProps {
  projectName: string;
  template: SmRunTemplate;
  library: SmProduct[];
  executions: SmExecutionSummary[];
  initialDetail: SmExecutionDetail | null;
  /** R1: a page read that failed, shown as an alert (never a silent fallback) */
  projectError?: string | null;
  /** R1: also disables Configure, since a tray over an empty library could Apply a scope that drops products */
  productsError?: string | null;
  /** R1: the result list failed, so an empty list is unknown, never "No execution yet" */
  executionsError?: string | null;
  /** R1: the newest result failed to load; it opens as the page's error, which a switch of result clears */
  detailError?: string | null;
}

/**
 * "Open map" (spec §12.1): the card ?option= names, only when ?execution= names the loaded execution. The option is
 * `${slot}:${candidate_key}`, answerKey's own form, so it is composed forward and never parsed. A candidate without a
 * `candidate_key` (an SP1 result) is never matched, so a participant id can't select a card.
 */
function seedSelection(execution: string | null, option: string | null, detail: SmExecutionDetail | null): { slot: number; candidate: number } | null {
  if (!option || !detail?.result || execution !== detail.execution.execution_id) return null;
  const slots = detail.result.slots;
  for (let slot = 0; slot < slots.length; slot++) {
    const candidate = slots[slot]!.candidates.findIndex((c) => c.candidate_key !== undefined && `${slot}:${c.candidate_key}` === option);
    if (candidate !== -1) return { slot, candidate };
  }
  return null;
}

/**
 * A pressed sub-tier handle (SP2, spec §12.4): the alias, the card it was pressed on, and what opened its panel: the
 * map's handle, or a Path beneath row in that card's details (LF spec §7). Focus returns to the opener on close.
 */
type Handle = { alias: string; origin: string; from: 'map' | 'tab' };

const noSubscription = () => () => {};
const serverStoredHeat = () => true;

/** The run workspace (spec §9.3): seat bar, map, details, Configure tray, Run. */
export function Workspace({
  projectName, template: initialTemplate, library, executions: initialExecutions, initialDetail,
  projectError = null, productsError = null, executionsError = null, detailError = null,
}: WorkspaceProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [template, setTemplate] = useState(initialTemplate);
  const [executions, setExecutions] = useState(initialExecutions);
  const [loaded, setLoaded] = useState(initialDetail);
  // `loaded` is state, so it is referentially stable, as the hook requires.
  const { detail, error: pollError } = useExecutionPoll(loaded);
  // SP2 (spec §8.3, §12.5): a throttled execution is live — the tick resumes it — so Cancel stays offered and Run stays blocked.
  const running = detail !== null && (detail.execution.status === 'queued' || detail.execution.status === 'running' || detail.execution.status === 'throttled');
  const [estimate, setEstimate] = useState<SmEstimateResponse | null>(null);
  // R5: a failed readiness read blocks Run with its reason; RunButton would otherwise say "Checking…" for ever.
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  // LF (w5): the tray's Apply or Duplicate is in flight, as the tray reports it; Escape leaves the tray open meanwhile.
  const [trayBusy, setTrayBusy] = useState(false);
  const [productFilter, setProductFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ slot: number; candidate: number } | null>(() => seedSelection(params.get('execution'), params.get('option'), initialDetail));
  // LF (spec §6.1, §6.2): at most one pinned card, beside the active one; a card by its indexes, as `selected` is
  const [pinned, setPinned] = useState<{ slot: number; candidate: number } | null>(null);
  // SP2 (spec §12.4): the pressed sub-tier handle and the card it was pressed on; the side column shows its panel
  // instead of the card's (P2, one panel at a time). The origin picks that option's copy of a shared node.
  const [handle, setHandle] = useState<Handle | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  // LF (spec §6.6): the links' heat. The server snapshot is on; after hydration the stored choice is read, and the
  // viewer's press (null until they press) wins for this page view. The stored value changes only through setHeat,
  // which re-renders through state, so there is nothing to subscribe to (as theme-root.tsx reads the theme).
  const storedHeat = useSyncExternalStore(noSubscription, readStoredHeat, serverStoredHeat);
  const [heatChosen, setHeatChosen] = useState<boolean | null>(null);
  const heat = heatChosen ?? storedHeat;
  function setHeat(next: boolean) {
    writeStoredHeat(next);
    setHeatChosen(next);
  }
  const [error, setError] = useState<string | null>(detailError);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // The estimate is read on mount and again after each Apply (a new `template`). An answer applies only while
  // its template is still the current one, so a late answer for the scope before an Apply never overwrites.
  useEffect(() => {
    let live = true;
    void smFetch<SmEstimateResponse>(`/api/account/sourcing-map/runs/${template.template_id}/estimate`, { method: 'POST' }).then((out) => {
      if (!live) return;
      if (out.ok) setEstimate(out.data);
      else setEstimateError(`Readiness could not be checked: ${out.message}`);
    });
    return () => {
      live = false;
    };
  }, [template]);

  // R3: each switch of result (a pick, Run's new execution, the reload after Cancel) takes a number; only the
  // latest one's answer, success or failure, is applied, so two answers arriving out of order can't swap.
  // Answers whether the switch was applied: false when it failed or a later switch superseded it.
  const selectSeq = useRef(0);
  async function selectExecution(id: string): Promise<boolean> {
    const seq = ++selectSeq.current;
    // R3: a switch of result starts clean; an error left by the previous one no longer applies.
    setError(null);
    const out = await smFetch<SmExecutionDetail>(`/api/account/sourcing-map/executions/${id}`);
    if (seq !== selectSeq.current) return false;
    if (!out.ok) {
      setError(out.message);
      return false;
    }
    setLoaded(out.data);
    // I-1: an "Open map" link's ?execution=&option= named the result just replaced; a reload or a copied link would reopen it.
    if (params.has('execution') || params.has('option')) {
      const q = new URLSearchParams(params.toString());
      q.delete('execution');
      q.delete('option');
      const rest = q.toString();
      window.history.replaceState(null, '', rest ? `${pathname}?${rest}` : pathname);
    }
    // R3: the pick, the pin (LF §6.2) and the collapsed rails are by slot (and candidate) index, so they named the result
    // just replaced.
    setSelected(null);
    setPinned(null);
    setHandle(null);
    setCollapsed(new Set());
    // The loaded execution's summary replaces (or joins) its picker entry, so a new run needs no list refetch.
    setExecutions((xs) => [out.data.execution, ...xs.filter((x) => x.execution_id !== out.data.execution.execution_id)]);
    return true;
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      // d-G4: the trigger answers { run_id }, and for sourcing_map run_id is the execution_id.
      const t = await smFetch<{ run_id: string }>(`/api/account/sourcing-map/runs/${template.template_id}/trigger`, { method: 'POST' });
      if (!t.ok) {
        setError(t.message);
        return;
      }
      // Run stays busy until the new execution has loaded (and reads as running), so a second press can't race it.
      await selectExecution(t.data.run_id);
    } finally {
      setBusy(false);
    }
  }

  // R2: a successful Cancel removes its own button. Once no execution runs any more (the reload, or a poll, says so),
  // a focus that fell to <body> goes to the result picker: it is always enabled then, as the cancelled execution is
  // listed. Run may be disabled (not ready, or the tray open), and a disabled control can't take focus. A focus the
  // user has since moved elsewhere (the tray, say) is left where it is. A layout effect, so this runs in the commit that
  // removes Cancel: a passive one ran a task after the reload's answer, with focus on <body> meanwhile (F-FLAKE-1).
  const pickerRef = useRef<HTMLSpanElement | null>(null);
  const focusAfterCancel = useRef(false);
  useLayoutEffect(() => {
    if (!focusAfterCancel.current || running) return;
    focusAfterCancel.current = false;
    if (document.activeElement !== null && document.activeElement !== document.body) return;
    pickerRef.current?.querySelector('select')?.focus();
  });

  async function cancel(id: string) {
    const seq = selectSeq.current;
    setCancelling(true);
    setError(null);
    try {
      const out = await smFetch(`/api/account/sourcing-map/executions/${id}/cancel`, { method: 'POST' });
      // R3: a switch of result made while the request was in flight wins; this answer, and its reload, no longer apply.
      if (seq !== selectSeq.current) return;
      if (!out.ok) {
        setError(out.message);
        return;
      }
      // Spec §8.9: in-flight probes finish and are discarded; reload so the banner and cards say so.
      // Cancel stays disabled through the reload, which removes it.
      focusAfterCancel.current = true;
      // M2: a reload that failed or was superseded leaves the button where it was; a later terminal poll must not
      // move focus at an arbitrary moment, so the hand-off is dropped.
      if (!(await selectExecution(id))) focusAfterCancel.current = false;
    } finally {
      setCancelling(false);
    }
  }

  // R2: closing the details returns focus to the card that opened them: the pressed `[data-anchor]` whose value equals
  // the selected card's key, compared by value as closeHandle compares a handle's. A key alone can name two cards in two
  // lanes (an SP1 participant, or one class in two slots: LF final review I-1); only the selected card's header is
  // both pressed and an anchor (a handle's value carries `/<alias>`, and the heat switch, LF §6.6, has no anchor). The
  // card outlives the close, so it is focused before the panel unmounts.
  const mapRef = useRef<HTMLDivElement | null>(null);
  function focusAnchor(anchor: string) {
    Array.from(mapRef.current?.querySelectorAll<HTMLElement>('[data-anchor]') ?? []).find((el) => el.dataset.anchor === anchor)?.focus();
  }
  function closeDetails() {
    if (selectedCandidate) {
      const key = candidateKeyOf(selectedCandidate);
      Array.from(mapRef.current?.querySelectorAll<HTMLElement>('[data-anchor][aria-pressed="true"]') ?? []).find((el) => el.dataset.anchor === key)?.focus();
    }
    setSelected(null);
  }

  // R2 for handles (fix round 1): closing the handle panel, by Close, by Escape or by pressing the handle again, returns
  // focus to its opener. The card's details stay mounted (hidden) under the handle panel, so nothing remounts and takes
  // focus to its heading afterwards, StrictMode's re-run effects included.
  // - Opened from the map: the pressed handle, found by its origin and alias. C-1: by comparing each anchor's value, as
  //   measureAnchors does, never by a CSS selector built from it: a real candidate_key is JSON.stringify([participant,
  //   sku]), whose quotes make such a selector throw.
  // - Opened from a Path beneath row (LF spec §7): that row in the details panel, compared by value the same way; when
  //   the details have gone (Hide all paths, w13), the map's handle, never <body>. A press on the map's handle itself
  //   keeps the focus there whatever opened the panel (R7).
  // The row sits in the details panel, which is hidden while the handle panel shows, and a browser will not focus into
  // a hidden subtree; so the focus moves in a layout effect after the commit that clears the handle and shows the
  // details again, never in closeHandle itself (ruling F3). closedHandle holds a handle only while that handle is being
  // cleared, so the commit that runs the effect always follows it.
  const detailsRef = useRef<HTMLElement | null>(null);
  const closedHandle = useRef<Handle | null>(null);
  useLayoutEffect(() => {
    const h = closedHandle.current;
    if (h === null) return;
    closedHandle.current = null;
    const row = h.from === 'tab' ? Array.from(detailsRef.current?.querySelectorAll<HTMLElement>('[data-path-row]') ?? []).find((el) => el.dataset.pathRow === h.alias) : undefined;
    if (row) row.focus();
    else focusAnchor(`${h.origin}/${h.alias}`);
  });
  function closeHandle() {
    closedHandle.current = handle;
    setHandle(null);
  }
  // A card pick (a click, or the limits list) shows that card's details; a handle pressed before is dropped.
  // I-1: a pick whose lane is collapsed (the limits list stays shown) expands that lane, so the card and its trace
  // are drawn and Close has a card to return focus to. The set is kept as it is when the lane is already open.
  function selectCard(sel: { slot: number; candidate: number }) {
    setHandle(null);
    setSelected(sel);
    setCollapsed((c) => {
      if (!c.has(sel.slot)) return c;
      const n = new Set(c);
      n.delete(sel.slot);
      return n;
    });
  }
  function selectHandle(alias: string | null, origin: string) {
    // R7: the pressed handle pressed again closes its panel and keeps the focus, whatever opened the panel
    if (alias === null) {
      closedHandle.current = handle && { ...handle, from: 'map' };
      setHandle(null);
    } else setHandle({ alias, origin, from: 'map' });
  }
  // LF (spec §7): a Path beneath row opens its alias's handle panel on the active card, as that card's map handle does.
  function openRow(alias: string) {
    if (selectedCandidate) setHandle({ alias, origin: candidateKeyOf(selectedCandidate), from: 'tab' });
  }
  // LF (spec §6.4): Hide all paths clears the active card and the pinned card, so the details close with the active
  // card's trace: the two are one selection. A handle panel is left as it is. Focus stays on the pressed button, which
  // turns unavailable (w3). Escape's last step is the same call (§6.5).
  function hideAll() {
    setSelected(null);
    setPinned(null);
  }
  // LF (spec §6.2): Pin makes the active card the pinned one, replacing any earlier pin; Unpin, on the pinned card,
  // clears the pin only
  const activePinned = pinned !== null && selected !== null && pinned.slot === selected.slot && pinned.candidate === selected.candidate;
  function togglePin() {
    setPinned(activePinned ? null : selected);
  }

  // M1: collapsing a lane unmounts its cards (layout.ts: a collapsed lane has no cards). The details of a card in it
  // close with it, so Close never has a card to return focus to; focus stays on the lane's toggle. So does a handle
  // pressed on a card in it that is not the selected card (fix round 1): its panel would describe a card no longer shown.
  // A card pinned in it is unpinned (LF §6.2), whichever card is active.
  function toggleLane(i: number) {
    if (!collapsed.has(i)) {
      if (selected?.slot === i) {
        setSelected(null);
        setHandle(null);
      } else if (handle && detail?.result?.slots[i]?.candidates.some((c) => candidateKeyOf(c) === handle.origin)) {
        setHandle(null);
      }
      if (pinned?.slot === i) setPinned(null);
    }
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  // R2: the tray moves focus into itself on open; closing it gives focus back to Configure, which opened it.
  const configureRef = useRef<HTMLButtonElement | null>(null);
  // P2: the side column holds one panel at a time (the details and the tray side by side would overflow the row).
  function openTray() {
    setSelected(null);
    setHandle(null);
    setTrayOpen(true);
  }
  function closeTray() {
    configureRef.current?.focus();
    setTrayOpen(false);
  }

  // F2: the drop is view state the server render never reads. A router navigation would re-render the page's server
  // reads on every click (a new ?drop= is a new, uncached page segment); the history API keeps the link shareable,
  // and Next syncs useSearchParams with it (next/dist/client/components/app-router.js patches replaceState).
  function setDrop(drop: string) {
    const q = new URLSearchParams(params.toString());
    q.set('drop', drop);
    window.history.replaceState(null, '', `${pathname}?${q.toString()}`);
  }

  const result = detail?.result ?? null;
  // I-1: the poll moves the status inside the hook, so the picker's entry for the loaded execution is derived from
  // it at render (no effect, no refetch: d-G4 holds).
  const listed = detail ? executions.map((x) => (x.execution_id === detail.execution.execution_id ? detail.execution : x)) : executions;
  const asOfDrop = result ? resolveAsOfDrop(params.get('drop'), result.portfolio) : null;
  const productNames = Object.fromEntries(library.map((p) => [p.product_id, p.name]));
  const selectedCandidate = result && selected ? result.slots[selected.slot]?.candidates[selected.candidate] ?? null : null;
  const pinnedCandidate = result && pinned ? result.slots[pinned.slot]?.candidates[pinned.candidate] ?? null : null;
  const handleNode = result && handle ? nodeOf(result, handle.alias, handle.origin) : null;
  // the handle's role on the trace is that of the traced card it was pressed on, the active card or the pinned one
  // (LF §6.2), and only when it was pressed on one of them
  const handleCard = handle ? [selectedCandidate, pinnedCandidate].find((c) => c !== null && candidateKeyOf(c) === handle.origin) : undefined;
  const handleTraceNode = handle && handleCard ? handleCard.trace?.nodes.find((n) => n.alias === handle.alias) ?? null : null;
  const candidateNames = result ? candidateNamesOf(result) : {};
  const inRun = library.filter((p) => template.scope.products.some((x) => x.product_id === p.product_id));
  const units = [...new Set(inRun.map((p) => p.unit_label))];
  const days = [...new Set(inRun.map((p) => p.assembly_days))].sort((a, b) => a - b);
  const handlePanel = !trayOpen && result && handle && handleNode ? (
    <HandlePanel
      key={`${handle.origin}/${handle.alias}`}
      node={{ ...handleNode, under: underOf(result, handle.alias) }}
      origin={handle.origin}
      candidateNames={candidateNames}
      trace={handleTraceNode ? { role: handleTraceNode.role, binds_for: handleTraceNode.binds_for } : null}
      otherTiers={otherTiers(result, handle.alias, handle.origin)}
      onClose={closeHandle}
    />
  ) : null;
  const detailsPanel = !trayOpen && detail && result && selected && selectedCandidate ? (
    <DetailsPanel
      ref={detailsRef}
      // R2: keyed by the pick, so a new pick mounts a panel that moves focus to its heading. A re-pick of the same
      // card while a handle panel shows keeps this panel mounted: selectCard drops the handle, which un-hides the
      // panel without moving focus.
      key={`${selected.slot}:${selected.candidate}`}
      // P2: one panel at a time; hidden (not unmounted) under a handle panel, so closing that never remounts it.
      // M-4: only while the handle panel actually renders (its node is on the map); never an empty side column.
      hidden={handle !== null && handleNode !== null}
      executionId={detail.execution.execution_id}
      result={result}
      slot={result.slots[selected.slot]!}
      candidate={selectedCandidate}
      drops={result.portfolio.drops}
      asOfDrop={asOfDrop}
      productNames={productNames}
      onClose={closeDetails}
      // LF (spec §9.5, ruling F1): a running execution has no projection to drill into yet
      unavailable={running ? RUN_NOT_COMPLETE : null}
      onOpenRow={openRow}
      // LF (spec §6.2, §9.5): nothing to pin while the run is live, nor on a card that never answered or has no projection
      pin={{ pinned: activePinned, onToggle: togglePin, reason: running ? RUN_NOT_COMPLETE : pinnable(selectedCandidate) ? null : NOTHING_BENEATH }}
      // LF (spec §6.7): the strip sets the pinned card against the active one, so only while they are two cards
      compare={pinned && pinnedCandidate && !activePinned ? { slot: result.slots[pinned.slot]!, candidate: pinnedCandidate, onUnpin: () => setPinned(null) } : null}
    />
  ) : null;

  // LF (spec §6.5): Escape is the page's, and this one listener owns it; the panels have no handler of their own, so a
  // press closes exactly one layer, the first that shows (what renders above, not the raw state: a card picked while
  // the tray is open has `selected` set and no panel); with nothing else open, a pin is the last layer, cleared as Hide
  // all paths clears it (a busy tray still takes the press). It ignores a press another handler took; one from another
  // surface (w9: only <body>, <html> and this root are the page's); one inside a dialog, the rule for a non-modal one
  // such as the help panel; any press while a modal is open (w1, review I-1: a modal owns the key wherever focus is;
  // this is what covers the upload wizard); and one on a <select>, whose list uses the key (w4). It listens in the
  // bubble phase: a capture listener without the dialog rule would close a layer AND minimise the help panel on one
  // press. useEffectEvent gives the listener, attached once, this render's state.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const t = e.target;
    if (t !== document.body && t !== document.documentElement && !(t instanceof Node && rootRef.current?.contains(t))) return;
    if (t instanceof Element && t.closest('[role="dialog"]')) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    if (t instanceof HTMLSelectElement) return;
    if (handlePanel !== null) closeHandle();
    else if (detailsPanel !== null) closeDetails();
    else if (trayOpen) {
      // w5: an Apply or Duplicate in flight answers in the tray, whose Close waits for it; so does Escape
      if (!trayBusy) closeTray();
    } else if (pinned !== null) hideAll();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyDown(e);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  return (
    <div ref={rootRef} className="contents">
      <SmHeader
        crumbs={[{ label: 'Projects', href: SM_HOME }, { label: projectName, href: smProjectHref(template.scope.project_id) }, { label: template.template_name }]}
        actions={
          <>
            <span ref={pickerRef} className="contents">
              <ExecutionPicker executions={listed} selectedId={detail?.execution.execution_id ?? null} onSelect={(id) => void selectExecution(id)} />
            </span>
            {result && <AnswersAsOf asOf={result.answers_as_of} now={new Date()} />}
            <button ref={configureRef} type="button" className="sm-btn sm-btn-ghost" disabled={productsError !== null} onClick={openTray}>
              Configure
            </button>
            <RunButton estimate={estimate} blockedReason={trayOpen ? 'Apply or close Configure before running.' : estimateError} running={running} busy={busy} onRun={() => void run()} />
          </>
        }
      />
      {/* P2: the side panels sit in the page flow as a column beside the page body, below the header, so they never
          cover the header's controls (a fixed overlay did). The header is flex-wrap, so no height is assumed. */}
      <div className="flex items-start">
        <div className="min-w-0 flex-1">
          {projectError && <p role="alert" className="sm-error px-6 pt-3 text-sm">{projectError}</p>}
          {productsError && <p role="alert" className="sm-error px-6 pt-3 text-sm">{productsError}</p>}
          {executionsError && <p role="alert" className="sm-error px-6 pt-3 text-sm">{executionsError}</p>}
          {error && <p role="alert" className="sm-error px-6 pt-3 text-sm">{error}</p>}
          {pollError && <p role="alert" className="sm-error px-6 pt-3 text-sm">{pollError}</p>}
          {/* R1: with no result loaded after a failed read, what exists is unknown; the alert says so, not the banner. */}
          {!(detail === null && (executionsError !== null || detailError !== null)) && (
            <ExecutionBanner
              execution={detail?.execution ?? null}
              onCancel={detail && running ? () => void cancel(detail.execution.execution_id) : undefined}
              cancelling={cancelling}
            />
          )}
          {result && (
            <SeatBar
              result={result}
              unitLabel={units.length === 1 ? units[0]! : 'units'}
              asOfDrop={asOfDrop}
              onDrop={setDrop}
              productFilter={productFilter}
              onProduct={setProductFilter}
            />
          )}
          {result && (
            <div ref={mapRef} className="contents">
              <MapCanvas
                result={result}
                asOfDrop={asOfDrop}
                productFilter={productFilter}
                productNames={productNames}
                seat={{
                  name: result.seat.legal_name,
                  country: result.seat.country,
                  classLabel: result.seat.class_label,
                  productCount: template.scope.products.length,
                  slotCount: result.slots.length,
                  assemblyDays: days.length === 0 ? '—' : days.length === 1 ? String(days[0]) : `${days[0]}–${days[days.length - 1]}`,
                  capacity: template.scope.seat_weekly_capacity,
                }}
                selected={selected}
                onSelect={selectCard}
                collapsed={collapsed}
                onToggle={toggleLane}
                selectedHandle={handle}
                onSelectAlias={selectHandle}
                onHideAll={hideAll}
                unavailable={running ? RUN_NOT_COMPLETE : null}
                heat={heat}
                onHeat={setHeat}
                pinned={pinned}
              />
            </div>
          )}
        </div>
        {/* P2: while the tray is open it holds the side column; a card picked meanwhile shows once the tray closes. */}
        {/* SP2 (spec §12.4): a pressed handle's panel takes the column; the card's details return when it closes. */}
        {handlePanel}
        {detailsPanel}
        {trayOpen && (
          <ConfigureTray
            template={template}
            library={library}
            onApplied={(t) => {
              // The readiness read so far was the old scope's; Run says it is checking until the new one answers.
              setEstimate(null);
              setEstimateError(null);
              setTemplate(t);
              // M3: P2d holds for Close only; after an Apply, focus returns to Configure and a pick made meanwhile is dropped.
              setSelected(null);
              setHandle(null);
              closeTray();
            }}
            onClose={closeTray}
            onBusy={setTrayBusy}
          />
        )}
      </div>
    </div>
  );
}
