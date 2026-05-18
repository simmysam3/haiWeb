'use client';

import Link from 'next/link';
import type { ComplianceChange, ComplianceChangeKind } from '@haiwave/protocol';
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

interface PriorCurrentOrigin {
  country_of_origin?: string;
}
interface PriorCurrentPlant {
  plant_id?: string;
}
interface PriorCurrentLeadTime {
  lead_time_days?: number | string;
}
interface PriorCurrentCert {
  certification_status?: string;
}
interface PriorCurrentDepth {
  depth?: number | string;
}

function describeChange(change: ComplianceChange): string {
  const kind = change.change_kind;
  const prior = change.prior_value as Record<string, unknown> | null;
  const current = change.current_value as Record<string, unknown> | null;

  switch (kind) {
    case 'origin_shifted_country': {
      const p = (prior as PriorCurrentOrigin | null)?.country_of_origin ?? '—';
      const c = (current as PriorCurrentOrigin | null)?.country_of_origin ?? '—';
      return `Origin nation: ${p} → ${c}`;
    }
    case 'origin_shifted_plant': {
      const p = (prior as PriorCurrentPlant | null)?.plant_id ?? '—';
      const c = (current as PriorCurrentPlant | null)?.plant_id ?? '—';
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
      const p = (prior as PriorCurrentDepth | null)?.depth ?? '—';
      const c = (current as PriorCurrentDepth | null)?.depth ?? '—';
      return `Maximum traversal depth decreased from ${p} to ${c}.`;
    }
    case 'depth_increased': {
      const p = (prior as PriorCurrentDepth | null)?.depth ?? '—';
      const c = (current as PriorCurrentDepth | null)?.depth ?? '—';
      return `Maximum traversal depth increased from ${p} to ${c}.`;
    }
    default:
      return kind;
  }
}

interface Props {
  changes: ComplianceChange[];
}

export function ChangesFeed({ changes }: Props) {
  if (changes.length === 0) {
    return (
      <p className="p-12 text-center text-slate">
        No changes in the selected window.
      </p>
    );
  }

  return (
    <div className="divide-y divide-slate/10">
      {changes.map((change) => {
        const description = describeChange(change);
        const detectedAt = new Date(change.detected_at).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        });

        return (
          <div key={change.change_id} className="flex items-start justify-between gap-4 px-4 py-4">
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
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
              </div>
              <p className="text-sm font-medium text-navy">
                {change.vendor_participant_id}
                {change.component_ref ? (
                  <span className="ml-1 font-normal text-slate">· {change.component_ref}</span>
                ) : null}
              </p>
              <p className="text-sm text-slate">{description}</p>
              <p className="text-xs text-slate/70">{detectedAt}</p>
            </div>
            <Link
              href={`/account/sonar/compliance/posture/changes/${change.change_id}`}
              className="shrink-0 rounded-md border border-slate/30 px-3 py-1.5 text-xs text-slate hover:border-teal hover:text-navy"
            >
              Compare
            </Link>
          </div>
        );
      })}
    </div>
  );
}
