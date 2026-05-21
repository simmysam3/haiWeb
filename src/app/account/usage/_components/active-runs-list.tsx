'use client';

import Link from 'next/link';
import type { ActiveRunRow } from './types';

interface Props { rows: ActiveRunRow[]; }

const RUN_HREF: Record<ActiveRunRow['observation_class'], (id: string) => string> = {
  audit: (id) => `/account/sonar/posture/runs/${id}`,
  watcher: (id) => `/account/sonar/templates/${id}`,
  phantom_demand: (id) => `/account/sonar/phantom-demand/runs/${id}`,
};

export function ActiveRunsList({ rows }: Props) {
  return (
    <section className="bg-white border border-slate-200 rounded p-4">
      <h2 className="text-sm font-semibold text-charcoal uppercase tracking-wider">Active runs</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate mt-2">No active runs.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.map((r) => (
            <li key={r.run_id} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
              <Link href={RUN_HREF[r.observation_class](r.run_id)} className="text-teal hover:underline text-sm">
                {r.observation_class} {r.run_id.slice(0, 8)}…
              </Link>
              <span className={`text-xs px-2 py-0.5 rounded ${r.status === 'throttled' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                {r.status} ({r.hops_consumed} hops)
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
