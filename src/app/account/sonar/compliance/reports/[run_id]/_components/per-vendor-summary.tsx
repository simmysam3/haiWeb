import Link from 'next/link';
import type { PerVendorSummaryRow } from '@/lib/haiwave-api';
import { ResolutionStatusBadge } from './resolution-status-badge';

export function PerVendorSummary({
  rows,
  runId,
}: {
  rows: PerVendorSummaryRow[];
  runId: string;
}) {
  return (
    <section>
      <h2 className="font-display text-lg text-navy mb-3">Per-vendor summary</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate italic">No vendors in scope for this run.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate">
              <th className="border-b border-slate/20 py-2">Vendor</th>
              <th className="border-b border-slate/20 py-2">Status</th>
              <th className="border-b border-slate/20 py-2 text-right">Products</th>
              <th className="border-b border-slate/20 py-2 text-right">Gaps</th>
              <th className="border-b border-slate/20 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.vendor_participant_id}>
                <td className="border-b border-slate/10 py-2">{row.vendor_legal_name}</td>
                <td className="border-b border-slate/10 py-2">
                  <ResolutionStatusBadge resolution_status={row.resolution_status} />
                </td>
                <td className="border-b border-slate/10 py-2 text-right tabular-nums">
                  {row.product_count}
                </td>
                <td className="border-b border-slate/10 py-2 text-right tabular-nums">
                  {row.gap_count}
                </td>
                <td className="border-b border-slate/10 py-2 text-right">
                  <Link
                    href={`/account/sonar/compliance/reports/${runId}/vendor/${row.vendor_participant_id}`}
                    className="text-teal hover:text-navy"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
