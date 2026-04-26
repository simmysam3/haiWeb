'use client';
import type { GeoRollupEntry } from '@haiwave/protocol';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Panel } from '@/components';

export function GeoChart({ data }: { data: GeoRollupEntry[] }) {
  return (
    <Panel className="p-4">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">Components by country</h2>
      {data.length === 0 ? (
        <p className="text-sm text-slate">No audit data yet. Run an audit to populate the dashboard.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(140, data.length * 36)}>
          <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="country_of_origin" tickLine={false} axisLine={false} width={80} />
            <Tooltip formatter={(v) => `${v ?? 0} components`} />
            <Bar dataKey="component_count" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {data.map((e, i) => (
                <Cell
                  key={i}
                  fill={e.country_of_origin === '<unknown>' ? '#94A3B8' : 'var(--color-teal)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}
