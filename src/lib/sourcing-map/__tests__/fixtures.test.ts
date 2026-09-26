import { describe, it, expect } from 'vitest';
import {
  SmProjectSchema, SmProductSchema, SmProductDetailSchema, RunTemplateSchema, SmRunListResponseSchema,
  SmExecutionDetailSchema, SmEstimateResponseSchema, SourcingMapExecutionResultSchema,
} from '@haiwave/protocol';
import {
  vomeroProject, vomeroProducts, vomeroWorkbenchDetail, vomeroAgentDetail, vomeroRunTemplate, vomeroRunList,
  vomeroDetail, vomeroEstimate, vomeroResult, runningDetail, resultWithAgentFailure, zeroSlotResult, weeklyDropsResult,
} from '../__fixtures__/vomero';

function issues(schema: { safeParse(v: unknown): { success: boolean; error?: { issues: unknown[] } } }, v: unknown) {
  return schema.safeParse(v).error?.issues;
}

describe('Vomero fixtures', () => {
  it('every fixture parses with its protocol schema', () => {
    expect(issues(SmProjectSchema, vomeroProject)).toBeUndefined();
    for (const p of vomeroProducts) expect(issues(SmProductSchema, p)).toBeUndefined();
    expect(issues(SmProductDetailSchema, vomeroWorkbenchDetail)).toBeUndefined();
    expect(issues(SmProductDetailSchema, vomeroAgentDetail)).toBeUndefined();
    expect(issues(RunTemplateSchema, vomeroRunTemplate)).toBeUndefined();
    expect(issues(SmRunListResponseSchema, vomeroRunList)).toBeUndefined();
    expect(issues(SmExecutionDetailSchema, vomeroDetail)).toBeUndefined();
    expect(issues(SmExecutionDetailSchema, runningDetail())).toBeUndefined();
    expect(issues(SmEstimateResponseSchema, vomeroEstimate)).toBeUndefined();
    expect(issues(SourcingMapExecutionResultSchema, resultWithAgentFailure())).toBeUndefined();
    expect(issues(SourcingMapExecutionResultSchema, zeroSlotResult())).toBeUndefined();
    expect(issues(SourcingMapExecutionResultSchema, weeklyDropsResult(52))).toBeUndefined();
  });

  it("each variant-bound slot carries its axis system (Men's US); every other slot carries null (b-G12)", () => {
    expect(vomeroResult.slots.map((s) => [s.slot_key.class_id, s.slot_key.variant_bound, s.slot_key.variant_system])).toEqual([
      ['cpt_full_grain_leather_hides', true, "Men's US"],
      ['cpt_eva_foam_midsole', false, null],
      ['cpt_rubber_outsoles', true, "Men's US"],
      ['cpt_metal_eyelets', false, null],
      ['cpt_flat_laces', false, null],
    ]);
  });
});
