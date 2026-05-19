'use client';

import Link from 'next/link';
import type { ThrottleHistoryRow } from './types';

interface Props { rows: ThrottleHistoryRow[]; }

const RUN_HREF: Record<ThrottleHistoryRow['observation_class'], (id: string) => string> = {
  audit: (id) => `/account/sonar/compliance/runs/${id}`,
  watcher: (id) => `/account/sonar/templates/${id}`,
  phantom_demand: (id) => `/account/sonar/phantom-demand/runs/${id}`,
};

export function ThrottleHistoryList({ rows }: Props) {
  return (
    <section className="bg-white border border-slate-200 rounded p-4">
      <h2 className="text-sm font-semibold text-charcoal uppercase tracking-wider">Throttle history (last 30 days)</h2>
      <p className="text-xs text-slate mt-1">Shows the first throttle event per run.</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate mt-2">No throttle events in the last 30 days.</p>
      ) : (
        <table className="w-full mt-2 border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate">
              <th className="py-2">Run</th>
              <th className="py-2">Throttled at</th>
              <th className="py-2">Resumes</th>
              <th className="py-2">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.run_id} className="border-b border-slate-100">
                <td className="py-2">
                  <Link href={RUN_HREF[r.observation_class](r.run_id)} className="text-teal hover:underline">
                    {r.observation_class} {r.run_id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="py-2 text-slate">{new Date(r.throttled_at).toLocaleString()}</td>
                <td className="py-2">{r.resumption_count}</td>
                <td className="py-2 text-slate">{r.current_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
