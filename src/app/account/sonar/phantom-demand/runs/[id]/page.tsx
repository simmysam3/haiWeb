import { notFound } from 'next/navigation';
import { getServerHaiwaveClient } from '@/lib/server-haiwave-client';
import { PageHeader } from '@/components';
import { SpotCheckBanner } from '@/components/sonar/phantom-demand';
import { RunDetailShell } from './_components/run-detail-shell';
import type { PhantomDemandRunDetail } from '@/lib/haiwave-api';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await getServerHaiwaveClient();
  let detail: PhantomDemandRunDetail;
  try {
    detail = await client.getPhantomDemandRun(id);
  } catch (err) {
    if ((err as { status?: number }).status === 404) notFound();
    console.error('[pd-run-detail] fetch failed', { id, err });
    throw err;
  }

  // Title = the named Phantom Demand request + short run id. Falls back to the
  // run id alone for ad-hoc runs (no template) or if the request was deleted.
  const shortId = id.slice(0, 8);
  let requestName: string | null = null;
  if (detail.run.template_id) {
    try {
      const { template } = await client.getRunTemplate(detail.run.template_id);
      requestName = template.template_name;
    } catch {
      // request unavailable (deleted, etc.) — fall back to the run id alone
    }
  }
  const title = requestName ? `${requestName} · ${shortId}` : `Run ${shortId}`;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Phantom Demand" title={title} />
      <SpotCheckBanner capturedAt={detail.run.completed_at ?? detail.run.created_at} />
      <RunDetailShell initialDetail={detail} />
    </div>
  );
}
