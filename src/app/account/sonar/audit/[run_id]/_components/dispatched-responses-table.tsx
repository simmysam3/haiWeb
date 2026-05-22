// Read-only dispatched responses table.
//
// In v.1.39, `dispatched_responses` is always [] — the EvidenceResponseListItem
// protocol type carries no run-linking field (no source_run_ids / bound_run_id
// on the list shape). The empty-state is what renders. The non-empty branch is
// scaffolded so the layout is stable when export later lands (§6a deferral).

interface DispatchedResponseRow {
  response_id: string;
  recipient_name: string;
  recipient_type: string;
  exported_at: string;
  document_hash?: string | null;
}

interface Props {
  rows: DispatchedResponseRow[];
}

export function DispatchedResponsesTable({ rows }: Props) {
  return (
    <section aria-labelledby="dispatched-heading" className="space-y-3">
      <h2
        id="dispatched-heading"
        className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
      >
        Dispatched responses
      </h2>

      {rows.length === 0 ? (
        <p className="text-sm text-slate italic">No external dispatches yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate">
                <th className="py-2 pr-3">Recipient</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Dispatched at</th>
                <th className="py-2">Hash prefix</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.response_id}
                  className="border-b border-slate-100"
                >
                  <td className="py-2 pr-3 text-charcoal">{row.recipient_name}</td>
                  <td className="py-2 pr-3 text-slate text-xs">{row.recipient_type}</td>
                  <td className="py-2 pr-3 text-slate text-xs">
                    {new Date(row.exported_at).toLocaleString()}
                  </td>
                  <td className="py-2 font-mono text-xs text-slate">
                    {row.document_hash ? row.document_hash.slice(0, 6) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
