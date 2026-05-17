import { notFound } from 'next/navigation';
import { getServerHaiwaveClient } from '@/lib/server-haiwave-client';
import { ScopeSummary } from './_components/scope-summary';
import { ProbeResultsTable } from './_components/probe-results-table';
import { CancelButton } from './_components/cancel-button';
import { Pill } from '@/components/pill';
import type { PhantomDemandRunDetail } from '@/lib/haiwave-api';

export default async function Page({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = params instanceof Promise ? await params : params;

  let run: PhantomDemandRunDetail;
  try {
    const client = await getServerHaiwaveClient();
    run = await client.getPhantomDemandRun(id);
  } catch (err) {
    // Only a genuine "run not found / not owned" (haiCore 404) should render
    // the not-found page. Anything else — auth, 5xx, network, a broken
    // response contract — is a real failure: log it and let it surface as an
    // error (500), not a misleading 404. A bare `catch { notFound() }` here
    // previously masked a camelCase-contract bug as "not found".
    if ((err as { status?: number }).status === 404) notFound();
    console.error('[pd-run-detail] fetch failed', { id, err });
    throw err;
  }

  const scope = run.scope_snapshot as {
    kind: 'phantom_demand';
    counterparty: string;
    skus: string[];
    hypothetical_quantity: number;
    hypothetical_timeline: string | null;
  };

  return (
    <main className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-charcoal">
            Phantom Demand Run
          </h1>
          <p className="text-sm text-slate font-mono">{run.run_id}</p>
        </div>
        <Pill category="run_status" value={run.status} />
      </header>

      <ScopeSummary scope={scope} />

      <ProbeResultsTable
        results={run.results}
        ask={{
          hypothetical_quantity: scope.hypothetical_quantity,
          hypothetical_timeline: scope.hypothetical_timeline,
        }}
      />

      {run.status === 'running' && (
        <CancelButton runId={run.run_id} />
      )}
    </main>
  );
}
