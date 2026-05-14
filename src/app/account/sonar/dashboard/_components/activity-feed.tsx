'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { jsonFetcher } from '@/lib/swr-fetcher';

type Modality = 'audit' | 'watcher' | 'phantom_demand';

interface ActivityEvent {
  run_id: string;
  modality: Modality;
  status: string;
  title: string;
  summary: string;
  outcome: string | null;
  triggered_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  run_origin: string;
  detail_href: string;
}

interface FeedResponse {
  events: ActivityEvent[];
}

interface Props {
  initial: FeedResponse | null;
}

const MODALITY_LABEL: Record<Modality, string> = {
  audit: 'Audit',
  watcher: 'Watcher',
  phantom_demand: 'Phantom Demand',
};

const MODALITY_TONE: Record<Modality, string> = {
  audit: 'bg-indigo-100 text-indigo-900',
  watcher: 'bg-teal/10 text-teal-dark',
  phantom_demand: 'bg-amber-100 text-amber-900',
};

function statusTone(status: string): string {
  switch (status) {
    case 'complete':
    case 'completed':
    case 'succeeded':
      return 'bg-emerald-100 text-emerald-800';
    case 'running':
    case 'in_progress':
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

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'unknown time';
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) {
    const s = seconds - m * 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }
  const h = Math.floor(m / 60);
  const remM = m - h * 60;
  return remM === 0 ? `${h}h` : `${h}h ${remM}m`;
}

function originLabel(origin: string): string | null {
  if (origin === 'ad_hoc') return null;
  return origin.replace(/^template_/, '').replace(/_/g, ' ');
}

export function ActivityFeed({ initial }: Props) {
  const { data, error } = useSWR<FeedResponse>(
    '/api/account/sonar/dashboard/activity',
    jsonFetcher,
    {
      fallbackData: initial ?? undefined,
      refreshInterval: 30_000,
    },
  );

  if (error) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        Failed to load activity. Click refresh to retry.
      </div>
    );
  }
  const events = data?.events ?? [];
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-6 text-sm italic text-slate">
        No recent runs across modalities.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <h2 className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-charcoal">
        Recent activity
      </h2>
      <ul className="divide-y divide-slate-100">
        {events.map((e) => {
          const origin = originLabel(e.run_origin);
          return (
            <li
              key={`${e.modality}-${e.run_id}`}
              className="px-4 py-3 text-sm hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${MODALITY_TONE[e.modality]}`}
                    >
                      {MODALITY_LABEL[e.modality]}
                    </span>
                    <span className="truncate font-medium text-charcoal">{e.title}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(e.status)}`}
                    >
                      {e.status}
                    </span>
                    {e.outcome && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-charcoal">
                        {e.outcome}
                      </span>
                    )}
                    {origin && (
                      <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate">
                        {origin}
                      </span>
                    )}
                  </div>
                  {e.summary && (
                    <p className="mt-1 truncate text-xs text-slate">{e.summary}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-slate">
                  <span title={new Date(e.triggered_at).toLocaleString()}>
                    {formatRelative(e.triggered_at)}
                  </span>
                  {e.duration_seconds !== null && (
                    <span className="text-slate-500">
                      ran {formatDuration(e.duration_seconds)}
                    </span>
                  )}
                  <Link href={e.detail_href} className="text-teal hover:underline">
                    Open →
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
