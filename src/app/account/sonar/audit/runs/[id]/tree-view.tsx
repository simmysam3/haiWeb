'use client';
import type { ObservationNode, AuditGapKind, SynthesisMode } from '@haiwave/protocol';
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

const GAP_KIND_LABEL: Record<AuditGapKind, string> = {
  non_participant: 'non-participant',
  agent_offline: 'agent offline',
  unauthorized: 'unauthorized',
  depth_limited: 'depth limit reached',
};

const SYNTHESIS_LABEL: Record<SynthesisMode, string> = {
  direct: 'direct',
  aggregated_derivative: 'aggregated',
  redacted_gap: 'redacted',
};

function formatOrigin(audit: ReturnType<typeof auditPayload>): string | null {
  if (!audit) return null;
  const o = audit.origin;
  const country =
    !o.country_of_origin || o.country_of_origin === '<unknown>'
      ? null
      : o.country_of_origin;
  const parts = [o.city, o.state_province, country].filter(
    (p): p is string => !!p && p.length > 0,
  );
  return parts.length > 0 ? parts.join(', ') : null;
}

function formatPlant(audit: ReturnType<typeof auditPayload>): string | null {
  if (!audit) return null;
  const o = audit.origin;
  if (o.plant_address && o.plant_identifier) {
    return `${o.plant_identifier} — ${o.plant_address}`;
  }
  return o.plant_address ?? o.plant_identifier ?? null;
}

function formatOperational(audit: ReturnType<typeof auditPayload>): string | null {
  if (!audit) return null;
  const s = audit.operational_status;
  const parts: string[] = [];
  if (s.lead_time_meets !== null) {
    parts.push(s.lead_time_meets ? 'lead time ✓' : 'lead time ✗');
  }
  if (s.capacity) parts.push(`capacity: ${s.capacity}`);
  if (s.delivery_state) parts.push(s.delivery_state.replace(/_/g, ' '));
  return parts.length > 0 ? parts.join(' · ') : null;
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
  const originLabel = formatOrigin(audit);
  const plantLabel = formatPlant(audit);
  const operationalLabel = formatOperational(audit);
  const classIds = audit?.class_ids ?? [];
  const showSynthesis = node.synthesis_mode !== 'direct';

  return (
    <details open={depth < 2} className="ml-3 my-1.5">
      <summary className="cursor-pointer rounded px-2 py-1.5 hover:bg-slate-50 transition-colors">
        {/* Header line: identity + status pills */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {isParticipant ? (
            <>
              <span className="text-sm font-medium text-charcoal">
                {vendorName ?? 'Unnamed vendor'}
              </span>
              {node.participant_id && (
                <IdChip id={node.participant_id} />
              )}
            </>
          ) : (
            <span className="text-sm italic text-slate">Component</span>
          )}
          {showSynthesis && (
            <Pill tone="slate">{SYNTHESIS_LABEL[node.synthesis_mode]}</Pill>
          )}
          {node.gap && (
            <Pill tone="problem">
              {GAP_KIND_LABEL[node.gap.kind]}
              {node.gap.declared_country
                ? ` · declared ${node.gap.declared_country}`
                : ''}
            </Pill>
          )}
          <span className="ml-auto text-[10px] text-slate">depth {node.depth_level}</span>
        </div>

        {/* Detail rows — only rendered when populated */}
        <div className="mt-1 space-y-0.5 text-xs">
          {audit?.product_id && (
            <DetailRow label="Product">
              <span className="font-mono text-charcoal">{audit.product_id}</span>
            </DetailRow>
          )}
          {originLabel && (
            <DetailRow label="Origin">
              <span className="text-charcoal">{originLabel}</span>
            </DetailRow>
          )}
          {plantLabel && (
            <DetailRow label="Plant">
              <span className="text-charcoal">{plantLabel}</span>
            </DetailRow>
          )}
          {operationalLabel && (
            <DetailRow label="Status">
              <span className="text-charcoal">{operationalLabel}</span>
            </DetailRow>
          )}
          {classIds.length > 0 && (
            <DetailRow label="Classes">
              <span className="flex flex-wrap gap-1">
                {classIds.slice(0, 8).map((cid) => (
                  <span
                    key={cid}
                    className="rounded bg-teal/10 px-1.5 py-0.5 text-[10px] text-teal-dark"
                  >
                    {cid}
                  </span>
                ))}
                {classIds.length > 8 && (
                  <span className="text-[10px] text-slate">
                    +{classIds.length - 8} more
                  </span>
                )}
              </span>
            </DetailRow>
          )}
          {node.gap?.hint && (
            <DetailRow label="Hint">
              <span className="italic text-slate">{node.gap.hint}</span>
            </DetailRow>
          )}
        </div>
      </summary>
      {node.components.length > 0 && (
        <div className="ml-3 mt-1 border-l border-slate/15 pl-2">
          {node.components.map((c, i) => (
            <TreeView key={i} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </details>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate">
        {label}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: 'slate' | 'problem';
  children: React.ReactNode;
}) {
  const cls =
    tone === 'problem'
      ? 'bg-[var(--color-problem)]/10 text-[var(--color-problem)]'
      : 'bg-slate-100 text-slate-700';
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {children}
    </span>
  );
}
