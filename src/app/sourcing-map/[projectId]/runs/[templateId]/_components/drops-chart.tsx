'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { DemandDrop } from '@haiwave/protocol';

/** Spec §7.4: a recharts bar chart of a product's drops. The figure carries the numbers as text. */
export function DropsChart({ drops, unit }: { drops: DemandDrop[]; unit: string }) {
  const total = drops.reduce((a, d) => a + d.qty, 0);
  return (
    <figure aria-label={`${drops.length} drops totalling ${total.toLocaleString('en-US')} ${unit}`} className="mt-3 h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={drops.map((d) => ({ date: d.due_date.slice(5), qty: d.qty }))}>
          <XAxis dataKey="date" tick={{ fill: 'var(--sm-ink-2)', fontSize: 11 }} />
          <YAxis tick={{ fill: 'var(--sm-ink-2)', fontSize: 11 }} />
          <Tooltip formatter={(v) => `${Number(v ?? 0).toLocaleString('en-US')} ${unit}`} />
          <Bar dataKey="qty" fill="var(--sm-teal)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <figcaption className="sr-only">{drops.map((d) => `${d.due_date}: ${d.qty.toLocaleString('en-US')}`).join('; ')}</figcaption>
    </figure>
  );
}
