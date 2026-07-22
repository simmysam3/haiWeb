import { Pill } from '@/components/pill';

// Per-run lead-time history for a single (SKU, vendor) on the readiness watcher
// run-detail page. Each row is one watcher run; columns are the four lead-time
// provenances plus the available-capacity band. Rows arrive newest-first and
// row 0 (the latest run) is visually emphasized.

export type CapacityBand = 'low' | 'moderate' | 'high' | 'at_capacity';

export interface LeadTimeHistoryRow {
  run_date: string;
  published: number | null;
  calibrated: number | null;
  soft_quoted: number | null;
  soft_quoted_unavailable: boolean;
  capacity: CapacityBand | null;
}

// Availability relabel — mirrors BAND_LABEL in capacity-band-panel.tsx. The
// underlying signal is capacity *utilization*; we surface it as *availability*
// so "Ample" reads as "plenty of room to take new work" rather than "low"
// being misread as "can't take work".
const CAPACITY_LABEL: Record<CapacityBand, string> = {
  low: 'Ample',
  moderate: 'Moderate',
  high: 'Limited',
  at_capacity: 'At capacity',
};

const DASH = '—';

// Deterministic UTC formatting so the rendered run date does not drift with the
// runner's local timezone.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function days(value: number | null): string {
  return value === null ? DASH : `${value}d`;
}

interface Props {
  rows: LeadTimeHistoryRow[];
  askQuantity: number;
}

export function LeadTimeHistoryTable({ rows, askQuantity }: Props) {
  return (
    <section>
      <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
        Lead-time history
      </h4>
      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate">
            <tr>
              <th className="px-3 py-2 font-semibold">Run date</th>
              <th className="px-3 py-2 font-semibold">
                <Pill category="lead_time_col" value="published">
                  Published
                </Pill>
              </th>
              <th className="px-3 py-2 font-semibold">
                <Pill category="lead_time_col" value="calibrated">
                  Calibrated
                </Pill>
              </th>
              <th className="px-3 py-2 font-semibold">
                <span className="inline-flex items-center gap-1">
                  <Pill category="lead_time_col" value="soft_quoted">
                    Soft-quoted
                  </Pill>
                  <Pill category="lead_time_col" value="ask_quantity">
                    qty {askQuantity}
                  </Pill>
                </span>
              </th>
              <th className="px-3 py-2 font-semibold">
                <Pill category="lead_time_col" value="capacity">
                  Available capacity
                </Pill>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row, index) => {
              const latest = index === 0;
              return (
                <tr key={row.run_date} className={latest ? 'bg-teal/5 font-medium' : ''}>
                  <td className="px-3 py-2 text-charcoal">{formatDate(row.run_date)}</td>
                  <td className="px-3 py-2 font-mono">{days(row.published)}</td>
                  <td className="px-3 py-2 font-mono">{days(row.calibrated)}</td>
                  <td className="px-3 py-2 font-mono">
                    {row.soft_quoted_unavailable ? (
                      <span className="italic text-slate">not available</span>
                    ) : (
                      days(row.soft_quoted)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.capacity === null ? DASH : CAPACITY_LABEL[row.capacity]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
