/**
 * BFF-local mirror of the Sourcing Map SP1 `[P-a]` protocol (contract §3.1–§3.6).
 *
 * haiWeb cannot import `[P-a]` from `@haiwave/protocol` until SP1-a/SP1-b merge
 * and the haiCore primary is fast-forwarded: the protocol symlink resolves to
 * the live primary at 3.91.0, and repointing it is forbidden (contract §6.2).
 * Names are verbatim. Task 43 deletes this file and imports from the protocol.
 */
import { z } from 'zod';
import type { Cadence } from '@haiwave/protocol';

// ---------------------------------------------------------------- §3.1 common
/** Spec §6.2 limits. Services, UI and tests import these; never re-type the numbers. */
export const SM_LIMITS = {
  PRODUCTS_PER_RUN: 25,
  BOM_LINES_PER_PRODUCT: 500,
  DROPS_PER_PRODUCT: 52,
  VARIANTS_PER_AXIS: 40,
  CANDIDATES_PER_SLOT: 6,
  SCHEDULE_BUCKETS: 104,
  RUN_WINDOW_WEEKS: 104,
  PINS_PER_LINE: 20,
  SUGGESTION_LINES: 500,
  SUGGESTIONS_PER_LINE: 3,
  DEPTH_CAP_MIN: 1,
  DEPTH_CAP_MAX: 8,
  DEPTH_CAP_DEFAULT: 5,
} as const;

/**
 * Contract §10 b-G12: an agent line with no Network Index class is probed
 * through its pin, in a slot of its own whose class_id is this prefix plus
 * `<vendor_participant_id>:<vendor_sku>`.
 */
export const SM_UNCLASSIFIED_CLASS_PREFIX = 'unclassified:';

/** 'YYYY-MM-DD', calendar-valid. */
export const SmIsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), {
    message: 'not a calendar date',
  });
export type SmIsoDate = z.infer<typeof SmIsoDateSchema>;

/** Watcher capacity vocabulary (watcher/signal.ts `band`), named here for SP1. */
export const UtilizationBandSchema = z.enum(['low', 'moderate', 'high', 'at_capacity']);
export type UtilizationBand = z.infer<typeof UtilizationBandSchema>;

/** variant value -> non-negative integer quantity */
export const SmVariantQtySchema = z.record(z.string().min(1), z.number().int().nonnegative());
export type SmVariantQty = z.infer<typeof SmVariantQtySchema>;

/** variant value -> percentage; totals checked where used (100 ± 0.01) */
export const SmMixSchema = z.record(z.string().min(1), z.number().min(0).max(100));
export type SmMix = z.infer<typeof SmMixSchema>;

/** 100 ± 0.01, compared in integer hundredths: a float compare rejects 99.99
 *  (Math.abs(99.99 - 100) = 0.010000000000005116). Contract gap d-G7. */
export function mixTotalsHundred(mix: Record<string, number>): boolean {
  const total = Object.values(mix).reduce((a, b) => a + b, 0);
  return Math.abs(Math.round(total * 100) - 10000) <= 1;
}

// ---------------------------------------------------------------- §3.2 variant axis
export const VariantAxisSchema = z
  .object({
    name: z.string().min(1).max(60),
    system: z.string().min(1).max(60).nullable(),
    values: z.array(z.string().min(1).max(20)).min(1).max(SM_LIMITS.VARIANTS_PER_AXIS),
  })
  .refine((a) => new Set(a.values).size === a.values.length, {
    message: 'variant values must be unique',
    path: ['values'],
  });
export type VariantAxis = z.infer<typeof VariantAxisSchema>;

// ---------------------------------------------------------------- §3.3 library
export const SmProjectSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  created_by_user_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  archived_at: z.string().datetime().nullable(),
  run_count: z.number().int().nonnegative(),
  product_count: z.number().int().nonnegative(),
  last_activity_at: z.string().datetime(),
});
export type SmProject = z.infer<typeof SmProjectSchema>;

export const CreateSmProjectRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
});
export type CreateSmProjectRequest = z.infer<typeof CreateSmProjectRequestSchema>;

export const PatchSmProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    archived: z.boolean().optional(),
  })
  .refine((p) => Object.keys(p).length > 0, { message: 'empty patch' });
