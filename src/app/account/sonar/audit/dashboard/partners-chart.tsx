'use client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Panel } from '@/components';
import type { PartnerComplianceData, PartnerRow } from './_lib/partner-compliance';

const TOP_N = 25;
const ROW_HEIGHT_PX = 24;

function displayName(row: PartnerRow): string {
  return row.vendor_legal_name ?? `${row.vendor_participant_id.slice(0, 8)}…`;
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-slate">{label}</span>
      <span className="text-2xl font-semibold text-charcoal">{value}</span>
    </div>
  );
}

export function PartnersChart({ data }: { data: PartnerComplianceData | null }) {
  if (data === null) {
    return (
      <Panel className="p-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">Least compliant partners</h2>
        <p className="text-sm text-slate">
          No audit data yet. Run an audit to populate the dashboard.
        </p>
      </Panel>
    );
  }

  const visibleRows = data.rows.slice(0, TOP_N).map((r) => ({
    ...r,
    display_name: displayName(r),
  }));

  return (
    <Panel className="p-4">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">Least compliant partners</h2>

      <div className="grid grid-cols-3 gap-4 pb-3 mb-3 border-b border-slate/15">
        <StatItem label="Total vendors" value={data.total_vendors_in_scope} />
        <StatItem label="Total non-compliant" value={data.total_non_compliant} />
        <StatItem label="Median per vendor" value={data.median_per_vendor} />
      </div>

      {data.total_non_compliant === 0 ? (
        <p className="text-sm text-slate text-center py-8">All vendors compliant.</p>
      ) : (
        <ResponsiveContainer
          width="100%"
          height={Math.max(140, visibleRows.length * ROW_HEIGHT_PX)}
        >
          <BarChart data={visibleRows} layout="vertical" margin={{ left: 60 }}>
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="display_name"
              tickLine={false}
              axisLine={false}
              width={160}
            />
            <Tooltip formatter={(v) => `${v ?? 0} non-compliant components`} />
            <Bar
              dataKey="non_compliant_count"
              fill="var(--color-orange)"
              radius={[0, 4, 4, 0]}
              maxBarSize={14}
            />
          </BarChart>
        </ResponsiveContainer>
      )}

      <p className="text-xs text-slate italic mt-3">* Non US Based Components</p>
    </Panel>
  );
}
