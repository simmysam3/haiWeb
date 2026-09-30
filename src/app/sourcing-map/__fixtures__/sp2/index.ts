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

/** candidate_key → supplier name, as the multitier fixture has them (for tests and the handle panel's names). */
export const CANDIDATE_NAMES: Record<string, string> = {
  leon: 'León Cuero', mekong: 'Mekong Tannery', arno: 'Arno Pelli', flowknit: 'FlowKnit Mills', bowline: 'Bowline Trim', zephyr: 'Zephyr Compounds',
};
