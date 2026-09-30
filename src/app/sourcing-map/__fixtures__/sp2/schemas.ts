/**
 * Contract §3 (protocol 3.96.0) as zod, layered on the 3.95.0 schemas the symlink carries today. It exists so the
 * SP2 fixtures can be validated before 3.96.0 lands; Task 16 deletes it and validates with @haiwave/protocol.
 * Every widening keeps a 3.95.0 payload parsing: enums are supersets, new fields are optional.
 */
import { z } from 'zod';
import {
  SmCandidateResultSchema, SmCandidateStatusSchema, SmExecutionStatusResponseSchema, SmExecutionSummarySchema, SmSlotResultSchema,
  SourcingMapExecutionResultSchema,
} from '@haiwave/protocol';

export const SmExecutionStatusSchema2 = z.enum(['queued', 'running', 'throttled', 'completed', 'failed', 'cancelled']);
export const SmCandidateLiveStatusSchema2 = z.enum([
  'answered', 'unsupported', 'declined', 'timeout', 'unreachable', 'not_connected', 'rate_limited', 'cap_reached', 'probing', 'waiting',
]);
export const SmOptionLimitSchema2 = z.enum(['own', 'lead_time', 'unknown', 'inputs', 'both']);
export const SmBandSchema = z.enum(['slight', 'moderate', 'severe']);
export const SmTraceRoleSchema = z.enum(['binding', 'inherited']);

export const SmSubtierNodeSchema = z.object({
  alias: z.string().min(1).max(4),
  tier: z.number().int().min(2).max(8),
  country: z.string().length(2).nullable(),
  class: z.object({ slug: z.string(), label: z.string(), level: z.number().int().min(1), of_levels: z.number().int().min(1) }).nullable(),
  band: SmBandSchema.nullable(),
  observed_below: z.boolean(),
});

export const SmOptionAggregatesSchema = z.object({
  responders: z.number().int().nonnegative(),
  median_lead_time_days: z.number().nonnegative().nullable(),
  utilization: z.object({ low: z.number().int(), moderate: z.number().int(), high: z.number().int(), at_capacity: z.number().int() }),
  countries: z.array(z.string().length(2)),
  classes: z.array(z.string()),
  not_observed: z.number().int().nonnegative(),
});

export const SmTraceSchema = z.object({
  nodes: z.array(z.object({ alias: z.string(), tier: z.number().int(), role: SmTraceRoleSchema, band: SmBandSchema, binds_for: z.number().int().min(1) })),
  edges: z.array(z.object({ parent: z.string(), child: z.string(), band: SmBandSchema })),
  gaps: z.array(z.object({ at: z.string(), status: SmCandidateStatusSchema })),
});

export const SmCandidateResultSchema2 = SmCandidateResultSchema.omit({ status: true, limit: true }).extend({
  status: SmCandidateLiveStatusSchema2,
  limit: SmOptionLimitSchema2.nullable(),
  candidate_key: z.string().optional(),
  observed_below: z.boolean().optional(),
  aggregates: SmOptionAggregatesSchema.nullable().optional(),
  nodes: z.array(SmSubtierNodeSchema).optional(),
  trace: SmTraceSchema.nullable().optional(),
  unobserved_from_tier: z.number().int().min(2).nullable().optional(),
});

export const SmSlotResultSchema2 = SmSlotResultSchema.extend({ candidates: z.array(SmCandidateResultSchema2) });

export const SourcingMapExecutionResultSchema2 = SourcingMapExecutionResultSchema.extend({
  slots: z.array(SmSlotResultSchema2),
  shared_exposure: z.array(z.object({ alias: z.string(), tier: z.number().int(), under: z.array(z.string()) })).optional(),
  projection_k: z.number().int().min(1).nullable().optional(),
});

/** G-41/G-52: on the summary and the status frame; the name is null when the waiting responder is below tier 1. */
export const SmWaitingOnSchema = z.object({ responder_name: z.string().nullable(), refill_at: z.string().datetime() });

export const SmExecutionSummarySchema2 = SmExecutionSummarySchema.extend({ status: SmExecutionStatusSchema2, waiting_on: SmWaitingOnSchema.nullable().optional() });

export const SmExecutionDetailSchema2 = z.object({
  execution: SmExecutionSummarySchema2,
  result: SourcingMapExecutionResultSchema2.nullable(),
});

export const SmExecutionStatusResponseSchema2 = SmExecutionStatusResponseSchema.extend({
  status: SmExecutionStatusSchema2,
  changed: z.array(z.object({ slot_index: z.number().int().nonnegative(), candidate_index: z.number().int().nonnegative(), candidate: SmCandidateResultSchema2 })),
  waiting_on: SmWaitingOnSchema.nullable().optional(),
});
