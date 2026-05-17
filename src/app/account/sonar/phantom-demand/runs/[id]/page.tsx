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
  } catch {
    notFound();
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

      <ProbeResultsTable results={run.results} />

      {run.status === 'running' && (
        <CancelButton runId={run.run_id} />
      )}
    </main>
  );
}
