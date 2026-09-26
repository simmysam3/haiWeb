import { describe, it, expect } from 'vitest';
import * as protocol from '@haiwave/protocol';
import { vomeroRunTemplate } from '../__fixtures__/vomero';

const NAMES = [
  'SM_LIMITS', 'SM_UNCLASSIFIED_CLASS_PREFIX', 'SmIsoDateSchema', 'UtilizationBandSchema', 'SmVariantQtySchema',
  'SmMixSchema', 'mixTotalsHundred', 'VariantAxisSchema', 'SmProjectSchema', 'CreateSmProjectRequestSchema',
  'PatchSmProjectRequestSchema', 'SmProjectListResponseSchema', 'BomLinePinSchema', 'BomLineOriginSchema',
  'SmBomLineInputSchema', 'SmBomLineSchema', 'ReplaceBomLinesRequestSchema', 'SmReadinessRuleSchema',
  'SmReadinessSchema', 'SmBomSourceSchema', 'CreateSmProductRequestSchema', 'PatchSmProductRequestSchema',
  'SmProductSchema', 'SmProductDetailSchema', 'SmProductListResponseSchema', 'SmProductInUseSchema',
  'ClassSuggestionBandSchema', 'ClassSuggestionsRequestSchema', 'ClassSuggestionSchema',
  'ClassSuggestionsResponseSchema', 'SmClassSearchResponseSchema', 'SupplierMatchesRequestSchema',
  'SupplierMatchSchema', 'SupplierMatchesResponseSchema', 'ClassSupplierSkuSchema', 'ClassSuppliersResponseSchema',
  'ImportAgentBomRequestSchema', 'ImportAgentBomResponseSchema', 'AgentParentSkusResponseSchema', 'DemandDropSchema',
  'DemandGeneratorSchema', 'DemandScheduleSchema', 'SourcingMapRunProductSchema', 'SourcingMapScopeSchema',
  'SmExecutionStatusSchema', 'SmFailureReasonSchema', 'SmTriggerSchema', 'SmCandidateStatusSchema', 'SM_GAP_STATUSES',
  'SmCandidateLiveStatusSchema', 'SmOptionLimitSchema', 'SmAvailabilityFormSchema', 'SmSlotKeySchema',
  'SmWeekDemandSchema', 'SmCoverageWeekSchema', 'SmCandidateWeekSchema', 'SmCandidateResultSchema',
  'SmSlotResultSchema', 'SmProductDropResultSchema', 'SmProductResultSchema', 'SmPortfolioResultSchema',
  'SourcingMapExecutionResultSchema', 'SmGapCountsSchema', 'SmExecutionSummarySchema', 'SmExecutionDetailSchema',
  'SmExecutionListResponseSchema', 'SmExecutionStatusResponseSchema', 'SmRunSummarySchema', 'SmRunListResponseSchema',
  'SmEstimateResponseSchema',
];

describe('protocol switch', () => {
  it('protocol 3.93.0 exports every Sourcing Map name the mirror carried', () => {
    expect(NAMES.filter((n) => !(n in protocol))).toEqual([]);
  });

  it('protocol 3.93.0 RunTemplateSchema reads a sourcing_map template (d-G1)', () => {
    expect(protocol.RunTemplateSchema.safeParse(vomeroRunTemplate).success).toBe(true);
  });
});
