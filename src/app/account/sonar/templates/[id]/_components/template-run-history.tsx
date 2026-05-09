'use client';

import useSWR from 'swr';
import { jsonFetcher } from '@/lib/swr-fetcher';

interface RunRow {
  run_id: string;
  status: string;
  triggered_at: string;
  completed_at: string | null;
  run_origin: string;
}

interface RunsResponse {
  runs: RunRow[];
}

interface Props {
  templateId: string;
}

export function TemplateRunHistory({ templateId }: Props) {
  const { data, error } = useSWR<RunsResponse>(
    `/api/account/sonar/templates/${templateId}/runs`,
    jsonFetcher,
  );

  if (error) {
    return <p className="text-sm text-rose-600">Failed to load run history.</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate">Loading run history…</p>;
  }
  if (data.runs.length === 0) {
    return <p className="text-sm italic text-slate">This template hasn't been triggered yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate">Run</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate">Status</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate">Origin</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate">Triggered</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.runs.map((r) => (
            <tr key={r.run_id}>
              <td className="px-4 py-2 font-mono text-xs text-charcoal">{r.run_id}</td>
              <td className="px-4 py-2 text-charcoal">{r.status}</td>
              <td className="px-4 py-2 text-charcoal">{r.run_origin}</td>
              <td className="px-4 py-2 text-charcoal">{new Date(r.triggered_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
