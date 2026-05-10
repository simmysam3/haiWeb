import type { PhantomDemandResult } from '@/lib/haiwave-api';

interface ProbeResultPayload {
  kind?: string;
  responder_quoted_quantity?: number | null;
  responder_completeness?: string | null;
  responder_confidence?: string | null;
  responder_response_time_ms?: number | null;
  responder_quoted_timeline?: string | null;
  free_text_response?: string | null;
}

export function ProbeResultsTable({ results }: { results: PhantomDemandResult[] }) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-slate">No probe results yet.</p>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-medium text-charcoal mb-2">Probe Results</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="py-2 pr-4 font-medium text-slate">SKU</th>
              <th className="py-2 pr-4 font-medium text-slate">Status</th>
              <th className="py-2 pr-4 font-medium text-slate">Quoted Qty</th>
              <th className="py-2 pr-4 font-medium text-slate">Timeline</th>
              <th className="py-2 pr-4 font-medium text-slate">Confidence</th>
              <th className="py-2 pr-4 font-medium text-slate">Latency (ms)</th>
              <th className="py-2 font-medium text-slate">Gap</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const payload = r.payload as ProbeResultPayload;
              const isGap = r.synthesis_mode === 'redacted_gap';
              const statusText = isGap ? 'gap' : (payload.responder_completeness ?? '—');
              const gapReason = r.gap
                ? (r.gap as { reason?: string }).reason ?? ''
                : '';

              return (
                <tr key={r.sku_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-4 font-mono text-xs text-charcoal truncate max-w-xs">
                    {r.sku_id}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusPill status={statusText} />
                  </td>
                  <td className="py-2 pr-4 text-charcoal">
                    {payload.responder_quoted_quantity ?? '—'}
                  </td>
                  <td className="py-2 pr-4 text-charcoal text-xs">
                    {payload.responder_quoted_timeline ?? '—'}
                  </td>
                  <td className="py-2 pr-4 text-charcoal">
                    {payload.responder_confidence ?? '—'}
                  </td>
                  <td className="py-2 pr-4 text-charcoal">
                    {payload.responder_response_time_ms ?? '—'}
                  </td>
                  <td className="py-2 text-xs text-slate">
                    {gapReason}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'complete'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'partial'
      ? 'bg-amber-50 text-amber-700'
      : status === 'declined'
      ? 'bg-red-50 text-red-700'
      : status === 'gap'
      ? 'bg-slate-100 text-slate-600'
      : 'bg-slate-50 text-slate-500';
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${tone}`}>{status}</span>
  );
}
