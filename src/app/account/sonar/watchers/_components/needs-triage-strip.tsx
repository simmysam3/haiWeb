'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { jsonFetcher } from '@/lib/swr-fetcher';
import { Pill } from '@/components/pill';
import type { SignalType } from '@haiwave/protocol';

interface TriageAlert {
  id: string;
  signal_type: SignalType;
  watcher_name: string;
  watcher_template_id?: string;
  counterparty_name: string;
  drift_description: string;
  delta_chip: string;
  run_id: string;
}

interface AlertsResponse {
  alerts: TriageAlert[];
}

const SIGNAL_PILL: Record<SignalType, 'LT' | 'CAP' | 'DEL'> = {
  lead_time_distribution: 'LT',
  capacity_utilization_band: 'CAP',
  delivery_event: 'DEL',
};

export function NeedsTriageStrip() {
  const { data } = useSWR<AlertsResponse>(
    '/api/account/sonar/watcher/triage-alerts',
    jsonFetcher,
    { refreshInterval: 60_000, fallbackData: { alerts: [] } },
  );

  const alerts = data?.alerts ?? [];
  if (alerts.length === 0) return null;

  return (
    <section
      role="region"
      aria-label="Needs triage"
      className="rounded-md border border-rose-200 bg-rose-50/60"
    >
      <div className="flex items-center gap-2 border-b border-rose-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-rose-800">
        <span aria-hidden="true">⚠</span>
        Needs triage · {alerts.length} active drift alert
        {alerts.length === 1 ? '' : 's'}
      </div>
      <ul className="divide-y divide-rose-200/70">
        {alerts.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm text-charcoal"
          >
            <Pill category="signal_type" value={SIGNAL_PILL[a.signal_type]} />
            {a.watcher_template_id ? (
              <Link
                href={`/account/sonar/watchers/definitions/${a.watcher_template_id}`}
                className="font-medium text-teal hover:underline"
              >
                {a.watcher_name}
              </Link>
            ) : (
              <span className="font-medium">{a.watcher_name}</span>
            )}
            <span className="text-slate">·</span>
            <span>
              {a.counterparty_name} · {a.drift_description}
            </span>
            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-mono text-rose-900">
              {a.delta_chip}
            </span>
            <Link
              href={`/account/sonar/watchers/${a.run_id}`}
              className="ml-auto text-xs text-teal hover:underline"
            >
              Open ›
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
