import { notFound } from 'next/navigation';
import { fetchBffJson } from '@/lib/server-fetch';
import type { AuditRun, AuditRunResult } from '@haiwave/protocol';
import { RunHeader } from './_components/run-header';
import { SummaryStrip } from './_components/summary-strip';
import { EvidenceTreePanel } from './_components/evidence-tree-panel';
import { DispatchedResponsesTable } from './_components/dispatched-responses-table';

// result_hash is an additive enrichment added in v1.38 — it lives in the DB
// and is passed through the BFF but is not yet in AuditRunSchema.  Treat it
// as optional so the page degrades cleanly when the field is absent.
type AuditRunWire = AuditRun & { result_hash?: string | null };

interface RunDetailPayload {
  run: AuditRunWire;
  dispatched_responses: unknown[];
}

interface ResultsPayload {
  results: AuditRunResult[];
}

// Statuses that have a result tree to display
const TREE_STATUSES = new Set(['complete', 'partial']);

// Statuses where the run is terminal-error (no tree, but show error)
const ERROR_STATUSES = new Set(['failed', 'cancelled', 'throttled']);

export default async function AuditRunDetailPage({
  params,
}: {
  params: Promise<{ run_id: string }>;
}) {
  const { run_id } = await params;

  // Task 6 BFF — returns { run, dispatched_responses }
  const runResult = await fetchBffJson<RunDetailPayload>(
    `/api/account/sonar/audit/runs/${run_id}`,
  );

  if (runResult.kind === 'error') {
    if (runResult.status === 404) notFound();
    // For auth / server errors, also surface notFound so we don't leak info
    notFound();
  }

  const { run, dispatched_responses } = runResult.data;

  // Fetch results for complete/partial runs (best-effort: no results = empty tree)
  let results: AuditRunResult[] = [];
  if (TREE_STATUSES.has(run.status)) {
    const resultsResult = await fetchBffJson<ResultsPayload>(
      `/api/account/audit-runs/${run_id}/results`,
    );
    if (resultsResult.kind === 'ok') {
      results = resultsResult.data.results ?? [];
    }
    // On error: keep results = [] so the tree renders empty rather than throwing
  }

  const showTree = TREE_STATUSES.has(run.status);
  const showError = ERROR_STATUSES.has(run.status);
  const isRunning = run.status === 'running';

  return (
    <div className="p-6 space-y-8">
      {/* Header: breadcrumb, title, status pill, run-at, source pill, hash, "Run again" */}
      <RunHeader run={run} />

      {/* Summary strip — only meaningful when we have results */}
      {showTree && (
        <SummaryStrip run={run} results={results} />
      )}

      {/* In-progress placeholder */}
      {isRunning && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-teal/20 bg-teal/5 px-5 py-8 text-center text-sm text-teal"
        >
          Run in progress… Results will appear here when the run completes.
        </div>
      )}

      {/* Error / cancelled / throttled state */}
      {showError && (
        <div
          role="alert"
          className="rounded-lg border border-problem/20 bg-problem/5 px-5 py-4 text-sm text-problem"
        >
          {run.status === 'throttled'
            ? 'This run was throttled (hop budget exhausted). It may resume automatically.'
            : run.status === 'cancelled'
            ? 'This run was cancelled before completing.'
            : 'This run failed before completing.'}
          {run.error_message && (
            <p className="mt-1 font-mono text-xs">{run.error_message}</p>
          )}
        </div>
      )}

      {/* Full-width evidence tree — read-only, no annotation drawer (§6a) */}
      {showTree && (
        <section aria-labelledby="tree-heading" className="space-y-3">
          <h2
            id="tree-heading"
            className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
          >
            Evidence tree
          </h2>
          <EvidenceTreePanel results={results} />
        </section>
      )}

      {/* Dispatched responses — always rendered (always empty in v.1.39, §6a) */}
      <DispatchedResponsesTable rows={dispatched_responses as never[]} />

      {/* Footer: run_id + full result_hash + completion timestamp */}
      <footer className="border-t border-slate/10 pt-4 space-y-0.5 text-[10px] text-slate font-mono">
        <div>
          <span className="font-sans font-semibold uppercase tracking-wide mr-1.5">Run ID</span>
          {run.run_id}
        </div>
        {run.result_hash && (
          <div>
            <span className="font-sans font-semibold uppercase tracking-wide mr-1.5">Hash</span>
            {run.result_hash}
          </div>
        )}
        {run.completed_at && (
          <div>
            <span className="font-sans font-semibold uppercase tracking-wide mr-1.5">Completed</span>
            {new Date(run.completed_at).toLocaleString()}
          </div>
        )}
        {run.cancelled_at && (
          <div>
            <span className="font-sans font-semibold uppercase tracking-wide mr-1.5">Cancelled</span>
            {new Date(run.cancelled_at).toLocaleString()}
          </div>
        )}
      </footer>
    </div>
  );
}
