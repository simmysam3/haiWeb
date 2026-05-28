'use client';

import { useState, useMemo } from 'react';
import { Pill } from '@/components/pill';

export interface PostureRow {
  counterparty_id: string;
  counterparty_name: string;
  signals_shared: ('LT' | 'CAP' | 'DEL')[];
  latest_p50: number | null;
  delta_pct: number | null;
  gap_count: number;
  total_runs: number;
  cumulative_score: number;
  drift?: boolean;
}

type SortKey = 'cumulative_score' | 'counterparty_name' | 'gap_count';

interface Props {
  rows: PostureRow[];
}

function deltaChip(delta: number | null): string {
  if (delta === null) return '—';
  if (delta > 5) return `↑ +${Math.round(delta)}%`;
  if (delta < -5) return `↓ ${Math.round(delta)}%`;
  return '↔ stable';
}

export function PerCounterpartyPostureTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('cumulative_score');
  const sorted = useMemo(() => {
    const s = [...rows];
    s.sort((a, b) => {
      if (sortKey === 'counterparty_name')
        return a.counterparty_name.localeCompare(b.counterparty_name);
      if (sortKey === 'gap_count') return b.gap_count - a.gap_count;
      return b.cumulative_score - a.cumulative_score;
    });
    return s;
  }, [rows, sortKey]);

  if (rows.length === 0) {
    return (
      <p className="text-sm italic text-slate">
        No counterparties yet — no runs have completed.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate">
            <th
              role="button"
              tabIndex={0}
              onClick={() => setSortKey('counterparty_name')}
              className="py-2 pr-3 cursor-pointer hover:text-charcoal"
            >
              Counterparty
            </th>
            <th className="py-2 pr-3">Signals shared</th>
            <th className="py-2 pr-3">Latest calibrated LT</th>
            <th className="py-2 pr-3">Trend</th>
            <th
              role="button"
              tabIndex={0}
              onClick={() => setSortKey('gap_count')}
              className="py-2 pr-3 cursor-pointer hover:text-charcoal"
            >
              Gap history
            </th>
            <th
              role="button"
              tabIndex={0}
              onClick={() => setSortKey('cumulative_score')}
              className="py-2 pr-3 cursor-pointer hover:text-charcoal"
            >
              Cumulative score
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.counterparty_id}
              className={`border-b border-slate-100 ${
                r.drift ? 'bg-rose-50/70' : 'hover:bg-slate-50/50'
              }`}
            >
              <td className="py-2 pr-3 font-medium text-charcoal">
                {r.counterparty_name}
              </td>
              <td className="py-2 pr-3">
                {r.signals_shared.length === 0 ? (
                  <span className="text-slate italic">no signals shared</span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    {r.signals_shared.map((s) => (
                      <Pill key={s} category="signal_type" value={s} />
                    ))}
                  </span>
                )}
              </td>
              <td className="py-2 pr-3 font-mono text-charcoal">
                {r.latest_p50 === null ? '—' : `${r.latest_p50}d`}{' '}
                <span className="text-xs text-slate">{deltaChip(r.delta_pct)}</span>
              </td>
              <td className="py-2 pr-3 text-slate text-xs">
                <span className="text-slate">—</span>
              </td>
              <td className="py-2 pr-3 text-xs">
                {r.gap_count} / {r.total_runs}
                {r.gap_count === r.total_runs && r.total_runs > 0 && (
                  <span className="ml-1 text-slate">(always redacted)</span>
                )}
              </td>
              <td className="py-2 pr-3 font-mono">{r.cumulative_score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
