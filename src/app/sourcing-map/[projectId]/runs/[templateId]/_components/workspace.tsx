'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { SmEstimateResponse, SmExecutionDetail, SmExecutionSummary, SmProduct, SmRunTemplate } from '@/lib/sourcing-map/contract';
import { smFetch } from '@/lib/sourcing-map/client';
import { SM_HOME, smProjectHref } from '@/lib/sourcing-map/routes';
import { resolveAsOfDrop } from '@/lib/sourcing-map/map/selectors';
import { SmHeader } from '@/app/sourcing-map/_components/sm-header';
import { useExecutionPoll } from './use-execution-poll';
import { ExecutionPicker } from './execution-picker';
import { RunButton } from './run-button';
import { AnswersAsOf, ExecutionBanner } from './execution-state';
import { SeatBar } from './seat-bar';
import { MapCanvas } from './map-canvas';
import { DetailsPanel } from './details-panel';
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

/** The run workspace (spec §9.3): seat bar, map, details, Configure tray, Run. */
export function Workspace({
  projectName, template: initialTemplate, library, executions: initialExecutions, initialDetail,
  projectError = null, productsError = null, executionsError = null, detailError = null,
}: WorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [template, setTemplate] = useState(initialTemplate);
  const [executions, setExecutions] = useState(initialExecutions);
  const [loaded, setLoaded] = useState(initialDetail);
  // `loaded` is state, so it is referentially stable, as the hook requires.
  const { detail, error: pollError } = useExecutionPoll(loaded);
  const running = detail !== null && (detail.execution.status === 'queued' || detail.execution.status === 'running');
  const [estimate, setEstimate] = useState<SmEstimateResponse | null>(null);
  // R5: a failed readiness read blocks Run with its reason; RunButton would otherwise say "Checking…" for ever.
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [productFilter, setProductFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ slot: number; candidate: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
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
  const selectSeq = useRef(0);
  async function selectExecution(id: string) {
    const seq = ++selectSeq.current;
    // R3: a switch of result starts clean; an error left by the previous one no longer applies.
    setError(null);
    const out = await smFetch<SmExecutionDetail>(`/api/account/sourcing-map/executions/${id}`);
    if (seq !== selectSeq.current) return;
    if (!out.ok) {
      setError(out.message);
      return;
    }
    setLoaded(out.data);
    // R3: the pick and the collapsed rails are by slot (and candidate) index, so they named the result just replaced.
    setSelected(null);
    setCollapsed(new Set());
    // The loaded execution's summary replaces (or joins) its picker entry, so a new run needs no list refetch.
    setExecutions((xs) => [out.data.execution, ...xs.filter((x) => x.execution_id !== out.data.execution.execution_id)]);
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
  // user has since moved elsewhere (the tray, say) is left where it is.
  const pickerRef = useRef<HTMLSpanElement | null>(null);
  const focusAfterCancel = useRef(false);
  useEffect(() => {
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
      await selectExecution(id);
    } finally {
      setCancelling(false);
    }
  }

  // R2: closing the details returns focus to the card that opened them. Only option cards carry aria-pressed
  // inside the map (SeatBar's pressed chips sit outside this wrapper); the card outlives the close, so it is
  // focused before the panel unmounts.
  const mapRef = useRef<HTMLDivElement | null>(null);
  function closeDetails() {
    mapRef.current?.querySelector<HTMLElement>('button[aria-pressed="true"]')?.focus();
    setSelected(null);
  }

  // R2: the tray moves focus into itself on open; closing it gives focus back to Configure, which opened it.
  const configureRef = useRef<HTMLButtonElement | null>(null);
  // P2: the side column holds one panel at a time (the details and the tray side by side would overflow the row).
  function openTray() {
    setSelected(null);
    setTrayOpen(true);
  }
  function closeTray() {
    configureRef.current?.focus();
    setTrayOpen(false);
  }

  function setDrop(drop: string) {
    const q = new URLSearchParams(params.toString());
    q.set('drop', drop);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }

  const result = detail?.result ?? null;
  const asOfDrop = result ? resolveAsOfDrop(params.get('drop'), result.portfolio) : null;
  const productNames = Object.fromEntries(library.map((p) => [p.product_id, p.name]));
  const inRun = library.filter((p) => template.scope.products.some((x) => x.product_id === p.product_id));
  const units = [...new Set(inRun.map((p) => p.unit_label))];
  const days = [...new Set(inRun.map((p) => p.assembly_days))].sort((a, b) => a - b);

  return (
    <>
      <SmHeader
        crumbs={[{ label: 'Projects', href: SM_HOME }, { label: projectName, href: smProjectHref(template.scope.project_id) }, { label: template.template_name }]}
        actions={
          <>
            <span ref={pickerRef} className="contents">
              <ExecutionPicker executions={executions} selectedId={detail?.execution.execution_id ?? null} onSelect={(id) => void selectExecution(id)} />
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
                onSelect={setSelected}
                collapsed={collapsed}
                onToggle={(i) => setCollapsed((c) => { const n = new Set(c); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
              />
            </div>
          )}
        </div>
        {result && selected && result.slots[selected.slot]?.candidates[selected.candidate] && (
          <DetailsPanel
            // R2: keyed by the pick, so each new pick mounts a panel that moves focus to its heading.
            key={`${selected.slot}:${selected.candidate}`}
            slot={result.slots[selected.slot]!}
            candidate={result.slots[selected.slot]!.candidates[selected.candidate]!}
            drops={result.portfolio.drops}
            asOfDrop={asOfDrop}
            productNames={productNames}
            onClose={closeDetails}
          />
        )}
        {trayOpen && (
          <ConfigureTray
            template={template}
            library={library}
            onApplied={(t) => {
              // The readiness read so far was the old scope's; Run says it is checking until the new one answers.
              setEstimate(null);
              setEstimateError(null);
              setTemplate(t);
              closeTray();
            }}
            onClose={closeTray}
          />
        )}
      </div>
    </>
  );
}
