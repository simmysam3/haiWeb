import Link from 'next/link';
import { getServerHaiwaveClient } from '@/lib/server-haiwave-client';
import { PageHeader } from '@/components';
import { TemplatesTable } from './_components/templates-table';

export const dynamic = 'force-dynamic';

export default async function PhantomDemandListPage() {
  const client = await getServerHaiwaveClient();
  const templates = await client.listPhantomDemandTemplates({ limit: 100 });

  return (
    <div>
      <PageHeader
        eyebrow="Sonar"
        title="Phantom Demand"
        actions={
          <Link
            href="/account/sonar/phantom-demand/new"
            className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            + New phantom demand
          </Link>
        }
      />
      <TemplatesTable templates={templates} />
    </div>
  );
}
