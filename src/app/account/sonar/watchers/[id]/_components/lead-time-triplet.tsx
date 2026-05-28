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

const FIELD_LABEL = 'text-[10px] uppercase tracking-wider text-teal-dark font-semibold';

function NotShared({ label }: { label: string }) {
  return (
    <div className="rounded border border-slate-200 px-3 py-1.5 bg-slate-50/50">
      <div className={FIELD_LABEL}>{label}</div>
      <div className="text-sm italic text-slate">Not shared</div>
    </div>
  );
}

export function LeadTimeTriplet({ published, quoted, calibrated }: Props) {
  const calP50 = calibrated?.percentiles.p50;
  return (
    <div className="grid grid-cols-3 gap-2">
      {published ? (
        <div className="rounded border border-slate-200 px-3 py-1.5">
          <div className={FIELD_LABEL}>Published</div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-lg text-charcoal">{published.days}d</span>
            {published.vendor_ref && (
              <span className="text-[10px] text-slate">ref: {published.vendor_ref}</span>
            )}
          </div>
        </div>
      ) : (
        <NotShared label="Published" />
      )}
      {quoted ? (
        <div className="rounded border border-slate-200 px-3 py-1.5">
          <div className={FIELD_LABEL}>Quoted</div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-lg text-charcoal">{quoted.days}d</span>
            {published && (
              <span className="text-xs text-slate">{deltaChip(quoted.days, published.days)} vs pub</span>
            )}
          </div>
        </div>
      ) : (
        <NotShared label="Quoted" />
      )}
      {calibrated && calP50 !== undefined ? (
        <div className="rounded border border-slate-200 px-3 py-1.5">
          <div className={FIELD_LABEL}>Calibrated p50</div>
          {/* Horizontal layout: value + supporting metrics + delta flow on one
              wrapping line so this cell doesn't drive the row height. */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-lg text-charcoal">{calP50}d</span>
            <span className="text-[10px] text-slate">
              p90 {calibrated.percentiles.p90}d · {calibrated.sample_count} samples
            </span>
            {published && (
              <span className="text-xs text-slate">{deltaChip(calP50, published.days)} vs pub</span>
            )}
          </div>
        </div>
      ) : (
        <NotShared label="Calibrated p50" />
      )}
    </div>
  );
}
