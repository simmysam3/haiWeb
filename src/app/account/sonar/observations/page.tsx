import { cookies, headers } from 'next/headers';
import type { ObservationClass } from '@haiwave/protocol';
import { ObservationsClient } from './_components/observations-client';

interface ObservationsPayload {
  tab: ObservationClass;
  runs: unknown[];
  templates: unknown[];
}

async function loadObservations(tab: ObservationClass): Promise<ObservationsPayload> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  try {
    const res = await fetch(`${proto}://${host}/api/account/sonar/observations?tab=${tab}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return { tab, runs: [], templates: [] };
    return (await res.json()) as ObservationsPayload;
  } catch (err) {
    console.error('[observations list] fetch failed', err);
    return { tab, runs: [], templates: [] };
  }
}

const VALID_TABS: ReadonlySet<string> = new Set(['audit', 'watcher', 'phantom_demand']);

function normalizeTab(raw: string | string[] | undefined): ObservationClass {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (candidate && VALID_TABS.has(candidate)) return candidate as ObservationClass;
  return 'audit';
}

export default async function ObservationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    date_range?: string;
    search?: string;
    counterparty?: string;
  }>;
}) {
  const params = await searchParams;
  const tab = normalizeTab(params.tab);
  const payload = await loadObservations(tab);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-charcoal">Observations</h1>
        <p className="text-sm text-slate mt-1">
          Unified view of audit, Watcher, and Phantom Demand runs + templates.
          Use the tabs to switch modalities.
        </p>
      </header>

      <ObservationsClient
        initialTab={tab}
        initialRuns={payload.runs}
        initialTemplates={payload.templates}
      />
    </div>
  );
}
