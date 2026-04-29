import type { SkuTableRow } from '@/lib/haiwave-api';
import { ResolutionStatusBadge } from './resolution-status-badge';
import { ResolutionClassBadge } from './resolution-class-badge';

export function SkuTable({ rows }: { rows: SkuTableRow[] }) {
  return (
    <section>
      <h2 className="font-display text-lg text-navy mb-3">SKUs</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate italic">No SKUs in coverage for this vendor.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate">
              <th className="border-b border-slate/20 py-2">SKU</th>
              <th className="border-b border-slate/20 py-2">Status</th>
              <th className="border-b border-slate/20 py-2 text-right">Manifest version</th>
              <th className="border-b border-slate/20 py-2 text-right">Sub-tier gaps</th>
              <th className="border-b border-slate/20 py-2">Resolution class</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.product_id}>
                <td className="border-b border-slate/10 py-2 font-medium text-charcoal">
                  {row.sku_label}
                </td>
                <td className="border-b border-slate/10 py-2">
                  <ResolutionStatusBadge resolution_status={row.resolution_status} />
                </td>
                <td className="border-b border-slate/10 py-2 text-right tabular-nums">
                  {row.current_origin_manifest_version ?? '—'}
                </td>
                <td className="border-b border-slate/10 py-2 text-right tabular-nums">
                  {row.unresolved_subtier_gap_count}
                </td>
                <td className="border-b border-slate/10 py-2">
                  {row.predominant_resolution_class ? (
                    <ResolutionClassBadge resolution_class={row.predominant_resolution_class} />
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
