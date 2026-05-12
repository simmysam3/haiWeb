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

interface FilterParams {
  status?: string;
  date_from?: string;
  date_to?: string;
}

type LoadReportsResult =
  | { kind: 'ok'; payload: ReportsPayload }
  | { kind: 'forbidden' };

async function loadReports(tab: Modality, filters: FilterParams): Promise<LoadReportsResult> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';

  const qs = new URLSearchParams({ tab });
  if (filters.status) qs.set('status', filters.status);
  if (filters.date_from) qs.set('date_from', filters.date_from);
  if (filters.date_to) qs.set('date_to', filters.date_to);

  const res = await fetch(`${proto}://${host}/api/account/sonar/reports?${qs.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (res.status === 403) {
    // Surfaced via the per-modality scope check landed in haiCore PR-7
    // (#31 C4) — e.g. a user without `watcher:read` clicking the Watcher
    // tab. Show an inline permissions message instead of falling through to
    // the generic error boundary or (worse) a silent empty-state fallback.
    return { kind: 'forbidden' };
  }
  if (!res.ok) {
    // Distinct error state vs empty state (review #20 I1). Surface a real
    // error so Next's error boundary handles it instead of rendering the
    // "No reports yet" empty-state UI for what is actually a 4xx/5xx.
    throw new Error(`reports list fetch failed: ${res.status} ${res.statusText}`);
  }
  return { kind: 'ok', payload: (await res.json()) as ReportsPayload };
}

const SCOPE_HINT: Record<Modality, string> = {
  audit: '`audit:read`',
  watcher: '`watcher:read`',
  phantom_demand: '`phantom_demand:read`',
};

const VALID_TABS: ReadonlySet<string> = new Set(['audit', 'watcher', 'phantom_demand']);

function normalizeTab(raw: string | string[] | undefined): Modality {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (candidate && VALID_TABS.has(candidate)) return candidate as Modality;
  return 'audit';
}

function firstString(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; date_from?: string; date_to?: string }>;
}) {
  const params = await searchParams;
  const tab = normalizeTab(params.tab);
  const filters: FilterParams = {
    status: firstString(params.status),
    date_from: firstString(params.date_from),
    date_to: firstString(params.date_to),
  };
  const result = await loadReports(tab, filters);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-charcoal">Reports</h1>
        <p className="text-sm text-slate mt-1">
          Completed observation runs with downloadable reports. Switch tabs to browse by modality.
        </p>
      </header>
      {result.kind === 'forbidden' ? (
        <div
          role="alert"
          className="border border-amber-200 bg-amber-50 rounded p-6"
        >
          <h2 className="text-base font-semibold text-charcoal">No access to this modality</h2>
          <p className="text-sm text-slate mt-2">
            Your account is missing the {SCOPE_HINT[tab]} scope required to view{' '}
            {tab === 'phantom_demand' ? 'phantom demand' : tab} reports. Contact your
            workspace admin to request it.
          </p>
        </div>
      ) : (
        <ReportsClient initialTab={tab} initialReports={result.payload.reports} />
      )}
    </div>
  );
}
