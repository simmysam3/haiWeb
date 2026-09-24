import type { SmProductDetail } from '@/lib/sourcing-map/contract';

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** The agent's lines as this GET read them, read-only. */
function AgentLines({ detail }: { detail: SmProductDetail }) {
  return (
    <>
      {detail.lines_fetched_at && <p className="sm-muted text-xs">Last fetched {DATE.format(new Date(detail.lines_fetched_at))}</p>}
      <table className="sm-table mt-4">
        <thead><tr><th>Component</th><th>Part ref</th><th>Class</th><th>Qty per unit</th><th>UoM</th><th>Supplier SKU</th></tr></thead>
        <tbody>
          {detail.lines.map((l) => (
            <tr key={l.line_id} aria-label={l.component_label}>
              <td>{l.component_label}</td>
              <td>{l.part_ref ?? '—'}</td>
              <td>{l.class_id ? detail.classes[l.class_id]?.label ?? l.class_id : <span className="sm-warn">Unclassified</span>}</td>
              <td>{l.qty_per_unit}</td>
              <td>{l.uom}</td>
              <td>{l.pins.map((p) => p.supplier_sku).join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** Agent-source product (spec §7.2): the lines as this GET read them live (a-G9), read-only; the run reads them fresh (§8.1). */
export function AgentBomView({ detail }: { detail: SmProductDetail }) {
  return (
    <div className="sm-card p-5">
      <h2 className="sm-heading text-lg font-semibold">Bill of materials</h2>
      <p className="mt-1 text-sm">Linked to your agent · {detail.agent_root_sku}</p>
      <p className="sm-muted text-sm">Read fresh at each run</p>
      <AgentLines detail={detail} />
    </div>
  );
}
