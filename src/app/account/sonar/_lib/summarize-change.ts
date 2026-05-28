import type { ComplianceChange } from '@haiwave/protocol';

/**
 * Per-kind business-readable summary of a compliance change for the Event
 * detail page. The detail page used to render only the raw JSON of the prior
 * and current snapshot cells, which is fine as supporting evidence but is not
 * what a reviewer wants to read first. This module extracts the salient
 * "going-forward" state — the new value on each meaningful field, plus a
 * one-sentence `consider` hint that frames the typical decision — so the
 * reviewer can quickly judge whether the new state is acceptable or needs
 * action, before falling back to the JSON.
 *
 * Robust to BOTH shapes that appear in dev:
 *  - the haiCore diff service (compliance-diff.ts) writes the spec keys:
 *    {country_of_origin}, {plant_identifier}, {lead_time_days},
 *    {certification_status}.
 *  - the haiCore dev seed (scripts/seed-request-workflows.ts) writes the
 *    short keys: {country}, {plant}, {days}, {status} (+ {expires}/{expired_on}).
 * Each picker tries both. Production data will always be the diff-service
 * shape; the short-key fallback exists so dev surfaces look right today.
 */

interface SummaryField {
  label: string;
  newValue: string;
  /** Optional context — what the value was before. Rendered as muted "was X". */
  priorValue?: string;
}

export interface ChangeSummary {
  fields: SummaryField[];
  /** One-sentence framing of the typical decision for this kind. */
  consider?: string;
}

const MISSING = '—';

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

function formatVendors(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return '(none)';
  // The diff service emits redacted vendors as the sentinel '<null>' — those
  // don't help the reader, but the COUNT does ("3 redacted vendors").
  const display = raw.map((v) => String(v));
  const realIds = display.filter((s) => s !== '<null>' && s !== '');
  const redactedCount = display.length - realIds.length;
  const parts: string[] = [];
  if (realIds.length > 0) {
    parts.push(
      realIds.map((id) => (id.length > 14 ? `${id.slice(0, 8)}…` : id)).join(', '),
    );
  }
  if (redactedCount > 0) {
    parts.push(`${redactedCount} redacted`);
  }
  return parts.length > 0 ? parts.join(' · ') : '(redacted)';
}

