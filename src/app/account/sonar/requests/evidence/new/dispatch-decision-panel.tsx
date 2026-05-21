'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useRunStatus } from '@/app/account/sonar/posture/runs/[id]/use-run-status';
import { EvidenceTreeView } from './evidence-tree-view';
import { ResponseExportDialog } from './response-export-dialog';

export interface DraftWire {
  draft_response_id: string;
  scope_payload: { skus: string[]; resolved_skus: string[]; unknown_skus: string[] };
  dispatch_availability: {
    total_skus: number; covered_count: number;
    uncovered_skus: string[]; oldest_applicable_run_age_days: number | null;
  };
  // v1.34 P9: recipient fields carried from the full EvidenceDraftWire for export.
  recipient_name?: string;
  recipient_type?: string;
  source_run_ids?: string[] | null;
  bound_run_id?: string | null;
}

function RunWaiting({ runId }: { runId: string }) {
  const router = useRouter();
  const { status } = useRunStatus(runId);
  const hasFired = useRef(false);
  const terminal = !!status && ['complete', 'partial', 'failed', 'cancelled'].includes(status);
  useEffect(() => {
    if (terminal && !hasFired.current) {
      hasFired.current = true;
      router.refresh();
    }
  }, [terminal, router]);
  return <p className="text-sm text-slate">Fresh run {runId} — status: {status ?? 'starting'}…</p>;
}

export function DispatchDecisionPanel({ draft }: { draft: DraftWire }) {
  const a = draft.dispatch_availability;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boundRunId, setBoundRunId] = useState<string | null>(null);
  const [done, setDone] = useState<'cached' | null>(null);

  // Reuses the same useRunStatus SWR key RunWaiting subscribes to (deduped —
  // not a parallel flag). Lifts the fresh-run terminal state up so the review
  // stage can render once dispatch is resolved AND the tree is ready.
  const { status: runStatus } = useRunStatus(boundRunId ?? '');
  const dispatchResolved = done === 'cached' || boundRunId !== null;
  const treeReady =
    done === 'cached' || ['complete', 'partial'].includes(runStatus ?? '');
  // Derived purely from the already-subscribed runStatus (no parallel poll).
  // A fresh run that ends failed/cancelled never reaches complete/partial, so
  // treeReady stays false forever — without this the user is stuck on the
  // indefinite RunWaiting "…" line with no error. Cached path can't fail here.
  const runFailed =
    boundRunId !== null && ['failed', 'cancelled'].includes(runStatus ?? '');

  async function dispatch(decision: 'cached' | 'fresh') {
    setBusy(true); setError(null);
    try {
      const res = await fetch(
        `/api/account/sonar/compliance/evidence/draft/${encodeURIComponent(draft.draft_response_id)}/dispatch`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }) },
      );
      if (!res.ok) { setError(`Dispatch failed (${res.status})`); return; }
      const out = await res.json() as { dispatch_decision: string; bound_run_id: string | null };
      if (decision === 'fresh') {
        if (out.bound_run_id) setBoundRunId(out.bound_run_id);
        else setError('Fresh dispatch did not return a run id');
      } else {
        setDone('cached');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      setError(`Dispatch failed — ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-charcoal">Dispatch decision</h1>
      <p className="text-sm">
        {a.covered_count} of {a.total_skus} SKUs have a recent completed run
        {a.oldest_applicable_run_age_days !== null && <> · oldest applicable run {a.oldest_applicable_run_age_days}d old</>}.
      </p>
      {a.uncovered_skus.length > 0 && (
        <p className="text-sm text-warn">Uncovered: {a.uncovered_skus.join(', ')}</p>
      )}
      {draft.scope_payload.unknown_skus.length > 0 && (
        <p className="text-sm text-warn">Not in catalog: {draft.scope_payload.unknown_skus.join(', ')}</p>
      )}
      {error && <p className="text-sm text-problem">{error}</p>}

      {boundRunId && runFailed ? (
          <div className="rounded border border-problem/30 bg-problem/5 p-3 text-sm text-problem space-y-1">
            <p className="font-semibold">Fresh run {runStatus}.</p>
            <p>Run {boundRunId} {runStatus} before evidence could be generated. Review &amp; annotate is unavailable for this run.</p>
          </div>
        )
        : boundRunId ? <RunWaiting runId={boundRunId} />
        : done === 'cached' ? <p className="text-sm text-success">Cached dispatch recorded.</p>
        : (
          <div className="flex gap-3">
            <button type="button" disabled={busy} onClick={() => dispatch('cached')}
              className="px-4 py-2 rounded border">Use cached</button>
            <button type="button" disabled={busy} onClick={() => dispatch('fresh')}
              className="px-4 py-2 rounded bg-charcoal text-white">Run fresh</button>
          </div>
        )}

      {dispatchResolved && treeReady && (
        <section className="mt-6">
          <h3 className="font-semibold mb-2">Review &amp; annotate</h3>
          <EvidenceTreeView draftId={draft.draft_response_id} />
          <ResponseExportDialog
            draftId={draft.draft_response_id}
            recipientName={draft.recipient_name ?? ''}
            recipientType={(draft.recipient_type ?? 'other') as import('./evidence-protocol-mirror').EvidenceRecipientType}
            sourceRunSummary={
              draft.source_run_ids?.length
                ? `${draft.source_run_ids.length} run(s)`
                : draft.bound_run_id
                  ? '1 run'
                  : 'cached'
            }
          />
        </section>
      )}
    </div>
  );
}
