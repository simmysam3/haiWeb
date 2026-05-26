import { notFound } from 'next/navigation';
import { fetchBffJson } from '@/lib/server-fetch';
import type { AuditRun, AuditRunResult } from '@haiwave/protocol';
import { RunHeader } from './_components/run-header';
import { SummaryStrip } from './_components/summary-strip';
import { EvidenceTreePanel } from './_components/evidence-tree-panel';
import { DispatchedResponsesTable } from './_components/dispatched-responses-table';
import { InProgressPoller } from './_components/in-progress-poller';

interface RunDetailPayload {
  run: AuditRun;
  dispatched_responses: unknown[];
  // ISO-2 country code of the auditor's headquarters (e.g. "US"). Drives the
  // per-SKU domestic-flag badge: SKUs whose geo_rollup resolves entirely to
  // this country get a flag icon on their header row.
  auditor_country?: string;
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

  const { run, dispatched_responses, auditor_country } = runResult.data;

  // Fetch results for complete/partial runs. Distinguish a genuine empty
  // result (run completed with no evidence) from a results-fetch ERROR — the
  // latter must surface a notice rather than masquerade as an empty tree.
  let results: AuditRunResult[] = [];
  let resultsLoadFailed = false;
  if (TREE_STATUSES.has(run.status)) {
    const resultsResult = await fetchBffJson<ResultsPayload>(
      `/api/account/audit-runs/${run_id}/results`,
    );
    if (resultsResult.kind === 'ok') {
      results = resultsResult.data.results ?? [];
    } else {
      // Fetch errored — don't crash, but don't render a silently-empty tree.
      resultsLoadFailed = true;
    }
  }

  const showTree = TREE_STATUSES.has(run.status);
  const showError = ERROR_STATUSES.has(run.status);
  const isRunning = run.status === 'running';

  return (
    <div className="p-6 space-y-8">
      {/* Header: breadcrumb, audit-name title, one-sentence sub-head (origin /
          start / completion / hash), "Edit / Run Again" CTA */}
      <RunHeader run={run} />

      {/* Summary strip — only meaningful when we have results */}
      {showTree && !resultsLoadFailed && (
        <SummaryStrip run={run} results={results} />
      )}

      {/* In-progress placeholder — auto-polls the BFF and triggers a server
          re-render once the run reaches a terminal status. */}
      {isRunning && <InProgressPoller runId={run_id} />}

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
          {resultsLoadFailed ? (
            <div
              role="alert"
              className="rounded-lg border border-problem/20 bg-problem/5 px-5 py-4 text-sm text-problem"
            >
              Couldn&apos;t load the evidence tree for this run. The run
              completed, but its results couldn&apos;t be fetched — try
              refreshing the page.
            </div>
          ) : (
            <EvidenceTreePanel results={results} auditorCountry={auditor_country} />
          )}
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
