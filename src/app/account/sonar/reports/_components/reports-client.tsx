'use client';

import { useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type Modality = 'audit' | 'watcher' | 'phantom_demand';
type ReportFormat = 'html' | 'csv' | 'pdf';

interface ReportEntry {
  run_id: string;
  modality: Modality;
  name: string;
  completed_at: string | null;
  status: string;
  available_formats: ReportFormat[];
}

interface Props {
  initialTab: Modality;
  initialReports: ReportEntry[];
}

type SortKey = 'completed_at' | 'modality' | 'status';
type SortDir = 'asc' | 'desc';

const TABS: { id: Modality; label: string }[] = [
  { id: 'audit', label: 'Audit' },
  { id: 'watcher', label: 'Watcher' },
  { id: 'phantom_demand', label: 'Phantom Demand' },
];

const RUN_DETAIL_HREF: Record<Modality, (runId: string) => string> = {
  audit: (id) => `/account/sonar/reports/${id}`,
  watcher: () => `/account/sonar/watcher/dashboard`,
  phantom_demand: (id) => `/account/sonar/phantom-demand/runs/${id}`,
};

// Download URLs target HaiWeb BFF routes (NOT the haiCore Fastify origin —
// the browser can't reach Fastify directly and haiCore uses Accept-header
// negotiation, not a `?format=` querystring). The BFF translates the
// `?format=` querystring into the appropriate Accept header before
// forwarding to haiCore. Mirrors `src/app/account/sonar/reports/[run_id]/_components/download-menu.tsx`.
//
// watcher + phantom_demand have no per-run report endpoint in v1.30
// (deferred — see as-built §14.25); their `available_formats` arrive from
// the service as `[]` so this dropdown is not rendered for those rows.
// The functions remain as defensive placeholders that return '#'.
const REPORT_DOWNLOAD_URL: Record<Modality, (runId: string, format: ReportFormat) => string> = {
  audit: (id, fmt) => `/api/account/sonar/audit/reports/${id}/aggregate?format=${fmt}`,
  watcher: () => '#',
  phantom_demand: () => '#',
};

const SORT_VALUE: Record<SortKey, (r: ReportEntry) => string> = {
  completed_at: (r) => r.completed_at ?? '',
  modality: (r) => r.modality,
  status: (r) => r.status,
};

function compareReports(a: ReportEntry, b: ReportEntry, key: SortKey, dir: SortDir): number {
  const av = SORT_VALUE[key](a);
  const bv = SORT_VALUE[key](b);
  if (av === bv) return 0;
  const cmp = av < bv ? -1 : 1;
  return dir === 'asc' ? cmp : -cmp;
}

export function ReportsClient({ initialTab, initialReports }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Default sort: most recently completed first.
  const [sortKey, setSortKey] = useState<SortKey>('completed_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sortedReports = useMemo(() => {
    // Defensive copy: never mutate the caller's array.
    return [...initialReports].sort((a, b) => compareReports(a, b, sortKey, sortDir));
  }, [initialReports, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'completed_at' ? 'desc' : 'asc');
    }
  }

  function changeTab(next: Modality) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    params.delete('status');
    params.delete('date_from');
    params.delete('date_to');
    router.push(`${pathname}?${params.toString()}`);
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Report modalities" className="flex border-b border-slate-200">
        {TABS.map((t) => {
          const selected = t.id === initialTab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => changeTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                selected ? 'border-teal text-teal' : 'border-transparent text-slate hover:text-charcoal'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {sortedReports.length === 0 ? (
        <div className="border border-dashed rounded p-8 text-center">
          <h2 className="text-base font-semibold text-charcoal">No reports yet</h2>
          <p className="text-sm text-slate mt-1">
            Completed {initialTab} runs will appear here with downloadable reports.
          </p>
        </div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate">
              <th className="py-2">Name</th>
              <th className="py-2">
                <button
                  type="button"
                  onClick={() => toggleSort('completed_at')}
                  aria-sort={sortKey === 'completed_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="uppercase text-xs text-slate hover:text-charcoal"
                >
                  Completed{sortIndicator('completed_at')}
                </button>
              </th>
              <th className="py-2">
                <button
                  type="button"
                  onClick={() => toggleSort('status')}
                  aria-sort={sortKey === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="uppercase text-xs text-slate hover:text-charcoal"
                >
                  Status{sortIndicator('status')}
                </button>
              </th>
              <th className="py-2 text-right">Download</th>
            </tr>
          </thead>
          <tbody>
            {sortedReports.map((r) => (
              <tr key={r.run_id} className="border-b border-slate-100">
                <td className="py-2">
                  <Link
                    href={RUN_DETAIL_HREF[r.modality](r.run_id)}
                    className="text-teal hover:underline"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="py-2 text-slate">
                  {r.completed_at ? new Date(r.completed_at).toLocaleString() : '—'}
                </td>
                <td className="py-2 text-slate">{r.status}</td>
                <td className="py-2 text-right">
                  {r.available_formats.length === 0 ? (
                    <span className="text-xs text-slate">no report</span>
                  ) : (
                    <FormatDropdown
                      runId={r.run_id}
                      modality={r.modality}
                      formats={r.available_formats}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function FormatDropdown({
  runId,
  modality,
  formats,
}: {
  runId: string;
  modality: Modality;
  formats: ReportFormat[];
}) {
  if (formats.length === 0) {
    return <span className="text-xs text-slate">no report</span>;
  }
  return (
    <select
      onChange={(e) => {
        const format = e.target.value as ReportFormat | '';
        if (!format) return;
        const url = REPORT_DOWNLOAD_URL[modality](runId, format);
        if (url !== '#') {
          // noopener/noreferrer: the download tab must not be able to
          // window.opener back into the portal (review #20 I4).
          window.open(url, '_blank', 'noopener,noreferrer');
        }
        e.target.value = '';
      }}
      defaultValue=""
      className="text-xs border border-slate-200 rounded px-2 py-1"
    >
      <option value="" disabled>Download…</option>
      {formats.map((f) => (
        <option key={f} value={f}>{f.toUpperCase()}</option>
      ))}
    </select>
  );
}
