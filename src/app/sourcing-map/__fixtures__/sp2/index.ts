// src/app/sourcing-map/__fixtures__/sp2/index.ts
/**
 * The SP2-0 fixtures (contract §10), typed. The JSON modules infer `string` where the protocol has enums, so each is
 * asserted through `unknown` to its contract shape; fixtures.test.ts is where the JSON is actually validated (zod).
 */
import type { SmEstimateResponse } from '@haiwave/protocol';
import type { SmExecutionDetail2, SmExecutionStatusResponse2 } from '@/lib/sourcing-map/types';
import multitierJson from './execution-multitier.json';
import throttledJson from './execution-throttled.json';
import estimateJson from './estimate-may-wait.json';

export const multitierDetail = multitierJson as unknown as SmExecutionDetail2;
export const throttledDetail = throttledJson.detail as unknown as SmExecutionDetail2;
export const throttledStatus = throttledJson.status as unknown as SmExecutionStatusResponse2;
export const mayWaitEstimate = estimateJson as unknown as SmEstimateResponse;

/**
 * The detail with every candidate key in its real wire shape: SP2-a's planner serves `candidate_key` as
 * JSON.stringify([supplier_participant_id, supplier_sku]) (slots.ts:148), which carries `"`, `[` and `,`. The fixture's
 * slugs (`leon`) are rewritten consistently wherever a key appears: candidate_key, shared_exposure[].under, and a trace's
 * edge parent or child and gap `at` when it names a key (an alias is never one). A deep copy; the input is untouched.
 */
export function withRealKeys(detail: SmExecutionDetail2): SmExecutionDetail2 {
  const out = JSON.parse(JSON.stringify(detail)) as SmExecutionDetail2;
  if (!out.result) return out;
  const real = new Map<string, string>();
  for (const s of out.result.slots) for (const c of s.candidates) {
    if (c.candidate_key) real.set(c.candidate_key, JSON.stringify([c.supplier_participant_id, c.supplier_sku]));
  }
  const map = (k: string) => real.get(k) ?? k;
  for (const s of out.result.slots) for (const c of s.candidates) {
    if (c.candidate_key) c.candidate_key = map(c.candidate_key);
    if (c.trace) {
      for (const e of c.trace.edges) {
        e.parent = map(e.parent);
        e.child = map(e.child);
      }
      for (const g of c.trace.gaps) g.at = map(g.at);
    }
  }
  for (const e of out.result.shared_exposure ?? []) e.under = e.under.map(map);
  return out;
}

/** candidate_key → supplier name, as the multitier fixture has them (for tests and the handle panel's names). */
export const CANDIDATE_NAMES: Record<string, string> = {
  leon: 'León Cuero', mekong: 'Mekong Tannery', arno: 'Arno Pelli', flowknit: 'FlowKnit Mills', bowline: 'Bowline Trim', zephyr: 'Zephyr Compounds',
};
