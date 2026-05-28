import { notFound } from 'next/navigation';
import { getServerHaiwaveClient } from '@/lib/server-haiwave-client';
import { PageHeader } from '@/components';
import { TemplateDetail } from './_components/template-detail';

export default async function Page({
  params,
}: {
  params: { template_id: string } | Promise<{ template_id: string }>;
}) {
  const { template_id } = params instanceof Promise ? await params : params;

  let detail;
  try {
    const client = await getServerHaiwaveClient();
    detail = await client.getRunTemplate(template_id);
  } catch (err) {
    if ((err as { status?: number }).status === 404) notFound();
    throw err;
  }

  return (
    <div>
      <PageHeader eyebrow="Phantom Demand" title={detail.template.template_name} />
      <TemplateDetail template={detail.template} />
    </div>
  );
}
