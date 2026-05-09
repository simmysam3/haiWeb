'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { jsonFetcher } from '@/lib/swr-fetcher';

type Modality = 'audit' | 'type2' | 'phantom_demand';

interface ActivityEvent {
  run_id: string;
  modality: Modality;
  status: string;
  triggered_at: string;
  completed_at: string | null;
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
  type2: 'Type 2',
  phantom_demand: 'Phantom Demand',
};

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
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
        {events.map((e) => (
          <li key={`${e.modality}-${e.run_id}`} className="flex items-center justify-between px-4 py-2 text-sm">
            <div className="flex items-center gap-3">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-charcoal">
                {MODALITY_LABEL[e.modality]}
              </span>
              <span className="text-xs text-slate">{e.status}</span>
              {e.run_origin !== 'ad_hoc' && (
                <span className="text-xs text-teal">{e.run_origin}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate">
              <span>{formatRelative(e.triggered_at)}</span>
              <Link href={e.detail_href} className="text-teal hover:underline">
                Open →
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
