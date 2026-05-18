import type { ClassRollupEntry } from '@/lib/haiwave-api';

export function ClassRollup({ rows }: { rows: ClassRollupEntry[] }) {
  const sorted = [...rows].sort((a, b) => b.component_count - a.component_count);
  return (
    <section>
      <h2 className="font-display text-lg text-navy mb-3">Class rollup</h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-slate italic">No class rollup data surfaced for this run.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate">
              <th className="border-b border-slate/20 py-2">Class</th>
              <th className="border-b border-slate/20 py-2">Root</th>
              <th className="border-b border-slate/20 py-2 text-right">Components</th>
              <th className="border-b border-slate/20 py-2 text-right">Depth</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.node_id}>
                <td className="border-b border-slate/10 py-2 font-medium text-charcoal">
                  {row.master_label}
                </td>
                <td className="border-b border-slate/10 py-2">{row.root_label}</td>
                <td className="border-b border-slate/10 py-2 text-right tabular-nums">
                  {row.component_count}
                </td>
                <td className="border-b border-slate/10 py-2 text-right tabular-nums">
                  {row.depth}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
