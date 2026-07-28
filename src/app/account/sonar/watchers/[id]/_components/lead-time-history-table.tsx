import { ColumnHeader } from '@/components/column-header';

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
  /** Quantity this run resolved the soft quote for. Null when the run had no
   *  soft-quote result. Per-run, NOT the current configured ask. */
  ask_quantity: number | null;
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

// The "Lead time (days)" group header carries the unit, so cells are bare
// numbers. Columns outside that group (e.g. ship delta) keep their own suffix.
function days(value: number | null): string {
  return value === null ? DASH : String(value);
}

interface Props {
  rows: LeadTimeHistoryRow[];
}

export function LeadTimeHistoryTable({ rows }: Props) {
  return (
    <section>
      <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
        Lead-time history
      </h4>
      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead>
            {/* Group tier: Published/Calibrated/Soft-quoted share a unit; Qty and
                capacity do not. A plain spanning th — a unit annotation, not a
                defined term, so no tooltip. */}
            <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-600">
              <th />
              <th
                colSpan={3}
                className="border-b border-slate-300 px-3 pb-1 pt-2 text-center font-bold text-teal"
              >
                Lead time (days)
              </th>
              <th />
              <th />
            </tr>
            <tr className="border-b-2 border-slate-300 bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <ColumnHeader label="Run date" />
              <ColumnHeader label="Published" category="lead_time_col" value="published" />
              <ColumnHeader label="Calibrated" category="lead_time_col" value="calibrated" />
              <ColumnHeader label="Soft-quoted" category="lead_time_col" value="soft_quoted" />
              <ColumnHeader label="Qty" category="lead_time_col" value="ask_quantity" />
              <ColumnHeader
                label="Available capacity"
                category="lead_time_col"
                value="capacity"
              />
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
                  <td data-testid="qty-cell" className="px-3 py-2 font-mono">
                    {row.ask_quantity === null ? DASH : row.ask_quantity}
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
