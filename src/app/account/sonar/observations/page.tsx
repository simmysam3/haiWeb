import { cookies, headers } from 'next/headers';
import { PageHeader } from '@/components';
import { ObservationsClient } from './_components/observations-client';

interface ObservationsPayload {
  runs: unknown[];
  templates: unknown[];
}

async function loadPhantomDemand(): Promise<ObservationsPayload> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  try {
    const res = await fetch(
      `${proto}://${host}/api/account/sonar/observations?tab=phantom_demand`,
      { headers: { cookie: cookieHeader }, cache: 'no-store' },
    );
    if (!res.ok) return { runs: [], templates: [] };
    const data = (await res.json()) as { runs?: unknown[]; templates?: unknown[] };
    return { runs: data.runs ?? [], templates: data.templates ?? [] };
  } catch (err) {
    console.error('[observations list] fetch failed', err);
    return { runs: [], templates: [] };
  }
}

export default async function ObservationsPage() {
  const payload = await loadPhantomDemand();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phantom Demand"
        description={
          <>
            Procurement questions — ask trading partners &ldquo;if I needed N units
            of X, when could you deliver?&rdquo; without committing to an order.
          </>
        }
      />

      <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate">
        Placeholder surface. A dedicated Phantom Demand workspace is planned for the next release;
        this page will evolve into that home.
      </div>

      <ObservationsClient
        initialRuns={payload.runs}
        initialTemplates={payload.templates}
      />
    </div>
  );
}
