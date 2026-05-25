'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { Pill } from '@/components/pill';
import { jsonFetcher } from '@/lib/swr-fetcher';
import type { AuditRun } from '@haiwave/protocol';
import { FLAG_COMPONENTS } from '../_lib/country-flags';

// Enriched shape returned by the list BFF. The protocol AuditRun envelope
// has none of these — they're added route-side and carried as optional
// fields so older callers still parse cleanly.
type EnrichedAuditRun = AuditRun & {
  template_name?: string;
  domestic_count?: number | null;
  total_count?: number | null;
};

interface RunsPayload {
  runs: EnrichedAuditRun[];
  auditor_country?: string;
}

interface Props {
  initialRows: AuditRun[];
}

function formatRunLabel(run: EnrichedAuditRun): string {
  if (run.template_name) return run.template_name;
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
  const auditorCountry = data?.auditor_country;
  const FlagComponent = auditorCountry ? FLAG_COMPONENTS[auditorCountry] : undefined;

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
        {/* Shared 7-col grid — kept identical to scheduled-queue for vertical alignment */}
        <colgroup>
          <col style={{ width: '26%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '8%' }} />
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate">
            <th className="py-2 pr-3">Name</th>
            <th className="py-2 pr-3">Source</th>
            <th className="py-2 pr-3">Run at</th>
            <th className="py-2 pr-3">Scope</th>
            <th className="py-2 pr-3" title="SKUs whose components fully resolved to your home country / total SKUs in the run">
              Domestic
            </th>
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
              <td className="py-2 pr-3 text-xs">
                {/* Domestic indicator: shows flag + X/Y for runs that produced
                    results. "—" for runs that have no results yet (running /
                    failed / cancelled / throttled) or when the BFF couldn't
                    compute the counts. */}
                {run.total_count != null && run.total_count > 0 ? (
                  <span
                    className="inline-flex items-center gap-1.5 text-charcoal"
                    title={
                      auditorCountry
                        ? `${run.domestic_count ?? 0} of ${run.total_count} SKUs fully resolved as ${auditorCountry}-origin`
                        : `${run.total_count} SKUs (auditor country unknown)`
                    }
                  >
                    {FlagComponent && (
                      <FlagComponent className="h-3 w-auto rounded-sm shadow-sm" />
                    )}
                    <span className="font-mono">
                      {run.domestic_count ?? 0}/{run.total_count}
                    </span>
                  </span>
                ) : (
                  <span className="text-slate">—</span>
                )}
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
