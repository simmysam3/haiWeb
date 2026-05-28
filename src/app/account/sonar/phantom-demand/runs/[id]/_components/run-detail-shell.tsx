'use client';
import { useState } from 'react';
import useSWR from 'swr';
import type { PhantomDemandRunDetail } from '@/lib/haiwave-api';
import { BomTreeView, BomNodeDetail } from '@/components/sonar/phantom-demand';
import type { BomNode } from '@haiwave/protocol';

interface RunDetailShellProps {
  initialDetail: PhantomDemandRunDetail;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

const TERMINAL_STATUSES = new Set(['complete', 'completed', 'failed', 'cancelled']);

function findNode(tree: BomNode, lineId: string): BomNode | null {
  if (tree.line_id === lineId) return tree;
  for (const child of tree.subcomponents) {
    const found = findNode(child, lineId);
    if (found) return found;
  }
  return null;
}

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

  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const selectedNode = tree && selectedLineId ? findNode(tree, selectedLineId) : null;

  if (!tree) {
    return (
      <div className="rounded border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">Resolving components…</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <BomTreeView tree={tree} selectedLineId={selectedLineId} onSelect={setSelectedLineId} />
      {selectedNode ? (
        <BomNodeDetail node={selectedNode} />
      ) : (
        <div className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Select a component to see details.
        </div>
      )}
    </div>
  );
}
