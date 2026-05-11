'use client';

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

const TABS: { id: Modality; label: string }[] = [
  { id: 'audit', label: 'Audit' },
  { id: 'watcher', label: 'Watcher' },
  { id: 'phantom_demand', label: 'Phantom Demand' },
];

const RUN_DETAIL_HREF: Record<Modality, (runId: string) => string> = {
  audit: (id) => `/account/sonar/audit/reports/${id}`,
  watcher: () => `/account/sonar/watcher/dashboard`,
  phantom_demand: (id) => `/account/sonar/phantom-demand/runs/${id}`,
};

const REPORT_DOWNLOAD_URL: Record<Modality, (runId: string, format: ReportFormat) => string> = {
  audit: (id, fmt) => `/api/v1/sonar/audit/reports/${id}/aggregate?format=${fmt}`,
  watcher: () => '#',
  phantom_demand: (id, fmt) => `/api/v1/sonar/phantom-demand/runs/${id}/report?format=${fmt}`,
};

export function ReportsClient({ initialTab, initialReports }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function changeTab(next: Modality) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    params.delete('status');
    params.delete('date_from');
    params.delete('date_to');
    router.push(`${pathname}?${params.toString()}`);
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

      {initialReports.length === 0 ? (
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
              <th className="py-2">Completed</th>
              <th className="py-2">Status</th>
              <th className="py-2 text-right">Download</th>
            </tr>
          </thead>
          <tbody>
            {initialReports.map((r) => (
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

function FormatDropdown({
  runId,
  modality,
  formats,
}: {
  runId: string;
  modality: Modality;
  formats: ReportFormat[];
}) {
  return (
    <select
      onChange={(e) => {
        const format = e.target.value as ReportFormat | '';
        if (!format) return;
        const url = REPORT_DOWNLOAD_URL[modality](runId, format);
        if (url !== '#') {
          window.open(url, '_blank');
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
