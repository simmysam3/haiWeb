'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';

interface ThrottleStatus {
  count: number;
  most_recent_modality: 'audit' | 'watcher' | 'phantom_demand' | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const DISMISS_KEY = 'haiwave.throttle.dismissed';

/**
 * ThrottleHeaderIndicator — global header banner surfacing the count of the
 * caller's currently-throttled runs. Polls `/api/account/throttle-status`
 * every 30s and links to /account/usage (deep-linked to the relevant modality
 * tab + active-runs anchor when available). Dismiss is sessionStorage-scoped,
 * so it reappears on the next browser session.
 *
 * v1.30 PR-6 Phase 8.
 */
export function ThrottleHeaderIndicator() {
  const { data } = useSWR<ThrottleStatus>('/api/account/throttle-status', fetcher, {
    refreshInterval: 30000,
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem(DISMISS_KEY) === 'true'
    ) {
      setDismissed(true);
    }
  }, []);

  if (!data || typeof data.count !== 'number' || data.count <= 0 || dismissed) return null;

  const href = data.most_recent_modality
    ? `/account/usage?tab=${data.most_recent_modality}&scrollTo=active-runs`
    : '/account/usage';

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-900 px-4 py-2 flex items-center justify-between text-sm">
      <Link href={href} className="font-medium hover:underline">
        {data.count} {data.count === 1 ? 'run' : 'runs'} throttled — view consumption
      </Link>
      <button
        onClick={() => {
          window.sessionStorage.setItem(DISMISS_KEY, 'true');
          setDismissed(true);
        }}
        className="text-yellow-700 hover:text-yellow-900"
        aria-label="Dismiss throttle alert"
      >
        ×
      </button>
    </div>
  );
}