export type PatchSmProjectRequest = z.infer<typeof PatchSmProjectRequestSchema>;

export const SmProjectListResponseSchema = z.object({ projects: z.array(SmProjectSchema) });
export type SmProjectListResponse = z.infer<typeof SmProjectListResponseSchema>;

export const BomLinePinSchema = z.object({
  supplier_participant_id: z.string().uuid(),
  supplier_sku: z.string().min(1).max(200),
  share_pct: z.number().gt(0).max(100),
});
export type BomLinePin = z.infer<typeof BomLinePinSchema>;

export const BomLineOriginSchema = z.enum(['authored', 'uploaded', 'agent_import']);
export type BomLineOrigin = z.infer<typeof BomLineOriginSchema>;

const SmBomLineFieldsSchema = z.object({
  component_label: z.string().min(1).max(200),
  part_ref: z.string().min(1).max(200).nullable(),
  /** concept slug (`cpt_…`), see contract §2. Null while drafting; required to run. */
  class_id: z.string().min(1).max(200).nullable(),
  uom: z.string().min(1).max(20),
  qty_per_unit: z.number().positive(),
  variant_bound: z.boolean(),
  qty_by_variant: z.record(z.string().min(1), z.number().nonnegative()).nullable(),
  pins: z.array(BomLinePinSchema).max(SM_LIMITS.PINS_PER_LINE),
  origin: BomLineOriginSchema,
  note: z.string().max(500).nullable(),
});

type SmBomLineFields = z.infer<typeof SmBomLineFieldsSchema>;
function checkLine(l: SmBomLineFields, ctx: z.RefinementCtx): void {
  const total = l.pins.reduce((a, p) => a + p.share_pct, 0);
  if (total > 100 + 1e-9) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pins'], message: 'pin shares total more than 100' });
  // Mirror note: contract §3.3 joins the key with a NUL character; JSON.stringify is the same uniqueness test.
  const keys = new Set(l.pins.map((p) => JSON.stringify([p.supplier_participant_id, p.supplier_sku])));
  if (keys.size !== l.pins.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pins'], message: 'duplicate pin' });
  if (l.qty_by_variant !== null && !l.variant_bound)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['qty_by_variant'], message: 'qty_by_variant requires variant_bound' });
}

export const SmBomLineInputSchema = SmBomLineFieldsSchema.superRefine(checkLine);
export type SmBomLineInput = z.infer<typeof SmBomLineInputSchema>;

export const SmBomLineSchema = SmBomLineFieldsSchema.extend({
  line_id: z.string().uuid(),
  product_id: z.string().uuid(),
  position: z.number().int().nonnegative(),
}).superRefine(checkLine);
export type SmBomLine = z.infer<typeof SmBomLineSchema>;

export const ReplaceBomLinesRequestSchema = z.object({
  lines: z.array(SmBomLineInputSchema).max(SM_LIMITS.BOM_LINES_PER_PRODUCT),
});
export type ReplaceBomLinesRequest = z.infer<typeof ReplaceBomLinesRequestSchema>;

export const SmReadinessRuleSchema = z.enum([
  'no_products',
  'agent_root_sku_missing',
  'no_lines',
  'line_missing_class',
  'qty_by_variant_key_unknown',
  'mix_missing',
  'mix_keys_mismatch',
  'mix_not_100',
  'drops_outside_window',
]);
export type SmReadinessRule = z.infer<typeof SmReadinessRuleSchema>;

export const SmReadinessSchema = z.object({
  ready: z.boolean(),
  first_failing_rule: SmReadinessRuleSchema.nullable(),
  /** human text naming the rule and the object (product name, line position, drop date) */
  detail: z.string().nullable(),
});
export type SmReadiness = z.infer<typeof SmReadinessSchema>;

export const SmBomSourceSchema = z.enum(['workbench', 'agent']);
export type SmBomSource = z.infer<typeof SmBomSourceSchema>;

const SmProductFieldsSchema = z.object({
  name: z.string().min(1).max(200),
  unit_label: z.string().min(1).max(40),
  bom_source: SmBomSourceSchema,
  agent_root_sku: z.string().min(1).max(200).nullable(),
  variant_axis: VariantAxisSchema.nullable(),
  assembly_days: z.number().int().min(0).max(365),
});

