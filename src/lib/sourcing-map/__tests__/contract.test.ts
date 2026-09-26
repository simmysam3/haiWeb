import { describe, it, expect } from 'vitest';
import {
  SourcingMapScopeSchema,
  SM_LIMITS,
  mixTotalsHundred,
  SmFailureReasonSchema,
  SmTriggerSchema,
  SmOptionLimitSchema,
  SmAvailabilityFormSchema,
  SmWeekDemandSchema,
  SmCoverageWeekSchema,
  SmCandidateWeekSchema,
  SmProductDropResultSchema,
  SmPortfolioResultSchema,
  SmGapCountsSchema,
  SmExecutionListResponseSchema,
  SmRunSummarySchema,
  ClassSupplierSkuSchema,
} from '@haiwave/protocol';
import type {
  SmFailureReason,
  SmTrigger,
  SmOptionLimit,
  SmAvailabilityForm,
  SmWeekDemand,
  SmCoverageWeek,
  SmCandidateWeek,
  SmProductDropResult,
  SmPortfolioResult,
  SmGapCounts,
  SmExecutionListResponse,
  SmRunSummary,
  ClassSupplierSku,
} from '@haiwave/protocol';

describe('sourcing-map contract mirror', () => {
  it('parses a saved draft run with no products and applies the scope defaults', () => {
    const parsed = SourcingMapScopeSchema.parse({
      kind: 'sourcing_map',
      project_id: '5a1e0000-0000-4000-8000-000000000001',
      products: [],
    });
    expect(parsed.depth_cap).toBe(SM_LIMITS.DEPTH_CAP_DEFAULT);
    expect(parsed.seat_weekly_capacity).toBeNull();
  });

  it('mixTotalsHundred compares integer hundredths: 99.99% passes and 99.98% fails (d-G7)', () => {
    expect(mixTotalsHundred({ '9': 33.33, '10': 33.33, '11': 33.33 })).toBe(true);
    expect(mixTotalsHundred({ '9': 33.33, '10': 33.33, '11': 33.32 })).toBe(false);
  });

  it('a slot key carries its size system, and the unclassified-slot prefix is exported (contract §10 b-G12)', async () => {
    const { SmSlotKeySchema, SM_UNCLASSIFIED_CLASS_PREFIX } = await import('@haiwave/protocol');
    expect(SM_UNCLASSIFIED_CLASS_PREFIX).toBe('unclassified:');
    expect(SmSlotKeySchema.safeParse({ class_id: 'cpt_rubber_outsoles', uom: 'pr', variant_bound: true, variant_system: "Men's US" }).success).toBe(true);
    expect(SmSlotKeySchema.safeParse({ class_id: 'cpt_flat_laces', uom: 'pr', variant_bound: false, variant_system: null }).success).toBe(true);
    expect(SmSlotKeySchema.safeParse({ class_id: 'cpt_flat_laces', uom: 'pr', variant_bound: false }).success).toBe(false);
  });

  it('the mirror exports an inferred type for every §3 schema that lacked one (contract §10 b-G12 items 3–4)', () => {
    const failureReasons: SmFailureReason[] = ['interrupted', 'internal_error'];
    const trigger: SmTrigger = 'manual';
    const limit: SmOptionLimit = 'lead_time';
    const form: SmAvailabilityForm = 'not_probed_trust';
    const weekDemand: SmWeekDemand = { week: '2027-01-04', cum_qty: 10, cum_qty_by_variant: null };
    const coverageWeek: SmCoverageWeek = {
      week: '2027-01-04',
      covered: 5,
      coverage: 0.5,
      covered_by_variant: null,
      coverage_by_variant: null,
    };
    const candidateWeek: SmCandidateWeek = {
      week: '2027-01-04',
      cum_achievable: 5,
      cum_achievable_by_variant: null,
      option_coverage: 0.5,
    };
    const productDropResult: SmProductDropResult = { due_date: '2027-01-04', qty: 10, covered: 5, coverage: 0.5, by_variant: null };
    const portfolioResult: SmPortfolioResult = { drops: [], first_short_drop: null, seat_capacity_applied: false };
    const gapCounts: SmGapCounts = {};
    const executionListResponse: SmExecutionListResponse = { executions: [] };
    const runSummary: SmRunSummary = {
      template_id: '5a1e0000-0000-4000-8000-000000000002',
      template_name: 'Vomero portfolio',
      product_count: 0,
      cadence: null,
      last_execution: null,
    };
    const classSupplierSku: ClassSupplierSku = { supplier_sku: 'sku-1', class_id: 'cpt_rubber_outsoles', class_depth: 0 };

    for (const reason of failureReasons) expect(SmFailureReasonSchema.safeParse(reason).success).toBe(true);
    expect(SmTriggerSchema.safeParse(trigger).success).toBe(true);
    expect(SmOptionLimitSchema.safeParse(limit).success).toBe(true);
    expect(SmAvailabilityFormSchema.safeParse(form).success).toBe(true);
    expect(SmWeekDemandSchema.safeParse(weekDemand).success).toBe(true);
    expect(SmCoverageWeekSchema.safeParse(coverageWeek).success).toBe(true);
    expect(SmCandidateWeekSchema.safeParse(candidateWeek).success).toBe(true);
    expect(SmProductDropResultSchema.safeParse(productDropResult).success).toBe(true);
    expect(SmPortfolioResultSchema.safeParse(portfolioResult).success).toBe(true);
    expect(SmGapCountsSchema.safeParse(gapCounts).success).toBe(true);
    expect(SmExecutionListResponseSchema.safeParse(executionListResponse).success).toBe(true);
    expect(SmRunSummarySchema.safeParse(runSummary).success).toBe(true);
    expect(ClassSupplierSkuSchema.safeParse(classSupplierSku).success).toBe(true);
  });
});
