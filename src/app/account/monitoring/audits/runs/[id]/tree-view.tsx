'use client';
import type { AuditTraversalNode } from '@haiwave/protocol';

export function TreeView({
  node,
  depth = 0,
}: {
  node: AuditTraversalNode;
  depth?: number;
}) {
  const label = node.participant_id
    ? `${node.origin.vendor_name ?? node.participant_id.slice(0, 8)} · ${node.product_id ?? ''}`
    : (node.component_ref ?? '(unknown component)');
  return (
    <details open={depth < 2} className="ml-4">
      <summary className="cursor-pointer text-sm">
        <span className="text-charcoal">{label}</span>
        <span className="text-slate"> · {node.origin.country_of_origin}</span>
        {node.gap && (
          <span className="ml-2 text-xs text-[var(--color-problem)]">
            [{node.gap.kind}]
          </span>
        )}
      </summary>
      {node.components.length > 0 && (
        <div className="ml-2 mt-1 border-l border-slate/10 pl-3">
          {node.components.map((c, i) => (
            <TreeView key={i} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </details>
  );
}