export const CreateSmProductRequestSchema = SmProductFieldsSchema.superRefine((p, ctx) => {
  if (p.bom_source === 'agent' && p.agent_root_sku === null)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['agent_root_sku'], message: 'agent products need agent_root_sku' });
});
export type CreateSmProductRequest = z.infer<typeof CreateSmProductRequestSchema>;

export const PatchSmProductRequestSchema = SmProductFieldsSchema.partial().refine((p) => Object.keys(p).length > 0, {
  message: 'empty patch',
});
export type PatchSmProductRequest = z.infer<typeof PatchSmProductRequestSchema>;

export const SmProductSchema = SmProductFieldsSchema.extend({
  product_id: z.string().uuid(),
  project_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  line_count: z.number().int().nonnegative(),
  readiness: SmReadinessSchema,
});
export type SmProduct = z.infer<typeof SmProductSchema>;

export const SmProductDetailSchema = SmProductSchema.extend({
  /** workbench: the stored lines; agent: the lines as last fetched (read-only) or [] */
  lines: z.array(SmBomLineSchema),
  lines_fetched_at: z.string().datetime().nullable(),
  /** d-G5: display data for every class_id on the lines (concept slug → label and path) */
  classes: z.record(z.string(), z.object({ label: z.string(), class_path: z.array(z.string()) })),
});
export type SmProductDetail = z.infer<typeof SmProductDetailSchema>;

export const SmProductListResponseSchema = z.object({ products: z.array(SmProductSchema) });
export type SmProductListResponse = z.infer<typeof SmProductListResponseSchema>;

/** 409 body for DELETE of a product a run uses */
export const SmProductInUseSchema = z.object({
  code: z.literal('product_in_use'),
  runs: z.array(z.object({ template_id: z.string().uuid(), template_name: z.string() })),
});
export type SmProductInUse = z.infer<typeof SmProductInUseSchema>;

// ---------------------------------------------------------------- §3.4 resolve
export const ClassSuggestionBandSchema = z.enum(['high', 'medium', 'low']);
export type ClassSuggestionBand = z.infer<typeof ClassSuggestionBandSchema>;

export const ClassSuggestionsRequestSchema = z.object({
  lines: z.array(z.object({ label: z.string().min(1).max(200) })).min(1).max(SM_LIMITS.SUGGESTION_LINES),
});
export type ClassSuggestionsRequest = z.infer<typeof ClassSuggestionsRequestSchema>;

export const ClassSuggestionSchema = z.object({
  class_id: z.string().min(1),
  label: z.string(),
  class_path: z.array(z.string()),
  band: ClassSuggestionBandSchema,
});
export type ClassSuggestion = z.infer<typeof ClassSuggestionSchema>;

export const ClassSuggestionsResponseSchema = z.object({
  retrieval: z.enum(['hybrid', 'text_only']),
  lines: z.array(z.object({ suggestions: z.array(ClassSuggestionSchema).max(SM_LIMITS.SUGGESTIONS_PER_LINE) })),
});
export type ClassSuggestionsResponse = z.infer<typeof ClassSuggestionsResponseSchema>;

/** d-G3 (contract §6.1): GET /sourcing-map/classes?q=&limit= */
export const SmClassSearchResponseSchema = z.object({ classes: z.array(ClassSuggestionSchema.omit({ band: true })) });
export type SmClassSearchResponse = z.infer<typeof SmClassSearchResponseSchema>;

export const SupplierMatchesRequestSchema = z.object({
  names: z.array(z.string().min(1).max(200)).min(1).max(SM_LIMITS.BOM_LINES_PER_PRODUCT),
});
export type SupplierMatchesRequest = z.infer<typeof SupplierMatchesRequestSchema>;

export const SupplierMatchSchema = z.object({
  name: z.string(),
  match: z
    .object({
      participant_id: z.string().uuid(),
      legal_name: z.string(),
      confidence: z.enum(['exact', 'high', 'low']),
    })
    .nullable(),
  /** why there is no usable match; null when match is exact/high */
  note: z.enum(['not_on_network', 'not_a_trading_partner', 'ambiguous']).nullable(),
});
export type SupplierMatch = z.infer<typeof SupplierMatchSchema>;

