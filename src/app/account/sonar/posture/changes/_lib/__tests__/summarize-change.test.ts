import { describe, it, expect } from 'vitest';
import type { ComplianceChange } from '@haiwave/protocol';
import { summarizeChange } from '../summarize-change';

const base: ComplianceChange = {
  change_id: 'c1',
  snapshot_id: 's1',
  prior_snapshot_id: 's0',
  change_kind: 'origin_shifted_country',
  vendor_participant_id: 'v1',
  component_ref: 'SKU-1',
  prior_value: null,
  current_value: null,
  severity: 'critical',
  detected_at: '2026-05-18T00:00:00.000Z',
};

const c = (e: Partial<ComplianceChange>): ComplianceChange => ({ ...base, ...e });

describe('summarizeChange', () => {
  // ─── shape robustness ────────────────────────────────────────────────────
  // Production diff-service shape and dev seed shape both render correctly.

  it('origin_shifted_country reads spec key country_of_origin', () => {
    const s = summarizeChange(
      c({
        change_kind: 'origin_shifted_country',
        prior_value: { country_of_origin: 'VN' },
        current_value: { country_of_origin: 'CN' },
      }),
    );
    expect(s.fields).toEqual([
      { label: 'Country of origin', newValue: 'CN', priorValue: 'VN' },
    ]);
    expect(s.consider).toMatch(/sanctioned|sourcing policy/i);
  });

  it('origin_shifted_country also reads dev short key country', () => {
    const s = summarizeChange(
      c({
        change_kind: 'origin_shifted_country',
        prior_value: { country: 'US' },
        current_value: { country: 'CN' },
      }),
    );
    expect(s.fields[0].newValue).toBe('CN');
    expect(s.fields[0].priorValue).toBe('US');
  });

  it('lead_time_degraded reads spec lead_time_days', () => {
    const s = summarizeChange(
      c({
        change_kind: 'lead_time_degraded',
        prior_value: { lead_time_days: 7 },
        current_value: { lead_time_days: 21 },
      }),
    );
    expect(s.fields[0]).toEqual({
      label: 'Lead time',
      newValue: '21 days',
      priorValue: '7 days',
    });
  });

  it('lead_time_degraded also reads dev short key days', () => {
    const s = summarizeChange(
      c({
        change_kind: 'lead_time_degraded',
        prior_value: { days: 21 },
        current_value: { days: 45 },
      }),
    );
    expect(s.fields[0].newValue).toBe('45 days');
    expect(s.fields[0].priorValue).toBe('21 days');
  });

  it('lead_time_improved uses an approval-leaning consider line', () => {
    const s = summarizeChange(
      c({ change_kind: 'lead_time_improved', prior_value: { days: 21 }, current_value: { days: 10 } }),
    );
    expect(s.consider).toMatch(/typically approvable|stable/i);
  });

  it('certification_expired_or_revoked surfaces expired_on when present', () => {
    const s = summarizeChange(
      c({
        change_kind: 'certification_expired_or_revoked',
        prior_value: { status: 'active' },
        current_value: { status: 'expired', expired_on: '2026-05-15' },
      }),
    );
    const labels = s.fields.map((f) => f.label);
    expect(labels).toEqual(['Certification status', 'Expired on']);
    expect(s.fields[0].newValue).toBe('expired');
    expect(s.fields[1].newValue).toBe('2026-05-15');
  });

  it('certification_renewed surfaces expires (renewal date) when present', () => {
    const s = summarizeChange(
      c({
        change_kind: 'certification_renewed',
        prior_value: { status: 'expired' },
        current_value: { status: 'active', expires: '2027-06-01' },
      }),
    );
    expect(s.fields.map((f) => f.label)).toEqual([
      'Certification status',
      'Valid through',
    ]);
    expect(s.fields[1].newValue).toBe('2027-06-01');
  });

  it('vendor_substituted formats redacted vendors as a count', () => {
    const s = summarizeChange(
      c({
        change_kind: 'vendor_substituted',
        prior_value: { vendors: [] },
        current_value: { vendors: ['<null>', '<null>'] },
      }),
    );
    expect(s.fields[0].newValue).toBe('2 redacted');
  });

  it('vendor_substituted formats real vendor ids by truncating long ones', () => {
    const s = summarizeChange(
      c({
        change_kind: 'vendor_substituted',
        prior_value: { vendors: [] },
        current_value: { vendors: ['3513cae6-f196-4c79-b2cd-3a508770ad5c'] },
      }),
    );
    expect(s.fields[0].newValue).toContain('3513cae6');
    expect(s.fields[0].newValue).toContain('…');
  });

  it('vendor_substituted shows the prior list only when it had entries', () => {
    const sNoPrior = summarizeChange(
      c({ change_kind: 'vendor_substituted', prior_value: { vendors: [] }, current_value: { vendors: ['abc'] } }),
    );
    expect(sNoPrior.fields[0].priorValue).toBeUndefined();

    const sWithPrior = summarizeChange(
      c({
        change_kind: 'vendor_substituted',
        prior_value: { vendors: ['old-vendor-uuid-123456789'] },
        current_value: { vendors: ['new-vendor-uuid-987654321'] },
      }),
    );
    expect(sWithPrior.fields[0].priorValue).toBeDefined();
    expect(sWithPrior.fields[0].priorValue).toContain('old-vend');
  });

  it('depth_reduced/depth_increased flip consider tone', () => {
    const reduced = summarizeChange(
      c({ change_kind: 'depth_reduced', prior_value: { max_depth: 3 }, current_value: { max_depth: 1 } }),
    );
    expect(reduced.consider).toMatch(/less|redaction|dropped/i);

    const increased = summarizeChange(
      c({ change_kind: 'depth_increased', prior_value: { max_depth: 1 }, current_value: { max_depth: 3 } }),
    );
    expect(increased.consider).toMatch(/deeper|good signal/i);
  });

  it('gap_added renders gap_kind + confidence percentage', () => {
    const s = summarizeChange(
      c({
        change_kind: 'gap_added',
        prior_value: null,
        current_value: { gap_kind: 'origin_unknown', confidence: 0.42 },
      }),
    );
    expect(s.fields).toEqual([
      { label: 'Gap kind', newValue: 'origin_unknown' },
      { label: 'Detection confidence', newValue: '42%' },
    ]);
  });

  it('gap_added falls back to gap_kinds array when single gap_kind is absent', () => {
    const s = summarizeChange(
      c({
        change_kind: 'gap_added',
        prior_value: null,
        current_value: { gap_kinds: ['unauthorized', 'unauthorized'] },
      }),
    );
    expect(s.fields[0].newValue).toBe('unauthorized, unauthorized');
  });

  it('gap_resolved surfaces the now-known origin', () => {
    const s = summarizeChange(
      c({
        change_kind: 'gap_resolved',
        prior_value: { gap_kind: 'origin_unknown' },
        current_value: { country: 'TW', plant: 'Hsinchu-3' },
      }),
    );
    expect(s.fields).toEqual([
      { label: 'Country of origin', newValue: 'TW' },
      { label: 'Plant', newValue: 'Hsinchu-3' },
    ]);
  });

  it('gap_resolved with no surfaced state falls back to "Gap closed"', () => {
    const s = summarizeChange(
      c({ change_kind: 'gap_resolved', prior_value: null, current_value: null }),
    );
    expect(s.fields).toEqual([{ label: 'Status', newValue: 'Gap closed' }]);
  });

  // ─── defensive: missing data doesn't crash ───────────────────────────────

  it('renders an em-dash newValue when the current_value is null', () => {
    const s = summarizeChange(
      c({
        change_kind: 'origin_shifted_country',
        prior_value: { country: 'US' },
        current_value: null,
      }),
    );
    expect(s.fields[0].newValue).toBe('—');
  });

  it('omits priorValue when prior_value is null', () => {
    const s = summarizeChange(
      c({
        change_kind: 'origin_shifted_country',
        prior_value: null,
        current_value: { country: 'CN' },
      }),
    );
    expect(s.fields[0].priorValue).toBeUndefined();
  });

  it('every emitted change kind returns at least a consider line', () => {
    const kinds = [
      'origin_shifted_country',
      'origin_shifted_plant',
      'vendor_substituted',
      'lead_time_degraded',
      'lead_time_improved',
      'certification_expired_or_revoked',
      'certification_renewed',
      'depth_reduced',
      'depth_increased',
      'gap_added',
      'gap_resolved',
    ] as const;
    for (const kind of kinds) {
      const s = summarizeChange(c({ change_kind: kind, prior_value: null, current_value: null }));
      expect(s.consider, `missing consider for ${kind}`).toBeDefined();
    }
  });
});
