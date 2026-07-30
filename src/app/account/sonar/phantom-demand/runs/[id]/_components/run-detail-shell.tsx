'use client';
import useSWR from 'swr';
import type { PhantomDemandRunDetail } from '@/lib/haiwave-api';
import { BomAccordionTree, BomNodeBand } from '@/components/sonar/phantom-demand';
import { Pill } from '@/components/pill';

interface RunDetailShellProps {
  initialDetail: PhantomDemandRunDetail;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

const TERMINAL_STATUSES = new Set(['complete', 'completed', 'failed', 'cancelled']);

export function RunDetailShell({ initialDetail }: RunDetailShellProps) {
  const runId = initialDetail.run.run_id;
  const isTerminal = TERMINAL_STATUSES.has(initialDetail.run.status);

  // Poll the lightweight status endpoint while the run is still in flight.
  const { data: statusData } = useSWR<{ status: string; cancel_requested_at: string | null }>(
    isTerminal ? null : `/api/account/sonar/phantom-demand/runs/${runId}/status`,
    fetcher,
    { refreshInterval: 1500 },
  );

  // Once the status flips to a terminal state (or the initial load already has
  // the tree), fetch the full detail so we get the BOM tree payload.
  const statusFlippedToTerminal =
    statusData?.status !== undefined && TERMINAL_STATUSES.has(statusData.status);
  const { data: refreshed } = useSWR<PhantomDemandRunDetail>(
    statusFlippedToTerminal && !initialDetail.tree
      ? `/api/account/sonar/phantom-demand/runs/${runId}`
      : null,
    fetcher,
  );

  const detail = (refreshed ?? initialDetail) as PhantomDemandRunDetail;
  const tree = detail.tree;
  const targetDate = (detail.run.scope_snapshot as { target_date?: string } | null)?.target_date ?? '';

  if (!tree) {
    return (
      <div className="rounded border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Resolving components…</p>
      </div>
    );
  }

  const verdict = detail.run.readiness_verdict;
  return (
    <div className="space-y-4">
      {verdict && verdict !== 'not_evaluated' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Readiness</span>
          <Pill category="readiness" value={verdict} />
        </div>
      )}
      {/* Unified accordion drill-in: one full-width tree; clicking a row toggles
          its detail band and children inline beneath it (replaces the two-pane
          tree + detail-panel layout). */}
      <BomAccordionTree
        tree={tree}
        targetDate={targetDate}
        renderBand={(node, lineRef) => (
          <BomNodeBand node={node} targetDate={targetDate} lineRef={lineRef} />
        )}
      />
    </div>
  );
}
