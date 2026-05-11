'use client';

interface Props {
  audit: number;
  watcher: number;
  phantom_demand: number;
  total: number;
}

const COLORS = {
  audit: '#1f6feb',
  watcher: '#3fb950',
  phantom_demand: '#a371f7',
} as const;

export function CompositionBar({ audit, watcher, phantom_demand, total }: Props) {
  const safeTotal = total > 0 ? total : 1;
  const auditPct = (audit / safeTotal) * 100;
  const watcherPct = (watcher / safeTotal) * 100;
  const pdPct = (phantom_demand / safeTotal) * 100;
  const remainingPct = Math.max(0, 100 - auditPct - watcherPct - pdPct);

  return (
    <section className="bg-white border border-slate-200 rounded p-4">
      <h2 className="text-sm font-semibold text-charcoal uppercase tracking-wider">Modality breakdown</h2>
      <div className="flex w-full h-6 mt-3 overflow-hidden rounded border border-slate-200">
        {audit > 0 ? <div title={`Audit: ${audit}`} style={{ width: `${auditPct}%`, background: COLORS.audit }} /> : null}
        {watcher > 0 ? <div title={`Watcher: ${watcher}`} style={{ width: `${watcherPct}%`, background: COLORS.watcher }} /> : null}
        {phantom_demand > 0 ? <div title={`Phantom Demand: ${phantom_demand}`} style={{ width: `${pdPct}%`, background: COLORS.phantom_demand }} /> : null}
        {remainingPct > 0 ? <div title={`Unused: ${Math.max(0, total - audit - watcher - phantom_demand)}`} style={{ width: `${remainingPct}%`, background: '#e2e8f0' }} /> : null}
      </div>
      <div className="flex gap-3 mt-2 text-xs">
        <Legend color={COLORS.audit} label={`Audit (${audit})`} />
        <Legend color={COLORS.watcher} label={`Watcher (${watcher})`} />
        <Legend color={COLORS.phantom_demand} label={`Phantom Demand (${phantom_demand})`} />
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
      <span className="text-slate">{label}</span>
    </span>
  );
}
