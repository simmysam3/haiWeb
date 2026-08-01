import { describe, it, expect } from 'vitest';
import type { GroundedForecastResult } from '@haiwave/protocol';
import { renderCommitmentSchedule } from '../render-commitment-schedule';

// The commitment schedule is the product of the feature — a standalone,
// copy-pasteable plain-text artifact the vendor sends back to the brand. These
// goldens pin the FULL rendered string: any change to the artifact's wording
// or layout is a deliberate contract change and must update the expected text
// here in the same commit.

// The protocol package's own fixture (Task 2, schemas.test.ts) — one pacer
// class, quote and history agreeing, nothing past due.
const BASE_RESULT: GroundedForecastResult = {
  generated_at: '2026-07-30T00:00:00.000Z',
  product_name: 'a2000',
  profile: { monthly_qty: 100000, start_month: '2027-01', end_month: '2027-02' },
  assembly_days: 21,
  earliest_achievable: '2026-11-20',
  classes: [
    {
      product_class_id: 'cpt_sole_compound',
      component_sku: 'SOLE-XR9',
      qty_per_unit: 2,
      lead_basis: 'max_of_both',
      lead_days: 94,
      quoted_days: 90,
      observed: { sample_count: 11, min_days: 88, max_days: 102, median_days: 94 },
      confidence: 'high',
      quote_obtained: true,
      pacer: true,
    },
  ],
  schedule: [
    {
      month: '2027-01',
      product_class_id: 'cpt_sole_compound',
      last_commit_date: '2026-09-14',
      quantity: 200000,
      past_due: false,
    },
  ],
  pacer_ranking: ['cpt_sole_compound'],
  flags: { past_due_months: [], observed_only_classes: [] },
};

// A degraded forecast: the pacer has no usable quote (observed-only, LOW) and
// both its months are already past their commitment date; a second, non-pacing
// class rides along and is summarized without month lines.
const DEGRADED_RESULT: GroundedForecastResult = {
  generated_at: '2026-07-30T00:00:00.000Z',
  product_name: 'g-force',
  profile: { monthly_qty: 5000, start_month: '2026-09', end_month: '2026-10' },
  assembly_days: 10,
  earliest_achievable: '2027-02-16',
  classes: [
    {
      product_class_id: 'cpt_carbon_plate',
      component_sku: 'CP-77',
      qty_per_unit: 1,
      lead_basis: 'observed',
      lead_days: 190,
      quoted_days: null,
      observed: { sample_count: 2, min_days: 180, max_days: 200, median_days: 190 },
      confidence: 'low',
      quote_obtained: false,
      pacer: true,
    },
    {
      product_class_id: 'cpt_lace',
      component_sku: 'LACE-9',
      qty_per_unit: 4,
      lead_basis: 'max_of_both',
      lead_days: 12,
      quoted_days: 12,
      observed: { sample_count: 5, min_days: 9, max_days: 14, median_days: 11 },
      confidence: 'med',
      quote_obtained: true,
      pacer: false,
    },
  ],
  schedule: [
    {
      month: '2026-09',
      product_class_id: 'cpt_carbon_plate',
      last_commit_date: '2026-03-14',
      quantity: 5000,
      past_due: true,
    },
    {
      month: '2026-09',
      product_class_id: 'cpt_lace',
      last_commit_date: '2026-09-08',
      quantity: 20000,
      past_due: false,
    },
    {
      month: '2026-10',
      product_class_id: 'cpt_carbon_plate',
      last_commit_date: '2026-04-14',
      quantity: 5000,
      past_due: true,
    },
    {
      month: '2026-10',
      product_class_id: 'cpt_lace',
      last_commit_date: '2026-10-09',
      quantity: 20000,
      past_due: false,
    },
  ],
  pacer_ranking: ['cpt_carbon_plate', 'cpt_lace'],
  flags: {
    past_due_months: ['2026-09', '2026-10'],
    observed_only_classes: ['cpt_carbon_plate'],
  },
};

describe('renderCommitmentSchedule', () => {
  it('renders the full artifact for a clean single-pacer forecast', () => {
    expect(renderCommitmentSchedule(BASE_RESULT, '2026-07-30')).toBe(
      `COMMITMENT SCHEDULE — a2000
Prepared 2026-07-30

Earliest achievable delivery: 2026-11-20

cpt_sole_compound — PACER · lead 94 days (observed 88–102, HIGH; quoted 90)
  Jan 2027 delivery: commit 200,000 by 2026-09-14

Assumptions
  Final assembly: 21 days
  Monthly quantity: 100,000 units/month, 2027-01 through 2027-02
  Analogue basis: blended order history of the nominated predecessor SKUs
  Lead basis: max(quoted days, observed median) per component class
  Observation window: trailing 24 months of delivery history`,
    );
  });

  it('renders past-due day counts, the observed-only annotation, and the non-pacer summary', () => {
    // Day counts by hand from preparedOn 2026-07-30 (UTC):
    // 2026-03-14 → +17 (Mar) +30 (Apr) +31 (May) +30 (Jun) +30 (Jul) = 138.
    // 2026-04-14 → +16 (Apr) +31 (May) +30 (Jun) +30 (Jul) = 107.
    expect(renderCommitmentSchedule(DEGRADED_RESULT, '2026-07-30')).toBe(
      `COMMITMENT SCHEDULE — g-force
Prepared 2026-07-30

Earliest achievable delivery: 2027-02-16

cpt_carbon_plate — PACER · lead 190 days (observed 180–200, LOW; no current quote — historic basis only)
  Sep 2026 delivery: commit 5,000 by 2026-03-14 — REQUIRED 138 DAYS AGO
  Oct 2026 delivery: commit 5,000 by 2026-04-14 — REQUIRED 107 DAYS AGO

Non-pacing components
  cpt_lace — lead 12 days (observed 9–14, MED; quoted 12)

Assumptions
  Final assembly: 10 days
  Monthly quantity: 5,000 units/month, 2026-09 through 2026-10
  Analogue basis: blended order history of the nominated predecessor SKUs
  Lead basis: max(quoted days, observed median) per component class
  Observation window: trailing 24 months of delivery history`,
    );
  });
});
