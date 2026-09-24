'use client';
import { useCallback, useEffect, useState } from 'react';
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
  projectName, template: initialTemplate, library, executions: initialExecutions, initialDetail, projectError = null, productsError = null, executionsError = null, detailError = null,
}: WorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [template, setTemplate] = useState(initialTemplate);
  const [executions, setExecutions] = useState(initialExecutions);
  const [loaded, setLoaded] = useState(initialDetail);
  // `loaded` is state, so it is referentially stable, as the hook requires.
  const { detail } = useExecutionPoll(loaded);
  const [estimate, setEstimate] = useState<SmEstimateResponse | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [productFilter, setProductFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ slot: number; candidate: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(detailError);
  const [busy, setBusy] = useState(false);

  const loadEstimate = useCallback(async () => {
    const out = await smFetch<SmEstimateResponse>(`/api/account/sourcing-map/runs/${template.template_id}/estimate`, { method: 'POST' });
    if (out.ok) setEstimate(out.data);
  }, [template]);
  useEffect(() => {
    void loadEstimate();
  }, [loadEstimate]);

  function setDrop(drop: string) {
    const q = new URLSearchParams(params.toString());
    q.set('drop', drop);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }

  const result = detail?.result ?? null;
  const asOfDrop = result ? resolveAsOfDrop(params.get('drop'), result.portfolio) : null;
  const running = detail !== null && (detail.execution.status === 'queued' || detail.execution.status === 'running');
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
            <ExecutionPicker executions={executions} selectedId={detail?.execution.execution_id ?? null} onSelect={() => undefined} />
            {result && <AnswersAsOf asOf={result.answers_as_of} now={new Date()} />}
            <button type="button" className="sm-btn sm-btn-ghost" disabled={productsError !== null} onClick={() => setTrayOpen(true)}>Configure</button>
            <RunButton estimate={estimate} blockedReason={trayOpen ? 'Apply or close Configure before running.' : null} running={running} busy={busy} onRun={() => undefined} />
          </>
        }
      />
      {projectError && <p role="alert" className="sm-error px-6 pt-3 text-sm">{projectError}</p>}
      {productsError && <p role="alert" className="sm-error px-6 pt-3 text-sm">{productsError}</p>}
      {executionsError && <p role="alert" className="sm-error px-6 pt-3 text-sm">{executionsError}</p>}
      {error && <p role="alert" className="sm-error px-6 pt-3 text-sm">{error}</p>}
      {/* R1: with no result loaded after a failed read, what exists is unknown; the alert says so, not the banner. */}
      {!(detail === null && (executionsError !== null || detailError !== null)) && <ExecutionBanner execution={detail?.execution ?? null} />}
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
      )}
      {trayOpen && (
        <ConfigureTray
          template={template}
          library={library}
          onApplied={(t) => {
            setTemplate(t);
            setTrayOpen(false);
          }}
          onClose={() => setTrayOpen(false)}
        />
      )}
    </>
  );
}