export const SupplierMatchesResponseSchema = z.object({ matches: z.array(SupplierMatchSchema) });
export type SupplierMatchesResponse = z.infer<typeof SupplierMatchesResponseSchema>;

/** Pin picker + candidate source: the seat's trading partners publishing a class or a descendant. */
export const ClassSupplierSkuSchema = z.object({
  supplier_sku: z.string(),
  class_id: z.string(),
  /** 0 = exact class; n = descendant depth */
  class_depth: z.number().int().nonnegative(),
});
export type ClassSupplierSku = z.infer<typeof ClassSupplierSkuSchema>;
export const ClassSuppliersResponseSchema = z.object({
  class_id: z.string(),
  suppliers: z.array(
    z.object({
      participant_id: z.string().uuid(),
      legal_name: z.string(),
      country: z.string().nullable(),
      skus: z.array(ClassSupplierSkuSchema),
    }),
  ),
});
export type ClassSuppliersResponse = z.infer<typeof ClassSuppliersResponseSchema>;

export const ImportAgentBomRequestSchema = z.object({
  agent_root_sku: z.string().min(1).max(200),
  mode: z.enum(['copy', 'link']),
});
export type ImportAgentBomRequest = z.infer<typeof ImportAgentBomRequestSchema>;

export const ImportAgentBomResponseSchema = z.object({
  mode: z.enum(['copy', 'link']),
  lines_created: z.number().int().nonnegative(),
  lines_unclassified: z.number().int().nonnegative(),
});
export type ImportAgentBomResponse = z.infer<typeof ImportAgentBomResponseSchema>;

/** R-6: the seat's finished goods from origin_manifests */
export const AgentParentSkusResponseSchema = z.object({
  skus: z.array(z.object({ sku: z.string(), product_name: z.string().nullable() })),
});
export type AgentParentSkusResponse = z.infer<typeof AgentParentSkusResponseSchema>;

// ---------------------------------------------------------------- §3.5 demand
export const DemandDropSchema = z.object({
  due_date: SmIsoDateSchema,
  qty: z.number().int().positive(),
  mix_override: SmMixSchema.nullable(),
});
export type DemandDrop = z.infer<typeof DemandDropSchema>;

export const DemandGeneratorSchema = z.object({
  total: z.number().int().positive(),
  first_due_date: SmIsoDateSchema,
  spacing: z.enum(['weekly', 'monthly']),
  count: z.number().int().min(1).max(SM_LIMITS.DROPS_PER_PRODUCT),
  shape: z.enum(['flat', 'ramp', 'front_loaded']),
  curve: z
    .object({ center: z.string().min(1), spread: z.number().positive(), half_sizes: z.boolean() })
    .nullable(),
});
export type DemandGenerator = z.infer<typeof DemandGeneratorSchema>;

export const DemandScheduleSchema = z
  .object({
    drops: z.array(DemandDropSchema).min(1).max(SM_LIMITS.DROPS_PER_PRODUCT),
    mix: SmMixSchema.nullable(),
    generator: DemandGeneratorSchema.nullable(),
  })
  .superRefine((d, ctx) => {
    for (let i = 1; i < d.drops.length; i++) {
      if (d.drops[i]!.due_date <= d.drops[i - 1]!.due_date)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['drops', i, 'due_date'], message: 'drops must be ascending with unique dates' });
    }
    if (d.mix !== null && !mixTotalsHundred(d.mix))
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mix'], message: 'mix must total 100' });
    d.drops.forEach((drop, i) => {
      if (drop.mix_override !== null && !mixTotalsHundred(drop.mix_override))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['drops', i, 'mix_override'], message: 'override must total 100' });
    });
  });
export type DemandSchedule = z.infer<typeof DemandScheduleSchema>;

export const SourcingMapRunProductSchema = z.object({
  product_id: z.string().uuid(),
  demand: DemandScheduleSchema,
});
export type SourcingMapRunProduct = z.infer<typeof SourcingMapRunProductSchema>;

