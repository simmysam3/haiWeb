'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { jsonFetcher } from '@/lib/swr-fetcher';
import { formatRelative } from '@/components/sonar/observations';
import { configNoun } from '../../_lib/config-noun';
import { runDetailHref } from '../../_lib/run-detail-href';

type ObservationClass = 'audit' | 'watcher' | 'phantom_demand';

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
  observationClass: ObservationClass;
}

const IN_FLIGHT_STATES = new Set(['running', 'in_progress', 'pending', 'throttled']);

function isInFlight(status: string): boolean {
  return IN_FLIGHT_STATES.has(status);
}

function statusTone(status: string): string {
  switch (status) {
    case 'complete':
    case 'completed':
    case 'succeeded':
      return 'bg-emerald-100 text-emerald-800';
    case 'running':
    case 'in_progress':
    case 'pending':
      return 'bg-sky-100 text-sky-800';
    case 'throttled':
    case 'partial':
      return 'bg-amber-100 text-amber-800';
    case 'failed':
    case 'cancelled':
    case 'canceled':
      return 'bg-rose-100 text-rose-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}

function formatDuration(triggeredAt: string, completedAt: string | null): string {
  if (!completedAt) return '—';
  const start = new Date(triggeredAt).getTime();
  const end = new Date(completedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '—';
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) {
    const s = seconds - m * 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }
  const h = Math.floor(m / 60);
  return `${h}h ${m - h * 60}m`;
}

function originLabel(origin: string): string {
  return origin.replace(/^template_/, '').replace(/_/g, ' ');
}

export function TemplateRunHistory({ templateId, observationClass }: Props) {
  const { data, error } = useSWR<RunsResponse>(
    `/api/account/sonar/templates/${templateId}/runs`,
    jsonFetcher,
    {
      // Poll every 5s when any run is in flight, else every 30s. Cheap on
      // the BFF (the template runs route is a single SQL select).
      refreshInterval: (latest) =>
        latest?.runs?.some((r) => isInFlight(r.status)) ? 5_000 : 30_000,
    },
  );

  if (error) {
    return <p className="text-sm text-rose-600">Failed to load run history.</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate">Loading run history…</p>;
  }
  if (data.runs.length === 0) {
    return (
      <p className="text-sm italic text-slate">
        This {configNoun(observationClass).toLowerCase()} hasn&apos;t been triggered yet.
      </p>
    );
  }

  const inFlight = data.runs.filter((r) => isInFlight(r.status));

  return (
    <div className="space-y-2">
      {inFlight.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900"
        >
          <span
            className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-500"
            aria-hidden
          />
          {inFlight.length === 1
            ? '1 run in progress — refreshing every 5s'
            : `${inFlight.length} runs in progress — refreshing every 5s`}
        </div>
      )}
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate">Run</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate">Status</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate">Triggered</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate">Duration</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate">Origin</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.runs.map((r) => {
              const live = isInFlight(r.status);
              return (
                <tr key={r.run_id} className={live ? 'bg-sky-50/40' : undefined}>
                  <td className="px-4 py-2 font-mono text-xs text-charcoal" title={r.run_id}>
                    {r.run_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td
                    className="px-4 py-2 text-charcoal text-xs"
                    title={new Date(r.triggered_at).toLocaleString()}
                  >
                    {formatRelative(r.triggered_at)}
                  </td>
                  <td className="px-4 py-2 text-xs text-charcoal">
                    {formatDuration(r.triggered_at, r.completed_at)}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate">
                    {originLabel(r.run_origin)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={runDetailHref(observationClass, r.run_id)}
                      className="text-xs text-teal hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
