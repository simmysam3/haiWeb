import type { ComplianceChange, ComplianceChangeKind } from '@haiwave/protocol';
import type { PillProps } from '@/components/pill';

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

// ─── Tolerant key pickers ──────────────────────────────────────────────────
//
// The haiCore diff service emits spec keys (country_of_origin, lead_time_days,
// certification_status, plant_identifier). The dev seed script
// (`scripts/seed-request-workflows.ts`) emits short keys (country, days,
// status, plant). Production data is always spec-shape, but local dev had a
// gap because describeChange only knew the spec keys → it rendered "—" for
// the seeded rows. Each picker accepts both shapes so the feed reads
// correctly in either environment.

function pickStr(obj: unknown, keys: readonly string[]): string | undefined {
  if (obj == null || typeof obj !== 'object') return undefined;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (v != null && v !== '' && v !== '<null>') return String(v);
  }
  return undefined;
}

function pickNum(obj: unknown, keys: readonly string[]): number | undefined {
  if (obj == null || typeof obj !== 'object') return undefined;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

// ─── describeChange ────────────────────────────────────────────────────────

export function describeChange(change: ComplianceChange): string {
  const kind = change.change_kind;
  const prior = change.prior_value;
  const current = change.current_value;
  const MISSING = '—';

  switch (kind) {
    case 'origin_shifted_country': {
      const p = pickStr(prior, ['country_of_origin', 'country']) ?? MISSING;
      const c = pickStr(current, ['country_of_origin', 'country']) ?? MISSING;
      return `Country of origin changed from ${p} to ${c}`;
    }
    case 'origin_shifted_plant': {
      const p = pickStr(prior, ['plant_identifier', 'plant']) ?? MISSING;
      const c = pickStr(current, ['plant_identifier', 'plant']) ?? MISSING;
      return `Plant identifier changed from ${p} to ${c}`;
    }
    case 'lead_time_degraded':
    case 'lead_time_improved': {
      const p = pickNum(prior, ['lead_time_days', 'days']);
      const c = pickNum(current, ['lead_time_days', 'days']);
      return `Lead time ${p ?? MISSING} → ${c ?? MISSING} days`;
    }
    case 'certification_expired_or_revoked':
    case 'certification_renewed': {
      const p = pickStr(prior, ['certification_status', 'status']) ?? MISSING;
      const c = pickStr(current, ['certification_status', 'status']) ?? MISSING;
      return `Certification ${p} → ${c}`;
    }
    case 'gap_added':
      return 'A new compliance gap appeared at this vendor/product cell.';
    case 'gap_resolved':
      return 'The compliance gap at this vendor/product cell has been resolved.';
    case 'vendor_substituted':
      return 'A subcomponent vendor was substituted.';
    case 'depth_reduced': {
      const p = pickNum(prior, ['max_depth']) ?? MISSING;
      const c = pickNum(current, ['max_depth']) ?? MISSING;
      return `Maximum traversal depth decreased from ${p} to ${c}.`;
    }
    case 'depth_increased': {
      const p = pickNum(prior, ['max_depth']) ?? MISSING;
      const c = pickNum(current, ['max_depth']) ?? MISSING;
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