export const SourcingMapScopeSchema = z
  .object({
    kind: z.literal('sourcing_map'),
    project_id: z.string().uuid(),
    products: z.array(SourcingMapRunProductSchema).max(SM_LIMITS.PRODUCTS_PER_RUN),
    depth_cap: z.number().int().min(SM_LIMITS.DEPTH_CAP_MIN).max(SM_LIMITS.DEPTH_CAP_MAX).default(SM_LIMITS.DEPTH_CAP_DEFAULT),
    seat_weekly_capacity: z.number().int().positive().nullable().default(null),
  })
  .superRefine((s, ctx) => {
    const ids = s.products.map((p) => p.product_id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['products'], message: 'a product appears twice' });
  });
export type SourcingMapScope = z.infer<typeof SourcingMapScopeSchema>;

// ---------------------------------------------------------------- §3.6 execution
export const SmExecutionStatusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']);
export type SmExecutionStatus = z.infer<typeof SmExecutionStatusSchema>;
export const SmFailureReasonSchema = z.enum(['interrupted', 'internal_error']);
export type SmFailureReason = z.infer<typeof SmFailureReasonSchema>;
export const SmTriggerSchema = z.enum(['manual', 'scheduled']);
export type SmTrigger = z.infer<typeof SmTriggerSchema>;

/** spec §8.8 — final statuses */
export const SmCandidateStatusSchema = z.enum([
  'answered', 'unsupported', 'declined', 'timeout', 'unreachable', 'not_connected', 'rate_limited', 'cap_reached',
]);
export type SmCandidateStatus = z.infer<typeof SmCandidateStatusSchema>;
/** statuses that contribute no answer and make a slot `observed: false` */
export const SM_GAP_STATUSES = ['declined', 'timeout', 'unreachable', 'not_connected', 'rate_limited', 'cap_reached'] as const;
/** the result during `running` may also carry 'probing'; a terminal result never does */
export const SmCandidateLiveStatusSchema = z.enum([
  'answered', 'unsupported', 'declined', 'timeout', 'unreachable', 'not_connected', 'rate_limited', 'cap_reached', 'probing',
]);
export type SmCandidateLiveStatus = z.infer<typeof SmCandidateLiveStatusSchema>;

export const SmOptionLimitSchema = z.enum(['own', 'lead_time', 'unknown']);
export type SmOptionLimit = z.infer<typeof SmOptionLimitSchema>;
/** D-148 pill form (spec §9.3) */
export const SmAvailabilityFormSchema = z.enum(['quantity', 'verdict', 'not_probed_trust']);
export type SmAvailabilityForm = z.infer<typeof SmAvailabilityFormSchema>;

export const SmSlotKeySchema = z.object({
  class_id: z.string(),
  uom: z.string(),
  variant_bound: z.boolean(),
  /** Contract §10 b-G12: the variant axis system of a variant-bound slot, else null. Men's US and Women's US are separate slots. */
  variant_system: z.string().nullable(),
});
export type SmSlotKey = z.infer<typeof SmSlotKeySchema>;

export const SmWeekDemandSchema = z.object({
  week: SmIsoDateSchema,
  cum_qty: z.number().int().nonnegative(),
  cum_qty_by_variant: SmVariantQtySchema.nullable(),
});
export type SmWeekDemand = z.infer<typeof SmWeekDemandSchema>;

export const SmCoverageWeekSchema = z.object({
  week: SmIsoDateSchema,
  covered: z.number().int().nonnegative(),
  coverage: z.number().min(0).max(1),
  covered_by_variant: SmVariantQtySchema.nullable(),
  coverage_by_variant: z.record(z.string(), z.number().min(0).max(1)).nullable(),
});
export type SmCoverageWeek = z.infer<typeof SmCoverageWeekSchema>;

export const SmCandidateWeekSchema = z.object({
  week: SmIsoDateSchema,
  cum_achievable: z.number().int().nonnegative(),
  cum_achievable_by_variant: SmVariantQtySchema.nullable(),
  option_coverage: z.number().min(0).max(1),
});
export type SmCandidateWeek = z.infer<typeof SmCandidateWeekSchema>;

