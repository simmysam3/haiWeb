'use client';

import { useState, useMemo } from 'react';
import { RiskPill } from './risk-pill';

type Color = 'green' | 'yellow' | 'red';
type Label = 'normal' | 'elevated' | 'critical';

export interface CrossModalityPartner {
  partner_id: string;
  partner_name: string;
  audit: { compliant: number; partial: number; non_compliant: number; total: number } | null;
  phantom_demand: { response_rate: number; window_id: string } | null;
  watcher: { capacity_band: 'low' | 'moderate' | 'high' | 'at_capacity' | null; lead_time_p90_days: number | null } | null;
  risk_score: number;
  risk_color: Color;
  risk_label: Label;
}

interface Props {
  partners: CrossModalityPartner[];
}

type SortKey = 'partner' | 'audit' | 'pd' | 'capacity' | 'lead_time' | 'risk';

function compareNullable(a: number | null, b: number | null, dir: 'asc' | 'desc'): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === 'asc' ? a - b : b - a;
}

interface HeaderButtonProps {
  k: SortKey;
  children: React.ReactNode;
  sortKey: SortKey;
  dir: 'asc' | 'desc';
  onClick: (k: SortKey) => void;
}

function HeaderButton({ k, children, sortKey, dir, onClick }: HeaderButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(k)}
      className="text-left text-xs font-semibold uppercase tracking-wide text-slate hover:text-charcoal"
    >
      {children} {sortKey === k ? (dir === 'asc' ? '↑' : '↓') : ''}
    </button>
  );
}

export function CrossModalityTable({ partners }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('risk');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const onHeaderClick = (key: SortKey) => {
    if (key === sortKey) setDir(dir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setDir(key === 'partner' ? 'asc' : 'desc');
    }
  };

  const sorted = useMemo(() => {
    const copy = [...partners];
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'partner':
          return dir === 'asc'
            ? a.partner_name.localeCompare(b.partner_name)
            : b.partner_name.localeCompare(a.partner_name);
        case 'audit':
          return compareNullable(a.audit?.non_compliant ?? null, b.audit?.non_compliant ?? null, dir);
        case 'pd':
          return compareNullable(a.phantom_demand?.response_rate ?? null, b.phantom_demand?.response_rate ?? null, dir);
        case 'capacity': {
          const order = { low: 0, moderate: 1, high: 2, at_capacity: 3 };
          const av = a.watcher?.capacity_band ? order[a.watcher.capacity_band] : null;
          const bv = b.watcher?.capacity_band ? order[b.watcher.capacity_band] : null;
          return compareNullable(av, bv, dir);
        }
        case 'lead_time':
          return compareNullable(a.watcher?.lead_time_p90_days ?? null, b.watcher?.lead_time_p90_days ?? null, dir);
        case 'risk':
        default:
          return dir === 'asc' ? a.risk_score - b.risk_score : b.risk_score - a.risk_score;
      }
    });
    return copy;
  }, [partners, sortKey, dir]);

  if (partners.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-6 text-sm italic text-slate">
        No partners observed yet
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2"><HeaderButton k="partner" sortKey={sortKey} dir={dir} onClick={onHeaderClick}>Partner</HeaderButton></th>
            <th className="px-4 py-2"><HeaderButton k="audit" sortKey={sortKey} dir={dir} onClick={onHeaderClick}>Audit (non-compliant)</HeaderButton></th>
            <th className="px-4 py-2"><HeaderButton k="pd" sortKey={sortKey} dir={dir} onClick={onHeaderClick}>PD response</HeaderButton></th>
            <th className="px-4 py-2"><HeaderButton k="capacity" sortKey={sortKey} dir={dir} onClick={onHeaderClick}>Watcher capacity</HeaderButton></th>
            <th className="px-4 py-2"><HeaderButton k="lead_time" sortKey={sortKey} dir={dir} onClick={onHeaderClick}>Watcher lead p90</HeaderButton></th>
            <th className="px-4 py-2"><HeaderButton k="risk" sortKey={sortKey} dir={dir} onClick={onHeaderClick}>Risk</HeaderButton></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((p) => (
            <tr key={p.partner_id}>
              <td className="px-4 py-2 text-charcoal">{p.partner_name}</td>
              <td className="px-4 py-2 text-charcoal">
                {p.audit ? `${p.audit.non_compliant}/${p.audit.total}` : '—'}
              </td>
              <td className="px-4 py-2 text-charcoal">
                {p.phantom_demand ? `${(p.phantom_demand.response_rate * 100).toFixed(0)}%` : '—'}
              </td>
              <td className="px-4 py-2 text-charcoal capitalize">{p.watcher?.capacity_band ?? '—'}</td>
              <td className="px-4 py-2 text-charcoal">
                {p.watcher?.lead_time_p90_days != null ? `${p.watcher.lead_time_p90_days.toFixed(1)}d` : '—'}
              </td>
              <td className="px-4 py-2"><RiskPill color={p.risk_color} label={p.risk_label} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
