'use client';

import type { ComplianceChange, ComplianceChangeDetail, ComplianceChangeKind } from '@haiwave/protocol';
import { Pill } from '@/components/pill';
import type { PillProps } from '@/components/pill';

function severityTone(severity: string): NonNullable<PillProps['tone']> {
  if (severity === 'critical') return 'problem';
  if (severity === 'warning') return 'warn';
  return 'info';
}

function kindLabel(kind: ComplianceChangeKind): string {
  return kind
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// mirrors describeChange in ../changes-feed.tsx — keep in sync
interface PriorCurrentOrigin { country_of_origin?: string; }
interface PriorCurrentPlant { plant_identifier?: string; }
interface PriorCurrentLeadTime { lead_time_days?: number | string; }
interface PriorCurrentCert { certification_status?: string; }
interface PriorCurrentDepth { max_depth?: number | string; }

function describeChange(change: ComplianceChange): string {
  const kind = change.change_kind;
  const prior = change.prior_value as Record<string, unknown> | null;
  const current = change.current_value as Record<string, unknown> | null;

  switch (kind) {
    case 'origin_shifted_country': {
      const p = (prior as PriorCurrentOrigin | null)?.country_of_origin ?? '—';
      const c = (current as PriorCurrentOrigin | null)?.country_of_origin ?? '—';
      return `Country of origin changed from ${p} to ${c}`;
    }
    case 'origin_shifted_plant': {
      const p = (prior as PriorCurrentPlant | null)?.plant_identifier ?? '—';
      const c = (current as PriorCurrentPlant | null)?.plant_identifier ?? '—';
      return `Plant identifier changed from ${p} to ${c}`;
    }
    case 'lead_time_degraded':
    case 'lead_time_improved': {
      const p = (prior as PriorCurrentLeadTime | null)?.lead_time_days ?? '—';
      const c = (current as PriorCurrentLeadTime | null)?.lead_time_days ?? '—';
      return `Lead time ${p} → ${c} days`;
    }
    case 'certification_expired_or_revoked':
    case 'certification_renewed': {
      const p = (prior as PriorCurrentCert | null)?.certification_status ?? '—';
      const c = (current as PriorCurrentCert | null)?.certification_status ?? '—';
      return `Certification ${p} → ${c}`;
    }
    case 'gap_added':
      return 'A new compliance gap appeared at this vendor/product cell.';
    case 'gap_resolved':
      return 'The compliance gap at this vendor/product cell has been resolved.';
    case 'vendor_substituted':
      return 'A subcomponent vendor was substituted.';
    case 'depth_reduced': {
      const p = (prior as PriorCurrentDepth | null)?.max_depth ?? '—';
      const c = (current as PriorCurrentDepth | null)?.max_depth ?? '—';
      return `Maximum traversal depth decreased from ${p} to ${c}.`;
    }
    case 'depth_increased': {
      const p = (prior as PriorCurrentDepth | null)?.max_depth ?? '—';
      const c = (current as PriorCurrentDepth | null)?.max_depth ?? '—';
      return `Maximum traversal depth increased from ${p} to ${c}.`;
    }
    default:
      return kind;
  }
}

interface CellPanelProps {
  label: string;
  samples: Record<string, unknown>[];
  tree: unknown;
}

function CellPanel({ label, samples, tree }: CellPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate/20 bg-white p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate">{label}</h3>

      <div>
        <p className="mb-2 text-xs font-medium text-navy">Samples</p>
        {samples.length === 0 ? (
          <p className="text-sm text-slate/70">none</p>
        ) : (
          <ul className="space-y-1">
            {samples.map((s, i) => {
              const attrKind = String(s.attribute_kind ?? '—');
              const rawVal = s.value_numeric ?? s.value_string;
              const val = rawVal != null ? String(rawVal) : '—';
              return (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="font-medium text-charcoal">{attrKind}:</span>
                  <span className="text-slate">{val}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-navy">Subtree</p>
        {tree == null ? (
          <p className="text-sm text-slate/70">no subtree</p>
        ) : (
          <pre className="overflow-x-auto rounded border border-slate/10 bg-slate/5 p-3 text-xs text-charcoal">
            {JSON.stringify(tree, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

interface Props {
  detail: ComplianceChangeDetail;
}

export function ChangeDetailCompare({ detail }: Props) {
  const { change, prior_cell, current_cell } = detail;

  return (
    <div className="space-y-6">
      {/* Change summary header */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate/20 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Pill
            category="change_kind"
            value={change.change_kind}
            tone={severityTone(change.severity)}
          >
            {kindLabel(change.change_kind)}
          </Pill>
          <Pill
            category="severity"
            value={change.severity}
            tone={severityTone(change.severity)}
          />
          <span className="ml-2 text-sm font-medium text-navy">
            {change.vendor_participant_id}
            {change.component_ref ? (
              <span className="ml-1 font-normal text-slate">· {change.component_ref}</span>
            ) : null}
          </span>
          <span className="ml-auto text-xs text-slate/70">
            {new Date(change.detected_at).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        </div>
        <p data-testid="change-description" className="text-sm text-slate">
          {describeChange(change)}
        </p>
      </div>

      {/* Side-by-side Prior / Current */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <CellPanel label="Prior" samples={prior_cell.samples} tree={prior_cell.tree} />
        <CellPanel label="Current" samples={current_cell.samples} tree={current_cell.tree} />
      </div>
    </div>
  );
}
