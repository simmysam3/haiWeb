import type { AuditRun, AuditRunResult } from '@haiwave/protocol';

interface Props {
  run: AuditRun;
  results: AuditRunResult[];
}

interface StatCell {
  label: string;
  value: string | number;
  subtitle?: string;
}

function Stat({ label, value, subtitle }: StatCell) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate">
        {label}
      </span>
      <span className="text-lg font-bold text-charcoal leading-tight">{value}</span>
      {subtitle && (
        <span className="text-[10px] text-slate">{subtitle}</span>
      )}
    </div>
  );
}

export function SummaryStrip({ run, results }: Props) {
  // Counterparties: unique vendor_participant_id values from results
  const counterpartyCount = new Set(results.map((r) => r.vendor_participant_id)).size;

  // SKUs: unique product_id values from results
  const skuCount = new Set(results.map((r) => r.product_id)).size;

  const depth = run.depth_limit;
  const hopCount = run.hop_count;
  const gapCount = run.gap_count;

  return (
    <div
      aria-label="Run summary"
      className="flex flex-wrap gap-6 rounded-lg border border-slate/10 bg-slate-50 px-5 py-4"
    >
      <Stat label="Counterparties" value={counterpartyCount} />
      <Stat label="SKUs" value={skuCount} />
      <Stat label="Depth limit" value={depth} />
      {hopCount !== null && hopCount !== undefined && (
        <Stat label="Hops" value={hopCount} />
      )}
      {gapCount !== null && gapCount !== undefined && (
        <Stat label="Gaps" value={gapCount} />
      )}
    </div>
  );
}
