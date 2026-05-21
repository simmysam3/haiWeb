import type { ComplianceChange, ComplianceChangeKind } from '@haiwave/protocol';
import type { PillProps } from '@/components/pill';

// ─── Helper interfaces for prior/current value shapes ──────────────────────

export interface PriorCurrentOrigin {
  country_of_origin?: string;
}
export interface PriorCurrentPlant {
  plant_identifier?: string;
}
export interface PriorCurrentLeadTime {
  lead_time_days?: number | string;
}
export interface PriorCurrentCert {
  certification_status?: string;
}
export interface PriorCurrentDepth {
  max_depth?: number | string;
}

// ─── kindLabel ─────────────────────────────────────────────────────────────

export function kindLabel(kind: ComplianceChangeKind): string {
  return kind
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── severityTone ──────────────────────────────────────────────────────────

export function severityTone(severity: string): NonNullable<PillProps['tone']> {
  if (severity === 'critical') return 'problem';
  if (severity === 'warning') return 'warn';
  return 'info';
}

// ─── describeChange ────────────────────────────────────────────────────────

export function describeChange(change: ComplianceChange): string {
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
      // dev-only warn so new kinds that land in the protocol surface immediately
      // in the development environment rather than silently emitting raw snake_case.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[describeChange] no description for kind:', kind);
      }
      return kindLabel(kind);
  }
}
