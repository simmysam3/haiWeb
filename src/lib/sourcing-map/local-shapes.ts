// src/lib/sourcing-map/local-shapes.ts — shapes 3.93.0 does not carry (contract gap d-G1; BFF-local AD-3).
import { z } from 'zod';
import { SourcingMapScopeSchema, type Cadence, type RunTemplate, type SourcingMapScope } from '@haiwave/protocol';

/** d-G1 (contract §3.8): the protocol's run-template branch; its schema object is not exported. */
export type SmRunTemplate = Extract<RunTemplate, { observation_class: 'sourcing_map' }>;

/** BFF-local create body; scope is validated with the protocol schema, never composed into this one. */
export const CreateSmRunBodySchema = z.object({
  template_name: z.string().min(1).max(200),
  scope: z.unknown(),
  cadence: z.custom<Cadence>((v) => typeof v === 'object' && v !== null && typeof (v as { kind?: unknown }).kind === 'string').optional(),
});
export type CreateSmRunBody = { template_name: string; scope: SourcingMapScope; cadence?: Cadence };
export function parseCreateSmRunBody(raw: unknown): { ok: true; data: CreateSmRunBody } | { ok: false; issues: unknown[] } {
  const body = CreateSmRunBodySchema.safeParse(raw);
  if (!body.success) return { ok: false, issues: body.error.issues };
  const scope = SourcingMapScopeSchema.safeParse(body.data.scope);
  if (!scope.success) return { ok: false, issues: scope.error.issues };
  return { ok: true, data: { template_name: body.data.template_name, scope: scope.data, cadence: body.data.cadence } };
}
