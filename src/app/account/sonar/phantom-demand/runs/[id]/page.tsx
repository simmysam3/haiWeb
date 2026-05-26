import { notFound } from 'next/navigation';
import { getServerHaiwaveClient } from '@/lib/server-haiwave-client';
import { ScopeSummary } from './_components/scope-summary';
import { ProbeResultsTable } from './_components/probe-results-table';
import { CancelButton } from './_components/cancel-button';
import { Pill } from '@/components/pill';
import { PageHeader } from '@/components';
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

  const scope = run.scope_snapshot;

  return (
    <main className="space-y-6 p-6">
      <PageHeader
        eyebrow="Phantom Demand"
        title="Run"
        description={<span className="font-mono">{run.run_id}</span>}
        actions={<Pill category="run_status" value={run.status} />}
      />

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
