'use client';
import type { GeoRollupEntry } from '@haiwave/protocol';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function GeoChart({ data }: { data: GeoRollupEntry[] }) {
  return (
    <div className="rounded border border-slate/10 bg-layer-1 p-4">
      <h2 className="text-sm font-medium text-charcoal mb-3">Components by country</h2>
      {data.length === 0 ? (
        <p className="text-sm text-slate">No audit data yet. Run an audit to populate the dashboard.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 28)}>
          <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="country_of_origin" tickLine={false} axisLine={false} width={80} />
            <Tooltip formatter={(v) => `${v ?? 0} components`} />
            <Bar dataKey="component_count" radius={[0, 4, 4, 0]}>
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
    </div>
  );
}