export const SmCandidateResultSchema = z.object({
  supplier_participant_id: z.string().uuid(),
  supplier_name: z.string(),
  supplier_country: z.string().nullable(),
  supplier_sku: z.string(),
  class_id: z.string(),
  class_path: z.array(z.string()),
  pinned: z.boolean(),
  allocation_share_pct: z.number().min(0).max(100),
  status: SmCandidateLiveStatusSchema,
  availability_form: SmAvailabilityFormSchema,
  answered_at_allocation: z.boolean(),
  spare_unknown: z.boolean(),
  shared_candidate: z.boolean(),
  weeks: z.array(SmCandidateWeekSchema),
  limit: SmOptionLimitSchema.nullable(),
  own_lead_time_days: z.number().int().nonnegative().nullable(),
  utilization_band: UtilizationBandSchema.nullable(),
  answered_at: z.string().datetime().nullable(),
  /** probes_done value when this candidate last changed; the status-poll cursor compares against it */
  status_seq: z.number().int().nonnegative(),
});
export type SmCandidateResult = z.infer<typeof SmCandidateResultSchema>;

export const SmSlotResultSchema = z.object({
  slot_key: SmSlotKeySchema,
  class_label: z.string(),
  class_path: z.array(z.string()),
  product_ids: z.array(z.string().uuid()),
  demand: z.array(SmWeekDemandSchema),
  coverage: z.array(SmCoverageWeekSchema),
  observed: z.boolean(),
  /** no pin and no trading partner publishes the class — "No trading partner publishes this class" */
  no_publisher: z.boolean(),
  candidates: z.array(SmCandidateResultSchema),
  not_probed_count: z.number().int().nonnegative(),
  /** d-G8: each product's cumulative demand in this slot, index-aligned with `demand` */
  product_demand: z.array(z.object({
    product_id: z.string().uuid(),
    cum_qty: z.array(z.number().int().nonnegative()),
  })),
  /** portfolio drop → the latest need-week of this slot belonging to any drop ≤ it (null = none yet) */
  as_of_weeks: z.array(z.object({ drop: SmIsoDateSchema, week: SmIsoDateSchema.nullable() })),
});
export type SmSlotResult = z.infer<typeof SmSlotResultSchema>;

export const SmProductDropResultSchema = z.object({
  due_date: SmIsoDateSchema,
  qty: z.number().int().nonnegative(),
  covered: z.number().int().nonnegative(),
  coverage: z.number().min(0).max(1),
  by_variant: z
    .array(z.object({ variant: z.string(), qty: z.number().int().nonnegative(), covered: z.number().int().nonnegative(), coverage: z.number().min(0).max(1) }))
    .nullable(),
});
export type SmProductDropResult = z.infer<typeof SmProductDropResultSchema>;

export const SmProductResultSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string(),
  status: z.enum(['composed', 'failed']),
  failure: z.enum(['agent_bom_unavailable']).nullable(),
  drops: z.array(SmProductDropResultSchema),
});
export type SmProductResult = z.infer<typeof SmProductResultSchema>;

export const SmPortfolioResultSchema = z.object({
  drops: z.array(z.object({
    due_date: SmIsoDateSchema,
    demand: z.number().int().nonnegative(),
    covered: z.number().int().nonnegative(),
    coverage: z.number().min(0).max(1),
  })),
  first_short_drop: SmIsoDateSchema.nullable(),
  seat_capacity_applied: z.boolean(),
});
export type SmPortfolioResult = z.infer<typeof SmPortfolioResultSchema>;

export const SourcingMapExecutionResultSchema = z.object({
  complete: z.boolean(),
  /** d-G6: the seat card (spec §9.3) */
  seat: z.object({
    participant_id: z.string().uuid(),
    legal_name: z.string(),
    country: z.string().nullable(),
    class_label: z.string().nullable(),
  }),
  portfolio: SmPortfolioResultSchema,
  products: z.array(SmProductResultSchema),
  slots: z.array(SmSlotResultSchema),
  /** the oldest answered_at across candidates; drives "Answers as of" and the 7-day warning */
  answers_as_of: z.string().datetime().nullable(),
});
export type SourcingMapExecutionResult = z.infer<typeof SourcingMapExecutionResultSchema>;

export const SmGapCountsSchema = z.record(SmCandidateStatusSchema, z.number().int().nonnegative());
export type SmGapCounts = z.infer<typeof SmGapCountsSchema>;

