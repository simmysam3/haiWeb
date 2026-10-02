// src/app/sourcing-map/__fixtures__/sp3/index.ts
/**
 * The SP3 fixtures (contract §9), typed. As in sp2/index.ts the JSON modules infer `string` where the protocol has enums,
 * so each is asserted through `unknown`; fixtures.test.ts is where the JSON is validated against the protocol's schemas.
 * `notTracedDetail` is derived from the SP2 multitier fixture rather than stored (ruling C-1), so "only these deltas" holds
 * by construction.
 */
import type {
  SmDemandExceptionListResponse, SmOptionPanel, SmSupplyRisk, SmSupplyRiskListResponse, SmTraversalSetting,
} from '@/lib/sourcing-map/types';
import { multitierDetail, withRealKeys } from '../sp2';
import supplyRisksJson from './supply-risks.json';
import exceptionsLeonJson from './demand-exceptions-leon.json';
import exceptionsVettaJson from './demand-exceptions-vetta.json';
import panelLeonJson from './option-panel-leon.json';
import panelPartialJson from './option-panel-partial.json';
import panelUncoveredJson from './option-panel-uncovered.json';
import settingJson from './traversal-setting.json';

export const supplyRisksList = supplyRisksJson as unknown as SmSupplyRiskListResponse;
export const leonExceptions = exceptionsLeonJson as unknown as SmDemandExceptionListResponse;
export const vettaExceptions = exceptionsVettaJson as unknown as SmDemandExceptionListResponse;
export const leonPanel = panelLeonJson as unknown as SmOptionPanel;
export const partialPanel = panelPartialJson as unknown as SmOptionPanel;
export const uncoveredPanel = panelUncoveredJson as unknown as SmOptionPanel;
export const traversalSetting = settingJson as unknown as SmTraversalSetting;

/** A fresh copy of León's open risk with `over` applied; never the shared fixture object. */
export function riskOf(over: Partial<SmSupplyRisk> = {}): SmSupplyRisk {
  return { ...(JSON.parse(JSON.stringify(supplyRisksList.risks[0])) as SmSupplyRisk), ...over };
}

/**
 * The multitier detail where León is not traced below (spec §13): a deep copy (withRealKeys) with only these deltas.
 * León keeps its weeks; its own answer is the same series. Every shared_exposure entry drops León's key, and an entry
 * left with one key is removed.
 */
function deriveNotTraced() {
  const out = withRealKeys(multitierDetail);
  const leonKey = JSON.stringify([out.result!.slots[0]!.candidates[0]!.supplier_participant_id, out.result!.slots[0]!.candidates[0]!.supplier_sku]);
  const leon = out.result!.slots[0]!.candidates[0]!;
  leon.not_traced_below = true;
  leon.observed_below = false;
  leon.unobserved_from_tier = 2;
  leon.nodes = [];
  leon.trace = null;
  leon.aggregates = null;
  leon.limit = 'own';
  out.result!.shared_exposure = (out.result!.shared_exposure ?? [])
    .map((e) => ({ ...e, under: e.under.filter((k) => k !== leonKey) }))
    .filter((e) => e.under.length > 1);
  return out;
}
export const notTracedDetail = deriveNotTraced();
