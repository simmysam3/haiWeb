interface Numbered {
  days: number;
  observed_at: string;
  vendor_ref?: string;
}

interface Distribution {
  window_days: number;
  percentiles: { p50: number; p75: number; p90: number; p95: number; p99: number };
  sample_count: number;
}

interface Props {
  published: Numbered | null;
  quoted: Numbered | null;
  calibrated: Distribution | null;
}

function deltaChip(value: number, baseline: number): string {
  if (baseline === 0) return '';
  const pct = ((value - baseline) / baseline) * 100;
  const abs = Math.abs(pct);
  if (abs < 10) return '≈ stable';
  const arrow = pct > 0 ? (abs > 30 ? '↑↑' : '↑') : (abs > 30 ? '↓↓' : '↓');
  return `${arrow} ${pct > 0 ? '+' : ''}${Math.round(pct)}%`;
}

function NotShared({ label }: { label: string }) {
  return (
    <div className="rounded border border-slate-200 px-3 py-2 bg-slate-50/50">
      <div className="text-[10px] uppercase tracking-wider text-slate">{label}</div>
      <div className="text-sm italic text-slate mt-1">Not shared</div>
    </div>
  );
}

export function LeadTimeTriplet({ published, quoted, calibrated }: Props) {
  const calP50 = calibrated?.percentiles.p50;
  return (
    <div className="grid grid-cols-3 gap-2">
      {published ? (
        <div className="rounded border border-slate-200 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate">Published</div>
          <div className="font-mono text-xl text-charcoal">{published.days}d</div>
          {published.vendor_ref && (
            <div className="text-[10px] text-slate mt-0.5">ref: {published.vendor_ref}</div>
          )}
        </div>
      ) : (
        <NotShared label="Published" />
      )}
      {quoted ? (
        <div className="rounded border border-slate-200 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate">Quoted</div>
          <div className="font-mono text-xl text-charcoal">{quoted.days}d</div>
          {published && (
            <div className="text-xs text-slate mt-1">{deltaChip(quoted.days, published.days)} vs published</div>
          )}
        </div>
      ) : (
        <NotShared label="Quoted" />
      )}
      {calibrated && calP50 !== undefined ? (
        <div className="rounded border border-slate-200 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate">Calibrated p50</div>
          <div className="font-mono text-xl text-charcoal">{calP50}d</div>
          <div className="text-[10px] text-slate mt-0.5">
            p90 {calibrated.percentiles.p90}d · {calibrated.sample_count} samples
          </div>
          {published && (
            <div className="text-xs text-slate mt-1">{deltaChip(calP50, published.days)} vs published</div>
          )}
        </div>
      ) : (
        <NotShared label="Calibrated p50" />
      )}
    </div>
  );
}