export const SmExecutionSummarySchema = z.object({
  execution_id: z.string().uuid(),
  /** a-G10: null after D-206 archive/keep deleted the template */
  template_id: z.string().uuid().nullable(),
  template_name: z.string(),
  status: SmExecutionStatusSchema,
  failure_reason: SmFailureReasonSchema.nullable(),
  trigger: SmTriggerSchema,
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  probes_planned: z.number().int().nonnegative(),
  probes_done: z.number().int().nonnegative(),
  gap_counts: SmGapCountsSchema,
  portfolio_coverage_last_drop: z.number().min(0).max(1).nullable(),
  first_short_drop: SmIsoDateSchema.nullable(),
  archived_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});
export type SmExecutionSummary = z.infer<typeof SmExecutionSummarySchema>;

export const SmExecutionDetailSchema = z.object({
  execution: SmExecutionSummarySchema,
  result: SourcingMapExecutionResultSchema.nullable(),
});
export type SmExecutionDetail = z.infer<typeof SmExecutionDetailSchema>;

export const SmExecutionListResponseSchema = z.object({ executions: z.array(SmExecutionSummarySchema) });
export type SmExecutionListResponse = z.infer<typeof SmExecutionListResponseSchema>;

export const SmExecutionStatusResponseSchema = z.object({
  execution_id: z.string().uuid(),
  status: SmExecutionStatusSchema,
  failure_reason: SmFailureReasonSchema.nullable(),
  probes_planned: z.number().int().nonnegative(),
  probes_done: z.number().int().nonnegative(),
  /** pass back as ?cursor= ; = probes_done at read time */
  cursor: z.number().int().nonnegative(),
  changed: z.array(z.object({
    slot_index: z.number().int().nonnegative(),
    candidate_index: z.number().int().nonnegative(),
    candidate: SmCandidateResultSchema,
  })),
});
export type SmExecutionStatusResponse = z.infer<typeof SmExecutionStatusResponseSchema>;

export const SmRunSummarySchema = z.object({
  template_id: z.string().uuid(),
  template_name: z.string(),
  product_count: z.number().int().nonnegative(),
  cadence: z.unknown(),
  last_execution: SmExecutionSummarySchema.nullable(),
});
export type SmRunSummary = z.infer<typeof SmRunSummarySchema>;
export const SmRunListResponseSchema = z.object({ runs: z.array(SmRunSummarySchema) });
export type SmRunListResponse = z.infer<typeof SmRunListResponseSchema>;

export const SmEstimateResponseSchema = z.object({
  readiness: z.object({
    ready: z.boolean(),
    first_failing_rule: z.string().nullable(),
    detail: z.string().nullable(),
  }),
  slot_count: z.number().int().nonnegative(),
  probe_count: z.number().int().nonnegative(),
  probe_count_worst_case: z.number().int().nonnegative(),
  responders_short: z.array(z.object({
    participant_id: z.string().uuid(),
    legal_name: z.string(),
    probes_planned: z.number().int().nonnegative(),
    remaining_allowance: z.number().int().nonnegative(),
  })),
});
export type SmEstimateResponse = z.infer<typeof SmEstimateResponseSchema>;

// ---------------------------------------------------------------- haiWeb-local (not in contract §3)
/**
 * d-G1 (contract §3.8): the RunTemplateSchema branch for observation_class
 * 'sourcing_map' (`RunTemplateSourcingMapSchema`, not exported by the protocol
 * on its own). Task 43 replaces it with Extract<RunTemplate, …>.
 */
export const SmRunTemplateSchema = z.object({
  template_id: z.string().uuid(),
  initiator_participant_id: z.string().uuid(),
  template_name: z.string().min(1).max(200),
  cadence: z.custom<Cadence>((v) => typeof v === 'object' && v !== null && typeof (v as { kind?: unknown }).kind === 'string'),
  enabled: z.boolean(),
  retention_days: z.number().int().min(1).max(3650),
  created_at: z.string().datetime(),
  created_by_user_id: z.string().uuid(),
  last_run_id: z.string().uuid().nullable(),
  last_run_at: z.string().datetime().nullable(),
  observation_class: z.literal('sourcing_map'),
  scope: SourcingMapScopeSchema,
});
export type SmRunTemplate = z.infer<typeof SmRunTemplateSchema>;
