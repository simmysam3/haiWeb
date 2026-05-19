import type { GeographicRollupRow } from '@/lib/haiwave-api';

export function GeographicRollup({ rows }: { rows: GeographicRollupRow[] }) {
  const sorted = [...rows].sort((a, b) => b.component_count - a.component_count);
  return (
    <section>
      <h2 className="font-display text-lg text-navy mb-3">Geographic rollup</h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-slate italic">No geographic data surfaced for this run.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate">
              <th className="border-b border-slate/20 py-2">Country</th>
              <th className="border-b border-slate/20 py-2 text-right">Components</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.country_of_origin}>
                <td className="border-b border-slate/10 py-2">{row.country_label}</td>
                <td className="border-b border-slate/10 py-2 text-right tabular-nums">
                  {row.component_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
