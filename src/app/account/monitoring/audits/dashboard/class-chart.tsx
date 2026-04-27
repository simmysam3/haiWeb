'use client';
import type { ClassRollupEntry } from '@haiwave/protocol';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Panel } from '@/components';

export function ClassChart({ data }: { data: ClassRollupEntry[] }) {
  // Build a tooltip-friendly label = "Root › Leaf" when leaf differs from root.
  const enriched = data.map((e) => ({
    ...e,
    breadcrumb:
      e.master_label === e.root_label
        ? e.master_label
        : `${e.root_label} › ${e.master_label}`,
  }));

  return (
    <Panel className="p-4">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">Component Compliance Issues by Product Class</h2>
      {enriched.length === 0 ? (
        <p className="text-sm text-slate">No classification data yet. Run an audit to populate the dashboard.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(140, enriched.length * 36)}>
          <BarChart data={enriched} layout="vertical" margin={{ left: 40 }}>
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="master_label"
              tickLine={false}
              axisLine={false}
              width={140}
            />
            <Tooltip
              formatter={(v) => `${v ?? 0} components`}
              labelFormatter={(_, payload) => {
                const entry = payload?.[0]?.payload as { breadcrumb?: string } | undefined;
                return entry?.breadcrumb ?? '';
              }}
            />
            <Bar dataKey="component_count" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {enriched.map((e, i) => (
                <Cell
                  key={i}
                  fill={e.master_label === 'Unclassified' ? '#94A3B8' : 'var(--color-teal)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}
