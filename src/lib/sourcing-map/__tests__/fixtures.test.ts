import { describe, it, expect } from 'vitest';
import {
  SmProjectSchema, SmProductSchema, SmProductDetailSchema, SmRunTemplateSchema, SmRunListResponseSchema,
  SmExecutionDetailSchema, SmEstimateResponseSchema, SourcingMapExecutionResultSchema,
} from '../contract';
import {
  vomeroProject, vomeroProducts, vomeroWorkbenchDetail, vomeroAgentDetail, vomeroRunTemplate, vomeroRunList,
  vomeroDetail, vomeroEstimate, runningDetail, resultWithAgentFailure, zeroSlotResult, weeklyDropsResult,
} from '../__fixtures__/vomero';

function issues(schema: { safeParse(v: unknown): { success: boolean; error?: { issues: unknown[] } } }, v: unknown) {
  return schema.safeParse(v).error?.issues;
}

describe('Vomero fixtures', () => {
  it('every fixture parses with its mirror schema', () => {
    expect(issues(SmProjectSchema, vomeroProject)).toBeUndefined();
    for (const p of vomeroProducts) expect(issues(SmProductSchema, p)).toBeUndefined();
    expect(issues(SmProductDetailSchema, vomeroWorkbenchDetail)).toBeUndefined();
    expect(issues(SmProductDetailSchema, vomeroAgentDetail)).toBeUndefined();
    expect(issues(SmRunTemplateSchema, vomeroRunTemplate)).toBeUndefined();
    expect(issues(SmRunListResponseSchema, vomeroRunList)).toBeUndefined();
    expect(issues(SmExecutionDetailSchema, vomeroDetail)).toBeUndefined();
    expect(issues(SmExecutionDetailSchema, runningDetail())).toBeUndefined();
    expect(issues(SmEstimateResponseSchema, vomeroEstimate)).toBeUndefined();
    expect(issues(SourcingMapExecutionResultSchema, resultWithAgentFailure())).toBeUndefined();
    expect(issues(SourcingMapExecutionResultSchema, zeroSlotResult())).toBeUndefined();
    expect(issues(SourcingMapExecutionResultSchema, weeklyDropsResult(52))).toBeUndefined();
  });
});
