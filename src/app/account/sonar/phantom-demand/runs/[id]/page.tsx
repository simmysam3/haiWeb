import { notFound } from 'next/navigation';
import { getServerHaiwaveClient } from '@/lib/server-haiwave-client';
import { PageHeader } from '@/components';
import { SpotCheckBanner } from '@/components/sonar/phantom-demand';
import { RunDetailShell } from './_components/run-detail-shell';
import type { PhantomDemandRunDetail } from '@/lib/haiwave-api';

export default async function Page({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = params instanceof Promise ? await params : params;

  let detail: PhantomDemandRunDetail;
  try {
    const client = await getServerHaiwaveClient();
    detail = await client.getPhantomDemandRun(id);
  } catch (err) {
    if ((err as { status?: number }).status === 404) notFound();
    console.error('[pd-run-detail] fetch failed', { id, err });
    throw err;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Phantom Demand"
        title={`Run ${id.slice(0, 8)}`}
      />
      <SpotCheckBanner capturedAt={detail.run.completed_at ?? detail.run.created_at} />
      <RunDetailShell initialDetail={detail} />
    </div>
  );
}
