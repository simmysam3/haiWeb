import { cookies, headers } from 'next/headers';
import { ReportsClient } from './_components/reports-client';

type Modality = 'audit' | 'watcher' | 'phantom_demand';

interface ReportEntry {
  run_id: string;
  modality: Modality;
  name: string;
  completed_at: string | null;
  status: string;
  available_formats: Array<'html' | 'csv' | 'pdf'>;
}

interface ReportsPayload {
  reports: ReportEntry[];
}

async function loadReports(tab: Modality): Promise<ReportsPayload> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  try {
    const res = await fetch(`${proto}://${host}/api/account/sonar/reports?tab=${tab}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return { reports: [] };
    return (await res.json()) as ReportsPayload;
  } catch (err) {
    console.error('[reports list] fetch failed', err);
    return { reports: [] };
  }
}

const VALID_TABS: ReadonlySet<string> = new Set(['audit', 'watcher', 'phantom_demand']);

function normalizeTab(raw: string | string[] | undefined): Modality {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (candidate && VALID_TABS.has(candidate)) return candidate as Modality;
  return 'audit';
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; date_from?: string; date_to?: string }>;
}) {
  const params = await searchParams;
  const tab = normalizeTab(params.tab);
  const payload = await loadReports(tab);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-charcoal">Reports</h1>
        <p className="text-sm text-slate mt-1">
          Completed observation runs with downloadable reports. Switch tabs to browse by modality.
        </p>
      </header>
      <ReportsClient initialTab={tab} initialReports={payload.reports} />
    </div>
  );
}