export function summarizeChange(change: ComplianceChange): ChangeSummary {
  const kind = change.change_kind;
  const prior = change.prior_value;
  const current = change.current_value;

  switch (kind) {
    case 'origin_shifted_country': {
      const c = pickStr(current, ['country_of_origin', 'country']);
      const p = pickStr(prior, ['country_of_origin', 'country']);
      return {
        fields: [
          { label: 'Country of origin', newValue: c ?? MISSING, priorValue: p },
        ],
        consider:
          'Confirm the new country is acceptable for this component. If it is sanctioned, restricted, or violates a sourcing policy, raise an exception or substitute the vendor.',
      };
    }

    case 'origin_shifted_plant': {
      const c = pickStr(current, ['plant_identifier', 'plant']);
      const p = pickStr(prior, ['plant_identifier', 'plant']);
      return {
        fields: [
          { label: 'Plant identifier', newValue: c ?? MISSING, priorValue: p },
        ],
        consider:
          'Confirm the new plant is approved. A move within the same country is usually low-risk, but plant-level audits and certifications may need to follow.',
      };
    }

    case 'lead_time_degraded':
    case 'lead_time_improved': {
      const c = pickNum(current, ['lead_time_days', 'days']);
      const p = pickNum(prior, ['lead_time_days', 'days']);
      return {
        fields: [
          {
            label: 'Lead time',
            newValue: c != null ? `${c} days` : MISSING,
            priorValue: p != null ? `${p} days` : undefined,
          },
        ],
        consider:
          kind === 'lead_time_degraded'
            ? 'Assess whether the new lead time keeps your downstream commitments safe. Consider adjusting safety stock or qualifying a backup supplier.'
            : 'Shorter lead time — typically approvable. Verify the new value is stable before reducing safety stock.',
      };
    }

    case 'certification_expired_or_revoked': {
      const c = pickStr(current, ['certification_status', 'status']);
      const p = pickStr(prior, ['certification_status', 'status']);
      const expiredOn = pickStr(current, ['expired_on']);
      const fields: SummaryField[] = [
        { label: 'Certification status', newValue: c ?? MISSING, priorValue: p },
      ];
      if (expiredOn) fields.push({ label: 'Expired on', newValue: expiredOn });
      return {
        fields,
        consider:
          'Chase a renewal from the vendor, or document a compensating control. Compliance posture is degraded until a valid certificate is on file.',
      };
    }

    case 'certification_renewed': {
      const c = pickStr(current, ['certification_status', 'status']);
      const p = pickStr(prior, ['certification_status', 'status']);
      const expires = pickStr(current, ['expires']);
      const fields: SummaryField[] = [
        { label: 'Certification status', newValue: c ?? MISSING, priorValue: p },
      ];
      if (expires) fields.push({ label: 'Valid through', newValue: expires });
      return {
        fields,
        consider:
          'Renewal received — typically approvable. File the new certificate against this vendor/product.',
      };
    }

    case 'vendor_substituted': {
      const cv = current != null && typeof current === 'object'
        ? (current as Record<string, unknown>).vendors
        : undefined;
      const pv = prior != null && typeof prior === 'object'
        ? (prior as Record<string, unknown>).vendors
        : undefined;
      const fields: SummaryField[] = [
        { label: 'Subcomponent vendor(s)', newValue: formatVendors(cv) },
      ];
      // Only show prior if it had real entries — "was (none)" adds no signal.
      if (Array.isArray(pv) && pv.length > 0) {
        fields[0].priorValue = formatVendors(pv);
      }
      return {
        fields,
        consider:
          'Verify the new vendor is approved for this component class and meets your trust posture (certifications, geography, behavioral score).',
      };
    }

    case 'depth_reduced':
    case 'depth_increased': {
      const c = pickNum(current, ['max_depth']);
      const p = pickNum(prior, ['max_depth']);
      return {
        fields: [
          {
            label: 'Maximum traversal depth',
            newValue: c != null ? String(c) : MISSING,
            priorValue: p != null ? String(p) : undefined,
          },
        ],
        consider:
          kind === 'depth_reduced'
            ? 'Less of the sub-tier supply chain is visible now. Check whether the responder added a redaction, dropped a tier, or hit an unresolved component.'
            : 'Deeper visibility into the sub-tier supply chain — typically a good signal that this audit reached further than before.',
      };
    }

    case 'gap_added': {
      const gapKind = pickStr(current, ['gap_kind']);
      const gapKindsRaw =
        current != null && typeof current === 'object'
          ? (current as Record<string, unknown>).gap_kinds
          : undefined;
      const gapKinds = Array.isArray(gapKindsRaw)
        ? gapKindsRaw.map(String)
        : undefined;
      const confidence = pickNum(current, ['confidence']);
      const fields: SummaryField[] = [
        {
          label: 'Gap kind',
          newValue:
            gapKind ??
            (gapKinds && gapKinds.length > 0 ? gapKinds.join(', ') : 'unspecified'),
        },
      ];
      if (confidence != null) {
        fields.push({
          label: 'Detection confidence',
          newValue: `${Math.round(confidence * 100)}%`,
        });
      }
      return {
        fields,
        consider:
          'A new compliance gap surfaced at this vendor/product cell. Add it to the working list, raise a chase to the responder, or accept a documented justification.',
      };
    }

    case 'gap_resolved': {
      // current_value often carries the resolved state (country/plant now known).
      const country = pickStr(current, ['country_of_origin', 'country']);
      const plant = pickStr(current, ['plant_identifier', 'plant']);
      const fields: SummaryField[] = [];
      if (country) fields.push({ label: 'Country of origin', newValue: country });
      if (plant) fields.push({ label: 'Plant', newValue: plant });
      if (fields.length === 0) {
        fields.push({ label: 'Status', newValue: 'Gap closed' });
      }
      return {
        fields,
        consider:
          'A prior gap has been resolved. Confirm the responder-supplied state is acceptable; if so, the item can be cleared from the working list.',
      };
    }

    default:
      return { fields: [] };
  }
}
