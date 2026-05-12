'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { TimeseriesBucket } from './types';

interface Props {
  buckets: TimeseriesBucket[];
  window: 1 | 7 | 30;
  onWindowChange: (w: 1 | 7 | 30) => void;
}

export function TimeseriesChart({ buckets, window, onWindowChange }: Props) {
  const data = buckets.map((b) => ({
    hour: new Date(b.window_start).toLocaleString(),
    hops: b.hops_consumed,
  }));

  return (
    <section className="bg-white border border-slate-200 rounded p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-charcoal uppercase tracking-wider">Hop consumption</h2>
        <div className="flex gap-1 text-xs">
          {([1, 7, 30] as const).map((w) => (
            <button
              key={w}
              onClick={() => onWindowChange(w)}
              className={`px-2 py-1 rounded ${window === w ? 'bg-teal text-white' : 'bg-slate-100 text-slate hover:bg-slate-200'}`}
            >
              {w === 1 ? '24h' : `${w}d`}
            </button>
          ))}
        </div>
      </header>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" hide />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="hops" stroke="#1f6feb" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
