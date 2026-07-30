'use client';
import { useState } from 'react';
import type {
  ObservationNode,
  AuditGapKind,
  SynthesisMode,
  NodeAttestation,
  Annotation,
} from '@haiwave/protocol';
import { IdChip } from '@/components/id-chip';
import { Pill as SharedPill } from '@/components/pill';
import { VerifiedUndisclosedChip } from '@/components/verified-undisclosed-chip';
import {
  DomesticFlagBadge,
  isDomesticOrigin,
} from '@/app/account/sonar/audit/_lib/domestic';

export interface TreeOverlay {
  byNodeKey: Map<string, { attestations: NodeAttestation[]; currentAnnotation: Annotation | null }>;
  onAnnotate?: (t: {
    vendor: string;
    componentRef: string;
    depth: number;
    currentAnnotation: Annotation | null;
  }) => void;
}

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

// haiCore emits two distinct "country couldn't be resolved" sentinels on
// OriginDisclosure.country_of_origin: 'XX' (source-audit-service /
// audit-mcp-adapter / orchestrator — see "Use 'XX' as unknown sentinel") and
// the older '<unknown>'. Treat BOTH (plus empty) as no-country so the UI never
// prints a bogus "XX" and never scores an unresolved node as covered.
function resolvedCountry(country: string | null | undefined): string | null {
  if (!country || country === 'XX' || country === '<unknown>') return null;
  return country;
}

