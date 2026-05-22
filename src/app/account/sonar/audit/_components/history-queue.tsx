'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { Pill } from '@/components/pill';
import { jsonFetcher } from '@/lib/swr-fetcher';
import type { AuditRun } from '@haiwave/protocol';

interface RunsPayload {
  runs: AuditRun[];
}

interface Props {
  initialRows: AuditRun[];
}

function formatRunLabel(run: AuditRun): string {
  // template_name is not on the protocol type; the BFF may enrich it.
  const enriched = run as AuditRun & { template_name?: string | null };
  if (enriched.template_name) return enriched.template_name;
  return `Run ${run.run_id.slice(0, 8)}`;
}

function formatScopeSnapshot(run: AuditRun): string {
  const parts: string[] = [`depth ${run.depth_limit}`];
  // Key-scoped runs pin provenance_key_id on the scope snapshot.
  if (run.scope_snapshot?.provenance_key_id) {
    parts.push('key-scoped');
  } else {
    parts.push('bilateral');
  }
  return parts.join(' · ');
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'unknown';
  const diffMs = Date.now() - then;
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function HistoryQueue({ initialRows }: Props) {
  const { data, error } = useSWR<RunsPayload>(
    '/api/account/sonar/audit/runs',
    jsonFetcher,
    {
      fallbackData: { runs: initialRows },
      refreshInterval: 15_000,
    },
  );

  if (error) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        Failed to load audit history. Check your session and retry.
      </div>
    );
  }

  const runs = data?.runs ?? [];

  if (runs.length === 0) {
    return (
      <p className="text-sm text-slate italic">
        No audit runs yet. Trigger a run from a configuration or use the
        &ldquo;+ New Audit&rdquo; action above.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {/* Shared 6-col grid — kept identical to scheduled-queue for vertical alignment */}
        <colgroup>
          <col style={{ width: '28%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '8%' }} />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate">
            <th className="py-2 pr-3">Name</th>
            <th className="py-2 pr-3">Source</th>
            <th className="py-2 pr-3">Run at</th>
            <th className="py-2 pr-3">Scope</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.run_id}
              className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
            >
              <td className="py-2 pr-3">
                <Link
                  href={`/account/sonar/audit/${run.run_id}`}
                  className="text-teal hover:underline font-medium"
                >
                  {formatRunLabel(run)}
                </Link>
              </td>
              <td className="py-2 pr-3">
                {run.run_origin ? (
                  <Pill category="run_origin" value={run.run_origin} />
                ) : (
                  <span className="text-slate text-xs">—</span>
                )}
              </td>
              <td
                className="py-2 pr-3 text-slate text-xs"
                title={new Date(run.triggered_at).toLocaleString()}
              >
                {formatRelative(run.triggered_at)}
              </td>
              <td className="py-2 pr-3 text-slate text-xs">
                {formatScopeSnapshot(run)}
              </td>
              <td className="py-2 pr-3">
                <Pill
                  category="run_status"
                  value={run.status}
                  detail={run.error_message ?? undefined}
                />
              </td>
              <td className="py-2">
                <Link
                  href={`/account/sonar/audit/${run.run_id}`}
                  className="text-xs text-teal hover:underline"
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
