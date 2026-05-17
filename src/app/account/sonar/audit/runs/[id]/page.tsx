import { notFound } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import type { AuditRun, AuditRunResult } from '@haiwave/protocol';
import { RollupPanel } from './rollup-panel';
import { ProductsGrid } from './products-grid';
import { RunControls } from './run-controls';
import { RunFailureBanner } from './run-failure-banner';
import { ThrottledStatusPill } from '@/components/sonar/throttled-status-pill';
import { ThrottleBanner } from '@/components/sonar/throttle-banner';
import { ResumptionHistoryTable } from '@/components/sonar/resumption-history-table';

interface LoadOk {
  run: AuditRun;
  results: AuditRunResult[];
  resultsError: { status: number } | null;
}

async function load(runId: string): Promise<LoadOk | null> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;

  try {
    const runRes = await fetch(`${baseUrl}/api/account/audit-runs/${runId}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (runRes.status === 404) return null; // genuinely not found → notFound()
    if (!runRes.ok) {
      // Auth / 5xx — a real error, not "not found".
      throw new Error(`audit run fetch failed: ${runRes.status}`);
    }
    const run = (await runRes.json()) as AuditRun;
    if (!run?.run_id) {
      // 200 but missing run_id ⇒ broken response contract, not "not found".
      throw new Error('audit run response missing run_id (contract mismatch)');
    }

    const resultsRes = await fetch(
      `${baseUrl}/api/account/audit-runs/${runId}/results`,
      {
        headers: { cookie: cookieHeader },
        cache: 'no-store',
      },
    );

    // Distinguish "results not yet available" (200 with empty list) from a
    // real upstream failure (4xx/5xx). The latter must surface to the user
    // as a banner rather than silently rendering an empty grid that looks
    // like a successful "no results" response.
    if (resultsRes.ok) {
      const resultsData = (await resultsRes.json()) as { results?: AuditRunResult[] };
      return { run, results: resultsData.results ?? [], resultsError: null };
    }
    return { run, results: [], resultsError: { status: resultsRes.status } };
  } catch (err) {
    // Genuine 404 already returned null above; reaching here means a real
    // failure (network / auth / 5xx / contract). Surface it as an error
    // instead of a misleading not-found page.
    console.error('[runs/[id] load] fetch failed', { runId, err });
    throw err;
  }
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-charcoal">
          Run {data.run.run_id.slice(0, 8)}
        </h1>
        <p className="text-sm text-slate">
          Triggered {new Date(data.run.triggered_at).toLocaleString()}
        </p>
        <div className="flex items-center gap-3">
          <RunControls
            runId={data.run.run_id}
            initialStatus={data.run.status}
            initialHopCount={data.run.hop_count}
            initialGapCount={data.run.gap_count}
            initialResultsCount={data.results.length}
            errorMessage={data.run.error_message}
          />
          {data.run.status === 'throttled' && data.run.resumption_state && (
            <ThrottledStatusPill
              nextResumeAt={data.run.resumption_state.next_resume_at}
            />
          )}
          {data.run.status === 'complete' && (
            <Link
              href={`/account/sonar/audit/reports/${data.run.run_id}`}
              className="text-teal hover:text-navy text-sm"
            >
              View Aggregate Report →
            </Link>
          )}
        </div>
      </header>

      <RunFailureBanner
        status={data.run.status}
        errorMessage={data.run.error_message}
        resultsCount={data.results.length}
      />

      {data.resultsError && (
        <div
          role="alert"
          className="rounded-md border border-problem/20 bg-problem/5 p-4 text-sm text-problem"
        >
          Couldn&apos;t load this run&apos;s results
          {data.resultsError.status >= 500
            ? ' — the audit service is temporarily unavailable.'
            : data.resultsError.status === 403
            ? ' — you do not have permission to view this run.'
            : ` — server returned ${data.resultsError.status}.`}
        </div>
      )}

      {data.run.status === 'throttled' && data.run.resumption_state && (
        <>
          <ThrottleBanner />
          <ResumptionHistoryTable resumptionState={data.run.resumption_state} />
        </>
      )}

      <RollupPanel results={data.results} />

      <section>
        <h2 className="text-sm font-medium text-charcoal mb-2">Products</h2>
        <ProductsGrid results={data.results} />
      </section>
    </div>
  );
}