function formatOrigin(audit: ReturnType<typeof auditPayload>): string | null {
  if (!audit) return null;
  const o = audit.origin;
  const country = resolvedCountry(o.country_of_origin);
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

// Presentation discriminant for the identity cell. 'undisclosed' cases render
// the shared <VerifiedUndisclosedChip> (the every-redaction-is-a-chip rule);
// 'name' cases render plain text. Kind (not a bare label string) so the JSX
// picks chip vs text — the 'Unknown — no network record' and italic 'Component'
// branches keep their prior text rendering unchanged.
type NodeDisplay =
  | { kind: 'undisclosed' }
  | { kind: 'name'; label: string; italic: boolean };

function nodeDisplayName(
  node: ObservationNode,
  vendorName: string | null,
): NodeDisplay {
  if (node.identity_redacted === true) {
    return { kind: 'undisclosed' };
  }
  if (vendorName) return { kind: 'name', label: vendorName, italic: false };
  if (node.gap?.kind === 'unauthorized') {
    return { kind: 'undisclosed' };
  }
  if (node.gap?.kind === 'non_participant') {
    return { kind: 'name', label: 'Unknown — no network record', italic: false };
  }
  if (node.participant_id) {
    return { kind: 'undisclosed' };
  }
  return { kind: 'name', label: 'Component', italic: true };
}

type ComplianceTone = 'green' | 'red';

// Left status-bar tone for audit-run trees (only rendered when complianceBar
// is set — the watcher tree shares this component but has no provenance
// compliance semantics, so it opts out). The sliver tracks COVERAGE of this
// node's origin — it is intentionally binary:
//   red   — a hard gap (the source/identity couldn't be resolved at all), OR
//           the origin country is unresolved (null / '' / 'XX' / '<unknown>').
//           A row with no real origin cannot be "covered", so it is red.
//   green — origin resolved to a real country. Aggregated / derived rollups
//           count as covered here: a node whose origin IS disclosed (e.g.
//           Amphenol → US-WA, US) is green even though synthesis_mode is
//           'aggregated_derivative'. The 'aggregated' header pill still flags
//           that it's a rollup; the sliver shouldn't read as a problem when the
//           provenance is actually present.
function nodeComplianceTone(node: ObservationNode): ComplianceTone {
  if (node.gap) return 'red';
  return resolvedCountry(auditPayload(node)?.origin.country_of_origin)
    ? 'green'
    : 'red';
}

// Worst (red-dominant) tone across this node AND its entire subtree. Used for
// the sliver when a node is COLLAPSED: the bar then only spans the summary row,
// so it must surface any red buried in descendants — otherwise a clean-looking
// root hides an unresolved sub-tier until the user expands. When expanded, the
// node shows its OWN tone instead (each child renders its own bar).
function subtreeWorstTone(node: ObservationNode): ComplianceTone {
  if (nodeComplianceTone(node) === 'red') return 'red';
  for (const c of node.components) {
    if (subtreeWorstTone(c) === 'red') return 'red';
  }
  return 'green';
}

const COMPLIANCE_BAR_CLASS: Record<ComplianceTone, string> = {
  green: 'bg-green-300/40',
  red: 'bg-red-300/40',
};

const COMPLIANCE_BAR_TITLE: Record<ComplianceTone, string> = {
  green: 'Source resolved — origin verified for this node',
  red: 'Not resolved — provenance gap or no origin disclosed for this node',
};

export function TreeView({
  node,
  depth = 0,
  overlay,
  complianceBar = false,
  auditorCountry,
}: {
  node: ObservationNode;
  depth?: number;
  overlay?: TreeOverlay;
  // When true, render a narrow left status bar per node spanning its full
  // subtree height (audit run view). Threaded through the recursion.
  complianceBar?: boolean;
  // ISO-2 auditor home country (audit surfaces only). When a vendor line's
  // own origin is resolved AND matches, the line carries the domestic flag —
  // geography is a primary concern on audit reports. Threaded through the
  // recursion; watcher contexts simply omit it.
  auditorCountry?: string;
}) {
  const audit = auditPayload(node);
  const hasChildren = node.components.length > 0;
  const [open, setOpen] = useState(depth < 2);
  // Collapsed: surface the worst tone anywhere in the subtree so a buried red
  // is visible without expanding. Expanded: show this node's own tone (each
  // child draws its own bar). Leaves are always their own tone.
  const tone =
    !open && hasChildren ? subtreeWorstTone(node) : nodeComplianceTone(node);
  const vendorName = node.vendor_legal_name ?? audit?.origin.vendor_name ?? null;
  const vendorDisplay = nodeDisplayName(node, vendorName);
  const originLabel = formatOrigin(audit);
  const plantLabel = formatPlant(audit);
  const operationalLabel = formatOperational(audit);
  const classIds = audit?.class_ids ?? [];
  const showSynthesis = node.synthesis_mode !== 'direct';

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className={complianceBar ? 'relative ml-3 my-1.5 pl-2.5' : 'ml-3 my-1.5'}
    >
      <summary className="cursor-pointer rounded px-2 py-1.5 hover:bg-slate-50 transition-colors">
        {/* The sliver MUST live inside <summary>: a collapsed <details> hides
            every direct child except its <summary>, so an absolute span placed
            as a sibling of <summary> vanishes when collapsed (the reported
            "have to expand to see the red bar" bug). Kept absolute + positioned
            against the `relative` <details>, so it still spans the full subtree
            height when expanded, but survives collapse because <summary> always
            renders. (jsdom renders all children regardless of open, which is
            why unit tests couldn't catch this — only a real browser hides it.) */}
        {complianceBar && (
          <span
            aria-hidden="true"
            title={COMPLIANCE_BAR_TITLE[tone]}
            className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-full ${COMPLIANCE_BAR_CLASS[tone]}`}
          />
        )}
        {/* Header line: identity + status pills */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <>
            {vendorDisplay.kind === 'undisclosed' ? (
              <VerifiedUndisclosedChip />
            ) : (
              <span
                className={`text-sm ${vendorDisplay.italic ? 'italic text-slate' : 'font-medium text-charcoal'}`}
              >
                {vendorDisplay.label}
              </span>
            )}
            {vendorName && node.participant_id && !node.identity_redacted && (
              <IdChip id={node.participant_id} />
            )}
            {auditorCountry &&
              isDomesticOrigin(audit?.origin.country_of_origin, auditorCountry) && (
                <DomesticFlagBadge
                  country={auditorCountry}
                  title={`Verified ${auditorCountry} origin`}
                  className="h-3 w-auto rounded-[1px] shadow-sm"
                />
              )}
          </>
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
          {overlay && <NodeOverlay node={node} overlay={overlay} />}
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
            <TreeView key={i} node={c} depth={depth + 1} overlay={overlay} complianceBar={complianceBar} auditorCountry={auditorCountry} />
          ))}
        </div>
      )}
    </details>
  );
}

// Attestation/annotation overlay column (v1.34 P8). Only rendered when an
// overlay is supplied (the shared run-detail surface passes no overlay, so this
// is inert there). Behaviour is identical to the prior inline IIFE.
function NodeOverlay({
  node,
  overlay,
}: {
  node: ObservationNode;
  overlay: TreeOverlay;
}) {
  const pid = node.payload.kind === 'audit' ? node.payload.product_id : null;
  const k = `${node.participant_id ?? ''}|${pid ?? ''}|${node.depth_level}`;
  const o = overlay.byNodeKey.get(k);
  if (!o) return null;
  const isGap = o.attestations.some((a) => a.attestation_kind === 'unsubstantiated_gap');
  return (
    <span className="flex flex-wrap items-center gap-1">
      {o.attestations.map((a, i) => (
        <SharedPill key={i} category="attestation_kind" value={a.attestation_kind} />
      ))}
      {o.currentAnnotation && (
        <SharedPill category="attestation_kind" value="verified_out_of_band" />
      )}
      {isGap && overlay.onAnnotate && node.participant_id && pid && (
        <button
          type="button"
          className="text-[10px] underline text-charcoal hover:text-slate"
          onClick={() => overlay.onAnnotate!({
            vendor: node.participant_id!, componentRef: pid, depth: node.depth_level,
            currentAnnotation: o.currentAnnotation,
          })}
        >
          Annotate
        </button>
      )}
    </span>
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
