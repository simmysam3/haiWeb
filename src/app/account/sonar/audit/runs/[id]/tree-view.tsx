'use client';
import type { ObservationNode } from '@haiwave/protocol';
import { IdChip } from '@/components/id-chip';

// v1.30: audit-specific fields moved into ObservationNode.payload (a
// discriminated union by `kind`). For audit-run trees every node should be
// kind='audit', but defensively narrow before reading audit-only fields so
// a stray watcher_signal/phantom_demand_response node doesn't crash render.
function auditPayload(
  node: ObservationNode,
): Extract<ObservationNode['payload'], { kind: 'audit' }> | null {
  return node.payload.kind === 'audit' ? node.payload : null;
}

export function TreeView({
  node,
  depth = 0,
}: {
  node: ObservationNode;
  depth?: number;
}) {
  const isParticipant = !!node.participant_id;
  const audit = auditPayload(node);
  const vendorName = node.vendor_legal_name ?? audit?.origin.vendor_name ?? null;
  const country = audit?.origin.country_of_origin ?? null;
  const countryLabel =
    !country || country === '<unknown>' ? 'Unknown' : country;

  return (
    <details open={depth < 2} className="ml-4">
      <summary className="cursor-pointer text-sm py-1">
        <span className="inline-flex items-baseline gap-x-4 gap-y-1 flex-wrap">
          {isParticipant ? (
            <>
              <Field label="Product">
                <span className="font-mono text-charcoal">
                  {audit?.product_id ?? '—'}
                </span>
              </Field>
              <Field label="Vendor">
                {vendorName ? (
                  <span className="text-charcoal">{vendorName}</span>
                ) : (
                  <IdChip id={node.participant_id!} />
                )}
              </Field>
            </>
          ) : (
            <Field label="Component">
              <span className="text-slate italic">(component)</span>
            </Field>
          )}
          <Field label="Origin">
            <span
              className={
                countryLabel === 'Unknown' ? 'text-slate italic' : 'text-charcoal'
              }
            >
              {countryLabel}
            </span>
          </Field>
          {node.gap && (
            <span className="rounded bg-[var(--color-problem)]/10 px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-problem)]">
              gap · {node.gap.kind}
            </span>
          )}
        </span>
      </summary>
      {node.components.length > 0 && (
        <div className="ml-2 mt-1 border-l border-slate/15 pl-3">
          {node.components.map((c, i) => (
            <TreeView key={i} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </details>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate">
        {label}
      </span>
      {children}
    </span>
  );
}
